begin;
alter table public.ai_jobs drop constraint ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check check(kind in('summary','decisions','notes','weekly','song'));
alter table public.music_queue drop constraint music_queue_provider_check;
alter table public.music_queue add constraint music_queue_provider_check check(provider in('youtube','spotify','apple'));
create or replace function public.request_ai_job(p_group_id uuid,p_kind text,p_client_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare j uuid;begin
 perform pg_advisory_xact_lock(74439014);perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 if not exists(select 1 from public.groups where id=p_group_id and ai_enabled) then raise exception 'AI_DISABLED';end if;
 if p_kind not in('summary','decisions','notes','song') or p_kind is null or p_client_id is null then raise exception 'INVALID_INPUT';end if;
 select id into j from public.ai_jobs where group_id=p_group_id and requester_id=auth.uid() and client_id=p_client_id;if j is not null then return j;end if;
 if (select count(*) from public.ai_jobs where requester_id=auth.uid() and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 or(select count(*) from public.ai_jobs where kind<>'weekly' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'AI_LIMIT';end if;
 insert into public.ai_jobs(group_id,requester_id,kind,client_id) values(p_group_id,auth.uid(),p_kind,p_client_id) returning id into j;return j;
end $$;
create or replace function public.music_action(p_group_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
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
  if provider is null or kind is null or external is null or provider not in('youtube','spotify','apple') or kind not in('track','playlist') or not(case when provider='apple' then kind='track' and external ~ '^(my|us|gb|au|sg|in):[1-9][0-9]{0,15}:[1-9][0-9]{0,15}$' when provider='spotify' then external ~ '^[A-Za-z0-9]{22}$' when kind='track' then external ~ '^[A-Za-z0-9_-]{11}$' else external ~ '^[A-Za-z0-9_-]{10,100}$' end) then raise exception 'INVALID_TRACK';end if;
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
commit;
