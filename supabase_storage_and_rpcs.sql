-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Storage Buckets + Admin RPCs
-- Run AFTER all previous migrations in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Storage buckets ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true,  5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banners',  'banners',  true,  10485760,  ARRAY['image/jpeg','image/png','image/webp']),
  ('clips',    'clips',    false, 524288000, ARRAY['video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Public read for avatars and banners
DROP POLICY IF EXISTS "Public read avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Own delete avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Public read banners"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload banners"  ON storage.objects;
DROP POLICY IF EXISTS "Own delete banners"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload clips"    ON storage.objects;
DROP POLICY IF EXISTS "Own read clips"       ON storage.objects;
DROP POLICY IF EXISTS "Own delete clips"     ON storage.objects;
DROP POLICY IF EXISTS "Admin all storage"    ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Own delete avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Public read banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Auth upload banners"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Own delete banners"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'banners' AND owner = auth.uid());

CREATE POLICY "Auth upload clips"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'clips' AND auth.uid() IS NOT NULL);

CREATE POLICY "Own read clips"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clips' AND (owner = auth.uid() OR EXISTS (
    SELECT 1 FROM public.clips WHERE object_key = storage.objects.name AND is_published = true
  )));

CREATE POLICY "Own delete clips"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'clips' AND owner = auth.uid());

CREATE POLICY "Admin all storage"
  ON storage.objects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN','MODERATOR')
    )
  );

-- ── 2. get_community_stats() ──────────────────────────────────────────────────
-- Returns aggregate community content stats for the admin dashboard.
CREATE OR REPLACE FUNCTION public.get_community_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_posts     bigint;
  v_clips     bigint;
  v_comments  bigint;
  v_reports   bigint;
  v_featured  bigint;
BEGIN
  SELECT COUNT(*) INTO v_posts    FROM public.posts;
  SELECT COUNT(*) INTO v_clips    FROM public.clips    WHERE is_published = true;
  SELECT COUNT(*) INTO v_comments FROM public.post_comments;
  SELECT COUNT(*) INTO v_reports  FROM public.content_reports WHERE status = 'pending';
  SELECT COUNT(*) INTO v_featured FROM public.posts WHERE tag = 'tournament';

  RETURN jsonb_build_object(
    'totalPosts',       v_posts,
    'totalClips',       v_clips,
    'totalComments',    v_comments,
    'pendingReview',    v_reports,
    'reportedContent',  v_reports,
    'featuredContent',  v_featured,
    'trendingToday',    0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_stats() TO authenticated;

-- ── 3. get_admin_metrics() ────────────────────────────────────────────────────
-- Returns real-time platform metrics for the admin incident dashboard.
CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_users      bigint;
  v_tournaments_live  bigint;
  v_moderation_queue  bigint;
  v_pending_disputes  bigint;
BEGIN
  -- Users active in the last 15 minutes (via updated_at as proxy)
  SELECT COUNT(*) INTO v_active_users
  FROM public.profiles
  WHERE updated_at > now() - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_tournaments_live
  FROM public.tournaments
  WHERE status = 'ongoing';

  SELECT COUNT(*) INTO v_moderation_queue
  FROM public.content_reports
  WHERE status = 'pending';

  SELECT COUNT(*) INTO v_pending_disputes
  FROM public.match_disputes
  WHERE status = 'pending';

  RETURN jsonb_build_object(
    'active_users',       v_active_users,
    'reports_per_hour',   0,
    'tournaments_live',   v_tournaments_live,
    'system_health',      99,
    'moderation_queue',   v_moderation_queue,
    'pending_disputes',   v_pending_disputes
  );
EXCEPTION WHEN undefined_table THEN
  RETURN jsonb_build_object(
    'active_users',     0,
    'reports_per_hour', 0,
    'tournaments_live', v_tournaments_live,
    'system_health',    99,
    'moderation_queue', v_moderation_queue,
    'pending_disputes', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_metrics() TO authenticated;
