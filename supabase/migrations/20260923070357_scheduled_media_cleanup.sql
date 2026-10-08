begin;
do $setup$ begin
 if exists(select 1 from pg_available_extensions where name='pg_net') then
  create extension if not exists pg_net with schema extensions;
 end if;
end $setup$;
create function private.run_media_cleanup() returns void language plpgsql security definer set search_path='' as $$
declare token text;endpoint text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='chatter_media_cleanup_secret';
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='chatter_functions_url';
 if token is null or endpoint is null then return;end if;
 perform net.http_post(url:=endpoint||'/media-cleanup',headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',token),body:='{}'::jsonb,timeout_milliseconds:=30000);
end $$;
revoke all on function private.run_media_cleanup() from public,anon,authenticated;
do $schedule$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('chatter-media-cleanup','*/15 * * * *','select private.run_media_cleanup()');end if;
end $schedule$;
commit;
