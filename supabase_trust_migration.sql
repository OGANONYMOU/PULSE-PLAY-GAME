-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Trust Infrastructure Migration
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tournament Participants ──────────────────────────────────────────────
create table if not exists public.tournament_participants (
  id              uuid        primary key default gen_random_uuid(),
  tournament_id   uuid        not null references public.tournaments(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  game_account_id uuid        null,
  status          text        not null default 'joined'
                              check (status in ('joined','checked_in','dropped')),
  joined_at       timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.tournament_participants enable row level security;

create policy "Users can see participants"
  on public.tournament_participants for select using (true);

create policy "Users can join tournaments"
  on public.tournament_participants for insert
  with check (auth.uid() = user_id);

create policy "Users can leave tournaments"
  on public.tournament_participants for delete
  using (auth.uid() = user_id);

create policy "Admins manage participants"
  on public.tournament_participants for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- Derive current_players from participant count (view for convenience)
create or replace view public.tournament_counts as
  select tournament_id, count(*) as participant_count
  from public.tournament_participants
  where status != 'dropped'
  group by tournament_id;

-- ── 2. Matches ──────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id              uuid        primary key default gen_random_uuid(),
  tournament_id   uuid        not null references public.tournaments(id) on delete cascade,
  round           int         not null default 1,
  status          text        not null default 'scheduled'
                              check (status in (
                                'scheduled','in_progress','awaiting_proof',
                                'disputed','verified','settled','canceled'
                              )),
  started_at      timestamptz null,
  proof_due_at    timestamptz null,
  created_at      timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Public can view matches"
  on public.matches for select using (true);

create policy "Admins manage matches"
  on public.matches for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 3. Evidence Objects ─────────────────────────────────────────────────────
create table if not exists public.evidence_objects (
  id           uuid        primary key default gen_random_uuid(),
  match_id     uuid        not null references public.matches(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  kind         text        not null check (kind in ('screenshot','video','log','other')),
  object_key   text        not null,
  sha256       text        not null default '',
  phash        text        null,
  captured_at  timestamptz null,
  created_at   timestamptz not null default now()
);

alter table public.evidence_objects enable row level security;

create policy "Users can view evidence for their matches"
  on public.evidence_objects for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

create policy "Users can submit evidence"
  on public.evidence_objects for insert with check (auth.uid() = user_id);

create policy "Admins manage evidence"
  on public.evidence_objects for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 4. Disputes ─────────────────────────────────────────────────────────────
create table if not exists public.disputes (
  id               uuid        primary key default gen_random_uuid(),
  match_id         uuid        not null unique references public.matches(id) on delete cascade,
  opened_by        uuid        not null references public.profiles(id),
  reason           text        not null,
  state            text        not null default 'open'
                               check (state in ('open','needs_more_info','resolved','canceled')),
  due_by           timestamptz null,
  resolved_by      uuid        null references public.profiles(id),
  resolved_at      timestamptz null,
  resolution       text        null,
  notes            text        null,
  created_at       timestamptz not null default now()
);

alter table public.disputes enable row level security;

create policy "Users can view their own disputes"
  on public.disputes for select
  using (
    auth.uid() = opened_by
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

create policy "Users can open disputes"
  on public.disputes for insert with check (auth.uid() = opened_by);

create policy "Admins manage disputes"
  on public.disputes for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 5. Audit Log ────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigserial   primary key,
  ts          timestamptz not null default now(),
  actor_id    uuid        null references auth.users(id) on delete set null,
  action      text        not null,
  entity_type text        not null,
  entity_id   uuid        null,
  ip          inet        null,
  user_agent  text        null,
  data        jsonb       not null default '{}'::jsonb
);

alter table public.audit_log enable row level security;

-- Audit log is write-only for authenticated users, read-only for admins
create policy "Users can write audit entries"
  on public.audit_log for insert
  with check (auth.uid() is not null);

create policy "Admins can read audit log"
  on public.audit_log for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 6. Outbox Events ────────────────────────────────────────────────────────
create table if not exists public.outbox_events (
  id           bigserial   primary key,
  ts           timestamptz not null default now(),
  topic        text        not null,
  key          text        null,
  payload      jsonb       not null,
  published_at timestamptz null
);

alter table public.outbox_events enable row level security;

create policy "Users can enqueue outbox events"
  on public.outbox_events for insert
  with check (auth.uid() is not null);

create policy "Admins can read outbox"
  on public.outbox_events for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 7. game_updates table (if not already run) ──────────────────────────────
create table if not exists public.game_updates (
  id           uuid        primary key default gen_random_uuid(),
  game_id      uuid        null references public.games(id) on delete cascade,
  type         text        not null check (type in ('update','news')),
  title        text        not null,
  content      text        not null,
  tag          text        not null default 'General',
  is_published boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid        null references auth.users(id)
);

alter table public.game_updates enable row level security;

-- Drop first so re-running the script is safe
drop policy if exists "Public read game_updates" on public.game_updates;
drop policy if exists "Admin full game_updates"  on public.game_updates;

create policy "Public read game_updates"
  on public.game_updates for select using (is_published = true);

create policy "Admin full game_updates"
  on public.game_updates for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
-- ══════════════════════════════════════════════════════════════════════════════
