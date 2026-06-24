-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay V4.2 Granular Permissions in Backend RPCs
-- Ensures that backend RPCs validate the specific permissions configured in the frontend
-- ══════════════════════════════════════════════════════════════════════════════

-- Ensure `has_global_permission` exists (from Phase 1 Core Schema)
create or replace function public.has_global_permission(
  p_user_id uuid,
  p_permission text,
  p_scope_type text default 'global',
  p_scope_id uuid default null
) returns boolean language plpgsql security definer as $$
begin
  return exists (
    select 1 from public.global_permissions
    where user_id = p_user_id
      and permission = p_permission
      and is_active = true
      and (scope_type = p_scope_type or scope_type = 'global')
      and (scope_id = p_scope_id or scope_id is null)
  ) or exists (
    select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')
  );
end;
$$;

-- ── 1. Update generate_bracket to use granular permission ────────────────────
create or replace function public.generate_bracket(p_tournament_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_participants  uuid[];
  v_count         int;
  v_rounds        int;
  v_bracket_size  int;
  v_round_id      uuid;
  v_match_id      uuid;
  v_round_num     int := 1;
  v_matches_this_round int;
  v_p1            uuid;
  v_p2            uuid;
  v_slot          int;
  v_seed1         int;
  v_seed2         int;
  v_curr_size     int;
  v_val           int;
  v_seed_order    int[];
  v_new_order     int[];
  v_prev_matches  uuid[];
  v_curr_matches  uuid[];
  v_round_name    text;
  v_match_num     int := 1;
  v_prev_round_matches  uuid[];
  v_curr_round_matches  uuid[];
BEGIN
  -- VALIDATE GRANULAR PERMISSION (tournaments.manage) OR CREATOR
  if not public.has_global_permission(auth.uid(), 'tournaments.manage')
     and not exists (select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid()) then
    raise exception 'Not authorized to generate bracket. Requires tournaments.manage permission.';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament_id and bracket_generated = true) then
    raise exception 'Bracket already generated for this tournament';
  end if;

  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id and status = 'checked_in';

  v_count := coalesce(array_length(v_participants, 1), 0);
  if v_count < 2 then
    raise exception 'Need at least 2 checked-in players to generate bracket (got %)', v_count;
  end if;

  v_bracket_size := 1;
  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;
  v_rounds := (log(v_bracket_size) / log(2))::int;

  delete from public.tournament_rounds where tournament_id = p_tournament_id;

  v_seed_order := array[1, 2];
  v_curr_size := 2;
  while v_curr_size < v_bracket_size loop
    v_new_order := '{}';
    for i in 1..array_length(v_seed_order, 1) loop
      v_val := v_seed_order[i];
      v_new_order := array_append(v_new_order, v_val);
      v_new_order := array_append(v_new_order, (v_curr_size * 2 + 1) - v_val);
    end loop;
    v_seed_order := v_new_order;
    v_curr_size := v_curr_size * 2;
  end loop;

  v_round_name := case v_rounds
    when 1 then 'Final'
    when 2 then 'Semi-Final'
    when 3 then 'Quarter-Final'
    else 'Round of ' || v_bracket_size::text
  end;

  insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
  values (p_tournament_id, 1, v_round_name, v_bracket_size / 2, 'active')
  returning id into v_round_id;

  v_curr_round_matches := '{}';
  v_matches_this_round := v_bracket_size / 2;

  for v_slot in 1..v_matches_this_round loop
    v_seed1 := v_seed_order[(v_slot * 2) - 1];
    v_seed2 := v_seed_order[v_slot * 2];
    v_p1 := v_participants[v_seed1];
    v_p2 := v_participants[v_seed2];

    if v_p1 is null and v_p2 is null then
      continue;
    end if;

    if v_p1 is null and v_p2 is not null then
      v_p1 := v_p2;
      v_p2 := null;
    end if;

    insert into public.matches(
      tournament_id, round_id, round, player1_id, player2_id,
      status, is_bye, match_number
    ) values (
      p_tournament_id, v_round_id, 1,
      v_p1, v_p2,
      case when v_p2 is null then 'verified' else 'scheduled' end,
      v_p2 is null,
      v_match_num
    ) returning id into v_match_id;

    if v_p2 is null then
      update public.matches set winner_id = v_p1, loser_id = null, completed_at = now()
      where id = v_match_id;
    end if;

    v_curr_round_matches := array_append(v_curr_round_matches, v_match_id);
    v_match_num := v_match_num + 1;
  end loop;

  for v_round_num in 2..v_rounds loop
    v_prev_round_matches := v_curr_round_matches;
    v_curr_round_matches := '{}';
    v_matches_this_round := v_bracket_size / power(2, v_round_num)::int;

    v_round_name := case (v_rounds - v_round_num + 1)
      when 1 then 'Final'
      when 2 then 'Semi-Final'
      when 3 then 'Quarter-Final'
      else 'Round of ' || (v_bracket_size / power(2, v_round_num - 1))::int::text
    end;

    insert into public.tournament_rounds(tournament_id, round_number, round_name, total_matches, status)
    values (p_tournament_id, v_round_num, v_round_name, v_matches_this_round, 'pending')
    returning id into v_round_id;

    for v_slot in 1..v_matches_this_round loop
      insert into public.matches(
        tournament_id, round_id, round, status, match_number
      ) values (
        p_tournament_id, v_round_id, v_round_num, 'scheduled', v_match_num
      ) returning id into v_match_id;

      v_curr_round_matches := array_append(v_curr_round_matches, v_match_id);
      v_match_num := v_match_num + 1;

      update public.matches set next_match_id = v_match_id, next_match_slot = 1
      where id = v_prev_round_matches[(v_slot * 2) - 1];

      update public.matches set next_match_id = v_match_id, next_match_slot = 2
      where id = v_prev_round_matches[v_slot * 2];
    end loop;
  end loop;

  update public.tournaments set
    bracket_generated = true, total_rounds = v_rounds, current_round = 1, status = 'ongoing'
  where id = p_tournament_id;

  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket', 'Bracket has been generated! Round 1 matches are now live.', null);

  return jsonb_build_object('rounds', v_rounds, 'participants', v_count, 'bracket_size', v_bracket_size);
END;
$$;

-- ── 2. Update advance_match_winner ──────────────────────────────────────────
create or replace function public.advance_match_winner(
  p_match_id uuid,
  p_winner_id uuid
) returns void language plpgsql security definer as $$
declare
  v_match           public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.winner_id is not null and not v_match.is_bye then
    raise exception 'Match already has a winner';
  end if;

  -- VALIDATE GRANULAR PERMISSION OR PLAYER
  if not public.has_global_permission(auth.uid(), 'matches.resolve')
     and auth.uid() != v_match.player1_id
     and auth.uid() != v_match.player2_id then
    raise exception 'Not authorized to advance this match. Requires matches.resolve permission.';
  end if;

  update public.matches set
    winner_id    = p_winner_id,
    loser_id     = case when p_winner_id = v_match.player1_id then v_match.player2_id else v_match.player1_id end,
    status       = 'settled',
    completed_at = now()
  where id = p_match_id;
end;
$$;
