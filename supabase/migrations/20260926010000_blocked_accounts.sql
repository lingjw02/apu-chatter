begin;
-- Block recovery must not depend on retaining membership in a shared group.
-- Reveal only account labels for the caller's own existing block relationships.
create function public.blocked_accounts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.verified() then raise exception 'FORBIDDEN';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'display_name',p.display_name) order by lower(p.display_name),p.id),'[]'::jsonb)
 from public.member_blocks b join public.profiles p on p.id=b.blocked_id where b.blocker_id=auth.uid());
end $$;
revoke all on function public.blocked_accounts() from public,anon,authenticated;
grant execute on function public.blocked_accounts() to authenticated;
commit;
