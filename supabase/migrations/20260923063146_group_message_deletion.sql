begin;
alter table public.group_messages add column deleted_at timestamptz;
create function public.delete_group_message(p_message_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.group_messages;
begin
 select * into m from public.group_messages where id=p_message_id;
 if m.id is null then raise exception 'NOT_FOUND'; end if;
 perform 1 from public.groups where id=m.group_id for update;
 select * into m from public.group_messages where id=p_message_id for update;
 if not private.member_of(m.group_id) or (m.author_id<>auth.uid() and not private.manages(m.group_id)) then raise exception 'FORBIDDEN'; end if;
 -- Retain the retry key, but erase content so a delayed send cannot restore it.
 update public.group_messages set body='Message deleted',deleted_at=coalesce(deleted_at,now()) where id=p_message_id;
end $$;
revoke all on function public.delete_group_message(uuid) from public,anon,authenticated;
grant execute on function public.delete_group_message(uuid) to authenticated;
commit;
