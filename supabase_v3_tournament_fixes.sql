-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay v3 — Tournament Engine: Critical Fixes + Full Feature Set
-- Run in Supabase SQL Editor AFTER all previous migrations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix tournament_participants status constraint (add 'withdrawn') ────────
alter table public.tournament_participants
  drop constraint if exists tournament_participants_status_check;

alter table public.tournament_participants
  add constraint tournament_participants_status_check
  check (status in ('joined', 'checked_in', 'dropped', 'withdrawn'));

-- ── 2. Add UPDATE policy so users can withdraw (update own row) ───────────────
drop policy if exists "Users can update own participation" on public.tournament_participants;
create policy "Users can update own participation"
  on public.tournament_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. Fix tournaments status constraint (add 'cancelled') ───────────────────
alter table public.tournaments
  drop constraint if exists tournaments_status_check;

alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('upcoming', 'ongoing', 'completed', 'cancelled'));

-- ── 4. Add missing columns to tournaments ────────────────────────────────────
alter table public.tournaments
  add column if not exists description text null,
  add column if not exists end_date    timestamptz null,
  add column if not exists banner_url  text null,
  add column if not exists thumbnail_url text null,
  add column if not exists streaming_url text null,
  add column if not exists sponsors    text[] null;

-- ── 5. Tournament edit policy (creator + staff) ──────────────────────────────
drop policy if exists "Organizers can edit tournaments" on public.tournaments;
create policy "Organizers can edit tournaments"
  on public.tournaments for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
    or exists (
      select 1 from public.tournament_staff ts
      where ts.tournament_id = id
        and ts.user_id = auth.uid()
        and ts.role in ('host','manager')
    )
  );

drop policy if exists "Organizers can create tournaments" on public.tournaments;
create policy "Organizers can create tournaments"
  on public.tournaments for insert
  with check (
    auth.uid() is not null and (
      created_by = auth.uid()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
      )
    )
  );

-- ── 6. tournament_fixtures table (frontend queries this) ─────────────────────
create table if not exists public.tournament_fixtures (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  round               int         not null default 1,
  match_number        int         not null default 1,
  home_participant_id uuid        null references public.profiles(id) on delete set null,
  away_participant_id uuid        null references public.profiles(id) on delete set null,
  home_score          int         null,
  away_score          int         null,
  winner_id           uuid        null references public.profiles(id) on delete set null,
  status              text        not null default 'scheduled'
                                    check (status in (
                                      'scheduled','in_progress','completed',
                                      'cancelled','walkover','postponed'
                                    )),
  scheduled_at        timestamptz null,
  played_at           timestamptz null,
  notes               text        null,
  created_at          timestamptz not null default now()
);

alter table public.tournament_fixtures enable row level security;

drop policy if exists "tournament_fixtures_public"  on public.tournament_fixtures;
drop policy if exists "tournament_fixtures_staff"   on public.tournament_fixtures;
drop policy if exists "tournament_fixtures_insert"  on public.tournament_fixtures;

create policy "tournament_fixtures_public" on public.tournament_fixtures
  for select using (true);

create policy "tournament_fixtures_staff" on public.tournament_fixtures
  for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and (
        t.created_by = auth.uid()
        or exists (
          select 1 from public.tournament_staff ts
          where ts.tournament_id = t.id and ts.user_id = auth.uid()
            and ts.role in ('host','manager','bracket_manager','reporter')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('ADMIN','MODERATOR','SUPER_ADMIN')
        )
      )
    )
  );

create index if not exists idx_tournament_fixtures_tournament
  on public.tournament_fixtures(tournament_id);
create index if not exists idx_tournament_fixtures_round
  on public.tournament_fixtures(tournament_id, round);

-- ── 7. tournament_standings table (frontend queries this) ─────────────────────
create table if not exists public.tournament_standings (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  participant_id      uuid        not null references public.profiles(id) on delete cascade,
  position            int         not null default 0,
  played              int         not null default 0,
  won                 int         not null default 0,
  drawn               int         not null default 0,
  lost                int         not null default 0,
  goals_for           int         not null default 0,
  goals_against       int         not null default 0,
  goal_difference     int         not null generated always as (goals_for - goals_against) stored,
  points              int         not null default 0,
  form                text[]      null,
  updated_at          timestamptz not null default now(),
  unique (tournament_id, participant_id)
);

alter table public.tournament_standings enable row level security;

drop policy if exists "tournament_standings_public" on public.tournament_standings;
drop policy if exists "tournament_standings_staff"  on public.tournament_standings;

create policy "tournament_standings_public"
  on public.tournament_standings for select using (true);

create policy "tournament_standings_staff"
  on public.tournament_standings for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
    or exists (
      select 1 from public.tournaments
      where id = tournament_id and created_by = auth.uid()
    )
    or exists (
      select 1 from public.tournament_staff ts
      where ts.tournament_id = tournament_id and ts.user_id = auth.uid()
        and ts.role in ('host','manager','bracket_manager','reporter')
    )
  );

create index if not exists idx_tournament_standings_tournament
  on public.tournament_standings(tournament_id);
create index if not exists idx_tournament_standings_points
  on public.tournament_standings(tournament_id, points desc);

-- ── 8. Battle-royale standings table ─────────────────────────────────────────
create table if not exists public.tournament_br_standings (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  participant_id      uuid        not null references public.profiles(id) on delete cascade,
  position            int         not null default 0,
  matches_played      int         not null default 0,
  total_kills         int         not null default 0,
  placement_points    int         not null default 0,
  chicken_dinners     int         not null default 0,
  total_placements    int         not null default 0,
  updated_at          timestamptz not null default now(),
  unique (tournament_id, participant_id)
);

alter table public.tournament_br_standings enable row level security;

drop policy if exists "tournament_br_standings_public" on public.tournament_br_standings;
drop policy if exists "tournament_br_standings_staff"  on public.tournament_br_standings;

create policy "tournament_br_standings_public"
  on public.tournament_br_standings for select using (true);

create policy "tournament_br_standings_staff"
  on public.tournament_br_standings for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
    or exists (
      select 1 from public.tournaments
      where id = tournament_id and created_by = auth.uid()
    )
  );

create index if not exists idx_tournament_br_standings_tournament
  on public.tournament_br_standings(tournament_id);

-- ── 9. Notifications table ────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null default 'info',
  title       text        not null,
  body        text        not null,
  ref_type    text        null,
  ref_id      uuid        null,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_own_select" on public.notifications;
drop policy if exists "notifications_own_update" on public.notifications;
drop policy if exists "notifications_insert"     on public.notifications;

create policy "notifications_own_select"
  on public.notifications for select using (auth.uid() = user_id);

create policy "notifications_own_update"
  on public.notifications for update using (auth.uid() = user_id);

create policy "notifications_insert"
  on public.notifications for insert with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
  );

create index if not exists idx_notifications_user
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(user_id, is_read)
  where is_read = false;

-- ── 10. audit_logs table (if missing the one referenced by code) ───────────────
create table if not exists public.audit_logs (
  id          bigserial   primary key,
  ts          timestamptz not null default now(),
  actor_id    uuid        null references auth.users(id) on delete set null,
  action      text        not null,
  entity_type text        not null,
  entity_id   uuid        null,
  data        jsonb       not null default '{}'::jsonb,
  ip_address  text        null,
  user_agent  text        null,
  severity    text        not null default 'info'
                          check (severity in ('debug','info','warning','critical')),
  created_at  timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_write"       on public.audit_logs;
drop policy if exists "audit_logs_admin_read"  on public.audit_logs;

create policy "audit_logs_write"
  on public.audit_logs for insert with check (auth.uid() is not null);

create policy "audit_logs_admin_read"
  on public.audit_logs for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
  );

create index if not exists idx_audit_logs_actor   on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ══════════════════════════════════════════════════════════════════════════════
-- STORED FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── F1. Withdraw from tournament ──────────────────────────────────────────────
create or replace function public.withdraw_from_tournament(
  p_tournament_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_tournament  record;
  v_participant record;
  v_username    text;
begin
  -- Fetch tournament
  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found';
  end if;

  -- Validate tournament state
  if v_tournament.status = 'ongoing' then
    raise exception 'Cannot withdraw: tournament has already started';
  end if;
  if v_tournament.status = 'completed' then
    raise exception 'Cannot withdraw: tournament is already completed';
  end if;
  if v_tournament.status = 'cancelled' then
    raise exception 'Tournament is cancelled';
  end if;

  -- Get participant record
  select * into v_participant
  from public.tournament_participants
  where tournament_id = p_tournament_id and user_id = auth.uid();

  if not found then
    raise exception 'Registration not found: you are not registered for this tournament';
  end if;

  if v_participant.status in ('withdrawn', 'dropped') then
    raise exception 'You have already withdrawn from this tournament';
  end if;

  -- Get username for notification
  select username into v_username from public.profiles where id = auth.uid();

  -- Mark as withdrawn
  update public.tournament_participants
  set status = 'withdrawn'
  where tournament_id = p_tournament_id and user_id = auth.uid();

  -- Decrement player count (floor at 0)
  update public.tournaments
  set current_players = greatest(0, current_players - 1)
  where id = p_tournament_id;

  -- Refund entry fee if paid
  if v_tournament.entry_fee > 0 then
    insert into public.pulsepoints_ledger(
      user_id, delta, reason, ref_type, ref_id, balance_after
    ) values (
      auth.uid(),
      v_tournament.entry_fee,
      'Refund: withdrew from ' || v_tournament.name,
      'tournament_refund',
      p_tournament_id,
      coalesce(
        (select sum(delta) from public.pulsepoints_ledger where user_id = auth.uid()),
        0
      ) + v_tournament.entry_fee
    );

    insert into public.tournament_wallet_transactions(
      tournament_id, user_id, type, amount, currency, status
    ) values (
      p_tournament_id, auth.uid(), 'refund',
      v_tournament.entry_fee, 'PulsePoints', 'completed'
    );
  end if;

  -- Post activity to tournament feed
  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (
    p_tournament_id, 'system',
    v_username || ' has withdrawn from the tournament.',
    null
  );

  -- Self-notification
  insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
  values (
    auth.uid(), 'info',
    'Withdrawal confirmed',
    'You have successfully withdrawn from ' || v_tournament.name
      || case when v_tournament.entry_fee > 0
              then '. Entry fee of ' || v_tournament.entry_fee || ' PP has been refunded.'
              else '.'
         end,
    'tournament', p_tournament_id
  );

  return jsonb_build_object(
    'success',  true,
    'refunded', v_tournament.entry_fee > 0,
    'amount',   v_tournament.entry_fee
  );
end;
$$;

grant execute on function public.withdraw_from_tournament(uuid) to authenticated;

-- ── F2. Generate round-robin fixtures ─────────────────────────────────────────
create or replace function public.generate_round_robin_fixtures(
  p_tournament_id     uuid,
  p_start_date        timestamptz default now(),
  p_interval_hours    int         default 24
) returns jsonb language plpgsql security definer as $$
declare
  v_participants  uuid[];
  v_n             int;
  v_total_rounds  int;
  v_round         int;
  v_match_num     int := 1;
  v_i             int;
  v_p1            uuid;
  v_p2            uuid;
  v_fixed         uuid;
  v_rotated       uuid[];
  v_temp          uuid;
  v_scheduled_at  timestamptz;
  v_fixtures_created int := 0;
begin
  -- Permission check
  if not (
    exists (
      select 1 from public.tournaments
      where id = p_tournament_id and created_by = auth.uid()
    ) or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    ) or exists (
      select 1 from public.tournament_staff ts
      where ts.tournament_id = p_tournament_id
        and ts.user_id = auth.uid()
        and ts.role in ('host','manager','bracket_manager')
    )
  ) then
    raise exception 'Not authorized to generate fixtures';
  end if;

  -- Gather participants
  select array_agg(user_id order by coalesce(seed, 9999), joined_at)
  into v_participants
  from public.tournament_participants
  where tournament_id = p_tournament_id
    and status in ('joined', 'checked_in');

  v_n := coalesce(array_length(v_participants, 1), 0);
  if v_n < 2 then
    raise exception 'Need at least 2 participants (got %)', v_n;
  end if;

  -- Delete existing fixtures for this tournament
  delete from public.tournament_fixtures where tournament_id = p_tournament_id;
  -- Reset standings
  delete from public.tournament_standings where tournament_id = p_tournament_id;

  -- Pad to even count with null BYE
  if v_n % 2 = 1 then
    v_participants := v_participants || array[null::uuid];
    v_n := v_n + 1;
  end if;

  v_total_rounds := v_n - 1;
  v_fixed        := v_participants[1];
  v_rotated      := v_participants[2:v_n];

  for v_round in 1..v_total_rounds loop
    v_scheduled_at :=
      p_start_date + ((v_round - 1) * p_interval_hours) * interval '1 hour';

    -- First slot: fixed vs last rotated
    v_p1 := v_fixed;
    v_p2 := v_rotated[array_length(v_rotated, 1)];

    if v_p1 is not null and v_p2 is not null then
      insert into public.tournament_fixtures(
        tournament_id, round, match_number,
        home_participant_id, away_participant_id,
        status, scheduled_at
      ) values (
        p_tournament_id, v_round, v_match_num,
        v_p1, v_p2, 'scheduled', v_scheduled_at
      );
      v_match_num        := v_match_num + 1;
      v_fixtures_created := v_fixtures_created + 1;
    end if;

    -- Remaining pairs
    for v_i in 1..(v_n/2 - 1) loop
      v_p1 := v_rotated[v_i];
      v_p2 := v_rotated[v_n - 1 - v_i];  -- mirror index in rotated array
      if v_p1 is not null and v_p2 is not null then
        insert into public.tournament_fixtures(
          tournament_id, round, match_number,
          home_participant_id, away_participant_id,
          status, scheduled_at
        ) values (
          p_tournament_id, v_round, v_match_num,
          v_p1, v_p2, 'scheduled', v_scheduled_at
        );
        v_match_num        := v_match_num + 1;
        v_fixtures_created := v_fixtures_created + 1;
      end if;
    end loop;

    -- Rotate (drop first, append last to front)
    v_temp    := v_rotated[1];
    for v_i in 1..(array_length(v_rotated, 1) - 1) loop
      v_rotated[v_i] := v_rotated[v_i + 1];
    end loop;
    v_rotated[array_length(v_rotated, 1)] := v_temp;
  end loop;

  -- Seed standings for all non-BYE participants
  for v_i in 1..array_length(v_participants, 1) loop
    if v_participants[v_i] is not null then
      insert into public.tournament_standings(
        tournament_id, participant_id, played, won, drawn, lost,
        goals_for, goals_against, points
      ) values (
        p_tournament_id, v_participants[v_i],
        0, 0, 0, 0, 0, 0, 0
      ) on conflict (tournament_id, participant_id) do nothing;
    end if;
  end loop;

  -- Post to feed
  insert into public.tournament_posts(tournament_id, type, content, author_id)
  values (
    p_tournament_id, 'bracket',
    'Round-robin fixtures generated — ' || v_fixtures_created ||
    ' matches across ' || v_total_rounds || ' rounds.',
    null
  );

  return jsonb_build_object(
    'fixtures_created', v_fixtures_created,
    'rounds',           v_total_rounds,
    'participants',     v_n
  );
end;
$$;

grant execute on function public.generate_round_robin_fixtures(uuid, timestamptz, int)
  to authenticated;

-- ── F3. Generate single-elimination from participants (simpler wrapper) ────────
-- (The existing generate_bracket function covers this; this just adds a check-in bypass)
create or replace function public.generate_fixtures_auto(
  p_tournament_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_tourn record;
  v_result jsonb;
begin
  select * into v_tourn from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  -- Permission check
  if not (
    v_tourn.created_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
  ) then
    raise exception 'Not authorized';
  end if;

  -- Dispatch by tournament type
  if v_tourn.tournament_type in ('round_robin', 'league', 'group_stage') then
    select public.generate_round_robin_fixtures(p_tournament_id) into v_result;
  else
    select public.generate_bracket(p_tournament_id) into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.generate_fixtures_auto(uuid) to authenticated;

-- ── F4. Record fixture result + update standings ───────────────────────────────
create or replace function public.record_fixture_result(
  p_fixture_id  uuid,
  p_home_score  int,
  p_away_score  int
) returns jsonb language plpgsql security definer as $$
declare
  v_fix         record;
  v_home_won    boolean;
  v_away_won    boolean;
  v_drawn       boolean;
  v_home_pts    int;
  v_away_pts    int;
  v_home_form   char;
  v_away_form   char;
begin
  select * into v_fix from public.tournament_fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;

  -- Permission check
  if not (
    exists (
      select 1 from public.tournaments t
      where t.id = v_fix.tournament_id and (
        t.created_by = auth.uid()
        or exists (
          select 1 from public.tournament_staff ts
          where ts.tournament_id = t.id and ts.user_id = auth.uid()
            and ts.role in ('host','manager','bracket_manager','reporter','referee')
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('ADMIN','MODERATOR','SUPER_ADMIN')
        )
      )
    )
  ) then
    raise exception 'Not authorized to record fixture results';
  end if;

  v_home_won := p_home_score > p_away_score;
  v_away_won := p_away_score > p_home_score;
  v_drawn    := p_home_score = p_away_score;
  v_home_pts := case when v_home_won then 3 when v_drawn then 1 else 0 end;
  v_away_pts := case when v_away_won then 3 when v_drawn then 1 else 0 end;
  v_home_form := case when v_home_won then 'W' when v_drawn then 'D' else 'L' end;
  v_away_form := case when v_away_won then 'W' when v_drawn then 'D' else 'L' end;

  -- Update fixture record
  update public.tournament_fixtures set
    home_score  = p_home_score,
    away_score  = p_away_score,
    status      = 'completed',
    played_at   = now(),
    winner_id   = case
      when v_home_won then home_participant_id
      when v_away_won then away_participant_id
      else null
    end
  where id = p_fixture_id;

  -- Update home standings
  if v_fix.home_participant_id is not null then
    insert into public.tournament_standings(
      tournament_id, participant_id,
      played, won, drawn, lost,
      goals_for, goals_against, points, form
    ) values (
      v_fix.tournament_id, v_fix.home_participant_id,
      1,
      case when v_home_won then 1 else 0 end,
      case when v_drawn    then 1 else 0 end,
      case when v_away_won then 1 else 0 end,
      p_home_score, p_away_score,
      v_home_pts,
      array[v_home_form::text]
    )
    on conflict (tournament_id, participant_id) do update set
      played        = tournament_standings.played + 1,
      won           = tournament_standings.won   + case when v_home_won then 1 else 0 end,
      drawn         = tournament_standings.drawn + case when v_drawn    then 1 else 0 end,
      lost          = tournament_standings.lost  + case when v_away_won then 1 else 0 end,
      goals_for     = tournament_standings.goals_for     + p_home_score,
      goals_against = tournament_standings.goals_against + p_away_score,
      points        = tournament_standings.points + v_home_pts,
      form = (
        case
          when array_length(tournament_standings.form, 1) >= 5
            then tournament_standings.form[2:5]
          else tournament_standings.form
        end || array[v_home_form::text]
      ),
      updated_at = now();
  end if;

  -- Update away standings
  if v_fix.away_participant_id is not null then
    insert into public.tournament_standings(
      tournament_id, participant_id,
      played, won, drawn, lost,
      goals_for, goals_against, points, form
    ) values (
      v_fix.tournament_id, v_fix.away_participant_id,
      1,
      case when v_away_won then 1 else 0 end,
      case when v_drawn    then 1 else 0 end,
      case when v_home_won then 1 else 0 end,
      p_away_score, p_home_score,
      v_away_pts,
      array[v_away_form::text]
    )
    on conflict (tournament_id, participant_id) do update set
      played        = tournament_standings.played + 1,
      won           = tournament_standings.won   + case when v_away_won then 1 else 0 end,
      drawn         = tournament_standings.drawn + case when v_drawn    then 1 else 0 end,
      lost          = tournament_standings.lost  + case when v_home_won then 1 else 0 end,
      goals_for     = tournament_standings.goals_for     + p_away_score,
      goals_against = tournament_standings.goals_against + p_home_score,
      points        = tournament_standings.points + v_away_pts,
      form = (
        case
          when array_length(tournament_standings.form, 1) >= 5
            then tournament_standings.form[2:5]
          else tournament_standings.form
        end || array[v_away_form::text]
      ),
      updated_at = now();
  end if;

  return jsonb_build_object(
    'success', true,
    'result',  case when v_home_won then 'home' when v_away_won then 'away' else 'draw' end
  );
end;
$$;

grant execute on function public.record_fixture_result(uuid, int, int) to authenticated;

-- ── F5. Record battle-royale match result ─────────────────────────────────────
create or replace function public.record_br_result(
  p_tournament_id    uuid,
  p_participant_id   uuid,
  p_kills            int,
  p_placement        int,   -- e.g. 1 = winner, 2 = 2nd, etc.
  p_total_players    int default 100
) returns void language plpgsql security definer as $$
declare
  v_placement_pts int;
begin
  -- Permission check
  if not (
    exists (
      select 1 from public.tournaments
      where id = p_tournament_id and created_by = auth.uid()
    ) or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
  ) then
    raise exception 'Not authorized';
  end if;

  -- Standard placement points (PUBG-style)
  v_placement_pts := case
    when p_placement = 1  then 15
    when p_placement = 2  then 12
    when p_placement = 3  then 10
    when p_placement <= 5  then 8
    when p_placement <= 10 then 5
    when p_placement <= 15 then 3
    when p_placement <= 20 then 2
    else 1
  end;

  insert into public.tournament_br_standings(
    tournament_id, participant_id,
    matches_played, total_kills, placement_points,
    chicken_dinners, total_placements
  ) values (
    p_tournament_id, p_participant_id,
    1, p_kills, v_placement_pts,
    case when p_placement = 1 then 1 else 0 end,
    p_placement
  )
  on conflict (tournament_id, participant_id) do update set
    matches_played   = tournament_br_standings.matches_played + 1,
    total_kills      = tournament_br_standings.total_kills + p_kills,
    placement_points = tournament_br_standings.placement_points + v_placement_pts,
    chicken_dinners  = tournament_br_standings.chicken_dinners
                         + case when p_placement = 1 then 1 else 0 end,
    total_placements = tournament_br_standings.total_placements + p_placement,
    updated_at       = now();
end;
$$;

grant execute on function public.record_br_result(uuid, uuid, int, int, int) to authenticated;

-- ── F6. Auto-update tournament status on date change ─────────────────────────
create or replace function public.auto_update_tournament_status()
returns void language plpgsql security definer as $$
begin
  -- Upcoming → mark expired as completed if end_date passed and still ongoing
  update public.tournaments
  set status = 'completed'
  where status = 'ongoing'
    and end_date is not null
    and end_date < now();

  -- Tournaments with start date in past but still upcoming → auto-start
  -- (only if no bracket required, i.e. easy_mode or explicit auto-start)
  update public.tournaments
  set status = 'ongoing'
  where status = 'upcoming'
    and easy_mode = true
    and date < now()
    and (registration_closes is null or registration_closes < now());
end;
$$;

-- ── F7. Send tournament notification to all participants ──────────────────────
create or replace function public.notify_tournament_participants(
  p_tournament_id uuid,
  p_type          text,
  p_title         text,
  p_body          text
) returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  v_row   record;
begin
  -- Permission check
  if not (
    exists (
      select 1 from public.tournaments
      where id = p_tournament_id and created_by = auth.uid()
    ) or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('ADMIN','MODERATOR','SUPER_ADMIN')
    )
  ) then
    raise exception 'Not authorized';
  end if;

  for v_row in
    select user_id from public.tournament_participants
    where tournament_id = p_tournament_id
      and status in ('joined','checked_in')
  loop
    insert into public.notifications(user_id, type, title, body, ref_type, ref_id)
    values (v_row.user_id, p_type, p_title, p_body, 'tournament', p_tournament_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.notify_tournament_participants(uuid, text, text, text)
  to authenticated;

-- ── F8. Get tournament role for a user ────────────────────────────────────────
-- (Safe re-create; already exists in phase1 but may be missing in some envs)
create or replace function public.get_my_tournament_role(
  p_tournament_id uuid
) returns text language plpgsql security definer as $$
declare
  v_profile_role text;
  v_staff_role   text;
begin
  select role into v_profile_role from public.profiles where id = auth.uid();
  if v_profile_role in ('ADMIN','MODERATOR','SUPER_ADMIN') then return 'admin'; end if;

  if exists (
    select 1 from public.tournaments
    where id = p_tournament_id and created_by = auth.uid()
  ) then return 'host'; end if;

  select role into v_staff_role from public.tournament_staff
  where tournament_id = p_tournament_id and user_id = auth.uid();

  return v_staff_role;  -- null if no role
end;
$$;

grant execute on function public.get_my_tournament_role(uuid) to authenticated;

-- ── Realtime for new tables ───────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.tournament_fixtures;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.tournament_standings;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.tournament_br_standings;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Apply with: Supabase Dashboard → SQL Editor → paste → Run
-- ══════════════════════════════════════════════════════════════════════════════
