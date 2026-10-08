begin;
create table public.member_blocks(blocker_id uuid references auth.users on delete cascade,blocked_id uuid references auth.users on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create index blocks_target on public.member_blocks(blocked_id);
create table public.member_reports(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,reporter_id uuid not null references auth.users on delete cascade,target_id uuid not null references auth.users on delete cascade,reason text not null check(length(btrim(reason)) between 1 and 1000),created_at timestamptz not null default now(),resolved_at timestamptz);
create index reports_group on public.member_reports(group_id);create index reports_author on public.member_reports(reporter_id);create index reports_target on public.member_reports(target_id);
alter table public.member_blocks enable row level security;alter table public.member_reports enable row level security;
create function private.owns(g uuid) returns boolean language sql stable security definer set search_path='' as $$select private.verified() and exists(select 1 from public.memberships where group_id=g and user_id=auth.uid() and role='owner')$$;
create policy own_blocks on public.member_blocks for select to authenticated using(blocker_id=(select auth.uid()) and (select private.verified()));
create policy visible_reports on public.member_reports for select to authenticated using(private.member_of(group_id) and (reporter_id=(select auth.uid()) or private.owns(group_id)));
revoke all on public.member_blocks,public.member_reports from anon,authenticated;grant select on public.member_blocks,public.member_reports to authenticated;
create function public.set_member_block(p_group_id uuid,p_member_id uuid,p_blocked boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Lock all groups in which this pair has a chat in a stable order before changing it.
 perform 1 from public.groups where id=p_group_id or id in(select group_id from public.private_chats where pair_low=least(auth.uid(),p_member_id) and pair_high=greatest(auth.uid(),p_member_id)) order by id for update;
 if not private.verified() or p_member_id=auth.uid() or p_blocked is null then raise exception 'FORBIDDEN'; end if;
 if not p_blocked then delete from public.member_blocks where blocker_id=auth.uid() and blocked_id=p_member_id;return;end if;
 if not private.member_of(p_group_id) or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_member_id) then raise exception 'NOT_MEMBER';end if;
 insert into public.member_blocks(blocker_id,blocked_id) values(auth.uid(),p_member_id) on conflict do nothing;
 update public.private_chats set state='closed',closed_at=coalesce(closed_at,now()) where pair_low=least(auth.uid(),p_member_id) and pair_high=greatest(auth.uid(),p_member_id) and state in('open','pending');
 delete from public.private_messages m using public.private_chats c where m.chat_id=c.id and c.pair_low=least(auth.uid(),p_member_id) and c.pair_high=greatest(auth.uid(),p_member_id);
end $$;
create function private.reject_blocked_chat() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.member_blocks where (blocker_id=new.requester_id and blocked_id=new.recipient_id) or (blocker_id=new.recipient_id and blocked_id=new.requester_id)) then raise exception 'PRIVATE_CHAT_UNAVAILABLE';end if;return new;end $$;
create trigger reject_blocked_chat before insert on public.private_chats for each row execute function private.reject_blocked_chat();
create function public.report_member(p_group_id uuid,p_target_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare r uuid;begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) or p_target_id=auth.uid() or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_target_id) then raise exception 'FORBIDDEN';end if;
 if (select count(*) from public.member_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMITED';end if;
 insert into public.member_reports(group_id,reporter_id,target_id,reason) values(p_group_id,auth.uid(),p_target_id,btrim(p_reason)) returning id into r;return r;end $$;
create function public.resolve_report(p_report_id uuid) returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin
 select group_id into g from public.member_reports where id=p_report_id;perform 1 from public.groups where id=g for update;
 if not private.owns(g) then raise exception 'FORBIDDEN';end if;update public.member_reports set resolved_at=coalesce(resolved_at,now()) where id=p_report_id;end $$;
create function public.delete_group(p_group_id uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.owns(p_group_id) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.groups where id=p_group_id and name=p_name) then raise exception 'NAME_MISMATCH';end if;
 delete from public.groups where id=p_group_id;end $$;
revoke all on function private.owns(uuid),private.reject_blocked_chat() from public,anon,authenticated;grant execute on function private.owns(uuid) to authenticated;
revoke all on function public.set_member_block(uuid,uuid,boolean),public.report_member(uuid,uuid,text),public.resolve_report(uuid),public.delete_group(uuid,text) from public,anon,authenticated;
grant execute on function public.set_member_block(uuid,uuid,boolean),public.report_member(uuid,uuid,text),public.resolve_report(uuid),public.delete_group(uuid,text) to authenticated;
commit;
