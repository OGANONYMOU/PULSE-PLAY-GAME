-- ============================================================
-- PulsePay MVP — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── PROFILES (add missing columns) ────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url       TEXT,
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS discord_username TEXT,
  ADD COLUMN IF NOT EXISTS twitter_username TEXT,
  ADD COLUMN IF NOT EXISTS is_banned        BOOLEAN NOT NULL DEFAULT false;

-- ─── GAMES TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  icon             TEXT NOT NULL DEFAULT '🎮',
  logo_url         TEXT,
  badge            TEXT,
  player_count     INTEGER NOT NULL DEFAULT 0,
  tournament_count INTEGER NOT NULL DEFAULT 0,
  category         TEXT NOT NULL DEFAULT 'other',
  featured         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add logo_url if table already existed without it
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ─── TOURNAMENTS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  game_id          UUID REFERENCES public.games(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed')),
  date             TIMESTAMPTZ NOT NULL,
  prize_pool       TEXT NOT NULL DEFAULT '0',
  max_players      INTEGER NOT NULL DEFAULT 64,
  current_players  INTEGER NOT NULL DEFAULT 0,
  duration         TEXT NOT NULL DEFAULT '2h',
  winner           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ANNOUNCEMENTS TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','success','event')),
  pinned      BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── POSTS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT 'general' CHECK (tag IN ('general','tournament','tips','clips')),
  likes      INTEGER NOT NULL DEFAULT 0,
  comments   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── LIVE UPDATES TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  message        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    NEW.email,
    'USER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── SEED DEFAULT GAMES (with logos) ───────────────────────
-- Only inserts if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.games LIMIT 1) THEN
    INSERT INTO public.games (name, description, icon, logo_url, badge, player_count, tournament_count, category, featured)
    VALUES
      ('eFootball',           'The ultimate mobile football experience with real-time matchmaking and seasonal competitions.',          '⚽', '/games/efootball.webp',   'Popular',  12500, 18, 'sports',        false),
      ('EA FC Mobile',        'EA Sports FC Mobile brings the world''s most popular sport to your fingertips.',                       '⚽', '/games/fifa-mobile.webp', 'Hot',      18200, 22, 'sports',        false),
      ('Call of Duty Mobile', 'Iconic FPS combat brought to mobile — battle royale, multiplayer, and ranked modes.',                  '🔫', '/games/cod-mobile.webp',  'Trending', 28400, 32, 'fps',           true),
      ('PUBG Mobile',         'Drop in, loot up, and outlast 99 rivals in the original mobile battle royale.',                       '🪖', '/games/pubg.webp',        'Popular',  19800, 25, 'battle-royale', false),
      ('Free Fire',           'Fast-paced 10-minute battle royale built for mobile — quick games, big wins.',                        '🔥', '/games/free-fire.webp',   'New',      22100, 21, 'battle-royale', false);
  END IF;
END $$;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE public.games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_updates  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "games_read"   ON public.games;
DROP POLICY IF EXISTS "games_write"  ON public.games;
CREATE POLICY "games_read"  ON public.games FOR SELECT USING (true);
CREATE POLICY "games_write" ON public.games FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));

DROP POLICY IF EXISTS "tourn_read"  ON public.tournaments;
DROP POLICY IF EXISTS "tourn_write" ON public.tournaments;
CREATE POLICY "tourn_read"  ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "tourn_write" ON public.tournaments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));

DROP POLICY IF EXISTS "ann_read"  ON public.announcements;
DROP POLICY IF EXISTS "ann_write" ON public.announcements;
CREATE POLICY "ann_read"  ON public.announcements FOR SELECT
  USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));
CREATE POLICY "ann_write" ON public.announcements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));

DROP POLICY IF EXISTS "posts_read"         ON public.posts;
DROP POLICY IF EXISTS "posts_insert"       ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"   ON public.posts;
DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;
CREATE POLICY "posts_read"         ON public.posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "posts_insert"       ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_delete_own"   ON public.posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "posts_delete_admin" ON public.posts FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));

DROP POLICY IF EXISTS "lu_read"  ON public.live_updates;
DROP POLICY IF EXISTS "lu_write" ON public.live_updates;
CREATE POLICY "lu_read"  ON public.live_updates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lu_write" ON public.live_updates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));