begin;
alter table public.group_bans add column removed_role text not null default 'member' check(removed_role in ('admin','member'));
alter table public.group_bans add column display_name text not null default 'Former member';
create table public.kick_votes(
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups on delete cascade,
 target_id uuid not null references auth.users, target_name text not null, target_role text not null check(target_role in ('admin','member')),
 started_by uuid not null references auth.users, status text not null default 'open' check(status in ('open','passed','failed','cancelled')),
 threshold integer not null check(threshold>0), eligible_count integer not null check(eligible_count>=threshold),
 kick_count integer not null default 0,keep_count integer not null default 0,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours'
);
create unique index one_open_vote on public.kick_votes(group_id,target_id) where status='open';
create table public.vote_electorate(vote_id uuid references public.kick_votes on delete cascade,user_id uuid references auth.users,primary key(vote_id,user_id));
create table public.vote_ballots(vote_id uuid references public.kick_votes on delete cascade,voter_id uuid references auth.users,choice text not null check(choice in ('kick','keep')),primary key(vote_id,voter_id));
create table public.moderation_events(id uuid primary key default gen_random_uuid(),group_id uuid references public.groups on delete cascade,actor_id uuid,action text not null,target_id uuid,created_at timestamptz not null default now());
alter table public.kick_votes enable row level security;
alter table public.vote_electorate enable row level security;
alter table public.vote_ballots enable row level security;
alter table public.moderation_events enable row level security;
create policy votes_read on public.kick_votes for select to authenticated using(private.member_of(group_id));
create policy electorate_own on public.vote_electorate for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.kick_votes v where v.id=vote_id and private.member_of(v.group_id)));
create policy ballots_own on public.vote_ballots for select to authenticated using(voter_id=auth.uid() and exists(select 1 from public.kick_votes v where v.id=vote_id and private.member_of(v.group_id)));
create policy events_managers on public.moderation_events for select to authenticated using(private.manages(group_id));
revoke all on public.kick_votes,public.vote_electorate,public.vote_ballots,public.moderation_events from public,anon,authenticated;
grant select on public.kick_votes,public.vote_electorate,public.vote_ballots,public.moderation_events to authenticated;

create function private.cancel_changed_votes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.kick_votes set status='cancelled' where group_id=coalesce(new.group_id,old.group_id) and status='open';
 return coalesce(new,old);
end $$;
create trigger membership_vote_snapshot after insert or delete or update of role on public.memberships for each row execute function private.cancel_changed_votes();

create function private.remove_and_ban(g uuid,u uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare target_role text; target_name text;
begin
 select role into target_role from public.memberships where group_id=g and user_id=u;
 if target_role is null then raise exception 'NOT_MEMBER'; end if;
 if target_role='owner' then raise exception 'OWNER_PROTECTED'; end if;
 select display_name into target_name from public.profiles where id=u;
 insert into public.group_bans(group_id,user_id,removed_role,display_name) values(g,u,target_role,coalesce(target_name,'Former member')) on conflict(group_id,user_id) do update set removed_role=excluded.removed_role,display_name=excluded.display_name,created_at=now();
 delete from public.memberships where group_id=g and user_id=u;
 insert into public.moderation_events(group_id,actor_id,action,target_id) values(g,auth.uid(),reason,u);
end $$;

create function public.set_member_role(p_group_id uuid,p_member_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.verified() or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=auth.uid() and role='owner') then raise exception 'FORBIDDEN'; end if;
 if p_role is null or p_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 if p_member_id=auth.uid() then raise exception 'OWNER_PROTECTED'; end if;
 update public.memberships set role=p_role where group_id=p_group_id and user_id=p_member_id;
 if not found then raise exception 'NOT_MEMBER'; end if;
 insert into public.moderation_events(group_id,actor_id,action,target_id) values(p_group_id,auth.uid(),'role_'||p_role,p_member_id);
end $$;
create function public.remove_member(p_group_id uuid,p_member_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.manages(p_group_id) then raise exception 'FORBIDDEN'; end if;
 select role into actor_role from public.memberships where group_id=p_group_id and user_id=auth.uid();
 select role into target_role from public.memberships where group_id=p_group_id and user_id=p_member_id;
 if p_member_id=auth.uid() or target_role='owner' or (target_role='admin' and actor_role<>'owner') then raise exception 'FORBIDDEN'; end if;
 perform private.remove_and_ban(p_group_id,p_member_id,'direct_removal');
end $$;
create function public.allow_reentry(p_group_id uuid,p_member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.manages(p_group_id) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.group_bans where group_id=p_group_id and user_id=p_member_id and removed_role='admin') and not exists(select 1 from public.memberships where group_id=p_group_id and user_id=auth.uid() and role='owner') then raise exception 'OWNER_REQUIRED'; end if;
 delete from public.group_bans where group_id=p_group_id and user_id=p_member_id;
 insert into public.moderation_events(group_id,actor_id,action,target_id) values(p_group_id,auth.uid(),'reentry_allowed',p_member_id);
end $$;
create function public.transfer_ownership(p_group_id uuid,p_member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.verified() or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=auth.uid() and role='owner') then raise exception 'FORBIDDEN'; end if;
 if p_member_id=auth.uid() or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_member_id) then raise exception 'INVALID_TARGET'; end if;
 update public.memberships set role='admin' where group_id=p_group_id and user_id=auth.uid();
 update public.memberships set role='owner' where group_id=p_group_id and user_id=p_member_id;
 insert into public.moderation_events(group_id,actor_id,action,target_id) values(p_group_id,auth.uid(),'ownership_transferred',p_member_id);
end $$;
create function public.leave_group(p_group_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER'; end if;
 if exists(select 1 from public.memberships where group_id=p_group_id and user_id=auth.uid() and role='owner') then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 delete from public.memberships where group_id=p_group_id and user_id=auth.uid();
 insert into public.moderation_events(group_id,actor_id,action,target_id) values(p_group_id,auth.uid(),'left',auth.uid());
end $$;
create function public.start_kick_vote(p_group_id uuid,p_target_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare target_role text; target_name text; electorate integer; vote uuid;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER'; end if;
 select m.role,p.display_name into target_role,target_name from public.memberships m join public.profiles p on m.user_id=p.id where m.group_id=p_group_id and m.user_id=p_target_id;
 if target_role is null or target_role='owner' or p_target_id=auth.uid() then raise exception 'INVALID_TARGET'; end if;
 update public.kick_votes set status='failed' where group_id=p_group_id and status='open' and expires_at<=now();
 if exists(select 1 from public.kick_votes where group_id=p_group_id and target_id=p_target_id and status='failed' and expires_at>now()-interval '7 days') then raise exception 'VOTE_COOLDOWN'; end if;
 if exists(select 1 from public.kick_votes where group_id=p_group_id and target_id=p_target_id and status='open') then raise exception 'VOTE_ALREADY_OPEN'; end if;
 select count(*) into electorate from public.memberships where group_id=p_group_id and user_id<>p_target_id;
 insert into public.kick_votes(group_id,target_id,target_name,target_role,started_by,threshold,eligible_count) values(p_group_id,p_target_id,target_name,target_role,auth.uid(),case when target_role='admin' then electorate else ceil(electorate/2.0)::int end,electorate) returning id into vote;
 insert into public.vote_electorate(vote_id,user_id) select vote,user_id from public.memberships where group_id=p_group_id and user_id<>p_target_id;
 return vote;
end $$;
create function public.cast_kick_vote(p_vote_id uuid,p_choice text) returns void language plpgsql security definer set search_path='' as $$
declare v public.kick_votes; g uuid; previous text;
begin
 select group_id into g from public.kick_votes where id=p_vote_id;
 perform 1 from public.groups where id=g for update;
 if not private.member_of(g) then raise exception 'NOT_MEMBER'; end if;
 select * into v from public.kick_votes where id=p_vote_id for update;
 if v.status<>'open' or v.expires_at<=now() then raise exception 'VOTE_CLOSED'; end if;
 if p_choice is null or p_choice not in ('kick','keep') then raise exception 'INVALID_CHOICE'; end if;
 if not exists(select 1 from public.vote_electorate where vote_id=p_vote_id and user_id=auth.uid()) then raise exception 'NOT_ELIGIBLE'; end if;
 select choice into previous from public.vote_ballots where vote_id=p_vote_id and voter_id=auth.uid();
 if previous is not null then
  if previous=p_choice then return; else raise exception 'ALREADY_VOTED'; end if;
 end if;
 insert into public.vote_ballots(vote_id,voter_id,choice) values(p_vote_id,auth.uid(),p_choice);
 update public.kick_votes set kick_count=kick_count+case when p_choice='kick' then 1 else 0 end,keep_count=keep_count+case when p_choice='keep' then 1 else 0 end where id=p_vote_id returning * into v;
 if v.kick_count>=v.threshold then
  update public.kick_votes set status='passed' where id=p_vote_id;
  perform private.remove_and_ban(g,v.target_id,'vote_removal');
 end if;
end $$;

revoke all on function private.cancel_changed_votes(),private.remove_and_ban(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.set_member_role(uuid,uuid,text),public.remove_member(uuid,uuid),public.allow_reentry(uuid,uuid),public.transfer_ownership(uuid,uuid),public.leave_group(uuid),public.start_kick_vote(uuid,uuid),public.cast_kick_vote(uuid,text) from public,anon,authenticated;
grant execute on function public.set_member_role(uuid,uuid,text),public.remove_member(uuid,uuid),public.allow_reentry(uuid,uuid),public.transfer_ownership(uuid,uuid),public.leave_group(uuid),public.start_kick_vote(uuid,uuid),public.cast_kick_vote(uuid,text) to authenticated;
commit;
