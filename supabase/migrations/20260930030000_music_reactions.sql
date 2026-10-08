begin;
create table public.music_reactions(item_id uuid references public.music_queue on delete cascade,user_id uuid references auth.users on delete cascade,reaction text not null check(reaction in('love','fire','applause')),primary key(item_id,user_id));
alter table public.music_reactions enable row level security;
create policy reaction_read on public.music_reactions for select to authenticated using(exists(select 1 from public.music_queue q where q.id=item_id and private.member_of(q.group_id)));
revoke all on public.music_reactions from anon,authenticated;grant select on public.music_reactions to authenticated;
create function public.set_music_reaction(p_item_id uuid,p_reaction text) returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin
 select group_id into g from public.music_queue where id=p_item_id;if g is null or not private.member_of(g) then raise exception 'FORBIDDEN';end if;
 if p_reaction not in('love','fire','applause') or p_reaction is null then raise exception 'INVALID_REACTION';end if;
 insert into public.music_reactions(item_id,user_id,reaction) values(p_item_id,auth.uid(),p_reaction) on conflict(item_id,user_id) do update set reaction=excluded.reaction;
end $$;
revoke all on function public.set_music_reaction(uuid,text) from public,anon,authenticated;
grant execute on function public.set_music_reaction(uuid,text) to authenticated;
commit;
