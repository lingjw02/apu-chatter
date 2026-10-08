begin;
alter table public.ai_jobs add column topics jsonb not null default '[]' check(jsonb_typeof(topics)='array' and jsonb_array_length(topics)<=5);
create function public.complete_weekly_ai(p_job_id uuid,p_result text,p_sources jsonb,p_partial boolean,p_topics jsonb) returns void language plpgsql security definer set search_path='' as $$
declare g uuid;t jsonb;s jsonb;
begin
 select group_id into g from public.ai_jobs where id=p_job_id and kind='weekly';
 if g is null then raise exception 'INVALID_WEEKLY_JOB';end if;
 perform 1 from public.groups where id=g for update;
 if jsonb_typeof(p_topics) is distinct from 'array' or jsonb_array_length(p_topics)>5 then raise exception 'INVALID_TOPICS';end if;
 for t in select value from jsonb_array_elements(p_topics) loop
  if jsonb_typeof(t->'label') is distinct from 'string' or length(trim(t->>'label')) not between 1 and 80 or jsonb_typeof(t->'sources') is distinct from 'array' or jsonb_array_length(t->'sources') not between 1 and 200 then raise exception 'INVALID_TOPICS';end if;
  for s in select value from jsonb_array_elements(t->'sources') loop
   if jsonb_typeof(s) is distinct from 'string' or not(p_sources @> jsonb_build_array(s)) or not exists(select 1 from public.group_messages where id::text=s#>>'{}' and group_id=g and deleted_at is null) then raise exception 'INVALID_TOPIC_SOURCE';end if;
  end loop;
 end loop;
 -- Store topics only with the same atomic completion transition as the summary.
 if exists(select 1 from public.ai_jobs where id=p_job_id and state in('pending','running')) and exists(select 1 from public.groups where id=g and ai_enabled) then
  perform public.complete_ai_job(p_job_id,'done',p_result,p_sources,p_partial);
  update public.ai_jobs set topics=p_topics where id=p_job_id and state='done';
 end if;
end $$;
create function public.group_weekly_topics(p_group_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_jobs;visible jsonb;
begin
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 select * into j from public.ai_jobs where group_id=p_group_id and kind='weekly' and state='done' order by week_start desc limit 1;
 if j.id is null then return null;end if;
 select coalesce(jsonb_agg(t.value order by jsonb_array_length(t.value->'sources') desc,t.ordinality),'[]') into visible
 from jsonb_array_elements(j.topics) with ordinality t(value,ordinality)
 where not exists(select 1 from jsonb_array_elements_text(t.value->'sources') s(id) where not exists(select 1 from public.group_messages m where m.id::text=s.id and m.group_id=p_group_id and m.deleted_at is null));
 return jsonb_build_object('week_start',j.week_start,'partial',j.partial,'topics',visible);
end $$;
revoke all on function public.complete_weekly_ai(uuid,text,jsonb,boolean,jsonb),public.group_weekly_topics(uuid) from public,anon,authenticated;
grant execute on function public.group_weekly_topics(uuid) to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.complete_weekly_ai(uuid,text,jsonb,boolean,jsonb) to service_role;end if;end $$;
commit;
