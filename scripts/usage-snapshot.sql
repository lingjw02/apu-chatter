-- Operator-only, read-only aggregates. No message bodies, names or object paths.
-- Storage metadata is not the provider's billing ledger; see deployment.md.
begin transaction read only;
select jsonb_build_object(
 'checked_at', now(),
 'database_bytes', pg_database_size(current_database()),
 'group_media_accounted_bytes',
   (select coalesce(sum(bytes),0) from public.group_content)
   +(select coalesce(sum(bytes),0) from private.media_cleanup),
 'largest_group_media_bytes',
   (select coalesce(max(total),0) from
     (select sum(bytes) total from public.group_content group by group_id) groups),
 'avatar_accounted_bytes', (select coalesce(sum(bytes),0) from public.avatar_assets),
 'board_json_bytes', (select coalesce(sum(octet_length(data::text)),0) from public.board_shapes),
 'storage_objects', (select count(*) from storage.objects),
 'storage_metadata_bytes', (select coalesce(sum(case
   when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0)
   from storage.objects),
 'storage_objects_without_size', (select count(*) from storage.objects
   where not coalesce(metadata->>'size' ~ '^[0-9]+$',false)),
 'pending_media_cleanup', (select count(*) from private.media_cleanup)
   +(select count(*) from public.group_content where state='deleted' and object_path is not null),
 'pending_avatar_cleanup', (select count(*) from public.avatar_assets where state='deleted'),
 'oldest_pending_avatar_created_at', (select min(created_at) from public.avatar_assets where state='deleted'),
 'scheduled_jobs', (select coalesce(jsonb_agg(jsonb_build_object(
   'name',j.jobname,'active',j.active,'schedule',j.schedule,
   'last_status',r.status,'last_started_at',r.start_time,'last_ended_at',r.end_time
 )), '[]'::jsonb) from cron.job j left join lateral
   (select status,start_time,end_time from cron.job_run_details
    where jobid=j.jobid order by start_time desc limit 1) r on true
   where j.jobname like 'chatter-%'),
 'egress_billing_usage', 'not measured: check Supabase organization Usage dashboard',
 'realtime_billing_usage', 'not measured: check Supabase organization Usage dashboard'
) as usage_snapshot;
rollback;
