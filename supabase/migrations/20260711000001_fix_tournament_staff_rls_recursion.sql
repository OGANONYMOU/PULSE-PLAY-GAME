-- Fix 1: eliminate self-referential recursion in tournament_staff_manage.
-- Root cause: the policy joined tournament_staff to itself inside its own USING
-- clause, which Postgres cannot evaluate (42P17 infinite recursion). Every query
-- touching tournament_staff -- and, transitively, fixtures/tournament_fixtures/
-- player_stats/tournament_standings, which all check tournament_staff membership
-- in their own policies -- failed as a result. This broke tournament creation
-- (the client inserts a 'host' row into tournament_staff right after creating a
-- tournament) and the tournament detail page load that follows it.
drop policy if exists "tournament_staff_manage" on public.tournament_staff;

create policy "tournament_staff_manage" on public.tournament_staff
  for all
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_staff.tournament_id
        and t.created_by = auth.uid()
    )
    or exists (
      select 1 from public.tournaments t
      join public.organizers o on o.id = t.organizer_id
      where t.id = tournament_staff.tournament_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.tournaments t
      join public.organizer_members om on om.organizer_id = t.organizer_id
      where t.id = tournament_staff.tournament_id
        and om.user_id = auth.uid()
        and om.can_host_tournaments = true
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN')
    )
    -- Non-recursive: get_tournament_role() is SECURITY DEFINER, so calling it from
    -- this policy does not re-trigger tournament_staff's own RLS evaluation.
    or public.get_tournament_role(auth.uid(), tournament_staff.tournament_id) = 'host'
  )
  with check (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_staff.tournament_id
        and t.created_by = auth.uid()
    )
    or exists (
      select 1 from public.tournaments t
      join public.organizers o on o.id = t.organizer_id
      where t.id = tournament_staff.tournament_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.tournaments t
      join public.organizer_members om on om.organizer_id = t.organizer_id
      where t.id = tournament_staff.tournament_id
        and om.user_id = auth.uid()
        and om.can_host_tournaments = true
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN')
    )
    or public.get_tournament_role(auth.uid(), tournament_staff.tournament_id) = 'host'
  );

-- Fix 2: tourn_write's WITH CHECK had "om.organizer_id = om.organizer_id" (an
-- always-true tautology) instead of "om.organizer_id = tournaments.organizer_id".
-- This let an organizer_member with can_host_tournaments=true for Organizer A
-- create/edit tournaments under ANY organizer_id, not just their own -- a
-- privilege escalation bug.
drop policy if exists "tourn_write" on public.tournaments;

create policy "tourn_write" on public.tournaments
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = ANY (ARRAY['ADMIN','MODERATOR','SUPER_ADMIN'])
    )
    or created_by = auth.uid()
    or (organizer_id is not null and exists (
      select 1 from public.organizers o where o.id = tournaments.organizer_id and o.owner_id = auth.uid()
    ))
    or (organizer_id is not null and exists (
      select 1 from public.organizer_members om
      where om.organizer_id = tournaments.organizer_id and om.user_id = auth.uid() and om.can_host_tournaments = true
    ))
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = ANY (ARRAY['ADMIN','MODERATOR','SUPER_ADMIN'])
    )
    or created_by = auth.uid()
    or (organizer_id is not null and exists (
      select 1 from public.organizers o where o.id = tournaments.organizer_id and o.owner_id = auth.uid()
    ))
    or (organizer_id is not null and exists (
      select 1 from public.organizer_members om
      where om.organizer_id = tournaments.organizer_id and om.user_id = auth.uid() and om.can_host_tournaments = true
    ))
  );
