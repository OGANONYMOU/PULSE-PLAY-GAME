-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay V4 Launch Readiness Migration
-- Focus: Proper Bracket Seeding, Advanced RLS Policies, Dispute Automation
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix Bracket Generation Seeding Logic ─────────────────────────────────
-- The previous logic placed players in sequential slots, resulting in Seed 1
-- playing Seed 2 early in the tournament. This updates it to standard folding.
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
  -- Validate caller is admin or tournament creator
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR', 'SUPER_ADMIN')
  ) and not exists (
    select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid()
  ) then
    raise exception 'Not authorized to generate bracket';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament_id and bracket_generated = true) then
    raise exception 'Bracket already generated for this tournament';
  end if;

  -- Get checked-in participants ordered by seed (or join time)
  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id and status = 'checked_in';

  v_count := coalesce(array_length(v_participants, 1), 0);
  if v_count < 2 then
    raise exception 'Need at least 2 checked-in players to generate bracket (got %)', v_count;
  end if;

  -- Calculate bracket size (next power of 2)
  v_bracket_size := 1;
  while v_bracket_size < v_count loop
    v_bracket_size := v_bracket_size * 2;
  end loop;
  v_rounds := (log(v_bracket_size) / log(2))::int;

  delete from public.tournament_rounds where tournament_id = p_tournament_id;

  -- Generate Standard Seeding Order
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

  -- Create round 1
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

    -- If both are null, skip
    if v_p1 is null and v_p2 is null then
      continue;
    end if;

    -- Swap so p1 is always the non-null player if only one is null
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

  -- Create subsequent rounds
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

      -- Wire previous round matches
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

-- ── 2. Admin Security Rules (RLS Policies) ──────────────────────────────────

-- Enable RLS on core tables
alter table public.tournaments enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.disputes enable row level security;

-- Tournaments Policies
-- Anyone can read public tournaments
drop policy if exists "Tournaments are viewable by everyone" on public.tournaments;
create policy "Tournaments are viewable by everyone" 
on public.tournaments for select using (true);

-- Only Admins/Hosts can create
drop policy if exists "Only admins and hosts can create tournaments" on public.tournaments;
create policy "Only admins and hosts can create tournaments" 
on public.tournaments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'HOST'))
);

-- Only Admins/Creator can update
drop policy if exists "Only admins and creator can update tournaments" on public.tournaments;
create policy "Only admins and creator can update tournaments" 
on public.tournaments for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('SUPER_ADMIN', 'ADMIN', 'MODERATOR'))
  or created_by = auth.uid()
);

-- Profiles Policies
-- Anyone can view profiles
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" 
on public.profiles for select using (true);

-- Users can update own profile, Admins can update any
drop policy if exists "Users can update own profile and admins can update any" on public.profiles;
create policy "Users can update own profile and admins can update any" 
on public.profiles for update using (
  id = auth.uid() or 
  exists (select 1 from public.profiles where id = auth.uid() and role in ('SUPER_ADMIN', 'ADMIN', 'MODERATOR'))
);

-- Disputes Policies
drop policy if exists "Users can view own disputes and admins view all" on public.disputes;
create policy "Users can view own disputes and admins view all" 
on public.disputes for select using (
  opened_by = auth.uid() or 
  exists (select 1 from public.profiles where id = auth.uid() and role in ('SUPER_ADMIN', 'ADMIN', 'MODERATOR'))
);

-- ── 3. Stale Dispute Auto-Resolution RPC ────────────────────────────────────
create or replace function public.resolve_stale_disputes()
returns void language plpgsql security definer as $$
begin
  -- Example logic: Find disputes older than 2 hours that are still 'open'
  -- and auto-resolve them in favor of the creator of the dispute if proof exists,
  -- otherwise close them. For now, we will mark them as 'needs_admin' for safety.
  update public.disputes
  set state = 'needs_admin'
  where state = 'open' and created_at < now() - interval '2 hours';
end;
$$;
