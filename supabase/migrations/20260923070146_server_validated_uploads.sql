begin;
do $$ begin if to_regclass('storage.objects') is not null then drop policy if exists chatter_media_upload on storage.objects;end if;end $$;
commit;
