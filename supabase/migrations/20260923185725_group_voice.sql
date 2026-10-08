begin;
create table public.voice_members(session_id uuid primary key,group_id uuid not null,user_id uuid not null,joined_at timestamptz not null default now(),last_seen timestamptz not null default now(),unique(group_id,user_id),foreign key(group_id,user_id) references public.memberships(group_id,user_id) on delete cascade);
create index voice_members_user on public.voice_members(user_id);
create table public.voice_signals(id uuid primary key default gen_random_uuid(),sender_session uuid not null references public.voice_members(session_id) on delete cascade,recipient_session uuid not null references public.voice_members(session_id) on delete cascade,payload jsonb not null check(octet_length(payload::text)<=20000),created_at timestamptz not null default now());
create index voice_signals_recipient on public.voice_signals(recipient_session,created_at);
create index voice_signals_sender on public.voice_signals(sender_session);
create table private.voice_rate(user_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null,count int not null);
alter table private.voice_rate enable row level security;alter table public.voice_members enable row level security;alter table public.voice_signals enable row level security;
create policy voice_members_read on public.voice_members for select to authenticated using(private.member_of(group_id));
create policy voice_signals_read on public.voice_signals for select to authenticated using(exists(select 1 from public.voice_members m where m.session_id=recipient_session and m.user_id=(select auth.uid()) and m.last_seen>now()-interval '45 seconds'));
create policy voice_signals_delete on public.voice_signals for delete to authenticated using(exists(select 1 from public.voice_members m where m.session_id=recipient_session and m.user_id=(select auth.uid())));
revoke all on public.voice_members,public.voice_signals from public,anon,authenticated;grant select on public.voice_members,public.voice_signals to authenticated;grant delete on public.voice_signals to authenticated;
create function public.join_voice(p_group_id uuid,p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.member_of(p_group_id) or p_session_id is null then raise exception 'FORBIDDEN';end if;
 perform 1 from public.groups where id=p_group_id for update;
 delete from public.voice_members where group_id=p_group_id and last_seen<now()-interval '45 seconds';
 if exists(select 1 from public.voice_members where group_id=p_group_id and user_id=auth.uid() and session_id<>p_session_id) then raise exception 'ALREADY_IN_VOICE';end if;
 if exists(select 1 from public.voice_members where session_id=p_session_id) then
  update public.voice_members set last_seen=now() where session_id=p_session_id and user_id=auth.uid() and group_id=p_group_id;if not found then raise exception 'FORBIDDEN';end if;return;
 end if;
 if (select count(*) from public.voice_members where group_id=p_group_id)>=4 then raise exception 'VOICE_FULL';end if;
 insert into public.voice_members(session_id,group_id,user_id) values(p_session_id,p_group_id,auth.uid());
end $$;
create function public.heartbeat_voice(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin
 select group_id into g from public.voice_members where session_id=p_session_id and user_id=auth.uid() and last_seen>now()-interval '45 seconds';if g is null or not private.member_of(g) then raise exception 'VOICE_ENDED';end if;
 perform 1 from public.groups where id=g for update;
 update public.voice_members set last_seen=now() where session_id=p_session_id and user_id=auth.uid();if not found then raise exception 'VOICE_ENDED';end if;
 delete from public.voice_members where group_id=g and last_seen<now()-interval '45 seconds';
 delete from public.voice_signals where created_at<now()-interval '1 minute' and recipient_session in(select session_id from public.voice_members where group_id=g);
end $$;
create function public.leave_voice(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from public.voice_members where session_id=p_session_id and user_id=auth.uid();end $$;
create function public.send_voice_signal(p_sender uuid,p_recipient uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$declare g uuid;counter int;begin
 select group_id into g from public.voice_members where session_id=p_sender and user_id=auth.uid() and last_seen>now()-interval '45 seconds';
 if g is null or not private.member_of(g) or p_sender=p_recipient or not exists(select 1 from public.voice_members where session_id=p_recipient and group_id=g and last_seen>now()-interval '45 seconds') then raise exception 'FORBIDDEN';end if;
 if p_payload is null or octet_length(p_payload::text)>20000 or coalesce(p_payload->>'type','') not in('offer','answer','candidate') then raise exception 'INVALID_SIGNAL';end if;
 insert into private.voice_rate(user_id,window_start,count) values(auth.uid(),now(),1) on conflict(user_id) do update set window_start=case when private.voice_rate.window_start<now()-interval '1 minute' then now() else private.voice_rate.window_start end,count=case when private.voice_rate.window_start<now()-interval '1 minute' then 1 else private.voice_rate.count+1 end returning count into counter;
 if counter>120 then raise exception 'VOICE_RATE_LIMIT';end if;
 if (select count(*) from public.voice_signals where recipient_session=p_recipient)>=200 then raise exception 'SIGNAL_QUEUE_FULL';end if;
 insert into public.voice_signals(sender_session,recipient_session,payload) values(p_sender,p_recipient,p_payload);
end $$;
revoke all on function public.join_voice(uuid,uuid),public.heartbeat_voice(uuid),public.leave_voice(uuid),public.send_voice_signal(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.join_voice(uuid,uuid),public.heartbeat_voice(uuid),public.leave_voice(uuid),public.send_voice_signal(uuid,uuid,jsonb) to authenticated;
commit;
