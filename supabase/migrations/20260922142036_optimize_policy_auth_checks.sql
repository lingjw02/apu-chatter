begin;
alter policy profile_update on public.profiles
 using(id=(select auth.uid()) and (select private.verified()))
 with check(id=(select auth.uid()));
alter policy electorate_own on public.vote_electorate
 using(user_id=(select auth.uid()) and exists(select 1 from public.kick_votes v where v.id=vote_id and private.member_of(v.group_id)));
alter policy ballots_own on public.vote_ballots
 using(voter_id=(select auth.uid()) and exists(select 1 from public.kick_votes v where v.id=vote_id and private.member_of(v.group_id)));
commit;
