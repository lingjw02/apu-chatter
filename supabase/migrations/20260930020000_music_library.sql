begin;
create table public.music_saved_queues(id uuid primary key,group_id uuid not null references public.groups on delete cascade,created_by uuid references auth.users on delete set null,name text not null check(length(name) between 1 and 80),tracks jsonb not null check(jsonb_typeof(tracks)='array' and jsonb_array_length(tracks) between 1 and 100),created_at timestamptz not null default now());
alter table public.music_saved_queues enable row level security;
create policy music_library_members on public.music_saved_queues for select to authenticated using(private.member_of(group_id));
revoke all on public.music_saved_queues from anon,authenticated;grant select on public.music_saved_queues to authenticated;
create table private.music_imports(id uuid primary key,group_id uuid not null references public.groups on delete cascade,user_id uuid not null references auth.users on delete cascade,created_at timestamptz not null default now());
alter table private.music_imports enable row level security;
create function public.music_library(p_group_id uuid,p_action text,p_name text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare tracks jsonb;begin
 perform private.music_refresh(p_group_id);
 if p_action='save' then
  if exists(select 1 from public.music_saved_queues where id=p_id and group_id=p_group_id and created_by=auth.uid()) then return;end if;
  if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'INVALID_NAME';end if;
  if (select count(*) from public.music_saved_queues where group_id=p_group_id)>=10 then raise exception 'LIBRARY_FULL';end if;
  select jsonb_agg(jsonb_build_object('provider',provider,'kind',kind,'external_id',external_id,'title',title) order by sort_order,id) into tracks from public.music_queue where group_id=p_group_id;
  if tracks is null then raise exception 'QUEUE_EMPTY';end if;
  insert into public.music_saved_queues values(p_id,p_group_id,auth.uid(),btrim(p_name),tracks,now());
 elsif p_action='delete' then
  delete from public.music_saved_queues where id=p_id and group_id=p_group_id and (created_by=auth.uid() or private.manages(p_group_id));if not found then raise exception 'FORBIDDEN';end if;
 else raise exception 'INVALID_ACTION';end if;
end $$;
create function public.load_music_queue(p_group_id uuid,p_saved_id uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare saved public.music_saved_queues;start_at bigint;new_id uuid;item jsonb;begin
 perform private.music_refresh(p_group_id);
 if not exists(select 1 from public.music_listeners where group_id=p_group_id and user_id=auth.uid()) then raise exception 'JOIN_LISTENING_FIRST';end if;
 if exists(select 1 from private.music_imports where id=p_request_id and group_id=p_group_id and user_id=auth.uid()) then return private.music_snapshot(p_group_id);end if;
 select * into saved from public.music_saved_queues where id=p_saved_id and group_id=p_group_id;if not found then raise exception 'NOT_FOUND';end if;
 if (select count(*) from public.music_queue where group_id=p_group_id)+jsonb_array_length(saved.tracks)>100 then raise exception 'QUEUE_FULL';end if;
 delete from private.music_imports where created_at<now()-interval '7 days';
 if (select count(*) from private.music_imports where user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'RATE_LIMITED';end if;
 insert into private.music_imports(id,group_id,user_id) values(p_request_id,p_group_id,auth.uid());
 select coalesce(max(sort_order),0) into start_at from public.music_queue where group_id=p_group_id;
 for item in select value from jsonb_array_elements(saved.tracks) loop
  start_at=start_at+1;insert into public.music_queue(group_id,added_by,provider,kind,external_id,title,sort_order) values(p_group_id,auth.uid(),item->>'provider',item->>'kind',item->>'external_id',item->>'title',start_at) returning id into new_id;
  update public.music_sessions set current_id=new_id,playing=false,playlist_index=0,playlist_video_id=null,position=0,revision=revision+1,updated_at=now() where group_id=p_group_id and current_id is null;
 end loop;
 return private.music_snapshot(p_group_id);
end $$;
revoke all on function public.music_library(uuid,text,text,uuid),public.load_music_queue(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.music_library(uuid,text,text,uuid),public.load_music_queue(uuid,uuid,uuid) to authenticated;
commit;
