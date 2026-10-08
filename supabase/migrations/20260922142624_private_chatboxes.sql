begin;
create table public.private_chats(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,
 requester_id uuid not null references auth.users on delete cascade,recipient_id uuid not null references auth.users on delete cascade,
 pair_low uuid generated always as (least(requester_id,recipient_id)) stored,
 pair_high uuid generated always as (greatest(requester_id,recipient_id)) stored,
 state text not null default 'pending' check(state in ('pending','open','closed')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',closed_at timestamptz,
 check(requester_id<>recipient_id)
);
create unique index private_active_pair on public.private_chats(group_id,pair_low,pair_high) where state in ('pending','open');
create index private_recipient on public.private_chats(recipient_id);
create index private_requester on public.private_chats(requester_id);
create table public.private_messages(
 id uuid primary key default gen_random_uuid(),chat_id uuid not null references public.private_chats on delete cascade,
 author_id uuid not null references auth.users on delete cascade,body text not null check(length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),client_id uuid not null,unique(chat_id,author_id,client_id)
);
create index private_history on public.private_messages(chat_id,created_at,id);
create index private_author on public.private_messages(author_id);
create function private.chat_access(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.verified() and exists(select 1 from public.private_chats p where p.id=c and auth.uid() in(p.requester_id,p.recipient_id) and p.state='open' and exists(select 1 from public.memberships where group_id=p.group_id and user_id=p.requester_id) and exists(select 1 from public.memberships where group_id=p.group_id and user_id=p.recipient_id))
$$;
alter table public.private_chats enable row level security;
alter table public.private_messages enable row level security;
create policy private_chats_participants on public.private_chats for select to authenticated using((select auth.uid()) in(requester_id,recipient_id) and private.member_of(group_id));
create policy private_messages_participants on public.private_messages for select to authenticated using(private.chat_access(chat_id));
revoke all on public.private_chats,public.private_messages from anon,authenticated;
grant select on public.private_chats,public.private_messages to authenticated;
create function public.request_private_chat(p_group_id uuid,p_recipient_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER'; end if;
 if p_recipient_id=auth.uid() or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_recipient_id) then raise exception 'INVALID_INPUT'; end if;
 update public.private_chats set state='closed',closed_at=now() where group_id=p_group_id and state='pending' and expires_at<=now();
 select id into c from public.private_chats where group_id=p_group_id and pair_low=least(auth.uid(),p_recipient_id) and pair_high=greatest(auth.uid(),p_recipient_id) and state in('pending','open');
 if c is not null then return c; end if;
 if (select count(*) from public.private_chats where requester_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'RATE_LIMITED'; end if;
 insert into public.private_chats(group_id,requester_id,recipient_id) values(p_group_id,auth.uid(),p_recipient_id) returning id into c;
 return c;
end $$;
create function public.respond_private_chat(p_chat_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare c public.private_chats;
begin
 select * into c from public.private_chats where id=p_chat_id;
 perform 1 from public.groups where id=c.group_id for update;
 select * into c from public.private_chats where id=p_chat_id for update;
 if not private.member_of(c.group_id) or c.recipient_id<>auth.uid() or c.id is null then raise exception 'FORBIDDEN'; end if;
 if c.state<>'pending' or c.expires_at<=now() then raise exception 'CHAT_CLOSED'; end if;
 if not exists(select 1 from public.memberships where group_id=c.group_id and user_id=c.requester_id) then raise exception 'NOT_MEMBER'; end if;
 if p_accept is null then raise exception 'INVALID_INPUT'; end if;
 update public.private_chats set state=case when p_accept then 'open' else 'closed' end,closed_at=case when p_accept then null else now() end where id=p_chat_id;
end $$;
create function public.close_private_chat(p_chat_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.private_chats;
begin
 select * into c from public.private_chats where id=p_chat_id;
 perform 1 from public.groups where id=c.group_id for update;
 select * into c from public.private_chats where id=p_chat_id for update;
 if c.id is null or not private.member_of(c.group_id) or auth.uid() not in(c.requester_id,c.recipient_id) then raise exception 'FORBIDDEN'; end if;
 update public.private_chats set state='closed',closed_at=coalesce(closed_at,now()) where id=p_chat_id;
 delete from public.private_messages where chat_id=p_chat_id;
end $$;
create function public.send_private_message(p_chat_id uuid,p_client_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.private_chats; m uuid;
begin
 select * into c from public.private_chats where id=p_chat_id;
 perform 1 from public.groups where id=c.group_id for update;
 perform 1 from public.private_chats where id=p_chat_id for update;
 if not private.chat_access(p_chat_id) then raise exception 'CHAT_CLOSED'; end if;
 select id into m from public.private_messages where chat_id=p_chat_id and author_id=auth.uid() and client_id=p_client_id;
 if m is not null then return m; end if;
 if (select count(*) from public.private_messages where chat_id=p_chat_id and author_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED'; end if;
 insert into public.private_messages(chat_id,author_id,client_id,body) values(p_chat_id,auth.uid(),p_client_id,btrim(p_body)) returning id into m;
 return m;
end $$;
create function private.close_chats_on_leave() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.private_chats set state='closed',closed_at=now() where group_id=old.group_id and old.user_id in(requester_id,recipient_id) and state in('pending','open');
 delete from public.private_messages m using public.private_chats c where m.chat_id=c.id and c.group_id=old.group_id and old.user_id in(c.requester_id,c.recipient_id);
 return old;
end $$;
create trigger close_private_chats_on_leave after delete on public.memberships for each row execute function private.close_chats_on_leave();
revoke all on function private.chat_access(uuid),private.close_chats_on_leave() from public,anon,authenticated;
grant execute on function private.chat_access(uuid) to authenticated;
revoke all on function public.request_private_chat(uuid,uuid),public.respond_private_chat(uuid,boolean),public.close_private_chat(uuid),public.send_private_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.request_private_chat(uuid,uuid),public.respond_private_chat(uuid,boolean),public.close_private_chat(uuid),public.send_private_message(uuid,uuid,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.private_chats,public.private_messages;
 end if;
end $$;
commit;
