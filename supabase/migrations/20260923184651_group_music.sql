begin;
create table public.music_sessions(group_id uuid primary key references public.groups on delete cascade,host_id uuid references auth.users on delete set null,current_id uuid,playing boolean not null default false,position double precision not null default 0,revision bigint not null default 1,updated_at timestamptz not null default now());
create table public.music_listeners(group_id uuid not null,user_id uuid not null,connection uuid not null,joined_at timestamptz not null default clock_timestamp(),last_seen timestamptz not null default now(),primary key(group_id,user_id),foreign key(group_id,user_id) references public.memberships(group_id,user_id) on delete cascade);
create table public.music_queue(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,added_by uuid references auth.users on delete set null,provider text not null check(provider in('youtube','spotify')),kind text not null check(kind in('track','playlist')),external_id text not null,title text not null check(length(title)<=160),sort_order bigint not null,created_at timestamptz not null default now());
create index music_queue_group on public.music_queue(group_id,sort_order);
create index music_queue_actor on public.music_queue(added_by);
create table public.music_skip_votes(group_id uuid not null,user_id uuid not null,track_id uuid not null references public.music_queue on delete cascade,primary key(group_id,user_id,track_id),foreign key(group_id,user_id) references public.music_listeners(group_id,user_id) on delete cascade);
create table private.music_rate(user_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null,count int not null);
alter table private.music_rate enable row level security;
alter table public.music_sessions enable row level security;alter table public.music_listeners enable row level security;alter table public.music_queue enable row level security;alter table public.music_skip_votes enable row level security;
create policy music_session_members on public.music_sessions for select to authenticated using(private.member_of(group_id));
create policy music_listener_members on public.music_listeners for select to authenticated using(private.member_of(group_id));
create policy music_queue_members on public.music_queue for select to authenticated using(private.member_of(group_id));
create policy music_vote_members on public.music_skip_votes for select to authenticated using(private.member_of(group_id));
revoke all on public.music_sessions,public.music_listeners,public.music_queue,public.music_skip_votes from public,anon,authenticated;
grant select on public.music_sessions,public.music_listeners,public.music_queue,public.music_skip_votes to authenticated;

create function private.music_next(g uuid) returns void language plpgsql security definer set search_path='' as $$declare old_id uuid;next_id uuid;begin
 select current_id into old_id from public.music_sessions where group_id=g;
 delete from public.music_queue where id=old_id;
 select id into next_id from public.music_queue where group_id=g order by sort_order,id limit 1;
 update public.music_sessions set current_id=next_id,playing=playing and next_id is not null,position=0,revision=revision+1,updated_at=now() where group_id=g;
end $$;
create function private.music_refresh(g uuid) returns void language plpgsql security definer set search_path='' as $$declare host uuid;track uuid;begin
 if not private.member_of(g) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.groups where id=g for update;
 delete from public.music_listeners where group_id=g and last_seen<now()-interval '45 seconds';
 if not exists(select 1 from public.music_listeners where group_id=g) then delete from public.music_sessions where group_id=g;delete from public.music_queue where group_id=g;return;end if;
 select host_id,current_id into host,track from public.music_sessions where group_id=g;
 if not exists(select 1 from public.music_listeners where group_id=g and user_id=host) then
  select user_id into host from public.music_listeners where group_id=g order by joined_at,user_id limit 1;
  update public.music_sessions set host_id=host,revision=revision+1 where group_id=g;
 end if;
 if track is not null and (select count(*) from public.music_skip_votes where group_id=g and track_id=track)*2>(select count(*) from public.music_listeners where group_id=g) then perform private.music_next(g);end if;
end $$;
create function private.music_snapshot(g uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object(
 'session',(select to_jsonb(s) from public.music_sessions s where group_id=g),
 'queue',(select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_order,q.id),'[]'::jsonb) from public.music_queue q where group_id=g),
 'listeners',(select coalesce(jsonb_agg(jsonb_build_object('user_id',l.user_id,'name',p.display_name,'joined_at',l.joined_at) order by l.joined_at,l.user_id),'[]'::jsonb) from public.music_listeners l join public.profiles p on p.id=l.user_id where l.group_id=g),
 'votes',(select count(*) from public.music_skip_votes where group_id=g and track_id=(select current_id from public.music_sessions where group_id=g)),
 'voted',exists(select 1 from public.music_skip_votes where group_id=g and user_id=auth.uid() and track_id=(select current_id from public.music_sessions where group_id=g)),
 'server_time',now());$$;
create function public.music_state(p_group_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.music_refresh(p_group_id);return private.music_snapshot(p_group_id);end $$;
create function public.music_action(p_group_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.music_sessions;connection_id uuid;item_id uuid;target uuid;entry public.music_queue;other public.music_queue;new_position double precision;provider text;kind text;external text;counted int;
begin
 perform private.music_refresh(p_group_id);
 insert into private.music_rate(user_id,window_start,count) values(auth.uid(),now(),1) on conflict(user_id) do update set window_start=case when private.music_rate.window_start<now()-interval '1 minute' then now() else private.music_rate.window_start end,count=case when private.music_rate.window_start<now()-interval '1 minute' then 1 else private.music_rate.count+1 end returning count into counted;
 if counted>60 then raise exception 'MUSIC_RATE_LIMIT';end if;
 select * into s from public.music_sessions where group_id=p_group_id;
 if p_action='join' then
  connection_id=(p_payload->>'connection')::uuid;if connection_id is null then raise exception 'INVALID_CONNECTION';end if;
  if exists(select 1 from public.music_listeners where group_id=p_group_id and user_id=auth.uid() and connection<>connection_id) then raise exception 'ALREADY_LISTENING';end if;
  insert into public.music_sessions(group_id,host_id) values(p_group_id,auth.uid()) on conflict do nothing;
  insert into public.music_listeners(group_id,user_id,connection) values(p_group_id,auth.uid(),connection_id) on conflict(group_id,user_id) do update set last_seen=now();
 elsif p_action in('heartbeat','leave') then
  connection_id=(p_payload->>'connection')::uuid;
  if p_action='heartbeat' then
   update public.music_listeners set last_seen=now() where group_id=p_group_id and user_id=auth.uid() and connection=connection_id;if not found then raise exception 'LISTENING_ENDED';end if;
  else delete from public.music_listeners where group_id=p_group_id and user_id=auth.uid() and connection=connection_id;end if;
 elsif p_action='add' then
  if s.group_id is null then raise exception 'JOIN_LISTENING_FIRST';end if;
  if (select count(*) from public.music_queue where group_id=p_group_id)>=100 then raise exception 'QUEUE_FULL';end if;
  provider=p_payload->>'provider';kind=p_payload->>'kind';external=p_payload->>'external_id';
  if provider is null or kind is null or external is null or provider not in('youtube','spotify') or kind not in('track','playlist') or not(case when provider='spotify' then external ~ '^[A-Za-z0-9]{22}$' when kind='track' then external ~ '^[A-Za-z0-9_-]{11}$' else external ~ '^[A-Za-z0-9_-]{10,100}$' end) then raise exception 'INVALID_TRACK';end if;
  insert into public.music_queue(group_id,added_by,provider,kind,external_id,title,sort_order) values(p_group_id,auth.uid(),provider,kind,external,left(coalesce(nullif(btrim(p_payload->>'title'),''),provider||' '||kind),160),(select coalesce(max(sort_order),0)+1 from public.music_queue where group_id=p_group_id)) returning id into item_id;
  if s.current_id is null then update public.music_sessions set current_id=item_id,playing=false,position=0,revision=revision+1,updated_at=now() where group_id=p_group_id;end if;
 elsif p_action='skip' then
  item_id=(p_payload->>'track')::uuid;if item_id is null or item_id is distinct from s.current_id or not exists(select 1 from public.music_listeners where group_id=p_group_id and user_id=auth.uid()) then raise exception 'STALE_TRACK';end if;
  insert into public.music_skip_votes(group_id,user_id,track_id) values(p_group_id,auth.uid(),item_id) on conflict do nothing;
 elsif p_action in('play','pause','seek','next','transfer','move') then
  if s.host_id is distinct from auth.uid() then raise exception 'HOST_ONLY';end if;
  if (p_payload->>'revision')::bigint is distinct from s.revision then raise exception 'STALE_REVISION';end if;
  if p_action='transfer' then
   target=(p_payload->>'user_id')::uuid;if not exists(select 1 from public.music_listeners where group_id=p_group_id and user_id=target) then raise exception 'NOT_LISTENING';end if;
   update public.music_sessions set host_id=target,revision=revision+1 where group_id=p_group_id;
  elsif p_action='move' then
   select * into entry from public.music_queue where id=(p_payload->>'item_id')::uuid and group_id=p_group_id and id<>s.current_id;if entry.id is null or coalesce(p_payload->>'direction','') not in('up','down') then raise exception 'INVALID_TRACK';end if;
   if p_payload->>'direction'='up' then select * into other from public.music_queue where group_id=p_group_id and id<>s.current_id and sort_order<entry.sort_order order by sort_order desc limit 1;
   else select * into other from public.music_queue where group_id=p_group_id and sort_order>entry.sort_order order by sort_order limit 1;end if;
   if other.id is not null then update public.music_queue set sort_order=case when id=entry.id then other.sort_order else entry.sort_order end where id in(entry.id,other.id);update public.music_sessions set revision=revision+1 where group_id=p_group_id;end if;
  elsif p_action='next' then perform private.music_next(p_group_id);
  else
   if s.current_id is null then raise exception 'QUEUE_EMPTY';end if;
   new_position=case when p_action='seek' then (p_payload->>'position')::double precision else s.position+case when s.playing then extract(epoch from now()-s.updated_at) else 0 end end;
   if new_position is null or new_position<0 or new_position>86400 or new_position='NaN'::double precision then raise exception 'INVALID_POSITION';end if;
   update public.music_sessions set position=new_position,playing=case when p_action='play' then true when p_action='pause' then false else playing end,revision=revision+1,updated_at=now() where group_id=p_group_id;
  end if;
 else raise exception 'INVALID_ACTION';end if;
 perform private.music_refresh(p_group_id);return private.music_snapshot(p_group_id);
end $$;
revoke all on function private.music_next(uuid),private.music_refresh(uuid),private.music_snapshot(uuid),public.music_state(uuid),public.music_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.music_state(uuid),public.music_action(uuid,text,jsonb) to authenticated;
commit;
