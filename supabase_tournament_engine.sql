-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay Tournament Engine Migration
-- Single-elimination brackets, match reports, confirmations, wallet, GamerCred
-- Run AFTER all previous migrations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend tournaments table ─────────────────────────────────────────────
alter table public.tournaments
  add column if not exists bracket_type    text    not null default 'single_elimination',
  add column if not exists entry_fee       int     not null default 0,
  add column if not exists prize_amount    int     not null default 0,
  add column if not exists currency        text    not null default 'PulsePoints',
  add column if not exists check_in_open   timestamptz null,
  add column if not exists check_in_close  timestamptz null,
  add column if not exists registration_closes timestamptz null,
  add column if not exists bracket_generated boolean not null default false,
  add column if not exists total_rounds    int     null,
  add column if not exists current_round   int     not null default 0,
  add column if not exists runner_up       text    null,
  add column if not exists created_by      uuid    null references public.profiles(id),
  add column if not exists easy_mode       boolean not null default false,
  add column if not exists format          text    not null default 'best_of_1'
                                           check (format in ('best_of_1','best_of_3','best_of_5')),
  add column if not exists rules           text    null,
  add column if not exists is_public       boolean not null default true;

-- ── 2. Tournament admins ────────────────────────────────────────────────────
create table if not exists public.tournament_admins (
  id             uuid        primary key default gen_random_uuid(),
  tournament_id  uuid        not null references public.tournaments(id) on delete cascade,
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  role           text        not null default 'moderator'
                             check (role in ('host','moderator')),
  created_at     timestamptz not null default now(),
  unique (tournament_id, user_id)
);
alter table public.tournament_admins enable row level security;
drop policy if exists "Public view admins"   on public.tournament_admins;
drop policy if exists "Host manage admins"   on public.tournament_admins;
drop policy if exists "Platform admin all"   on public.tournament_admins;
create policy "Public view tournament admins"
  on public.tournament_admins for select using (true);
create policy "Platform admins manage"
  on public.tournament_admins for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 3. Extend tournament_participants ───────────────────────────────────────
alter table public.tournament_participants
  add column if not exists seed              int    null,
  add column if not exists checked_in_at    timestamptz null,
  add column if not exists eliminated_round int    null,
  add column if not exists final_placement  int    null,
  add column if not exists in_game_username text   null;

-- ── 4. Tournament rounds ────────────────────────────────────────────────────
create table if not exists public.tournament_rounds (
  id             uuid        primary key default gen_random_uuid(),
  tournament_id  uuid        not null references public.tournaments(id) on delete cascade,
  round_number   int         not null,
  round_name     text        not null,   -- 'Round of 32', 'Quarter-Final', 'Semi-Final', 'Final'
  total_matches  int         not null default 0,
  completed_matches int      not null default 0,
  status         text        not null default 'pending'
                             check (status in ('pending','active','completed')),
  started_at     timestamptz null,
  completed_at   timestamptz null,
  created_at     timestamptz not null default now(),
  unique (tournament_id, round_number)
);
alter table public.tournament_rounds enable row level security;
drop policy if exists "Public view rounds" on public.tournament_rounds;
create policy "Public view rounds" on public.tournament_rounds for select using (true);
create policy "Admins manage rounds" on public.tournament_rounds for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- ── 5. Extend matches table ──────────────────────────────────────────────────
alter table public.matches
  add column if not exists round_id         uuid        null references public.tournament_rounds(id),
  add column if not exists player1_id       uuid        null references public.profiles(id),
  add column if not exists player2_id       uuid        null references public.profiles(id),
  add column if not exists player1_score    int         null,
  add column if not exists player2_score    int         null,
  add column if not exists winner_id        uuid        null references public.profiles(id),
  add column if not exists loser_id         uuid        null references public.profiles(id),
  add column if not exists next_match_id    uuid        null references public.matches(id),
  add column if not exists next_match_slot  int         null  check (next_match_slot in (1, 2)),
  add column if not exists is_bye           boolean     not null default false,
  add column if not exists scheduled_at    timestamptz  null,
  add column if not exists completed_at    timestamptz  null,
  add column if not exists match_number     int         null;

-- ── 6. Match reports (screenshot proof) ─────────────────────────────────────
create table if not exists public.match_reports (
  id             uuid        primary key default gen_random_uuid(),
  match_id       uuid        not null references public.matches(id) on delete cascade,
  reporter_id    uuid        not null references public.profiles(id) on delete cascade,
  player1_score  int         not null,
  player2_score  int         not null,
  proof_url      text        not null,
  proof_storage_key text     not null,
  notes          text        null,
  status         text        not null default 'pending'
                             check (status in ('pending','confirmed','disputed','rejected')),
  created_at     timestamptz not null default now(),
  unique (match_id, reporter_id)   -- one report per player per match
);
alter table public.match_reports enable row level security;
drop policy if exists "View match reports"   on public.match_reports;
drop policy if exists "Submit report"        on public.match_reports;
drop policy if exists "Admin reports"        on public.match_reports;
create policy "Participants and admins view reports"
  on public.match_reports for select using (
    reporter_id = auth.uid() or
    exists (select 1 from public.matches m where m.id = match_id and (m.player1_id = auth.uid() or m.player2_id = auth.uid())) or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );
create policy "Players submit reports"
  on public.match_reports for insert with check (auth.uid() = reporter_id);
create policy "Admin manage reports"
  on public.match_reports for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 7. Match confirmations ───────────────────────────────────────────────────
create table if not exists public.match_confirmations (
  id             uuid        primary key default gen_random_uuid(),
  match_id       uuid        not null references public.matches(id) on delete cascade,
  report_id      uuid        not null references public.match_reports(id) on delete cascade,
  confirmer_id   uuid        not null references public.profiles(id) on delete cascade,
  decision       text        not null check (decision in ('confirm','dispute')),
  reason         text        null,  -- required if dispute
  created_at     timestamptz not null default now(),
  unique (match_id, confirmer_id)
);
alter table public.match_confirmations enable row level security;
drop policy if exists "View confirmations" on public.match_confirmations;
drop policy if exists "Player confirm"     on public.match_confirmations;
create policy "Match players and admins view confirmations"
  on public.match_confirmations for select using (
    confirmer_id = auth.uid() or
    exists (select 1 from public.matches m where m.id = match_id and (m.player1_id = auth.uid() or m.player2_id = auth.uid())) or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );
create policy "Players confirm matches"
  on public.match_confirmations for insert with check (auth.uid() = confirmer_id);

-- ── 8. Tournament wallet transactions ───────────────────────────────────────
create table if not exists public.tournament_wallet_transactions (
  id             uuid        primary key default gen_random_uuid(),
  tournament_id  uuid        not null references public.tournaments(id) on delete cascade,
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  type           text        not null check (type in ('entry_fee','prize_payout','refund','gamercred_reward')),
  amount         int         not null,
  currency       text        not null default 'PulsePoints',
  status         text        not null default 'pending'
                             check (status in ('pending','completed','failed','reversed')),
  ref_type       text        null,
  ref_id         uuid        null,
  notes          text        null,
  created_at     timestamptz not null default now()
);
alter table public.tournament_wallet_transactions enable row level security;
drop policy if exists "Own txns" on public.tournament_wallet_transactions;
drop policy if exists "Admin all txns" on public.tournament_wallet_transactions;
create policy "Users see own transactions"
  on public.tournament_wallet_transactions for select using (auth.uid() = user_id);
create policy "System insert transactions"
  on public.tournament_wallet_transactions for insert with check (auth.uid() = user_id or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );
create policy "Admins view all transactions"
  on public.tournament_wallet_transactions for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 9. Leaderboard entries ───────────────────────────────────────────────────
create table if not exists public.leaderboard_entries (
  id                 uuid        primary key default gen_random_uuid(),
  tournament_id      uuid        not null references public.tournaments(id) on delete cascade,
  user_id            uuid        not null references public.profiles(id) on delete cascade,
  placement          int         not null,
  wins               int         not null default 0,
  losses             int         not null default 0,
  points_earned      int         not null default 0,
  gamercred_earned   int         not null default 0,
  created_at         timestamptz not null default now(),
  unique (tournament_id, user_id)
);
alter table public.leaderboard_entries enable row level security;
drop policy if exists "Public leaderboard" on public.leaderboard_entries;
create policy "Public tournament leaderboard"
  on public.leaderboard_entries for select using (true);
create policy "System writes leaderboard"
  on public.leaderboard_entries for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 10. Tournament posts (live feed) ────────────────────────────────────────
create table if not exists public.tournament_posts (
  id             uuid        primary key default gen_random_uuid(),
  tournament_id  uuid        not null references public.tournaments(id) on delete cascade,
  author_id      uuid        null references public.profiles(id) on delete set null,
  type           text        not null default 'update'
                             check (type in ('update','result','bracket','system','hype')),
  content        text        not null,
  match_id       uuid        null references public.matches(id),
  metadata       jsonb       null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tournament_posts_tournament
  on public.tournament_posts(tournament_id, created_at desc);
alter table public.tournament_posts enable row level security;
drop policy if exists "Public tournament feed" on public.tournament_posts;
drop policy if exists "Auth post to tournament" on public.tournament_posts;
create policy "Public tournament feed"
  on public.tournament_posts for select using (true);
create policy "Authenticated create posts"
  on public.tournament_posts for insert with check (
    auth.uid() = author_id or author_id is null
  );
create policy "Admins manage posts"
  on public.tournament_posts for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 11. Extend disputes table ────────────────────────────────────────────────
alter table public.disputes
  add column if not exists dispute_type  text null
    check (dispute_type in ('score_conflict','no_show','wrong_rules','disconnect','cheating','other')),
  add column if not exists report_id     uuid null references public.match_reports(id);

-- ── 12. Indexes ──────────────────────────────────────────────────────────────
create index if not exists idx_matches_tournament    on public.matches(tournament_id);
create index if not exists idx_matches_round         on public.matches(round_id);
create index if not exists idx_matches_player1       on public.matches(player1_id);
create index if not exists idx_matches_player2       on public.matches(player2_id);
create index if not exists idx_matches_next          on public.matches(next_match_id);
create index if not exists idx_match_reports_match   on public.match_reports(match_id);
create index if not exists idx_confirmations_match   on public.match_confirmations(match_id);
create index if not exists idx_tp_tournament         on public.tournament_participants(tournament_id);
create index if not exists idx_tp_user               on public.tournament_participants(user_id);
create index if not exists idx_wallet_user           on public.tournament_wallet_transactions(user_id);
create index if not exists idx_wallet_tournament     on public.tournament_wallet_transactions(tournament_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- SQL FUNCTIONS (run in Supabase as security definer)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── F1. Generate single-elimination bracket ──────────────────────────────────
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
  v_prev_matches  uuid[];
  v_curr_matches  uuid[];
  v_round_name    text;
  v_match_num     int := 1;
  v_match_ids_by_round  uuid[][];
  v_prev_round_matches  uuid[];
  v_curr_round_matches  uuid[];
BEGIN
  -- Validate caller is admin or tournament creator
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR')
  ) and not exists (
    select 1 from public.tournaments where id = p_tournament_id and created_by = auth.uid()
  ) then
    raise exception 'Not authorized to generate bracket';
  end if;

  -- Check not already generated
  if exists (select 1 from public.tournaments where id = p_tournament_id and bracket_generated = true) then
    raise exception 'Bracket already generated for this tournament';
  end if;

  -- Get checked-in participants ordered by seed
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

  -- Delete any existing rounds/matches for this tournament
  delete from public.tournament_rounds where tournament_id = p_tournament_id;

  -- Shuffle participants into seeded positions
  -- Seed 1 vs seed (bracket_size), seed 2 vs seed (bracket_size-1), etc.
  -- BYE slots for non-power-of-2

  -- Create round 1 matches
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
    -- Player indices: slot 1 gets [1] vs [bracket_size], slot 2 gets [2] vs [bracket_size-1]
    v_p1 := v_participants[v_slot];
    v_p2 := v_participants[v_bracket_size + 1 - v_slot];

    if v_p1 is null then
      -- Both null: skip creating match (shouldn't happen with bracket_size calc)
      continue;
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

    -- If BYE, auto-advance player1
    if v_p2 is null then
      update public.matches set winner_id = v_p1, loser_id = null, completed_at = now()
      where id = v_match_id;
    end if;

    v_curr_round_matches := v_curr_round_matches || v_match_id;
    v_match_num := v_match_num + 1;
  end loop;

  -- Create subsequent rounds with next_match_id wiring
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

      v_curr_round_matches := v_curr_round_matches || v_match_id;
      v_match_num := v_match_num + 1;

      -- Wire previous round matches to feed into this match
      update public.matches set
        next_match_id   = v_match_id,
        next_match_slot = 1
      where id = v_prev_round_matches[(v_slot * 2) - 1];

      update public.matches set
        next_match_id   = v_match_id,
        next_match_slot = 2
      where id = v_prev_round_matches[v_slot * 2];
    end loop;
  end loop;

  -- Update tournament state
  update public.tournaments set
    bracket_generated = true,
    total_rounds = v_rounds,
    current_round = 1,
    status = 'ongoing'
  where id = p_tournament_id;

  -- Post system message
  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (p_tournament_id, 'bracket', 'Bracket has been generated! Round 1 matches are now live.', null);

  return jsonb_build_object('rounds', v_rounds, 'participants', v_count, 'bracket_size', v_bracket_size);
END;
$$;

-- ── F2. Submit match result and advance winner ────────────────────────────────
create or replace function public.advance_match_winner(
  p_match_id uuid,
  p_winner_id uuid
) returns void language plpgsql security definer as $$
declare
  v_match           public.matches%rowtype;
  v_next            public.matches%rowtype;
  v_tournament      public.tournaments%rowtype;
  v_round           public.tournament_rounds%rowtype;
  v_completed_count int;
  v_all_done        boolean;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if v_match.winner_id is not null and not v_match.is_bye then
    raise exception 'Match already has a winner';
  end if;

  -- Validate caller is admin or one of the players
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
     and auth.uid() != v_match.player1_id
     and auth.uid() != v_match.player2_id then
    raise exception 'Not authorized to advance this match';
  end if;

  -- Set winner and loser
  update public.matches set
    winner_id    = p_winner_id,
    loser_id     = case when p_winner_id = player1_id then player2_id else player1_id end,
    status       = 'settled',
    completed_at = now()
  where id = p_match_id;

  select * into v_match from public.matches where id = p_match_id;

  -- Advance winner to next match if applicable
  if v_match.next_match_id is not null then
    if v_match.next_match_slot = 1 then
      update public.matches set player1_id = p_winner_id where id = v_match.next_match_id;
    else
      update public.matches set player2_id = p_winner_id where id = v_match.next_match_id;
    end if;

    -- If both slots filled, activate the next match
    select * into v_next from public.matches where id = v_match.next_match_id;
    if v_next.player1_id is not null and v_next.player2_id is not null then
      update public.matches set status = 'scheduled' where id = v_match.next_match_id;
    end if;
  end if;

  -- Mark participant as eliminated
  if v_match.loser_id is not null then
    update public.tournament_participants set
      status = 'dropped',
      eliminated_round = v_match.round
    where tournament_id = v_match.tournament_id and user_id = v_match.loser_id;
  end if;

  -- Update round completion
  select * into v_round from public.tournament_rounds where id = v_match.round_id;
  select count(*) into v_completed_count
  from public.matches
  where round_id = v_match.round_id and status in ('settled','verified')
    and (is_bye = false or winner_id is not null);

  if v_completed_count >= v_round.total_matches then
    update public.tournament_rounds set
      status = 'completed', completed_at = now(),
      completed_matches = v_completed_count
    where id = v_match.round_id;

    -- Activate next round
    update public.tournament_rounds set status = 'active', started_at = now()
    where tournament_id = v_match.tournament_id
      and round_number = v_round.round_number + 1;

    -- Update tournament current_round
    update public.tournaments set current_round = v_round.round_number + 1
    where id = v_match.tournament_id and total_rounds > v_round.round_number;

    -- Post round result
    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'result',
      v_round.round_name || ' complete! Next round is now live.',
      p_match_id);
  end if;

  -- Check if final match (no next match)
  if v_match.next_match_id is null then
    select * into v_tournament from public.tournaments where id = v_match.tournament_id;

    -- Set winner / runner-up
    update public.tournaments set
      status      = 'completed',
      winner      = (select username from public.profiles where id = p_winner_id),
      runner_up   = (select username from public.profiles where id = v_match.loser_id)
    where id = v_match.tournament_id;

    -- Write leaderboard entries
    insert into public.leaderboard_entries(tournament_id, user_id, placement, points_earned, gamercred_earned)
    values
      (v_match.tournament_id, p_winner_id, 1, 500, 150),
      (v_match.tournament_id, v_match.loser_id, 2, 200, 75)
    on conflict (tournament_id, user_id) do update set
      placement       = excluded.placement,
      points_earned   = excluded.points_earned,
      gamercred_earned = excluded.gamercred_earned;

    -- Award PulsePoints winner
    insert into public.pulsepoints_ledger(user_id, delta, reason, ref_type, ref_id, balance_after)
    values (
      p_winner_id, v_tournament.prize_amount,
      'Tournament win: ' || v_tournament.name, 'tournament_win', v_match.tournament_id,
      coalesce((select sum(delta) from public.pulsepoints_ledger where user_id = p_winner_id), 0) + v_tournament.prize_amount
    );

    -- Award GamerCred winner
    insert into public.gamercred_scores(user_id, score, wins, tournaments_played)
    values (p_winner_id, 1150, 1, 1)
    on conflict (user_id) do update set
      score = gamercred_scores.score + 150,
      wins  = gamercred_scores.wins + 1,
      tournaments_played = gamercred_scores.tournaments_played + 1,
      updated_at = now();

    -- GamerCred runner-up
    if v_match.loser_id is not null then
      insert into public.gamercred_scores(user_id, score, tournaments_played)
      values (v_match.loser_id, 1075, 1)
      on conflict (user_id) do update set
        score = gamercred_scores.score + 75,
        tournaments_played = gamercred_scores.tournaments_played + 1,
        updated_at = now();
    end if;

    -- Notify winner
    insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
    values (
      p_winner_id, 'achievement',
      '🏆 Tournament Champion!',
      'You won ' || v_tournament.name || '! +' || v_tournament.prize_amount || ' PulsePoints awarded.',
      'tournament', v_match.tournament_id
    );

    -- Tournament completion post
    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'system',
      '🏆 ' || v_tournament.name || ' is complete! Champion: ' ||
      (select username from public.profiles where id = p_winner_id),
      p_match_id);
  end if;
end;
$$;

-- ── F3. Confirm match result ──────────────────────────────────────────────────
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
begin
  select * into v_match  from public.matches       where id = p_match_id;
  select * into v_report from public.match_reports where id = p_report_id;

  if not found then raise exception 'Report not found'; end if;

  -- Confirmer must be the opposing player
  if auth.uid() = v_report.reporter_id then
    raise exception 'Cannot confirm your own report';
  end if;
  if auth.uid() != v_match.player1_id and auth.uid() != v_match.player2_id then
    raise exception 'Only match participants can confirm results';
  end if;

  -- Insert confirmation
  insert into public.match_confirmations(match_id, report_id, confirmer_id, decision, reason)
  values (p_match_id, p_report_id, auth.uid(), p_decision, p_reason)
  on conflict (match_id, confirmer_id) do update set
    decision   = excluded.decision,
    reason     = excluded.reason,
    created_at = now();

  if p_decision = 'confirm' then
    -- Determine winner from scores
    if v_report.player1_score > v_report.player2_score then
      v_winner := v_match.player1_id;
    else
      v_winner := v_match.player2_id;
    end if;

    -- Update match scores and status
    update public.matches set
      player1_score = v_report.player1_score,
      player2_score = v_report.player2_score,
      status = 'verified'
    where id = p_match_id;

    -- Update report status
    update public.match_reports set status = 'confirmed' where id = p_report_id;

    -- Advance winner
    perform public.advance_match_winner(p_match_id, v_winner);

    -- Notify winner
    insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
    values (v_winner, 'match_start', '✅ Match confirmed', 'Your result was confirmed. You advance!', 'match', p_match_id);

    return jsonb_build_object('status', 'confirmed', 'winner_id', v_winner);

  else
    -- Dispute flow
    if p_reason is null then
      raise exception 'Reason is required to open a dispute';
    end if;

    update public.matches set status = 'disputed' where id = p_match_id;
    update public.match_reports set status = 'disputed' where id = p_report_id;

    -- Create dispute record
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

    -- Notify admins
    insert into public.tournament_posts(tournament_id, type, content, match_id)
    values (v_match.tournament_id, 'system', 'A dispute has been opened for Match #' || v_match.match_number || '. Admin review required.', p_match_id);

    return jsonb_build_object('status', 'disputed');
  end if;
end;
$$;

-- ── F4. Deduct entry fee ──────────────────────────────────────────────────────
create or replace function public.deduct_entry_fee(
  p_tournament_id uuid,
  p_user_id       uuid
) returns boolean language plpgsql security definer as $$
declare
  v_fee     int;
  v_balance int;
begin
  select entry_fee into v_fee from public.tournaments where id = p_tournament_id;
  if v_fee = 0 then return true; end if;

  select coalesce(sum(delta), 0) into v_balance
  from public.pulsepoints_ledger where user_id = p_user_id;

  if v_balance < v_fee then
    raise exception 'Insufficient PulsePoints balance (have %, need %)', v_balance, v_fee;
  end if;

  insert into public.pulsepoints_ledger(user_id, delta, reason, ref_type, ref_id, balance_after)
  values (p_user_id, -v_fee, 'Entry fee: ' || (select name from public.tournaments where id = p_tournament_id),
    'tournament_entry', p_tournament_id, v_balance - v_fee);

  insert into public.tournament_wallet_transactions(tournament_id, user_id, type, amount, currency, status, ref_type, ref_id)
  values (p_tournament_id, p_user_id, 'entry_fee', v_fee, 'PulsePoints', 'completed', 'tournament', p_tournament_id);

  return true;
end;
$$;

-- ── F5. Check-in participant ──────────────────────────────────────────────────
create or replace function public.tournament_check_in(p_tournament_id uuid)
returns void language plpgsql security definer as $$
declare
  v_tourn public.tournaments%rowtype;
begin
  select * into v_tourn from public.tournaments where id = p_tournament_id;

  -- Validate check-in window
  if v_tourn.check_in_open is not null and now() < v_tourn.check_in_open then
    raise exception 'Check-in has not opened yet';
  end if;
  if v_tourn.check_in_close is not null and now() > v_tourn.check_in_close then
    raise exception 'Check-in has closed';
  end if;

  -- Must be joined
  if not exists (
    select 1 from public.tournament_participants
    where tournament_id = p_tournament_id and user_id = auth.uid() and status = 'joined'
  ) then
    raise exception 'Not registered for this tournament';
  end if;

  update public.tournament_participants set
    status = 'checked_in',
    checked_in_at = now()
  where tournament_id = p_tournament_id and user_id = auth.uid();

  insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
  values (auth.uid(), 'tournament_join', '✅ Checked in!',
    'You are checked in for ' || v_tourn.name || '. Get ready!', 'tournament', p_tournament_id);
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.generate_bracket(uuid) to authenticated;
grant execute on function public.advance_match_winner(uuid, uuid) to authenticated;
grant execute on function public.confirm_match_result(uuid, uuid, text, text) to authenticated;
grant execute on function public.deduct_entry_fee(uuid, uuid) to authenticated;
grant execute on function public.tournament_check_in(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- Storage bucket for match proofs (run separately in Supabase Storage)
-- CREATE BUCKET: 'match-proofs' with public = false
-- RLS: authenticated users can upload to their own folder
-- ══════════════════════════════════════════════════════════════════════════════
