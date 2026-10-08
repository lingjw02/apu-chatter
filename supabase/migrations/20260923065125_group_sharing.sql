begin;
create table public.group_content(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,author_id uuid not null references auth.users,
 kind text not null check(kind in('post','reel','story','shared','chat','avatar')),
 caption text not null default '' check(length(caption)<=4000),mime text,bytes bigint not null check(bytes between 0 and 15728640),object_path text unique,
 state text not null default 'reserved' check(state in('reserved','live','deleted','purged')),created_at timestamptz not null default now(),deleted_at timestamptz,
 check((mime is null and bytes=0 and object_path is null) or (mime in('image/jpeg','image/png','image/webp','video/mp4','video/webm') and bytes>0 and object_path is not null))
);
create index content_group_history on public.group_content(group_id,created_at desc,id desc);create index content_author on public.group_content(author_id);
alter table public.group_messages add column content_id uuid references public.group_content on delete set null;
create index messages_content on public.group_messages(content_id);
create table private.media_cleanup(object_path text primary key,bytes bigint not null,created_at timestamptz not null default now());
alter table private.media_cleanup enable row level security;
create function private.queue_removed_media() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.object_path is not null then insert into private.media_cleanup(object_path,bytes) values(old.object_path,old.bytes) on conflict do nothing;end if;return old;end $$;
create trigger queue_removed_media after delete on public.group_content for each row execute function private.queue_removed_media();
revoke all on function private.queue_removed_media() from public,anon,authenticated;
create table public.content_seen(content_id uuid references public.group_content on delete cascade,user_id uuid references auth.users on delete cascade,seen_at timestamptz not null default now(),primary key(content_id,user_id));create index content_seen_user on public.content_seen(user_id);
alter table public.group_content enable row level security;alter table public.content_seen enable row level security;
create policy content_members on public.group_content for select to authenticated using(private.member_of(group_id) and (state='live' or author_id=(select auth.uid()) or private.manages(group_id)));
create policy own_seen on public.content_seen for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.group_content,public.content_seen from anon,authenticated;grant select on public.group_content,public.content_seen to authenticated;
create function public.reserve_media(p_group_id uuid,p_kind text,p_caption text,p_mime text,p_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.group_content;newid uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(74439012);perform 1 from public.groups where id=p_group_id for update;
 if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 if p_kind not in('post','reel','story','shared','chat','avatar') or p_kind is null or p_caption is null or length(p_caption)>4000 or p_bytes is null then raise exception 'INVALID_INPUT';end if;
 if p_mime is null then
  if p_kind<>'post' or length(btrim(p_caption))=0 or p_bytes<>0 then raise exception 'INVALID_INPUT';end if;
 elsif p_mime not in('image/jpeg','image/png','image/webp','video/mp4','video/webm') or p_bytes<=0 or p_bytes>15728640 or (p_mime like 'image/%' and p_bytes>2097152) or (p_kind='reel' and p_mime not like 'video/%') or (p_kind='avatar' and p_mime not like 'image/%') then raise exception 'INVALID_MEDIA';end if;
 if (select coalesce(sum(bytes),0) from public.group_content where group_id=p_group_id)+p_bytes>104857600 then raise exception 'GROUP_STORAGE_FULL';end if;
 if (select coalesce(sum(bytes),0) from public.group_content)+(select coalesce(sum(bytes),0) from private.media_cleanup)+p_bytes>524288000 then raise exception 'STORAGE_FULL';end if;
 if (select count(*) from public.group_content where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMITED';end if;
 insert into public.group_content(id,group_id,author_id,kind,caption,mime,bytes,object_path) values(newid,p_group_id,auth.uid(),p_kind,p_caption,p_mime,p_bytes,case when p_mime is not null then p_group_id::text||'/'||newid::text end) returning * into c;return to_jsonb(c);
end $$;
create function public.publish_media(p_content_id uuid) returns void language plpgsql security definer set search_path='' as $$declare c public.group_content;begin
 select * into c from public.group_content where id=p_content_id;perform 1 from public.groups where id=c.group_id for update;select * into c from public.group_content where id=p_content_id for update;
 if c.id is null or not private.member_of(c.group_id) or c.author_id<>auth.uid() then raise exception 'FORBIDDEN';end if;
 if c.state='live' then return;end if;if c.state<>'reserved' or c.created_at<now()-interval '1 hour' then raise exception 'UPLOAD_EXPIRED';end if;
 if c.object_path is not null and not exists(select 1 from storage.objects where bucket_id='group-media' and name=c.object_path and (metadata->>'size')::bigint=c.bytes and metadata->>'mimetype'=c.mime) then raise exception 'UPLOAD_MISSING';end if;
 update public.group_content set state='live',created_at=now() where id=p_content_id;
 if c.kind='chat' then insert into public.group_messages(group_id,author_id,body,client_id,content_id) values(c.group_id,c.author_id,coalesce(nullif(c.caption,''),'Shared media'),c.id,c.id) on conflict(group_id,author_id,client_id) do nothing;end if;
end $$;
create function public.delete_content(p_content_id uuid) returns text language plpgsql security definer set search_path='' as $$declare c public.group_content;begin
 select * into c from public.group_content where id=p_content_id;perform 1 from public.groups where id=c.group_id for update;select * into c from public.group_content where id=p_content_id for update;
 if c.id is null or not private.member_of(c.group_id) or (c.author_id<>auth.uid() and not private.manages(c.group_id)) then raise exception 'FORBIDDEN';end if;
 update public.group_content set state=case when object_path is null then 'purged' else 'deleted' end,caption='',deleted_at=coalesce(deleted_at,now()) where id=p_content_id;update public.group_messages set body='Message deleted',deleted_at=coalesce(deleted_at,now()) where content_id=p_content_id;return c.object_path;
end $$;
create function public.confirm_media_removed(p_content_id uuid) returns void language plpgsql security definer set search_path='' as $$declare c public.group_content;begin
 perform pg_advisory_xact_lock(74439012);select * into c from public.group_content where id=p_content_id;perform 1 from public.groups where id=c.group_id for update;
 if c.id is null or not private.member_of(c.group_id) or (c.author_id<>auth.uid() and not private.manages(c.group_id)) then raise exception 'FORBIDDEN';end if;
 if c.state<>'deleted' or exists(select 1 from storage.objects where bucket_id='group-media' and name=c.object_path) then raise exception 'OBJECT_STILL_PRESENT';end if;
 update public.group_content set state='purged',bytes=0,mime=null,object_path=null where id=p_content_id;
end $$;
create function public.mark_content_seen(p_content_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.group_content where id=p_content_id and state='live' and private.member_of(group_id)) then raise exception 'FORBIDDEN';end if;
 insert into public.content_seen(content_id,user_id) values(p_content_id,auth.uid()) on conflict do nothing;end $$;
create function private.media_permission(path text,operation text,meta jsonb default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_content c where c.object_path=path and private.member_of(c.group_id) and case operation
 when 'read' then c.state='live' or (c.state='reserved' and c.author_id=auth.uid())
 when 'upload' then c.state='reserved' and c.author_id=auth.uid() and c.created_at>now()-interval '1 hour' and (meta->>'size')::bigint=c.bytes and meta->>'mimetype'=c.mime
 when 'delete' then c.state='deleted' and (c.author_id=auth.uid() or private.manages(c.group_id)) else false end)
$$;
revoke all on function private.media_permission(text,text,jsonb) from public,anon,authenticated;grant execute on function private.media_permission(text,text,jsonb) to authenticated;
revoke all on function public.reserve_media(uuid,text,text,text,bigint),public.publish_media(uuid),public.delete_content(uuid),public.confirm_media_removed(uuid),public.mark_content_seen(uuid) from public,anon,authenticated;
grant execute on function public.reserve_media(uuid,text,text,text,bigint),public.publish_media(uuid),public.delete_content(uuid),public.confirm_media_removed(uuid),public.mark_content_seen(uuid) to authenticated;
do $storage$ begin
 if to_regclass('storage.objects') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('group-media','group-media',false,15728640,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']) on conflict(id) do nothing;
 create policy chatter_media_read on storage.objects for select to authenticated using(bucket_id='group-media' and private.media_permission(name,'read'));
 create policy chatter_media_upload on storage.objects for insert to authenticated with check(bucket_id='group-media' and private.media_permission(name,'upload',metadata));
 create policy chatter_media_delete on storage.objects for delete to authenticated using(bucket_id='group-media' and private.media_permission(name,'delete'));
 end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.group_content;end if;
end $storage$;

create function public.media_cleanup_batch() returns jsonb language plpgsql security definer set search_path='' as $$begin
 update public.group_content set state='deleted',caption='',deleted_at=now() where state='reserved' and created_at<now()-interval '1 hour';
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select object_path from private.media_cleanup union select object_path from public.group_content where state='deleted' and object_path is not null limit 100)x);
end $$;
create function public.finish_media_cleanup(p_path text) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(74439012);
 if exists(select 1 from storage.objects where bucket_id='group-media' and name=p_path) then raise exception 'OBJECT_STILL_PRESENT';end if;
 update public.group_content set state='purged',bytes=0,mime=null,object_path=null where object_path=p_path and state='deleted';
 delete from private.media_cleanup where object_path=p_path;
end $$;
revoke all on function public.media_cleanup_batch(),public.finish_media_cleanup(text) from public,anon,authenticated;
do $grants$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.media_cleanup_batch(),public.finish_media_cleanup(text) to service_role;end if;end $grants$;


create function private.sync_message_media_deletion() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.deleted_at is not null and old.deleted_at is null and new.content_id is not null then
  update public.group_content set state='deleted',caption='',deleted_at=coalesce(deleted_at,now()) where id=new.content_id and state='live';
 end if;return new;
end $$;
create trigger sync_message_media_deletion after update on public.group_messages for each row execute function private.sync_message_media_deletion();
revoke all on function private.sync_message_media_deletion() from public,anon,authenticated;

commit;

