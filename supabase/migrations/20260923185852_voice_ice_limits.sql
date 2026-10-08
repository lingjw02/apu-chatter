begin;
create table private.voice_ice_rate(user_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null,count int not null);
alter table private.voice_ice_rate enable row level security;
create function public.claim_voice_ice(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$declare g uuid;counter int;begin
 select group_id into g from public.voice_members where session_id=p_session_id and user_id=auth.uid() and last_seen>now()-interval '45 seconds';if g is null or not private.member_of(g) then raise exception 'FORBIDDEN';end if;
 insert into private.voice_ice_rate(user_id,window_start,count) values(auth.uid(),now(),1) on conflict(user_id) do update set window_start=case when private.voice_ice_rate.window_start<now()-interval '1 hour' then now() else private.voice_ice_rate.window_start end,count=case when private.voice_ice_rate.window_start<now()-interval '1 hour' then 1 else private.voice_ice_rate.count+1 end returning count into counter;
 if counter>6 then raise exception 'VOICE_RELAY_LIMIT';end if;
end $$;
revoke all on function public.claim_voice_ice(uuid) from public,anon,authenticated;grant execute on function public.claim_voice_ice(uuid) to authenticated;
commit;
