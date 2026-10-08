begin;
create table private.activity_days(group_id uuid references public.groups on delete cascade,local_date date,eligible_ids uuid[] not null,primary key(group_id,local_date));
alter table private.activity_days enable row level security;
create function private.snapshot_activity(g uuid) returns void language plpgsql security definer set search_path='' as $$
declare tz text;day date;created date;ids uuid[];
begin
 select timezone,(created_at at time zone timezone)::date into tz,created from public.groups where id=g for update;if tz is null then return;end if;
 day:=(now() at time zone tz)::date;
 if exists(select 1 from private.activity_days where group_id=g and local_date=day) then return;end if;
 select coalesce(array_agg(user_id),'{}'::uuid[]) into ids from public.memberships where group_id=g and (created=day or joined_at<=(day::timestamp at time zone tz));
 insert into private.activity_days values(g,day,ids) on conflict do nothing;
end $$;
create function private.snapshot_on_message() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.snapshot_activity(new.group_id);return new;end $$;
create trigger activity_snapshot before insert on public.group_messages for each row execute function private.snapshot_on_message();
create function private.snapshot_all_activity() returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin for g in select id from public.groups order by id loop perform private.snapshot_activity(g);end loop;end $$;
create function public.group_activity(p_group_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text;day date;week date;ranks jsonb;words jsonb;ids uuid[];responded int;required int;streak int:=0;cursor_day date;qualified boolean;
begin
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 perform private.snapshot_activity(p_group_id);
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 select timezone into tz from public.groups where id=p_group_id;day:=(now() at time zone tz)::date;week:=date_trunc('week',day::timestamp)::date;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.weekly desc,r.total desc,r.name),'[]'::jsonb) into ranks from(
 select m.author_id,coalesce(p.display_name,'Former member') name,count(*) total,count(*) filter(where m.created_at>=(week::timestamp at time zone tz)) weekly
 from public.group_messages m left join public.profiles p on p.id=m.author_id where m.group_id=p_group_id and m.deleted_at is null group by m.author_id,p.display_name)r;
 select coalesce(jsonb_agg(to_jsonb(w) order by w.count desc,w.word),'[]'::jsonb) into words from(
 select word,count(*) count from public.group_messages m cross join lateral regexp_split_to_table(lower(m.body),'[^a-z]+')word
 where m.group_id=p_group_id and m.deleted_at is null and m.created_at>=(week::timestamp at time zone tz) and length(word)>2 and word not in('the','and','you','that','this','with','for','are','was','have','not','but','from','your','just','can','will','its','they','them','our','all','what','when','how','has','had','were','would','could','should','about','there') group by word order by count(*) desc,word limit 12)w;
 select eligible_ids into ids from private.activity_days where group_id=p_group_id and local_date=day;
 required:=greatest(2,ceil(cardinality(ids)*.30)::int);
 select count(distinct author_id) into responded from public.group_messages where group_id=p_group_id and deleted_at is null and author_id=any(ids) and (created_at at time zone tz)::date=day;
 cursor_day:=case when responded>=required then day else day-1 end;
 loop
 select count(distinct m.author_id)>=greatest(2,ceil(cardinality(d.eligible_ids)*.30)::int) into qualified from private.activity_days d left join public.group_messages m on m.group_id=d.group_id and m.author_id=any(d.eligible_ids) and m.deleted_at is null and (m.created_at at time zone tz)::date=d.local_date where d.group_id=p_group_id and d.local_date=cursor_day group by d.eligible_ids;
 exit when qualified is distinct from true;streak:=streak+1;cursor_day:=cursor_day-1;
 end loop;
 return jsonb_build_object('timezone',tz,'week_start',week,'rankings',ranks,'words',words,'streak',streak,'today',jsonb_build_object('date',day,'eligible',cardinality(ids),'responded',responded,'required',required));
end $$;
revoke all on function private.snapshot_activity(uuid),private.snapshot_on_message(),private.snapshot_all_activity(),public.group_activity(uuid) from public,anon,authenticated;
grant execute on function public.group_activity(uuid) to authenticated;
-- Hosted Supabase supports pg_cron; embedded test Postgres may not.
do $schedule$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('chatter-daily-eligibility','* * * * *','select private.snapshot_all_activity()');
  perform cron.schedule('chatter-expired-requests','*/15 * * * *','update public.private_chats set state=''closed'',closed_at=now() where state=''pending'' and expires_at<=now()');
 end if;
end $schedule$;
commit;
