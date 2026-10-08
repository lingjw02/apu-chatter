begin;
alter table public.ai_jobs add column range_start timestamptz,add column range_end timestamptz;
create function public.request_ai_job_range(p_group_id uuid,p_kind text,p_client_id uuid,p_start timestamptz,p_end timestamptz) returns uuid language plpgsql security definer set search_path='' as $$declare job uuid;prior public.ai_jobs;begin
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start>=p_end or p_end-p_start>interval '31 days' or p_end>now()+interval '1 minute' then raise exception 'INVALID_AI_RANGE';end if;
 job:=public.request_ai_job(p_group_id,p_kind,p_client_id);
 select * into prior from public.ai_jobs where id=job for update;
 if prior.range_start is not null and (prior.range_start<>p_start or prior.range_end<>p_end or prior.kind<>p_kind) then raise exception 'RETRY_RANGE_CHANGED';end if;
 if prior.range_start is null and prior.state<>'pending' then raise exception 'RETRY_RANGE_CHANGED';end if;
 update public.ai_jobs set range_start=p_start,range_end=p_end where id=job;
 return job;
end $$;
revoke all on function public.request_ai_job_range(uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;grant execute on function public.request_ai_job_range(uuid,text,uuid,timestamptz,timestamptz) to authenticated;
create or replace function public.ai_job_context(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.ai_jobs;tz text;start_time timestamptz;end_time timestamptz;begin
 select * into j from public.ai_jobs where id=p_job_id;select timezone into tz from public.groups where id=j.group_id and ai_enabled;
 if tz is null or j.state<>'running' or(j.requester_id is not null and not exists(select 1 from public.memberships where group_id=j.group_id and user_id=j.requester_id)) then raise exception 'FORBIDDEN';end if;
 start_time:=case when j.kind='weekly' then j.week_start::timestamp at time zone tz else coalesce(j.range_start,j.created_at-interval '30 days') end;
 end_time:=case when j.kind='weekly' then (j.week_start+7)::timestamp at time zone tz else coalesce(j.range_end,j.created_at) end;
 return(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc),'[]'::jsonb) from(select id,body,created_at from public.group_messages where group_id=j.group_id and deleted_at is null and created_at>=start_time and created_at<end_time order by created_at desc,id desc limit 201)m);
end $$;
commit;
