begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(btrim(display_name)) between 1 and 40),
 bio text not null default '' check (length(bio)<=160),
 status text not null default '' check (length(status)<=80)
);
create table public.groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=500),
 timezone text not null default 'UTC',
 created_at timestamptz not null default now()
);
create table public.memberships (
 group_id uuid references public.groups on delete cascade,
 user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','admin','member')),
 joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create unique index group_single_owner on public.memberships(group_id) where role='owner';
create index memberships_user on public.memberships(user_id);
create table public.group_invites (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups on delete cascade,
 token_hash text not null unique, created_by uuid not null references auth.users,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create table public.group_bans (
 group_id uuid references public.groups on delete cascade, user_id uuid references auth.users on delete cascade,
 created_at timestamptz not null default now(), primary key(group_id,user_id)
);
create table public.group_messages (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups on delete cascade,
 author_id uuid not null references auth.users, body text not null check(length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(), client_id uuid not null,
 unique(group_id,author_id,client_id)
);
create index messages_history on public.group_messages(group_id,created_at desc,id desc);

create function private.verified() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
$$;
create function private.member_of(g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.verified() and exists(select 1 from public.memberships where group_id=g and user_id=auth.uid())
$$;
create function private.manages(g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.verified() and exists(select 1 from public.memberships where group_id=g and user_id=auth.uid() and role in ('owner','admin'))
$$;
create function private.can_see_profile(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u=auth.uid() or (private.verified() and exists(select 1 from public.memberships mine join public.memberships theirs on mine.group_id=theirs.group_id where mine.user_id=auth.uid() and theirs.user_id=u))
$$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,display_name) values(new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'),40),''),'New member')); return new; end;
$$;
create trigger on_chatter_signup after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id,display_name)
 select id,coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),40),''),'New member') from auth.users
 on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_bans enable row level security;
alter table public.group_messages enable row level security;
create policy profile_read on public.profiles for select to authenticated using(private.can_see_profile(id));
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid() and private.verified()) with check(id=auth.uid());
create policy groups_read on public.groups for select to authenticated using(private.member_of(id));
create policy memberships_read on public.memberships for select to authenticated using(private.member_of(group_id));
create policy messages_read on public.group_messages for select to authenticated using(private.member_of(group_id));
create policy invites_read on public.group_invites for select to authenticated using(private.manages(group_id));
create policy bans_read on public.group_bans for select to authenticated using(private.manages(group_id));

create function public.create_group(p_name text,p_description text default '',p_timezone text default 'UTC') returns uuid language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 if not private.verified() then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.memberships where user_id=auth.uid() and role='owner')>=10 then raise exception 'GROUP_LIMIT'; end if;
 insert into public.groups(name,description,timezone) values(btrim(p_name),p_description,p_timezone) returning id into g;
 insert into public.memberships(group_id,user_id,role) values(g,auth.uid(),'owner');
 return g;
end $$;
create function public.create_invite(p_group_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; invite_id uuid;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.manages(p_group_id) then raise exception 'FORBIDDEN'; end if;
 -- Two independently generated UUIDs provide 244 random bits. Only the hash is stored.
 token:=replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
 update public.group_invites set revoked_at=now() where group_id=p_group_id and revoked_at is null;
 insert into public.group_invites(group_id,token_hash,created_by) values(p_group_id,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid()) returning id into invite_id;
 return jsonb_build_object('invite_id',invite_id,'token',token);
end $$;
create function public.revoke_invite(p_invite_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 select group_id into g from public.group_invites where id=p_invite_id;
 perform 1 from public.groups where id=g for update;
 if not private.manages(g) then raise exception 'FORBIDDEN'; end if;
 update public.group_invites set revoked_at=now() where id=p_invite_id;
end $$;
create function public.join_group(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare g uuid; token_digest text;
begin
 if not private.verified() then raise exception 'FORBIDDEN'; end if;
 if length(p_token)<>64 then raise exception 'INVALID_INVITE'; end if;
 token_digest:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 select group_id into g from public.group_invites where token_hash=token_digest and revoked_at is null;
 if g is null then raise exception 'INVALID_INVITE'; end if;
 perform 1 from public.groups where id=g for update;
 if not exists(select 1 from public.group_invites where token_hash=token_digest and revoked_at is null) then raise exception 'INVITE_REVOKED'; end if;
 if exists(select 1 from public.group_bans where group_id=g and user_id=auth.uid()) then raise exception 'BANNED'; end if;
 insert into public.memberships(group_id,user_id,role) values(g,auth.uid(),'member') on conflict do nothing;
 return g;
end $$;
create function public.send_group_message(p_group_id uuid,p_client_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER'; end if;
 select id into existing from public.group_messages where group_id=p_group_id and author_id=auth.uid() and client_id=p_client_id;
 if existing is not null then return existing; end if;
 if (select count(*) from public.group_messages where group_id=p_group_id and author_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED'; end if;
 insert into public.group_messages(group_id,author_id,client_id,body) values(p_group_id,auth.uid(),p_client_id,btrim(p_body)) returning id into existing;
 return existing;
end $$;

revoke all on public.profiles, public.groups, public.memberships, public.group_invites, public.group_bans, public.group_messages from anon, authenticated;
grant select on public.profiles, public.groups, public.memberships, public.group_messages to authenticated;
grant select(id,group_id,created_by,created_at,revoked_at) on public.group_invites to authenticated;
grant select on public.group_bans to authenticated;
grant update(display_name,bio,status) on public.profiles to authenticated;
revoke all on function private.verified(),private.member_of(uuid),private.manages(uuid),private.can_see_profile(uuid),private.create_profile() from public,anon,authenticated;
grant execute on function private.verified(),private.member_of(uuid),private.manages(uuid),private.can_see_profile(uuid) to authenticated;
revoke all on function public.create_group(text,text,text),public.create_invite(uuid),public.revoke_invite(uuid),public.join_group(text),public.send_group_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_group(text,text,text),public.create_invite(uuid),public.revoke_invite(uuid),public.join_group(text),public.send_group_message(uuid,uuid,text) to authenticated;

-- Supabase provides this publication; embedded database tests do not.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.group_messages;
 end if;
end $$;
commit;
