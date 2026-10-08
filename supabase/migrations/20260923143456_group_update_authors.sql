begin;
create function public.group_update_authors(p_group_id uuid)
returns table(author_id uuid,unread boolean)
language sql stable security invoker set search_path='' as $$
 select c.author_id,bool_or(s.content_id is null)
 from public.group_content c
 left join public.content_seen s on s.content_id=c.id and s.user_id=(select auth.uid())
 where c.group_id=p_group_id and c.state='live' and c.kind in ('post','reel','story')
 and (c.kind<>'story' or c.created_at>now()-interval '24 hours')
 group by c.author_id;
$$;
revoke all on function public.group_update_authors(uuid) from public,anon;
grant execute on function public.group_update_authors(uuid) to authenticated;
create index group_content_author_updates on public.group_content(group_id,author_id,created_at desc) where state='live' and kind in ('post','reel','story');
commit;
