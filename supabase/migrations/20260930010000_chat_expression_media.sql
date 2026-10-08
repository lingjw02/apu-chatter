begin;
alter table public.group_content drop constraint group_content_check;
alter table public.group_content add constraint group_content_check check(
 (mime is null and bytes=0 and object_path is null) or
 (mime in('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/mp4') and bytes>0 and object_path is not null));
create or replace function public.reserve_media(p_group_id uuid,p_kind text,p_caption text,p_mime text,p_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.group_content;newid uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(74439012);perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 if p_kind not in('post','reel','story','shared','chat','avatar') or p_kind is null or p_caption is null or length(p_caption)>4000 or p_bytes is null then raise exception 'INVALID_INPUT';end if;
 if p_mime is null then
  if p_kind<>'post' or length(btrim(p_caption))=0 or p_bytes<>0 then raise exception 'INVALID_INPUT';end if;
 elsif p_mime not in('image/jpeg','image/png','image/webp','video/mp4','video/webm','image/gif','audio/webm','audio/mp4') or p_bytes<=0 or p_bytes>15728640 or (p_mime like 'image/%' and p_bytes>2097152) or (p_kind='reel' and p_mime not like 'video/%') or (p_kind='avatar' and p_mime not like 'image/%') or (p_mime like 'audio/%' and (p_kind<>'chat' or p_bytes>5242880)) then raise exception 'INVALID_MEDIA';end if;
 if (select coalesce(sum(bytes),0) from public.group_content where group_id=p_group_id)+p_bytes>104857600 then raise exception 'GROUP_STORAGE_FULL';end if;
 if (select coalesce(sum(bytes),0) from public.group_content)+(select coalesce(sum(bytes),0) from private.media_cleanup)+p_bytes>524288000 then raise exception 'STORAGE_FULL';end if;
 if (select count(*) from public.group_content where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMITED';end if;
 insert into public.group_content(id,group_id,author_id,kind,caption,mime,bytes,object_path) values(newid,p_group_id,auth.uid(),p_kind,p_caption,p_mime,p_bytes,case when p_mime is not null then p_group_id::text||'/'||newid::text end) returning * into c;return to_jsonb(c);
end $$;
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/mp4'] where id='group-media';
commit;
