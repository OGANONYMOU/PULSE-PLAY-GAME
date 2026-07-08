-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay v5 — Tournament Formats: True Group Stage, Group→Knockout pipeline,
-- Swiss stage, and Double Elimination.
--
-- ⚠️ WRITTEN BUT NOT EXECUTED AGAINST A LIVE DATABASE. Apply and test this in a
-- Supabase dev/staging branch (or `supabase db reset` locally) with several
-- participant counts (4, 6, 8, 16, and a non-power-of-2 like 6 or 10) BEFORE
-- relying on it in production — bracket-progression math is notoriously easy to
-- get subtly wrong, and double-elimination in particular has no automated test
-- coverage here. Run in the Supabase SQL Editor AFTER supabase_v4_launch_readiness.sql.
--
-- This migration is purely additive:
--   - New columns are added with safe defaults; existing rows are unaffected.
--   - generate_bracket() and advance_match_winner() (the working single-elimination
--     path) are NOT modified. Single-elimination tournaments behave exactly as
--     before. New formats use new, separate functions.
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA ADDITIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Distinguish winners/losers/grand-finals matches for double elimination.
-- Existing rows default to 'winners', preserving current single-elim semantics
-- (advance_match_winner already treats every match as if it were 'winners').
alter table public.matches
  add column if not exists bracket_type text not null default 'winners'
    check (bracket_type in ('winners', 'losers', 'grand_finals'));

-- Grand-finals-only: has the losers-bracket champion already forced a bracket
-- reset (won game 1 of grand finals, requiring a decider game 2)?
alter table public.matches
  add column if not exists is_bracket_reset boolean not null default false;

-- Double-elimination only: where a WINNERS-bracket match's LOSER goes. Kept
-- separate from next_match_id/next_match_slot (which continues to mean "where
-- the WINNER goes" for both single- and double-elimination) because a winners-
-- bracket match needs to route two different players to two different
-- destinations simultaneously — a single next_match_id pointer can't do both.
alter table public.matches
  add column if not exists loser_next_match_id   uuid null references public.matches(id),
  add column if not exists loser_next_match_slot int  null check (loser_next_match_slot in (1, 2));

-- True sub-groups for group stage (e.g. "Group A", "Group B"). NULL = no group
-- (flat round robin, existing behavior of generate_round_robin_fixtures).
alter table public.tournament_fixtures
  add column if not exists group_name text null;
alter table public.tournament_standings
  add column if not exists group_name text null;

-- Swiss-stage record tracking, one row per participant per tournament.
create table if not exists public.swiss_standings (
  id              uuid        primary key default gen_random_uuid(),
  tournament_id   uuid        not null references public.tournaments(id) on delete cascade,
  participant_id  uuid        not null references public.profiles(id) on delete cascade,
  wins            int         not null default 0,
  losses          int         not null default 0,
  round_reached   int         not null default 0,
  status          text        not null default 'active'
                              check (status in ('active', 'advanced', 'eliminated')),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, participant_id)
);
alter table public.swiss_standings enable row level security;
drop policy if exists "swiss_standings_public" on public.swiss_standings;
create policy "swiss_standings_public" on public.swiss_standings for select using (true);
drop policy if exists "swiss_standings_staff" on public.swiss_standings;
create policy "swiss_standings_staff" on public.swiss_standings for all using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and (
      t.created_by = auth.uid()
      or exists (select 1 from public.tournament_staff ts where ts.tournament_id = t.id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    )
  )
);

-- Swiss pairings live in tournament_fixtures too (round = swiss round number,
-- group_name is unused/null for swiss). This keeps result-reporting and match
-- display code (which already queries tournament_fixtures) working unchanged.

create index if not exists idx_swiss_standings_tournament on public.swiss_standings(tournament_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TRUE GROUP STAGE (multiple groups, round robin within each)
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.generate_group_stage_fixtures(
  p_tournament_id  uuid,
  p_num_groups     int default 2,
  p_start_date     timestamptz default now(),
  p_interval_hours int default 24
) returns jsonb language plpgsql security definer as $$
declare
  v_participants    uuid[];
  v_n               int;
  v_group_labels    text[];
  v_group_of        uuid[];      -- v_group_of[i] = group label for participant i (snake-seeded)
  v_groups          jsonb := '{}'::jsonb;
  v_g               int;
  v_i               int;
  v_dir             int;
  v_label           text;
  v_group_members   uuid[];
  v_total_fixtures  int := 0;
  -- per-group round robin working vars (mirrors generate_round_robin_fixtures)
  v_gn              int;
  v_total_rounds    int;
  v_round           int;
  v_match_num       int;
  v_p1              uuid;
  v_p2              uuid;
  v_fixed           uuid;
  v_rotated         uuid[];
  v_temp            uuid;
  v_scheduled_at    timestamptz;
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    or exists (select 1 from public.tournament_staff ts where ts.tournament_id = p_tournament_id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
  ) then
    raise exception 'Not authorized to generate group stage';
  end if;

  if p_num_groups < 2 then
    raise exception 'Need at least 2 groups (got %)', p_num_groups;
  end if;

  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id and status in ('joined', 'checked_in');

  v_n := coalesce(array_length(v_participants, 1), 0);
  if v_n < p_num_groups * 2 then
    raise exception 'Need at least % participants for % groups (got %)', p_num_groups * 2, p_num_groups, v_n;
  end if;

  delete from public.tournament_fixtures where tournament_id = p_tournament_id;
  delete from public.tournament_standings where tournament_id = p_tournament_id;

  -- Group labels: A, B, C, ...
  v_group_labels := array[]::text[];
  for v_g in 1..p_num_groups loop
    v_group_labels := v_group_labels || chr(64 + v_g); -- 65 = 'A'
  end loop;

  -- Snake seed: 1->A,2->B,...,G->last group, then reverse: G+1->last,...,2G->A, repeat.
  -- This balances seed strength across groups instead of stacking top seeds together.
  v_group_of := array[]::uuid[];
  v_dir := 1;
  v_g := 1;
  for v_i in 1..v_n loop
    v_label := v_group_labels[v_g];
    -- Stash assignment via a temp jsonb map: group_label -> array of participant uuids
    v_groups := jsonb_set(
      v_groups,
      array[v_label],
      coalesce(v_groups -> v_label, '[]'::jsonb) || to_jsonb(v_participants[v_i]::text)
    );
    if v_dir = 1 then
      if v_g = p_num_groups then v_dir := -1; else v_g := v_g + 1; end if;
    else
      if v_g = 1 then v_dir := 1; else v_g := v_g - 1; end if;
    end if;
  end loop;

  -- For each group: round-robin within the group (same circle method as
  -- generate_round_robin_fixtures), tagged with group_name.
  for v_g in 1..p_num_groups loop
    v_label := v_group_labels[v_g];
    select array_agg(elem::uuid) into v_group_members
    from jsonb_array_elements_text(v_groups -> v_label) as elem;

    v_gn := array_length(v_group_members, 1);
    if v_gn < 2 then continue; end if;

    if v_gn % 2 = 1 then
      v_group_members := v_group_members || array[null::uuid];
      v_gn := v_gn + 1;
    end if;

    v_total_rounds := v_gn - 1;
    v_fixed        := v_group_members[1];
    v_rotated      := v_group_members[2:v_gn];
    v_match_num    := 1;

    for v_round in 1..v_total_rounds loop
      v_scheduled_at := p_start_date + ((v_round - 1) * p_interval_hours) * interval '1 hour';

      v_p1 := v_fixed;
      v_p2 := v_rotated[array_length(v_rotated, 1)];
      if v_p1 is not null and v_p2 is not null then
        insert into public.tournament_fixtures(
          tournament_id, round, match_number, group_name,
          home_participant_id, away_participant_id, status, scheduled_at
        ) values (
          p_tournament_id, v_round, v_match_num, v_label,
          v_p1, v_p2, 'scheduled', v_scheduled_at
        );
        v_match_num := v_match_num + 1;
        v_total_fixtures := v_total_fixtures + 1;
      end if;

      for v_i in 1..(v_gn / 2 - 1) loop
        v_p1 := v_rotated[v_i];
        v_p2 := v_rotated[v_gn - 1 - v_i];
        if v_p1 is not null and v_p2 is not null then
          insert into public.tournament_fixtures(
            tournament_id, round, match_number, group_name,
            home_participant_id, away_participant_id, status, scheduled_at
          ) values (
            p_tournament_id, v_round, v_match_num, v_label,
            v_p1, v_p2, 'scheduled', v_scheduled_at
          );
          v_match_num := v_match_num + 1;
          v_total_fixtures := v_total_fixtures + 1;
        end if;
      end loop;

      v_temp := v_rotated[1];
      for v_i in 1..(array_length(v_rotated, 1) - 1) loop
        v_rotated[v_i] := v_rotated[v_i + 1];
      end loop;
      v_rotated[array_length(v_rotated, 1)] := v_temp;
    end loop;

    -- Seed standings for this group's real (non-BYE) participants
    for v_i in 1..array_length(v_group_members, 1) loop
      if v_group_members[v_i] is not null then
        insert into public.tournament_standings(
          tournament_id, participant_id, group_name, played, won, drawn, lost,
          goals_for, goals_against, points
        ) values (
          p_tournament_id, v_group_members[v_i], v_label, 0, 0, 0, 0, 0, 0, 0
        ) on conflict (tournament_id, participant_id) do update set group_name = excluded.group_name;
      end if;
    end loop;
  end loop;

  -- Deliberately does NOT touch tournament_type: it may be 'group_stage'
  -- (groups only, no follow-up) or 'group_knockout' (two-phase — the caller
  -- still needs to know a knockout phase should follow group play).
  update public.tournaments set
    fixtures_generated = true,
    fixtures_count = v_total_fixtures
  where id = p_tournament_id;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket',
    'Group stage generated — ' || p_num_groups || ' groups, ' || v_total_fixtures || ' matches.', null);

  return jsonb_build_object('groups', p_num_groups, 'fixtures_created', v_total_fixtures, 'participants', v_n);
end;
$$;

grant execute on function public.generate_group_stage_fixtures(uuid, int, timestamptz, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. GROUP STAGE → KNOCKOUT ("Copa style": group table feeds a knockout bracket)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Cross-seeds the top N finishers of each group into a knockout bracket, using
-- the same round/match construction as generate_bracket(). Reuses
-- tournament_rounds + matches (bracket_type = 'winners') so the existing
-- FootballBracket.tsx renderer and advance_match_winner() work unchanged —
-- from the knockout stage's perspective this is just a single-elimination
-- bracket whose seed order happens to come from group results instead of
-- raw registration order.
create or replace function public.generate_knockout_from_groups(
  p_tournament_id     uuid,
  p_advance_per_group int default 2
) returns jsonb language plpgsql security definer as $$
declare
  v_groups          text[];
  v_seeded          uuid[] := array[]::uuid[];
  v_group_ranked    uuid[][];  -- v_group_ranked[g] = ordered array of participant uuids for group g, best first
  v_g               int;
  v_slot            int;
  v_count           int;
  v_bracket_size    int;
  v_rounds          int;
  v_round_id        uuid;
  v_match_id        uuid;
  v_round_num       int;
  v_matches_this_round int;
  v_p1              uuid;
  v_p2              uuid;
  v_round_name      text;
  v_match_num       int := 1;
  v_prev_round_matches uuid[];
  v_curr_round_matches uuid[];
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    or exists (select 1 from public.tournament_staff ts where ts.tournament_id = p_tournament_id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
  ) then
    raise exception 'Not authorized to generate knockout stage';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament_id and bracket_generated = true) then
    raise exception 'Knockout bracket already generated for this tournament';
  end if;

  select array_agg(distinct group_name order by group_name) into v_groups
  from public.tournament_standings
  where tournament_id = p_tournament_id and group_name is not null;

  if v_groups is null or array_length(v_groups, 1) < 2 then
    raise exception 'Need at least 2 completed groups with standings to generate a knockout stage';
  end if;

  -- Rank each group by points desc, goal_difference desc, goals_for desc — same
  -- tie-break order as calculateGroupStandings previously used client-side.
  v_group_ranked := array[]::uuid[][];
  for v_g in 1..array_length(v_groups, 1) loop
    v_group_ranked := v_group_ranked || array[
      (select array_agg(participant_id order by points desc, goal_difference desc, goals_for desc)
       from public.tournament_standings
       where tournament_id = p_tournament_id and group_name = v_groups[v_g])
    ];
  end loop;

  -- Cross-seed: all group winners first (in group order), then all runners-up
  -- (in REVERSE group order), etc. — so a group's 1st-place finisher meets
  -- another group's lower finisher in round 1, not their own group-mate.
  -- e.g. 2 groups, top 2 advance: [1A, 2B, 1B, 2A]
  for v_slot in 1..p_advance_per_group loop
    if v_slot % 2 = 1 then
      for v_g in 1..array_length(v_groups, 1) loop
        if v_group_ranked[v_g][v_slot] is not null then
          v_seeded := v_seeded || v_group_ranked[v_g][v_slot];
        end if;
      end loop;
    else
      for v_g in reverse array_length(v_groups, 1)..1 loop
        if v_group_ranked[v_g][v_slot] is not null then
          v_seeded := v_seeded || v_group_ranked[v_g][v_slot];
        end if;
      end loop;
    end if;
  end loop;

  v_count := array_length(v_seeded, 1);
  if v_count < 2 then
    raise exception 'Not enough qualifiers to build a knockout stage (got %)', v_count;
  end if;

  v_bracket_size := 1;
  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;
  v_rounds := (log(v_bracket_size) / log(2))::int;

  delete from public.tournament_rounds where tournament_id = p_tournament_id;

  v_round_name := case v_rounds when 1 then 'Final' when 2 then 'Semi-Final' when 3 then 'Quarter-Final' else 'Round of ' || v_bracket_size::text end;
  insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
  values (p_tournament_id, 1, v_round_name, v_bracket_size / 2, 'active')
  returning id into v_round_id;

  v_curr_round_matches := '{}';
  v_matches_this_round := v_bracket_size / 2;

  for v_slot in 1..v_matches_this_round loop
    v_p1 := v_seeded[v_slot];
    v_p2 := v_seeded[v_bracket_size + 1 - v_slot];

    if v_p1 is null then continue; end if;

    insert into public.matches(tournament_id, round_id, round, bracket_type, player1_id, player2_id, status, is_bye, match_number)
    values (p_tournament_id, v_round_id, 1, 'winners', v_p1, v_p2,
      case when v_p2 is null then 'verified' else 'scheduled' end, v_p2 is null, v_match_num)
    returning id into v_match_id;

    if v_p2 is null then
      update public.matches set winner_id = v_p1, loser_id = null, completed_at = now() where id = v_match_id;
    end if;

    v_curr_round_matches := v_curr_round_matches || v_match_id;
    v_match_num := v_match_num + 1;
  end loop;

  for v_round_num in 2..v_rounds loop
    v_prev_round_matches := v_curr_round_matches;
    v_curr_round_matches := '{}';
    v_matches_this_round := v_bracket_size / power(2, v_round_num)::int;

    v_round_name := case (v_rounds - v_round_num + 1)
      when 1 then 'Final' when 2 then 'Semi-Final' when 3 then 'Quarter-Final'
      else 'Round of ' || (v_bracket_size / power(2, v_round_num - 1))::int::text
    end;

    insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
    values (p_tournament_id, v_round_num, v_round_name, v_matches_this_round, 'pending')
    returning id into v_round_id;

    for v_slot in 1..v_matches_this_round loop
      insert into public.matches(tournament_id, round_id, round, bracket_type, status, match_number)
      values (p_tournament_id, v_round_id, v_round_num, 'winners', 'scheduled', v_match_num)
      returning id into v_match_id;

      v_curr_round_matches := v_curr_round_matches || v_match_id;
      v_match_num := v_match_num + 1;

      update public.matches set next_match_id = v_match_id, next_match_slot = 1 where id = v_prev_round_matches[(v_slot * 2) - 1];
      update public.matches set next_match_id = v_match_id, next_match_slot = 2 where id = v_prev_round_matches[v_slot * 2];
    end loop;
  end loop;

  update public.tournaments set
    bracket_generated = true,
    bracket_type = 'single_elimination',
    total_rounds = v_rounds,
    current_round = 1
  where id = p_tournament_id;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket',
    'Group stage complete! Knockout bracket generated — top ' || p_advance_per_group || ' from each group advance.', null);

  return jsonb_build_object('rounds', v_rounds, 'qualifiers', v_count, 'bracket_size', v_bracket_size);
end;
$$;

grant execute on function public.generate_knockout_from_groups(uuid, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SWISS STAGE (VCT/CS2-style: win-threshold advance, loss-threshold eliminate)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Round 1: seeded "fold" pairing (top half vs bottom half — seed 1 vs seed N/2+1,
-- seed 2 vs seed N/2+2, etc.), the standard Swiss round-1 pairing.
create or replace function public.generate_swiss_round1(
  p_tournament_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_participants uuid[];
  v_n            int;
  v_half         int;
  v_i            int;
  v_match_num    int := 1;
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    or exists (select 1 from public.tournament_staff ts where ts.tournament_id = p_tournament_id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
  ) then
    raise exception 'Not authorized to generate Swiss stage';
  end if;

  if exists (select 1 from public.swiss_standings where tournament_id = p_tournament_id) then
    raise exception 'Swiss stage already generated for this tournament';
  end if;

  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id and status in ('joined', 'checked_in');

  v_n := coalesce(array_length(v_participants, 1), 0);
  if v_n < 4 then
    raise exception 'Need at least 4 participants for a Swiss stage (got %)', v_n;
  end if;

  delete from public.tournament_fixtures where tournament_id = p_tournament_id;

  for v_i in 1..v_n loop
    insert into public.swiss_standings(tournament_id, participant_id, wins, losses, round_reached, status)
    values (p_tournament_id, v_participants[v_i], 0, 0, 1, 'active')
    on conflict (tournament_id, participant_id) do nothing;
  end loop;

  v_half := v_n / 2;
  for v_i in 1..v_half loop
    insert into public.tournament_fixtures(
      tournament_id, round, match_number, home_participant_id, away_participant_id, status
    ) values (
      p_tournament_id, 1, v_match_num, v_participants[v_i], v_participants[v_half + v_i], 'scheduled'
    );
    v_match_num := v_match_num + 1;
  end loop;
  -- Odd participant out (if v_n is odd) gets a bye: auto-win, no fixture row.
  if v_n % 2 = 1 then
    update public.swiss_standings set wins = 1 where tournament_id = p_tournament_id and participant_id = v_participants[v_n];
  end if;

  update public.tournaments set tournament_type = 'swiss', fixtures_generated = true where id = p_tournament_id;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket', 'Swiss stage Round 1 is live — ' || v_half || ' matches.', null);

  return jsonb_build_object('round', 1, 'matches', v_half, 'participants', v_n);
end;
$$;

grant execute on function public.generate_swiss_round1(uuid) to authenticated;

-- Call after every fixture in the current Swiss round has a result. Groups
-- players by identical win/loss record and pairs within each record group
-- (sequential pairing — does not attempt full anti-rematch optimization, which
-- is a reasonable simplification at this platform's scale). Players who reach
-- p_wins_needed are marked 'advanced'; players who reach p_losses_max are
-- marked 'eliminated' and stop receiving new pairings. Returns is_final_round
-- = true once no 'active' players remain.
create or replace function public.advance_swiss_round(
  p_tournament_id  uuid,
  p_wins_needed    int default 3,
  p_losses_max     int default 3
) returns jsonb language plpgsql security definer as $$
declare
  v_current_round   int;
  v_unresolved      int;
  v_rec             record;
  v_records         jsonb := '{}'::jsonb; -- "wins-losses" -> array of participant uuids (active only)
  v_key             text;
  v_pool            uuid[];
  v_i               int;
  v_match_num       int := 1;
  v_matches_made    int := 0;
  v_active_left     int;
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    or exists (select 1 from public.tournament_staff ts where ts.tournament_id = p_tournament_id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
  ) then
    raise exception 'Not authorized to advance Swiss stage';
  end if;

  select coalesce(max(round), 0) into v_current_round from public.tournament_fixtures where tournament_id = p_tournament_id;
  if v_current_round = 0 then
    raise exception 'Swiss stage has not been started — call generate_swiss_round1 first';
  end if;

  select count(*) into v_unresolved
  from public.tournament_fixtures
  where tournament_id = p_tournament_id and round = v_current_round and status != 'completed';
  if v_unresolved > 0 then
    raise exception 'Round % still has % unresolved match(es)', v_current_round, v_unresolved;
  end if;

  -- Apply this round's results to win/loss records.
  for v_rec in
    select home_participant_id, away_participant_id, winner_id
    from public.tournament_fixtures
    where tournament_id = p_tournament_id and round = v_current_round and winner_id is not null
  loop
    update public.swiss_standings set
      wins = wins + case when participant_id = v_rec.winner_id then 1 else 0 end,
      losses = losses + case when participant_id != v_rec.winner_id then 1 else 0 end,
      round_reached = v_current_round + 1,
      updated_at = now()
    where tournament_id = p_tournament_id
      and participant_id in (v_rec.home_participant_id, v_rec.away_participant_id);
  end loop;

  -- Resolve advance/eliminate thresholds.
  update public.swiss_standings set status = 'advanced'
  where tournament_id = p_tournament_id and status = 'active' and wins >= p_wins_needed;
  update public.swiss_standings set status = 'eliminated'
  where tournament_id = p_tournament_id and status = 'active' and losses >= p_losses_max;

  select count(*) into v_active_left from public.swiss_standings where tournament_id = p_tournament_id and status = 'active';
  if v_active_left = 0 then
    insert into public.tournament_posts(tournament_id, type, content, author_id)
    values (p_tournament_id, 'system', 'Swiss stage complete — all players have advanced or been eliminated.', null);
    return jsonb_build_object('is_final_round', true, 'round', v_current_round);
  end if;

  -- Group remaining active players by "wins-losses" record.
  for v_rec in
    select participant_id, wins, losses from public.swiss_standings
    where tournament_id = p_tournament_id and status = 'active'
    order by wins desc, losses asc, random()
  loop
    v_key := v_rec.wins || '-' || v_rec.losses;
    v_records := jsonb_set(v_records, array[v_key], coalesce(v_records -> v_key, '[]'::jsonb) || to_jsonb(v_rec.participant_id::text));
  end loop;

  for v_key in select jsonb_object_keys(v_records) loop
    select array_agg(elem::uuid) into v_pool from jsonb_array_elements_text(v_records -> v_key) as elem;
    v_i := 1;
    while v_i < array_length(v_pool, 1) loop
      insert into public.tournament_fixtures(
        tournament_id, round, match_number, home_participant_id, away_participant_id, status
      ) values (
        p_tournament_id, v_current_round + 1, v_match_num, v_pool[v_i], v_pool[v_i + 1], 'scheduled'
      );
      v_match_num := v_match_num + 1;
      v_matches_made := v_matches_made + 1;
      v_i := v_i + 2;
    end loop;
    -- Odd one out within a record group: carries a bye (auto-win) for this round.
    if v_i = array_length(v_pool, 1) then
      update public.swiss_standings set wins = wins + 1 where tournament_id = p_tournament_id and participant_id = v_pool[v_i];
    end if;
  end loop;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket', 'Swiss Round ' || (v_current_round + 1) || ' is live — ' || v_matches_made || ' matches.', null);

  return jsonb_build_object('is_final_round', false, 'round', v_current_round + 1, 'matches', v_matches_made, 'active_remaining', v_active_left);
end;
$$;

grant execute on function public.advance_swiss_round(uuid, int, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. DOUBLE ELIMINATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Builds winners bracket (identical seeding/structure to generate_bracket) plus
-- a losers bracket using the standard alternating pattern: LB round N either
-- consolidates LB survivors against each other, or absorbs the newest winners-
-- bracket dropouts. Pairing within a round is sequential (not full anti-rematch
-- seeding — see the note in advance_swiss_round; same trade-off applies here).
-- Grand finals is winners-bracket champion vs losers-bracket champion; if the
-- LB champion wins game 1, is_bracket_reset flags that a decider (game 2) match
-- is required — the standard double-elimination grand-finals rule.
create or replace function public.generate_bracket_double_elim(
  p_tournament_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_participants     uuid[];
  v_count            int;
  v_bracket_size     int;
  v_wb_rounds        int;
  v_round_id         uuid;
  v_match_id         uuid;
  v_round_num        int;
  v_slot             int;
  v_matches_this_round int;
  v_p1               uuid;
  v_p2               uuid;
  v_round_name       text;
  v_match_num        int := 1;
  v_wb_prev          uuid[];
  v_wb_curr          uuid[];
  v_wb_losers_by_round uuid[][]; -- v_wb_losers_by_round[r] = match ids of WB round r (to read loser_id from later)
  v_lb_round         int := 1;
  v_lb_prev          uuid[];     -- LB survivors from the previous LB round (match ids)
  v_lb_curr          uuid[];
  v_lb_pool          uuid[];     -- participants waiting to be paired this LB round
  v_gf_id            uuid;
  v_lb_final_id      uuid;
  v_wb_final_id      uuid;
  v_i                int;
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
    or exists (select 1 from public.tournament_staff ts where ts.tournament_id = p_tournament_id and ts.user_id = auth.uid() and ts.role in ('host', 'manager', 'bracket_manager'))
  ) then
    raise exception 'Not authorized to generate bracket';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament_id and bracket_generated = true) then
    raise exception 'Bracket already generated for this tournament';
  end if;

  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id and status = 'checked_in';

  v_count := coalesce(array_length(v_participants, 1), 0);
  if v_count < 4 then
    raise exception 'Need at least 4 checked-in players for double elimination (got %)', v_count;
  end if;

  v_bracket_size := 1;
  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;
  v_wb_rounds := (log(v_bracket_size) / log(2))::int;

  delete from public.tournament_rounds where tournament_id = p_tournament_id;

  -- ── Winners bracket round 1 ──────────────────────────────────────────────
  v_round_name := 'Winners Round 1';
  insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
  values (p_tournament_id, 1, v_round_name, v_bracket_size / 2, 'active')
  returning id into v_round_id;

  v_wb_curr := '{}';
  v_matches_this_round := v_bracket_size / 2;
  for v_slot in 1..v_matches_this_round loop
    v_p1 := v_participants[v_slot];
    v_p2 := v_participants[v_bracket_size + 1 - v_slot];
    if v_p1 is null then continue; end if;

    insert into public.matches(tournament_id, round_id, round, bracket_type, player1_id, player2_id, status, is_bye, match_number)
    values (p_tournament_id, v_round_id, 1, 'winners', v_p1, v_p2,
      case when v_p2 is null then 'verified' else 'scheduled' end, v_p2 is null, v_match_num)
    returning id into v_match_id;

    if v_p2 is null then
      update public.matches set winner_id = v_p1, loser_id = null, completed_at = now() where id = v_match_id;
    end if;

    v_wb_curr := v_wb_curr || v_match_id;
    v_match_num := v_match_num + 1;
  end loop;
  v_wb_losers_by_round := array[v_wb_curr];

  -- ── Winners bracket rounds 2..v_wb_rounds ────────────────────────────────
  for v_round_num in 2..v_wb_rounds loop
    v_wb_prev := v_wb_curr;
    v_wb_curr := '{}';
    v_matches_this_round := v_bracket_size / power(2, v_round_num)::int;
    v_round_name := 'Winners Round ' || v_round_num;

    insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
    values (p_tournament_id, v_round_num, v_round_name, v_matches_this_round, 'pending')
    returning id into v_round_id;

    for v_slot in 1..v_matches_this_round loop
      insert into public.matches(tournament_id, round_id, round, bracket_type, status, match_number)
      values (p_tournament_id, v_round_id, v_round_num, 'winners', 'scheduled', v_match_num)
      returning id into v_match_id;

      v_wb_curr := v_wb_curr || v_match_id;
      v_match_num := v_match_num + 1;

      update public.matches set next_match_id = v_match_id, next_match_slot = 1 where id = v_wb_prev[(v_slot * 2) - 1];
      update public.matches set next_match_id = v_match_id, next_match_slot = 2 where id = v_wb_prev[v_slot * 2];
    end loop;

    v_wb_losers_by_round := v_wb_losers_by_round || array[v_wb_curr];
  end loop;

  v_wb_final_id := v_wb_curr[1];

  -- ── Losers bracket ────────────────────────────────────────────────────────
  -- LB round 1 = WB round 1 losers paired against each other. Every LB round
  -- after that alternates: absorb the next WB round's losers, or consolidate
  -- (LB survivors play each other). We don't know actual loser_id values yet
  -- (WB matches haven't been played) — LB rounds are created with players
  -- unassigned (both null) and wired via next_match_id/next_match_slot from
  -- both the WB dropout matches and the previous LB round, exactly like WB
  -- rounds 2+ are wired above. advance_match_winner_double_elim (see below)
  -- fills in the actual player as each source match completes.
  v_lb_prev := '{}';
  for v_round_num in 1..(2 * v_wb_rounds - 2) loop
    -- Odd LB round pairs LB survivors together; even LB round absorbs a new WB round of losers.
    if v_round_num = 1 then
      v_matches_this_round := v_bracket_size / 4;
    elsif v_round_num % 2 = 0 then
      -- absorbs WB round (v_round_num/2 + 1) losers against LB round (v_round_num - 1) survivors
      v_matches_this_round := array_length(v_lb_prev, 1);
    else
      v_matches_this_round := greatest(array_length(v_lb_prev, 1) / 2, 1);
    end if;

    exit when v_matches_this_round < 1;

    v_round_name := 'Losers Round ' || v_round_num;
    insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
    values (p_tournament_id, v_wb_rounds + v_round_num, v_round_name, v_matches_this_round, 'pending')
    returning id into v_round_id;

    v_lb_curr := '{}';
    for v_slot in 1..v_matches_this_round loop
      insert into public.matches(tournament_id, round_id, round, bracket_type, status, match_number)
      values (p_tournament_id, v_round_id, v_wb_rounds + v_round_num, 'losers', 'scheduled', v_match_num)
      returning id into v_match_id;
      v_lb_curr := v_lb_curr || v_match_id;
      v_match_num := v_match_num + 1;
    end loop;

    if v_round_num = 1 then
      -- Pair up WB round-1 losers sequentially into LB round 1. These are WB
      -- matches — use loser_next_match_id so their existing next_match_id
      -- (winner -> WB round 2) is left untouched.
      for v_slot in 1..v_matches_this_round loop
        update public.matches set loser_next_match_id = v_lb_curr[v_slot], loser_next_match_slot = 1 where id = v_wb_losers_by_round[1][(v_slot * 2) - 1];
        update public.matches set loser_next_match_id = v_lb_curr[v_slot], loser_next_match_slot = 2 where id = v_wb_losers_by_round[1][v_slot * 2];
      end loop;
    elsif v_round_num % 2 = 0 then
      -- LB survivors (slot 1, an LB match's winner -> next_match_id is correct
      -- here) vs newest WB dropouts (slot 2, a WB match's loser -> must use
      -- loser_next_match_id), 1:1.
      for v_slot in 1..v_matches_this_round loop
        update public.matches set next_match_id = v_lb_curr[v_slot], next_match_slot = 1 where id = v_lb_prev[v_slot];
        if array_length(v_wb_losers_by_round[v_round_num / 2 + 1], 1) >= v_slot then
          update public.matches set loser_next_match_id = v_lb_curr[v_slot], loser_next_match_slot = 2 where id = v_wb_losers_by_round[v_round_num / 2 + 1][v_slot];
        end if;
      end loop;
    else
      -- Consolidation: pair LB survivors against each other.
      for v_slot in 1..v_matches_this_round loop
        update public.matches set next_match_id = v_lb_curr[v_slot], next_match_slot = 1 where id = v_lb_prev[(v_slot * 2) - 1];
        update public.matches set next_match_id = v_lb_curr[v_slot], next_match_slot = 2 where id = v_lb_prev[v_slot * 2];
      end loop;
    end if;

    v_lb_prev := v_lb_curr;
  end loop;

  v_lb_final_id := v_lb_prev[1];

  -- ── Grand finals: WB champion vs LB champion ─────────────────────────────
  insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
  values (p_tournament_id, v_wb_rounds + (2 * v_wb_rounds - 2) + 1, 'Grand Finals', 1, 'pending')
  returning id into v_round_id;

  insert into public.matches(tournament_id, round_id, round, bracket_type, status, match_number)
  values (p_tournament_id, v_round_id, v_wb_rounds + (2 * v_wb_rounds - 2) + 1, 'grand_finals', 'scheduled', v_match_num)
  returning id into v_gf_id;

  update public.matches set next_match_id = v_gf_id, next_match_slot = 1 where id = v_wb_final_id;
  if v_lb_final_id is not null then
    update public.matches set next_match_id = v_gf_id, next_match_slot = 2 where id = v_lb_final_id;
  end if;

  update public.tournaments set
    bracket_generated = true,
    bracket_type = 'double_elimination',
    total_rounds = v_wb_rounds + (2 * v_wb_rounds - 2) + 1,
    current_round = 1
  where id = p_tournament_id;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket', 'Double-elimination bracket generated! Winners Round 1 is now live.', null);

  return jsonb_build_object('winners_rounds', v_wb_rounds, 'participants', v_count, 'bracket_size', v_bracket_size);
end;
$$;

grant execute on function public.generate_bracket_double_elim(uuid) to authenticated;

-- Double-elimination-aware match advancement. Mirrors advance_match_winner()
-- but: (a) a winners-bracket loser drops into the losers bracket instead of
-- being eliminated, (b) a losers-bracket loser IS eliminated, (c) grand finals
-- applies the bracket-reset rule (LB champion winning game 1 forces a decider).
-- Only call this for tournaments where tournaments.bracket_type =
-- 'double_elimination' — single-elimination tournaments must keep using the
-- existing advance_match_winner().
create or replace function public.advance_match_winner_double_elim(
  p_match_id  uuid,
  p_winner_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_match      public.matches%rowtype;
  v_next       public.matches%rowtype;
  v_loser_id   uuid;
  v_reset_needed boolean := false;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.winner_id is not null and not v_match.is_bye then
    raise exception 'Match already has a winner';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR'))
     and auth.uid() != v_match.player1_id and auth.uid() != v_match.player2_id then
    raise exception 'Not authorized to advance this match';
  end if;

  v_loser_id := case when p_winner_id = v_match.player1_id then v_match.player2_id else v_match.player1_id end;

  -- Grand finals bracket reset: if this is the grand finals and the winner
  -- came from the losers bracket (i.e. was seeded into slot 2), and no reset
  -- has happened yet, this win forces a decider game instead of ending the
  -- tournament.
  if v_match.bracket_type = 'grand_finals' and p_winner_id = v_match.player2_id and not v_match.is_bracket_reset then
    update public.matches set
      is_bracket_reset = true,
      player1_score = null, player2_score = null,
      status = 'scheduled'
    where id = p_match_id;
    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'system', 'Bracket reset! The losers-bracket champion forced a deciding match.', p_match_id);
    return jsonb_build_object('bracket_reset', true);
  end if;

  update public.matches set
    winner_id = p_winner_id, loser_id = v_loser_id, status = 'settled', completed_at = now()
  where id = p_match_id;

  -- Winner advances via next_match_id (identical mechanism to single-elim).
  if v_match.next_match_id is not null then
    if v_match.next_match_slot = 1 then
      update public.matches set player1_id = p_winner_id where id = v_match.next_match_id;
    else
      update public.matches set player2_id = p_winner_id where id = v_match.next_match_id;
    end if;

    select * into v_next from public.matches where id = v_match.next_match_id;
    if v_next.player1_id is not null and v_next.player2_id is not null then
      update public.matches set status = 'scheduled' where id = v_match.next_match_id;
    end if;
  end if;

  -- Winners-bracket loser drops into their pre-wired losers-bracket match.
  -- Losers-bracket loser is simply eliminated — no further drop.
  if v_match.bracket_type = 'winners' and v_loser_id is not null and v_match.loser_next_match_id is not null then
    if v_match.loser_next_match_slot = 1 then
      update public.matches set player1_id = v_loser_id where id = v_match.loser_next_match_id;
    else
      update public.matches set player2_id = v_loser_id where id = v_match.loser_next_match_id;
    end if;

    select * into v_next from public.matches where id = v_match.loser_next_match_id;
    if v_next.player1_id is not null and v_next.player2_id is not null then
      update public.matches set status = 'scheduled' where id = v_match.loser_next_match_id;
    end if;
  elsif v_loser_id is not null and v_match.bracket_type != 'winners' then
    update public.tournament_participants set status = 'dropped', eliminated_round = v_match.round
    where tournament_id = v_match.tournament_id and user_id = v_loser_id;
  end if;

  if v_match.bracket_type = 'grand_finals' and v_match.next_match_id is null then
    update public.tournaments set
      status = 'completed', winner_id = p_winner_id, completed_at = now()
    where id = v_match.tournament_id;

    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'system',
      '🏆 Tournament complete! Champion: ' || (select username from public.profiles where id = p_winner_id), p_match_id);
  end if;

  return jsonb_build_object('bracket_reset', false, 'winner_id', p_winner_id, 'loser_id', v_loser_id);
end;
$$;

grant execute on function public.advance_match_winner_double_elim(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. WIRING: make the two existing dispatch/entry-point functions format-aware
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- TournamentCreateNew.tsx already lets an organizer pick Double Elimination,
-- Swiss, Round Robin, Group Stage, and Groups+Knockout — tournament_type gets
-- saved correctly. But the two functions that actually GENERATE and PROGRESS
-- a bracket never looked at that value: generate_fixtures_auto always fell
-- through to single-elimination generate_bracket() for anything that wasn't
-- round_robin/league/group_stage, and confirm_match_result (the normal
-- player-facing "opponent confirmed my result" flow — not just the admin
-- force-advance button) unconditionally called the single-elimination-only
-- advance_match_winner(). Both are redefined below to dispatch on the
-- tournament's actual type/bracket_type. Existing single-elimination
-- tournaments are unaffected — bracket_type defaults to 'single_elimination'
-- for every row that predates this migration, so they keep taking the exact
-- branch they always did.

create or replace function public.generate_fixtures_auto(
  p_tournament_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_tourn record;
  v_result jsonb;
begin
  select * into v_tourn from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  if not (
    v_tourn.created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  ) then
    raise exception 'Not authorized';
  end if;

  if v_tourn.tournament_type in ('round_robin', 'league') then
    select public.generate_round_robin_fixtures(p_tournament_id) into v_result;
  elsif v_tourn.tournament_type in ('group_stage', 'group_knockout') then
    -- group_knockout is two-phase: this generates the group stage (phase 1).
    -- The organizer calls generate_knockout_from_groups separately once group
    -- play has finished (phase 2) — that can't be auto-triggered here since
    -- the groups haven't been played yet.
    select public.generate_group_stage_fixtures(p_tournament_id) into v_result;
  elsif v_tourn.tournament_type = 'swiss' then
    select public.generate_swiss_round1(p_tournament_id) into v_result;
  elsif v_tourn.tournament_type = 'double_elimination' then
    select public.generate_bracket_double_elim(p_tournament_id) into v_result;
  else
    -- single_elimination, knockout, ladder (no dedicated ladder engine yet —
    -- falls back to single-elimination), and any unrecognized value.
    select public.generate_bracket(p_tournament_id) into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.generate_fixtures_auto(uuid) to authenticated;

create or replace function public.confirm_match_result(
  p_match_id       uuid,
  p_report_id      uuid,
  p_decision       text,  -- 'confirm' or 'dispute'
  p_reason         text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_match    public.matches%rowtype;
  v_report   public.match_reports%rowtype;
  v_winner   uuid;
  v_is_double_elim boolean;
begin
  select * into v_match  from public.matches       where id = p_match_id;
  select * into v_report from public.match_reports where id = p_report_id;

  if not found then raise exception 'Report not found'; end if;

  if auth.uid() = v_report.reporter_id then
    raise exception 'Cannot confirm your own report';
  end if;
  if auth.uid() != v_match.player1_id and auth.uid() != v_match.player2_id then
    raise exception 'Only match participants can confirm results';
  end if;

  insert into public.match_confirmations(match_id, report_id, confirmer_id, decision, reason)
  values (p_match_id, p_report_id, auth.uid(), p_decision, p_reason)
  on conflict (match_id, confirmer_id) do update set
    decision   = excluded.decision,
    reason     = excluded.reason,
    created_at = now();

  if p_decision = 'confirm' then
    if v_report.player1_score > v_report.player2_score then
      v_winner := v_match.player1_id;
    else
      v_winner := v_match.player2_id;
    end if;

    update public.matches set
      player1_score = v_report.player1_score,
      player2_score = v_report.player2_score,
      status = 'verified'
    where id = p_match_id;

    update public.match_reports set status = 'confirmed' where id = p_report_id;

    select (bracket_type = 'double_elimination') into v_is_double_elim
    from public.tournaments where id = v_match.tournament_id;

    if v_is_double_elim then
      perform public.advance_match_winner_double_elim(p_match_id, v_winner);
    else
      perform public.advance_match_winner(p_match_id, v_winner);
    end if;

    insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
    values (v_winner, 'match_start', '✅ Match confirmed', 'Your result was confirmed. You advance!', 'match', p_match_id);

    return jsonb_build_object('status', 'confirmed', 'winner_id', v_winner);

  else
    if p_reason is null then
      raise exception 'Reason is required to open a dispute';
    end if;

    update public.matches set status = 'disputed' where id = p_match_id;
    update public.match_reports set status = 'disputed' where id = p_report_id;

    insert into public.disputes(match_id, opened_by, reason, dispute_type, report_id, due_by)
    values (
      p_match_id, auth.uid(), p_reason, 'score_conflict', p_report_id,
      now() + interval '48 hours'
    )
    on conflict (match_id) do update set
      state    = 'open',
      reason   = excluded.reason,
      due_by   = excluded.due_by,
      opened_by = excluded.opened_by;

    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'system', 'A dispute has been opened for Match #' || v_match.match_number || '. Admin review required.', p_match_id);

    return jsonb_build_object('status', 'disputed');
  end if;
end;
$$;

grant execute on function public.confirm_match_result(uuid, uuid, text, text) to authenticated;
