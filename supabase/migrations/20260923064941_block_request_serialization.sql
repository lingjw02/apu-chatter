begin;
create or replace function public.set_member_block(p_group_id uuid,p_member_id uuid,p_blocked boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Lock all groups in which this pair has a chat in a stable order before changing it.
 perform 1 from public.groups where id=p_group_id or id in(select group_id from public.private_chats where pair_low=least(auth.uid(),p_member_id) and pair_high=greatest(auth.uid(),p_member_id)) order by id for update;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),p_member_id)::text||greatest(auth.uid(),p_member_id)::text,91));
 if not private.verified() or p_member_id=auth.uid() or p_blocked is null then raise exception 'FORBIDDEN'; end if;
 if not p_blocked then delete from public.member_blocks where blocker_id=auth.uid() and blocked_id=p_member_id;return;end if;
 if not private.member_of(p_group_id) or not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_member_id) then raise exception 'NOT_MEMBER';end if;
 insert into public.member_blocks(blocker_id,blocked_id) values(auth.uid(),p_member_id) on conflict do nothing;
 update public.private_chats set state='closed',closed_at=coalesce(closed_at,now()) where pair_low=least(auth.uid(),p_member_id) and pair_high=greatest(auth.uid(),p_member_id) and state in('open','pending');
 delete from public.private_messages m using public.private_chats c where m.chat_id=c.id and c.pair_low=least(auth.uid(),p_member_id) and c.pair_high=greatest(auth.uid(),p_member_id);
end $$;
create or replace function private.reject_blocked_chat() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(least(new.requester_id,new.recipient_id)::text||greatest(new.requester_id,new.recipient_id)::text,91));
 if exists(select 1 from public.member_blocks where (blocker_id=new.requester_id and blocked_id=new.recipient_id) or (blocker_id=new.recipient_id and blocked_id=new.requester_id)) then raise exception 'PRIVATE_CHAT_UNAVAILABLE';end if;return new;end $$;
commit;

