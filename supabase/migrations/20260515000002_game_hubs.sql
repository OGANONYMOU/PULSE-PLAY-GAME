-- ═══════════════════════════════════════════════════════════════════════════════
-- [PULSEPLAY] Game Hubs — game_follows + game_news
-- Paste entire file into Supabase SQL Editor and click Run.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── [1/6] TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_follows (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id    uuid        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.game_news (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     uuid        NOT NULL,
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  content     text,
  type        text        DEFAULT 'update'
                          CHECK (type IN ('update', 'patch', 'esports', 'event', 'announcement')),
  image_url   text,
  is_pinned   boolean     DEFAULT false,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── [2/6] OPTIONAL FOREIGN KEYS ───────────────────────────────────────────────

DO $$
BEGIN
  -- game_follows.game_id → games
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'game_follows_game_id_fkey' AND table_name = 'game_follows'
    ) THEN
      ALTER TABLE public.game_follows ADD CONSTRAINT game_follows_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- game_news.game_id → games
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'game_news_game_id_fkey' AND table_name = 'game_news'
    ) THEN
      ALTER TABLE public.game_news ADD CONSTRAINT game_news_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ── [3/6] INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_game_follows_game_id   ON public.game_follows(game_id);
CREATE INDEX IF NOT EXISTS idx_game_follows_user_id   ON public.game_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_game_news_game_created ON public.game_news(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_news_pinned       ON public.game_news(is_pinned) WHERE is_pinned = true;

-- ── [4/6] ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE public.game_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_news    ENABLE ROW LEVEL SECURITY;

-- ── [5/6] GAME_FOLLOWS POLICIES ───────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_follows' AND policyname='gf_select') THEN
    CREATE POLICY "gf_select" ON public.game_follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_follows' AND policyname='gf_insert') THEN
    CREATE POLICY "gf_insert" ON public.game_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_follows' AND policyname='gf_delete') THEN
    CREATE POLICY "gf_delete" ON public.game_follows FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── [6/6] GAME_NEWS POLICIES ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_news' AND policyname='gn_select') THEN
    CREATE POLICY "gn_select" ON public.game_news FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_news' AND policyname='gn_insert') THEN
    CREATE POLICY "gn_insert" ON public.game_news FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_news' AND policyname='gn_update') THEN
    CREATE POLICY "gn_update" ON public.game_news FOR UPDATE USING (auth.uid() = created_by);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables created: game_follows, game_news
-- ═══════════════════════════════════════════════════════════════════════════════
