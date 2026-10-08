-- Transactional hosted smoke check. No emails or persistent test records.
begin;
select set_config('chatter.test_owner',gen_random_uuid()::text,true);
select set_config('chatter.test_guest',gen_random_uuid()::text,true);
insert into auth.users(id,email_confirmed_at,raw_user_meta_data)
values(current_setting('chatter.test_owner')::uuid,now(),'{"display_name":"Smoke owner"}'),
      (current_setting('chatter.test_guest')::uuid,now(),'{"display_name":"Smoke guest"}');
select set_config('request.jwt.claim.sub',current_setting('chatter.test_owner'),true);
set local role authenticated;
select set_config('chatter.test_group',public.create_group('Rollback smoke test','','Asia/Kuala_Lumpur')::text,true);
select set_config('chatter.test_invite',(public.create_invite(current_setting('chatter.test_group')::uuid)->>'token'),true);
select public.send_group_message(current_setting('chatter.test_group')::uuid,gen_random_uuid(),'Smoke message');
select set_config('request.jwt.claim.sub',current_setting('chatter.test_guest'),true);
do $$ begin
 if exists(select 1 from public.groups where id=current_setting('chatter.test_group')::uuid) then raise exception 'Outsider can read group'; end if;
 if exists(select 1 from public.group_messages where group_id=current_setting('chatter.test_group')::uuid) then raise exception 'Outsider can read messages'; end if;
end $$;
select public.join_group(current_setting('chatter.test_invite'));
do $$ begin
 if (select count(*) from public.group_messages where group_id=current_setting('chatter.test_group')::uuid)<>1 then raise exception 'Member cannot read history'; end if;
end $$;
select set_config('chatter.test_chat',public.request_private_chat(current_setting('chatter.test_group')::uuid,current_setting('chatter.test_owner')::uuid)::text,true);
select set_config('request.jwt.claim.sub',current_setting('chatter.test_owner'),true);
select public.respond_private_chat(current_setting('chatter.test_chat')::uuid,true);
select public.send_private_message(current_setting('chatter.test_chat')::uuid,gen_random_uuid(),'Temporary smoke text');
select set_config('request.jwt.claim.sub',current_setting('chatter.test_guest'),true);
do $$ begin
 if (select count(*) from public.private_messages where chat_id=current_setting('chatter.test_chat')::uuid)<>1 then raise exception 'Private recipient cannot read'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('chatter.test_owner'),true);
select public.delete_group_message(id) from public.group_messages where group_id=current_setting('chatter.test_group')::uuid;
do $$ begin
 if exists(select 1 from public.group_messages where group_id=current_setting('chatter.test_group')::uuid and (deleted_at is null or body<>'Message deleted')) then raise exception 'Group deletion did not erase text'; end if;
end $$;
select public.close_private_chat(current_setting('chatter.test_chat')::uuid);
reset role;
do $$ begin
 if exists(select 1 from public.private_messages where chat_id=current_setting('chatter.test_chat')::uuid) then raise exception 'Private messages not deleted'; end if;
end $$;
rollback;
select 'PASS: hosted creation, invite, message, outsider isolation, joined history, accepted private chat and physical message deletion, group text erasure; all fixtures rolled back' as result;

