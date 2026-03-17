-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Extended Migration: Clubs, Clips, PulsePoints, GamerCred
-- Run AFTER supabase_trust_migration.sql
-- Safe to re-run (uses IF NOT EXISTS + DROP/CREATE for policies)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Clubs ────────────────────────────────────────────────────────────────
create table if not exists public.clubs (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  tag          text        not null unique,           -- e.g. "PPFC" (max 5 chars)
  description  text        not null default '',
  logo_url     text        null,
  banner_url   text        null,
  game_id      uuid        null references public.games(id) on delete set null,
  created_by   uuid        not null references public.profiles(id) on delete cascade,
  is_public    boolean     not null default true,
  invite_code  text        not null default substr(md5(random()::text), 1, 8),
  member_count int         not null default 1,
  wins         int         not null default 0,
  losses       int         not null default 0,
  points       int         not null default 0,
  created_at   timestamptz not null default now(),
  constraint clubs_tag_format check (char_length(tag) between 2 and 5)
);

create table if not exists public.club_members (
  id         uuid        primary key default gen_random_uuid(),
  club_id    uuid        not null references public.clubs(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  role       text        not null default 'member' check (role in ('owner','admin','member')),
  joined_at  timestamptz not null default now(),
  unique (club_id, user_id)
);

alter table public.clubs       enable row level security;
alter table public.club_members enable row level security;

drop policy if exists "Public clubs visible"      on public.clubs;
drop policy if exists "Members can view clubs"    on public.clubs;
drop policy if exists "Authenticated can create"  on public.clubs;
drop policy if exists "Club admins can update"    on public.clubs;
drop policy if exists "Platform admins all clubs" on public.clubs;
drop policy if exists "Public club members"       on public.club_members;
drop policy if exists "Auth can join clubs"       on public.club_members;
drop policy if exists "Members can leave"         on public.club_members;
drop policy if exists "Platform admins members"   on public.club_members;

create policy "Public clubs visible"
  on public.clubs for select using (is_public = true or created_by = auth.uid());

create policy "Authenticated can create clubs"
  on public.clubs for insert with check (auth.uid() = created_by);

create policy "Club admins can update"
  on public.clubs for update using (
    exists (select 1 from public.club_members where club_id = id and user_id = auth.uid() and role in ('owner','admin'))
  );

create policy "Platform admins all clubs"
  on public.clubs for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

create policy "Public club members visible"
  on public.club_members for select using (true);

create policy "Auth can join clubs"
  on public.club_members for insert with check (auth.uid() = user_id);

create policy "Members can leave"
  on public.club_members for delete using (auth.uid() = user_id);

create policy "Platform admins members"
  on public.club_members for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 2. Clips ────────────────────────────────────────────────────────────────
create table if not exists public.clips (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  game_id         uuid        null references public.games(id) on delete set null,
  tournament_id   uuid        null references public.tournaments(id) on delete set null,
  title           text        not null,
  description     text        not null default '',
  object_key      text        not null,          -- Supabase Storage path
  thumbnail_key   text        null,
  duration_secs   int         not null default 0,
  likes_count     int         not null default 0,
  reposts_count   int         not null default 0,
  views_count     int         not null default 0,
  comments_count  int         not null default 0,
  is_published    boolean     not null default false, -- false until processed
  is_featured     boolean     not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.clip_interactions (
  id         uuid        primary key default gen_random_uuid(),
  clip_id    uuid        not null references public.clips(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  type       text        not null check (type in ('like','repost','view')),
  created_at timestamptz not null default now(),
  unique (clip_id, user_id, type)
);

alter table public.clips             enable row level security;
alter table public.clip_interactions enable row level security;

drop policy if exists "Public clips"           on public.clips;
drop policy if exists "Auth upload clips"      on public.clips;
drop policy if exists "Owner edit clips"       on public.clips;
drop policy if exists "Platform admin clips"   on public.clips;
drop policy if exists "Public interactions"    on public.clip_interactions;
drop policy if exists "Auth interact"          on public.clip_interactions;
drop policy if exists "Remove own interaction" on public.clip_interactions;

create policy "Published clips visible"
  on public.clips for select using (is_published = true or user_id = auth.uid());

create policy "Auth upload clips"
  on public.clips for insert with check (auth.uid() = user_id);

create policy "Owner edit clips"
  on public.clips for update using (auth.uid() = user_id);

create policy "Platform admin clips"
  on public.clips for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

create policy "Public clip interactions visible"
  on public.clip_interactions for select using (true);

create policy "Auth can interact with clips"
  on public.clip_interactions for insert with check (auth.uid() = user_id);

create policy "Remove own interaction"
  on public.clip_interactions for delete using (auth.uid() = user_id);

-- ── 3. PulsePoints Ledger ───────────────────────────────────────────────────
create table if not exists public.pulsepoints_ledger (
  id            bigserial   primary key,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  delta         int         not null,             -- +/- points
  reason        text        not null,             -- human-readable reason
  ref_type      text        null,                 -- 'tournament_join', 'clip_like', etc.
  ref_id        uuid        null,
  balance_after int         not null default 0,
  created_at    timestamptz not null default now()
);

-- Materialized balance view
create or replace view public.pulsepoints_balances as
  select user_id, coalesce(sum(delta), 0) as balance
  from public.pulsepoints_ledger
  group by user_id;

alter table public.pulsepoints_ledger enable row level security;

drop policy if exists "Own ledger select"  on public.pulsepoints_ledger;
drop policy if exists "System insert only" on public.pulsepoints_ledger;
drop policy if exists "Admin read ledger"  on public.pulsepoints_ledger;

create policy "Users see own ledger"
  on public.pulsepoints_ledger for select using (auth.uid() = user_id);

create policy "Admins read all ledger"
  on public.pulsepoints_ledger for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

create policy "Authenticated can insert ledger entries"
  on public.pulsepoints_ledger for insert with check (auth.uid() = user_id);

-- ── 4. GamerCred Scores ─────────────────────────────────────────────────────
create table if not exists public.gamercred_scores (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null unique references public.profiles(id) on delete cascade,
  score                 int         not null default 1000,  -- ELO-style, starts at 1000
  wins                  int         not null default 0,
  losses                int         not null default 0,
  tournaments_played    int         not null default 0,
  disputes_opened       int         not null default 0,
  disputes_won          int         not null default 0,
  sportsmanship_flags   int         not null default 0,     -- negative signals
  verified_badge        boolean     not null default false,
  updated_at            timestamptz not null default now()
);

alter table public.gamercred_scores enable row level security;

drop policy if exists "Public gamercred"  on public.gamercred_scores;
drop policy if exists "Admin gamercred"   on public.gamercred_scores;
drop policy if exists "Self insert cred"  on public.gamercred_scores;

create policy "GamerCred scores are public"
  on public.gamercred_scores for select using (true);

create policy "Users can upsert own cred"
  on public.gamercred_scores for insert with check (auth.uid() = user_id);

create policy "Platform admins manage cred"
  on public.gamercred_scores for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 5. Guides ───────────────────────────────────────────────────────────────
create table if not exists public.guides (
  id           uuid        primary key default gen_random_uuid(),
  game_id      uuid        null references public.games(id) on delete cascade,
  author_id    uuid        not null references public.profiles(id) on delete cascade,
  title        text        not null,
  content      text        not null,
  category     text        not null default 'general'
               check (category in ('beginner','tactics','formation','skills','meta','general')),
  likes_count  int         not null default 0,
  is_published boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.guides enable row level security;

drop policy if exists "Public guides"   on public.guides;
drop policy if exists "Auth write guide" on public.guides;

create policy "Published guides are public"
  on public.guides for select using (is_published = true);

create policy "Authenticated can write guides"
  on public.guides for insert with check (auth.uid() = author_id);

create policy "Admin manage guides"
  on public.guides for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
  );

-- ── 6. Indexes for performance ───────────────────────────────────────────────
create index if not exists idx_clips_game_id      on public.clips(game_id);
create index if not exists idx_clips_user_id      on public.clips(user_id);
create index if not exists idx_clips_published    on public.clips(is_published, created_at desc);
create index if not exists idx_club_members_club  on public.club_members(club_id);
create index if not exists idx_club_members_user  on public.club_members(user_id);
create index if not exists idx_pp_ledger_user     on public.pulsepoints_ledger(user_id, created_at desc);
create index if not exists idx_gamercred_score    on public.gamercred_scores(score desc);
create index if not exists idx_guides_game        on public.guides(game_id, created_at desc);

-- ── 7. PulsePoints earn triggers ─────────────────────────────────────────────
-- Auto-award points when a user joins a tournament
create or replace function public.award_join_points()
returns trigger language plpgsql security definer as $$
begin
  insert into public.pulsepoints_ledger(user_id, delta, reason, ref_type, ref_id, balance_after)
  values (
    NEW.user_id, 10, 'Joined tournament', 'tournament_join', NEW.tournament_id,
    coalesce((select sum(delta) from public.pulsepoints_ledger where user_id = NEW.user_id), 0) + 10
  );
  return NEW;
end;
$$;

drop trigger if exists trg_award_join_points on public.tournament_participants;
create trigger trg_award_join_points
  after insert on public.tournament_participants
  for each row execute function public.award_join_points();

-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Verify tables:
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
-- ══════════════════════════════════════════════════════════════════════════════
