begin;
alter table public.profiles add column avatar_path text;
create table public.avatar_assets(
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null,
 object_path text not null unique,mime text not null check(mime in('image/jpeg','image/png','image/webp')),
 bytes bigint not null check(bytes between 0 and 262144),state text not null default 'reserved' check(state in('reserved','live','deleted','purged')),
 created_at timestamptz not null default now()
);
create index avatar_assets_owner on public.avatar_assets(user_id,created_at desc);
alter table public.avatar_assets enable row level security;
create policy own_avatar_assets on public.avatar_assets for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.avatar_assets from public,anon,authenticated;grant select on public.avatar_assets to authenticated;
create function public.reserve_avatar(p_mime text,p_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$declare asset public.avatar_assets;begin
 if not private.verified() then raise exception 'FORBIDDEN';end if;
 if p_mime is null or p_mime not in('image/jpeg','image/png','image/webp') or p_bytes is null or p_bytes<=0 or p_bytes>262144 then raise exception 'INVALID_MEDIA';end if;
 perform pg_advisory_xact_lock(74439015);
 if(select count(*) from public.avatar_assets where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'AVATAR_RATE_LIMIT';end if;
 if(select coalesce(sum(bytes),0) from public.avatar_assets)+p_bytes>20971520 then raise exception 'AVATAR_STORAGE_LIMIT';end if;
 update public.avatar_assets set state='deleted' where user_id=auth.uid() and state='reserved';
 insert into public.avatar_assets(user_id,object_path,mime,bytes) values(auth.uid(),auth.uid()::text||'/'||gen_random_uuid()::text,p_mime,p_bytes) returning * into asset;
 return to_jsonb(asset);
end $$;
create function public.publish_avatar(p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare asset public.avatar_assets;begin
 if not private.verified() then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(74439015);
 select * into asset from public.avatar_assets where id=p_id and user_id=auth.uid() and state='reserved' and created_at>now()-interval '1 hour';
 if asset.id is null then raise exception 'AVATAR_UNAVAILABLE';end if;
 if not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=asset.object_path and (metadata->>'size')::bigint=asset.bytes and metadata->>'mimetype'=asset.mime) then raise exception 'UPLOAD_REQUIRED';end if;
 update public.avatar_assets set state='deleted' where user_id=auth.uid() and state='live';
 update public.avatar_assets set state='live' where id=p_id;
 update public.profiles set avatar_path=asset.object_path where id=auth.uid();
end $$;
create function public.remove_avatar() returns void language plpgsql security definer set search_path='' as $$begin
 if not private.verified() then raise exception 'FORBIDDEN';end if;perform pg_advisory_xact_lock(74439015);
 update public.profiles set avatar_path=null where id=auth.uid();update public.avatar_assets set state='deleted' where user_id=auth.uid() and state in('reserved','live');
end $$;
create function public.avatar_cleanup_batch() returns jsonb language plpgsql security definer set search_path='' as $$begin
 update public.avatar_assets set state='deleted' where state in('reserved','live') and (user_id is null or (state='reserved' and created_at<now()-interval '1 hour'));
 return (select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from(select object_path from public.avatar_assets where state='deleted' limit 100)a);
end $$;
create function public.finish_avatar_cleanup(p_path text) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(74439015);
 if exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=p_path) then raise exception 'OBJECT_STILL_PRESENT';end if;
 update public.avatar_assets set state='purged',bytes=0 where object_path=p_path and state='deleted';
end $$;
revoke all on function public.reserve_avatar(text,bigint),public.publish_avatar(uuid),public.remove_avatar(),public.avatar_cleanup_batch(),public.finish_avatar_cleanup(text) from public,anon,authenticated;
grant execute on function public.reserve_avatar(text,bigint),public.publish_avatar(uuid),public.remove_avatar() to authenticated;
do $grants$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.avatar_cleanup_batch(),public.finish_avatar_cleanup(text) to service_role;end if;end $grants$;
do $storage$ begin if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-avatars','profile-avatars',false,262144,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
 create policy avatar_storage_read on storage.objects for select to authenticated using(bucket_id='profile-avatars' and exists(select 1 from public.profiles p where p.avatar_path=name));
end if;end $storage$;
commit;
