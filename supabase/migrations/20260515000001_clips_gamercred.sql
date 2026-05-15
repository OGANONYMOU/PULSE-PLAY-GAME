-- ═══════════════════════════════════════════════════════════════════════════════
-- PulsePlay Phase 1 — Clips System + GamerCred
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Clips ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clips (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description     text,
  object_key      text        NOT NULL,
  thumbnail_key   text,
  duration_secs   integer     DEFAULT 0,
  likes_count     integer     DEFAULT 0,
  reposts_count   integer     DEFAULT 0,
  views_count     integer     DEFAULT 0,
  comments_count  integer     DEFAULT 0,
  game_id         uuid        REFERENCES public.games(id),
  tournament_id   uuid        REFERENCES public.tournaments(id),
  week_start      date        DEFAULT date_trunc('week', now())::date,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clips_user_id    ON public.clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_week_start ON public.clips(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_clips_game_id    ON public.clips(game_id);
CREATE INDEX IF NOT EXISTS idx_clips_created    ON public.clips(created_at DESC);

-- ── Clip interactions (likes) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clip_interactions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id    uuid        NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text        NOT NULL DEFAULT 'like',
  created_at timestamptz DEFAULT now(),
  UNIQUE (clip_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_clip_interactions_clip ON public.clip_interactions(clip_id);

-- ── Clip comments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clip_comments (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id    uuid        NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  author_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id  uuid        REFERENCES public.clip_comments(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clip_comments_clip ON public.clip_comments(clip_id);

-- ── GamerCred ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gamercred_score integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.gamercred_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text        NOT NULL,
  points     integer     NOT NULL,
  meta       jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamercred_user ON public.gamercred_events(user_id, created_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.clips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamercred_events   ENABLE ROW LEVEL SECURITY;

-- clips
CREATE POLICY "clips_select"     ON public.clips FOR SELECT  USING (true);
CREATE POLICY "clips_insert"     ON public.clips FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clips_update_own" ON public.clips FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "clips_delete_own" ON public.clips FOR DELETE  USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR'))
);

-- clip_interactions
CREATE POLICY "ci_select" ON public.clip_interactions FOR SELECT USING (true);
CREATE POLICY "ci_insert" ON public.clip_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ci_delete" ON public.clip_interactions FOR DELETE USING (auth.uid() = user_id);

-- clip_comments
CREATE POLICY "cc_select" ON public.clip_comments FOR SELECT USING (true);
CREATE POLICY "cc_insert" ON public.clip_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "cc_delete" ON public.clip_comments FOR DELETE USING (
  auth.uid() = author_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR'))
);

-- gamercred_events
CREATE POLICY "gc_select_own" ON public.gamercred_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gc_insert"     ON public.gamercred_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Storage bucket: clips ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clips', 'clips', true,
  104857600,
  ARRAY['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "clips_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'clips');

CREATE POLICY "clips_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'clips' AND auth.role() = 'authenticated');

CREATE POLICY "clips_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'clips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Atomic like counter ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_clip_likes(clip_id uuid, delta integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.clips SET likes_count = GREATEST(0, likes_count + delta) WHERE id = clip_id;
$$;

-- ── Award GamerCred ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_gamercred(
  p_user_id   uuid,
  p_event     text,
  p_points    integer,
  p_meta      jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.gamercred_events (user_id, event_type, points, meta)
  VALUES (p_user_id, p_event, p_points, p_meta);

  UPDATE public.profiles
  SET gamercred_score = GREATEST(0, gamercred_score + p_points)
  WHERE id = p_user_id;
END;
$$;
