begin;
alter table public.groups add column ai_enabled boolean not null default false;
create table public.ai_jobs(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,requester_id uuid references auth.users on delete set null,kind text not null check(kind in('summary','decisions','notes','weekly')),client_id uuid,week_start date,state text not null default 'pending' check(state in('pending','running','done','failed','skipped')),result text not null default '' check(length(result)<=12000),sources jsonb not null default '[]',partial boolean not null default false,attempts int not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(group_id,requester_id,client_id),unique(group_id,week_start));
create index ai_jobs_actor on public.ai_jobs(requester_id);create index ai_jobs_group on public.ai_jobs(group_id,created_at desc);
alter table public.ai_jobs enable row level security;create policy ai_jobs_members on public.ai_jobs for select to authenticated using(private.member_of(group_id));revoke all on public.ai_jobs from anon,authenticated;grant select on public.ai_jobs to authenticated;
create function public.set_group_ai(p_group_id uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.groups where id=p_group_id for update;if not private.owns(p_group_id) or p_enabled is null then raise exception 'FORBIDDEN';end if;update public.groups set ai_enabled=p_enabled where id=p_group_id;
 if not p_enabled then update public.ai_jobs set state='failed',result='AI was disabled before this job completed.',updated_at=now() where group_id=p_group_id and state in('pending','running');end if;end $$;
create function public.request_ai_job(p_group_id uuid,p_kind text,p_client_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare j uuid;begin
 perform pg_advisory_xact_lock(74439014);perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 if not exists(select 1 from public.groups where id=p_group_id and ai_enabled) then raise exception 'AI_DISABLED';end if;
 if p_kind not in('summary','decisions','notes') or p_kind is null or p_client_id is null then raise exception 'INVALID_INPUT';end if;
 select id into j from public.ai_jobs where group_id=p_group_id and requester_id=auth.uid() and client_id=p_client_id;if j is not null then return j;end if;
 if (select count(*) from public.ai_jobs where requester_id=auth.uid() and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 or(select count(*) from public.ai_jobs where kind<>'weekly' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'AI_LIMIT';end if;
 insert into public.ai_jobs(group_id,requester_id,kind,client_id) values(p_group_id,auth.uid(),p_kind,p_client_id) returning id into j;return j;
end $$;
create function public.claim_ai_job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.ai_jobs;begin
 update public.ai_jobs set state='running',attempts=attempts+1,updated_at=now() where id=p_job_id and state='pending' and exists(select 1 from public.groups where id=group_id and ai_enabled) returning * into j;
 if j.id is null then return null;end if;return to_jsonb(j);end $$;
create function public.complete_ai_job(p_job_id uuid,p_state text,p_result text,p_sources jsonb,p_partial boolean) returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin
 select group_id into g from public.ai_jobs where id=p_job_id;perform 1 from public.groups where id=g for update;
 if p_state not in('done','failed','skipped') or p_state is null or length(p_result)>12000 or jsonb_typeof(p_sources)<>'array' then raise exception 'INVALID_INPUT';end if;
 if not exists(select 1 from public.groups where id=g and ai_enabled) then return;end if;
 update public.ai_jobs set state=p_state,result=p_result,sources=p_sources,partial=p_partial,updated_at=now() where id=p_job_id and state in('pending','running');end $$;
create function public.claim_weekly_ai() returns jsonb language plpgsql security definer set search_path='' as $$declare g record;week date;j uuid;claimed jsonb;answer jsonb:='[]';begin
 perform pg_advisory_xact_lock(74439014);
 -- Reclaim crashed workers, bounded to two total attempts for weekly jobs.
 update public.ai_jobs set state='failed',result='The AI request timed out.',updated_at=now() where state='running' and updated_at<now()-interval '5 minutes';
 for g in select id,timezone from public.groups where ai_enabled order by id loop
 week:=date_trunc('week',now() at time zone g.timezone)::date;
 if (now() at time zone g.timezone)<week::timestamp+interval '9 hours' then continue;end if;
 if not exists(select 1 from public.group_messages where group_id=g.id and deleted_at is null and created_at>=((week-7)::timestamp at time zone g.timezone) and created_at<(week::timestamp at time zone g.timezone)) then continue;end if;
 insert into public.ai_jobs(group_id,kind,week_start) values(g.id,'weekly',week-7) on conflict(group_id,week_start) do nothing;
 update public.ai_jobs set state='pending' where group_id=g.id and week_start=week-7 and state='failed' and attempts<2 and updated_at<now()-interval '1 hour';
 select id into j from public.ai_jobs where group_id=g.id and week_start=week-7 and state='pending';
 if j is not null then claimed:=public.claim_ai_job(j);if claimed is not null then answer:=answer||jsonb_build_array(claimed);end if;end if;
 exit when jsonb_array_length(answer)>=5;
 end loop;return answer;
end $$;
revoke all on function public.set_group_ai(uuid,boolean),public.request_ai_job(uuid,text,uuid),public.claim_ai_job(uuid),public.complete_ai_job(uuid,text,text,jsonb,boolean),public.claim_weekly_ai() from public,anon,authenticated;
grant execute on function public.set_group_ai(uuid,boolean),public.request_ai_job(uuid,text,uuid) to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.claim_ai_job(uuid),public.complete_ai_job(uuid,text,text,jsonb,boolean),public.claim_weekly_ai() to service_role;end if;end $$;
create function public.ai_job_context(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.ai_jobs;tz text;start_time timestamptz;end_time timestamptz;begin
 select * into j from public.ai_jobs where id=p_job_id;select timezone into tz from public.groups where id=j.group_id and ai_enabled;
 if tz is null or j.state<>'running' or(j.requester_id is not null and not exists(select 1 from public.memberships where group_id=j.group_id and user_id=j.requester_id)) then raise exception 'FORBIDDEN';end if;
 start_time:=case when j.kind='weekly' then j.week_start::timestamp at time zone tz else now()-interval '30 days' end;
 end_time:=case when j.kind='weekly' then (j.week_start+7)::timestamp at time zone tz else now() end;
 return(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc),'[]'::jsonb) from(select id,body,created_at from public.group_messages where group_id=j.group_id and deleted_at is null and created_at>=start_time and created_at<end_time order by created_at desc,id desc limit 201)m);
end $$;
revoke all on function public.ai_job_context(uuid) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.ai_job_context(uuid) to service_role;end if;end $$;
create function private.run_weekly_ai() returns void language plpgsql security definer set search_path='' as $$declare token text;endpoint text;begin
 select decrypted_secret into token from vault.decrypted_secrets where name='chatter_media_cleanup_secret';
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='chatter_functions_url';
 if token is null or endpoint is null then return;end if;
 perform net.http_post(url:=endpoint||'/weekly-ai',headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',token),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function private.run_weekly_ai() from public,anon,authenticated;
do $$begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('chatter-weekly-ai','*/15 * * * *','select private.run_weekly_ai()');end if;end $$;
commit;
