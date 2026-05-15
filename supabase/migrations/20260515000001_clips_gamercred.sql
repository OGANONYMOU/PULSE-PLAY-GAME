-- ═══════════════════════════════════════════════════════════════════════════════
-- [PULSEPLAY] Phase 1 — Clips System + GamerCred
-- Paste the entire file into Supabase SQL Editor and click Run.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS / ON CONFLICT everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── [1/8] TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clips (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description     text,
  object_key      text        NOT NULL,
  thumbnail_key   text,
  duration_secs   integer     DEFAULT 0,
  likes_count     integer     DEFAULT 0,
  reposts_count   integer     DEFAULT 0,
  views_count     integer     DEFAULT 0,
  comments_count  integer     DEFAULT 0,
  game_id         uuid,
  tournament_id   uuid,
  week_start      date        DEFAULT date_trunc('week', now())::date,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clip_interactions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id    uuid        NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL DEFAULT 'like',
  created_at timestamptz DEFAULT now(),
  UNIQUE (clip_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS public.clip_comments (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id    uuid        NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  author_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id  uuid        REFERENCES public.clip_comments(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamercred_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text        NOT NULL,
  points     integer     NOT NULL,
  meta       jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ── [2/8] ADD GAMERCRED SCORE TO PROFILES ─────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gamercred_score integer DEFAULT 0;
  END IF;
END $$;

-- ── [3/8] ADD OPTIONAL FOREIGN KEYS (only if parent tables exist) ─────────────

DO $$
BEGIN
  -- clips.game_id → games
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'clips_game_id_fkey' AND table_name = 'clips'
    ) THEN
      ALTER TABLE public.clips ADD CONSTRAINT clips_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- clips.tournament_id → tournaments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tournaments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'clips_tournament_id_fkey' AND table_name = 'clips'
    ) THEN
      ALTER TABLE public.clips ADD CONSTRAINT clips_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ── [4/8] INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clips_user_id    ON public.clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_week_start ON public.clips(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_clips_game_id    ON public.clips(game_id);
CREATE INDEX IF NOT EXISTS idx_clips_created    ON public.clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clip_interactions_clip ON public.clip_interactions(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_comments_clip    ON public.clip_comments(clip_id);
CREATE INDEX IF NOT EXISTS idx_gamercred_user        ON public.gamercred_events(user_id, created_at DESC);

-- ── [5/8] ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE public.clips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamercred_events  ENABLE ROW LEVEL SECURITY;

-- clips policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clips' AND policyname='clips_select') THEN
    CREATE POLICY "clips_select" ON public.clips FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clips' AND policyname='clips_insert') THEN
    CREATE POLICY "clips_insert" ON public.clips FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clips' AND policyname='clips_update_own') THEN
    CREATE POLICY "clips_update_own" ON public.clips FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clips' AND policyname='clips_delete_own') THEN
    CREATE POLICY "clips_delete_own" ON public.clips FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- clip_interactions policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_interactions' AND policyname='ci_select') THEN
    CREATE POLICY "ci_select" ON public.clip_interactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_interactions' AND policyname='ci_insert') THEN
    CREATE POLICY "ci_insert" ON public.clip_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_interactions' AND policyname='ci_delete') THEN
    CREATE POLICY "ci_delete" ON public.clip_interactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- clip_comments policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_comments' AND policyname='cc_select') THEN
    CREATE POLICY "cc_select" ON public.clip_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_comments' AND policyname='cc_insert') THEN
    CREATE POLICY "cc_insert" ON public.clip_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clip_comments' AND policyname='cc_delete') THEN
    CREATE POLICY "cc_delete" ON public.clip_comments FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

-- gamercred_events policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gamercred_events' AND policyname='gc_select_own') THEN
    CREATE POLICY "gc_select_own" ON public.gamercred_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gamercred_events' AND policyname='gc_insert') THEN
    CREATE POLICY "gc_insert" ON public.gamercred_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── [6/8] STORAGE BUCKET ──────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clips', 'clips', true,
  104857600,
  ARRAY['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='clips_storage_select') THEN
    CREATE POLICY "clips_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'clips');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='clips_storage_insert') THEN
    CREATE POLICY "clips_storage_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'clips' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='clips_storage_delete') THEN
    CREATE POLICY "clips_storage_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'clips' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- ── [7/8] FUNCTION: increment_clip_likes ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_clip_likes(clip_id uuid, delta integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.clips SET likes_count = GREATEST(0, likes_count + delta) WHERE id = clip_id;
$$;

-- ── [8/8] FUNCTION: award_gamercred ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.award_gamercred(
  p_user_id   uuid,
  p_event     text,
  p_points    integer,
  p_meta      jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.gamercred_events (user_id, event_type, points, meta)
  VALUES (p_user_id, p_event, p_points, p_meta);

  -- Update profiles if that table exists (conditional to avoid error on bare DB)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    UPDATE public.profiles
    SET gamercred_score = GREATEST(0, gamercred_score + p_points)
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables created: clips, clip_interactions, clip_comments, gamercred_events
-- Column added: profiles.gamercred_score
-- Functions: increment_clip_likes, award_gamercred
-- Storage bucket: clips (100MB, video+image)
-- ═══════════════════════════════════════════════════════════════════════════════
