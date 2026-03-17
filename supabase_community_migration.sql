-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Community System Migration
-- Run after supabase_trust_migration.sql and supabase_extended_migration.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Post Reactions (replaces simple likes counter) ───────────────────────
create table if not exists public.post_reactions (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.posts(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  reaction_type text        not null default 'like'
                            check (reaction_type in ('like','fire','trophy','clap','mind_blown')),
  created_at    timestamptz not null default now(),
  unique (post_id, user_id, reaction_type)
);

-- ── 2. Post Comments (threaded) ─────────────────────────────────────────────
create table if not exists public.post_comments (
  id            uuid        primary key default gen_random_uuid(),
  post_id       uuid        not null references public.posts(id) on delete cascade,
  parent_id     uuid        null references public.post_comments(id) on delete cascade,
  author_id     uuid        not null references public.profiles(id) on delete cascade,
  content       text        not null,
  upvotes       int         not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_post_comments_post    on public.post_comments(post_id, created_at desc);
create index if not exists idx_post_comments_parent  on public.post_comments(parent_id);

-- ── 3. Post Saves / Bookmarks ───────────────────────────────────────────────
create table if not exists public.post_saves (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- ── 4. Post Reposts (quote reposts) ─────────────────────────────────────────
create table if not exists public.post_reposts (
  id            uuid        primary key default gen_random_uuid(),
  original_id   uuid        not null references public.posts(id) on delete cascade,
  reposter_id   uuid        not null references public.profiles(id) on delete cascade,
  quote_text    text        null,
  created_at    timestamptz not null default now(),
  unique (original_id, reposter_id)
);

-- ── 5. Content Reports ──────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id            uuid        primary key default gen_random_uuid(),
  reporter_id   uuid        not null references public.profiles(id) on delete cascade,
  content_type  text        not null check (content_type in ('post','clip','comment','profile')),
  content_id    uuid        not null,
  reason        text        not null check (reason in (
    'spam','hate_speech','harassment','misinformation',
    'adult_content','violence','cheating','other'
  )),
  description   text        null,
  status        text        not null default 'pending'
                            check (status in ('pending','reviewed','actioned','dismissed')),
  reviewed_by   uuid        null references public.profiles(id),
  reviewed_at   timestamptz null,
  action_taken  text        null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_reports_status on public.content_reports(status, created_at desc);

-- ── 6. Moderation Logs ──────────────────────────────────────────────────────
create table if not exists public.moderation_logs (
  id            bigserial   primary key,
  moderator_id  uuid        not null references public.profiles(id),
  action        text        not null check (action in (
    'delete_post','delete_clip','delete_comment','ban_user','unban_user',
    'mute_user','unmute_user','adjust_gamercred','feature_content',
    'dismiss_report','action_report','warn_user'
  )),
  target_type   text        not null,
  target_id     uuid        not null,
  reason        text        not null,
  notes         text        null,
  created_at    timestamptz not null default now()
);

-- ── 7. Followers ────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id           uuid        primary key default gen_random_uuid(),
  follower_id  uuid        not null references public.profiles(id) on delete cascade,
  following_id uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id != following_id)
);

create index if not exists idx_follows_follower  on public.follows(follower_id);
create index if not exists idx_follows_following on public.follows(following_id);

-- ── 8. Rivalries ────────────────────────────────────────────────────────────
create table if not exists public.rivalries (
  id           uuid        primary key default gen_random_uuid(),
  player_a     uuid        not null references public.profiles(id) on delete cascade,
  player_b     uuid        not null references public.profiles(id) on delete cascade,
  game_id      uuid        null references public.games(id) on delete set null,
  wins_a       int         not null default 0,
  wins_b       int         not null default 0,
  matches      int         not null default 0,
  last_match   timestamptz null,
  created_at   timestamptz not null default now(),
  unique (player_a, player_b, game_id)
);

-- ── 9. Notifications ────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  type         text        not null check (type in (
    'like','comment','repost','follow','tournament_join',
    'match_start','dispute_update','mention','achievement','system'
  )),
  title        text        not null,
  body         text        not null default '',
  ref_type     text        null,
  ref_id       uuid        null,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- ── 10. Community Events ────────────────────────────────────────────────────
create table if not exists public.community_events (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text        not null default '',
  type         text        not null check (type in (
    'clip_of_week','strategy_friday','community_tournament',
    'king_of_hill','weekly_challenge','season_finale'
  )),
  game_id      uuid        null references public.games(id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  prize_pool   text        null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

-- ── 11. Daily Challenges ────────────────────────────────────────────────────
create table if not exists public.daily_challenges (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text        not null,
  type         text        not null check (type in (
    'play_match','upload_clip','post_comment','join_tournament',
    'follow_player','win_match','complete_profile'
  )),
  points_reward int        not null default 10,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.user_challenge_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  challenge_id uuid        not null references public.daily_challenges(id) on delete cascade,
  completed    boolean     not null default false,
  completed_at timestamptz null,
  date_key     text        not null, -- 'YYYY-MM-DD' to scope to today
  created_at   timestamptz not null default now(),
  unique (user_id, challenge_id, date_key)
);

-- ── 12. Clip Comments ───────────────────────────────────────────────────────
create table if not exists public.clip_comments (
  id           uuid        primary key default gen_random_uuid(),
  clip_id      uuid        not null references public.clips(id) on delete cascade,
  parent_id    uuid        null references public.clip_comments(id) on delete cascade,
  author_id    uuid        not null references public.profiles(id) on delete cascade,
  content      text        not null,
  upvotes      int         not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_clip_comments_clip on public.clip_comments(clip_id, created_at desc);

-- ── 13. Add columns to existing tables ──────────────────────────────────────

-- posts: add reposts_count, saves_count, reaction_counts
alter table public.posts add column if not exists reposts_count int not null default 0;
alter table public.posts add column if not exists saves_count   int not null default 0;

-- clips: add comments_count if missing
alter table public.clips add column if not exists comments_count int not null default 0;

-- profiles: add follower/following counts, match stats
alter table public.profiles add column if not exists followers_count  int not null default 0;
alter table public.profiles add column if not exists following_count  int not null default 0;
alter table public.profiles add column if not exists matches_played   int not null default 0;
alter table public.profiles add column if not exists matches_won      int not null default 0;
alter table public.profiles add column if not exists tournaments_won  int not null default 0;
alter table public.profiles add column if not exists region           text null;
alter table public.profiles add column if not exists is_muted         boolean not null default false;

-- ── 14. RLS Policies ────────────────────────────────────────────────────────
alter table public.post_reactions      enable row level security;
alter table public.post_comments       enable row level security;
alter table public.post_saves          enable row level security;
alter table public.post_reposts        enable row level security;
alter table public.content_reports     enable row level security;
alter table public.moderation_logs     enable row level security;
alter table public.follows             enable row level security;
alter table public.rivalries           enable row level security;
alter table public.notifications       enable row level security;
alter table public.community_events    enable row level security;
alter table public.daily_challenges    enable row level security;
alter table public.user_challenge_progress enable row level security;
alter table public.clip_comments       enable row level security;

-- Reactions
drop policy if exists "Public read reactions"    on public.post_reactions;
drop policy if exists "Auth react"               on public.post_reactions;
drop policy if exists "Remove own reaction"      on public.post_reactions;
create policy "Public read reactions"   on public.post_reactions for select using (true);
create policy "Auth can react"          on public.post_reactions for insert with check (auth.uid() = user_id);
create policy "Remove own reaction"     on public.post_reactions for delete using (auth.uid() = user_id);

-- Comments
drop policy if exists "Public read comments"   on public.post_comments;
drop policy if exists "Auth comment"           on public.post_comments;
drop policy if exists "Delete own comment"     on public.post_comments;
create policy "Public read comments"  on public.post_comments for select using (true);
create policy "Auth can comment"      on public.post_comments for insert with check (auth.uid() = author_id);
create policy "Delete own comment"    on public.post_comments for delete using (
  auth.uid() = author_id or
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- Saves
drop policy if exists "Own saves"    on public.post_saves;
create policy "Own saves only"  on public.post_saves for all using (auth.uid() = user_id);

-- Reposts
drop policy if exists "Public reposts"  on public.post_reposts;
drop policy if exists "Auth repost"     on public.post_reposts;
create policy "Public reposts"  on public.post_reposts for select using (true);
create policy "Auth repost"     on public.post_reposts for insert with check (auth.uid() = reposter_id);
create policy "Delete own repost" on public.post_reposts for delete using (auth.uid() = reposter_id);

-- Reports
drop policy if exists "Auth report"          on public.content_reports;
drop policy if exists "Admin read reports"   on public.content_reports;
create policy "Auth can report"       on public.content_reports for insert with check (auth.uid() = reporter_id);
create policy "Admin read reports"    on public.content_reports for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);
create policy "Admin update reports"  on public.content_reports for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- Moderation logs
drop policy if exists "Admin mod logs" on public.moderation_logs;
create policy "Admins write mod logs" on public.moderation_logs for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);
create policy "Admins read mod logs"  on public.moderation_logs for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- Follows
drop policy if exists "Public follows"    on public.follows;
drop policy if exists "Auth follow"       on public.follows;
drop policy if exists "Remove own follow" on public.follows;
create policy "Public follows visible"  on public.follows for select using (true);
create policy "Auth can follow"         on public.follows for insert with check (auth.uid() = follower_id);
create policy "Remove own follow"       on public.follows for delete using (auth.uid() = follower_id);

-- Rivalries
drop policy if exists "Public rivalries" on public.rivalries;
create policy "Public rivalries visible" on public.rivalries for select using (true);
create policy "System writes rivalries"  on public.rivalries for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- Notifications
drop policy if exists "Own notifications" on public.notifications;
create policy "Users see own notifications" on public.notifications for all using (auth.uid() = user_id);
create policy "System create notifs" on public.notifications for insert with check (true);

-- Community events
drop policy if exists "Public events" on public.community_events;
create policy "Public events visible" on public.community_events for select using (is_active = true);
create policy "Admin manage events"   on public.community_events for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- Daily challenges
drop policy if exists "Public challenges" on public.daily_challenges;
create policy "Public challenges visible"  on public.daily_challenges for select using (is_active = true);
create policy "Admin manage challenges"    on public.daily_challenges for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);
drop policy if exists "User progress"  on public.user_challenge_progress;
create policy "User own progress"  on public.user_challenge_progress for all using (auth.uid() = user_id);

-- Clip comments
drop policy if exists "Public clip comments"    on public.clip_comments;
drop policy if exists "Auth clip comment"       on public.clip_comments;
create policy "Public clip comments visible" on public.clip_comments for select using (true);
create policy "Auth can clip comment"        on public.clip_comments for insert with check (auth.uid() = author_id);
create policy "Delete own clip comment"      on public.clip_comments for delete using (
  auth.uid() = author_id or
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','MODERATOR'))
);

-- ── 15. Seed default daily challenges ───────────────────────────────────────
insert into public.daily_challenges (title, description, type, points_reward) values
  ('Play a Match',         'Compete in any tournament match',       'play_match',        20),
  ('Upload a Clip',        'Share your best play with the community','upload_clip',       30),
  ('Comment on 3 Posts',   'Join conversations in the feed',        'post_comment',      10),
  ('Join a Tournament',    'Register for any upcoming tournament',  'join_tournament',   15),
  ('Follow a Player',      'Follow someone new on PulsePlay',       'follow_player',      5),
  ('Win a Match',          'Secure a victory in a tournament match','win_match',         50),
  ('Complete Your Profile','Fill in your bio and region',           'complete_profile',  25)
on conflict do nothing;

-- ══════════════════════════════════════════════════════════════════════════════
-- Done. 13 new tables, follower/stats columns on profiles.
-- ══════════════════════════════════════════════════════════════════════════════
