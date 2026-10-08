begin;
create function public.resume_music(p_group_id uuid,p_previous uuid,p_connection uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare current_connection uuid;begin
 perform private.music_refresh(p_group_id);
 if p_previous is null or p_connection is null then raise exception 'INVALID_CONNECTION';end if;
 select connection into current_connection from public.music_listeners where group_id=p_group_id and user_id=auth.uid();
 if current_connection is null then return public.music_action(p_group_id,'join',jsonb_build_object('connection',p_connection));end if;
 if current_connection<>p_previous and current_connection<>p_connection then raise exception 'ALREADY_LISTENING';end if;
 update public.music_listeners set connection=p_connection,last_seen=now() where group_id=p_group_id and user_id=auth.uid();
 return private.music_snapshot(p_group_id);
end $$;
revoke all on function public.resume_music(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.resume_music(uuid,uuid,uuid) to authenticated;
commit;
