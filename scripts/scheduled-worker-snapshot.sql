-- Read-only operator evidence. Never return request headers or response text.
begin transaction read only;
with responses as (
 select status_code,timed_out,
 case when status_code>=400 then case
 when content='Cleanup unavailable' then 'media cleanup batch unavailable'
 when content='Avatar cleanup unavailable' then 'avatar cleanup batch unavailable'
 when content='Jobs unavailable' then 'weekly job claim unavailable'
 when content='Unauthorized' then 'worker authorization rejected'
 else 'other response (body withheld)' end else null end as failure_category,
 count(*) as responses,min(created) as first_at,max(created) as last_at,
 count(*) filter(where error_msg is not null) as transport_errors,
 count(*) filter(where case when pg_input_is_valid(content,'jsonb') then content::jsonb ? 'processed' else false end) as weekly_shaped_responses,
 max(created) filter(where case when pg_input_is_valid(content,'jsonb') then content::jsonb ? 'processed' else false end) as last_weekly_response_at,
 count(*) filter(where case when pg_input_is_valid(content,'jsonb') then content::jsonb ? 'removed' else false end) as cleanup_shaped_responses,
 max(created) filter(where case when pg_input_is_valid(content,'jsonb') then content::jsonb ? 'removed' else false end) as last_cleanup_response_at,
 count(*) filter(where case when pg_input_is_valid(content,'jsonb') then content::jsonb ? 'skipped' else false end) as skipped_responses
 from net._http_response where created>now()-interval '6 hours'
 group by status_code,timed_out,failure_category
), schedules as (
 select j.jobname,j.active,j.schedule,r.status,r.start_time,r.end_time
 from cron.job j left join lateral
 (select status,start_time,end_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1) r on true
 where j.jobname like 'chatter-%'
)
select jsonb_build_object('checked_at',now(),'http_responses',coalesce((select jsonb_agg(to_jsonb(r)) from responses r),'[]'::jsonb),'schedules',(select jsonb_agg(to_jsonb(s)) from schedules s)) as worker_snapshot;
rollback;
