-- ══════════════════════════════════════════════════════════════════════════════
-- Battle Royale Tournament Enhancements
-- Adds: per-game scoring configs, per-game results, room code distribution
-- Supports: PUBG Mobile, Free Fire, CODM BR, CODM MP, and custom presets
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. BR SCORING CONFIGS ─────────────────────────────────────────────────────
-- Stores per-tournament kill points multiplier and placement points table.
-- placement_points is a PostgreSQL integer array: index 1 = 1st place points.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='br_scoring_configs') THEN
    CREATE TABLE public.br_scoring_configs (
      id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      tournament_id     uuid        NOT NULL,
      kill_points       numeric(4,2) NOT NULL DEFAULT 1.0,
      placement_points  integer[]   NOT NULL DEFAULT ARRAY[10,6,5,4,3,2,2,2,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      preset_name       text,       -- 'pubg', 'free_fire', 'codm_br', 'codm_mp', 'custom'
      game_mode         text,       -- 'tpp', 'fpp', 'br', 'mp', 'clash_squad', 'hardpoint', 'snd'
      games_per_session integer     NOT NULL DEFAULT 4,
      created_at        timestamptz DEFAULT now()
    );
    ALTER TABLE public.br_scoring_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_scoring_configs' AND policyname='bsc_read') THEN
    CREATE POLICY "bsc_read" ON public.br_scoring_configs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_scoring_configs' AND policyname='bsc_manage') THEN
    CREATE POLICY "bsc_manage" ON public.br_scoring_configs FOR ALL
      USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_scoring_configs' AND policyname='bsc_insert_auth') THEN
    CREATE POLICY "bsc_insert_auth" ON public.br_scoring_configs FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 2. BR GAME RESULTS (per-game, per-participant) ────────────────────────────
-- Each row = one participant's result in one game (e.g. game 2 of session 1).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='br_game_results') THEN
    CREATE TABLE public.br_game_results (
      id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      tournament_id     uuid        NOT NULL,
      session_number    integer     NOT NULL DEFAULT 1,
      game_number       integer     NOT NULL DEFAULT 1,
      participant_id    uuid        NOT NULL,
      kills             integer     NOT NULL DEFAULT 0,
      placement         integer     NOT NULL DEFAULT 1,
      placement_points  integer     NOT NULL DEFAULT 0,
      kill_points       numeric(6,2) NOT NULL DEFAULT 0,
      total_points      numeric(6,2) NOT NULL DEFAULT 0,
      proof_url         text,
      submitted_by      uuid        REFERENCES auth.users(id),
      is_verified       boolean     DEFAULT false,
      verified_by       uuid        REFERENCES auth.users(id),
      created_at        timestamptz DEFAULT now(),
      UNIQUE (tournament_id, session_number, game_number, participant_id)
    );
    ALTER TABLE public.br_game_results ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_game_results' AND policyname='bgr_read') THEN
    CREATE POLICY "bgr_read" ON public.br_game_results FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_game_results' AND policyname='bgr_insert') THEN
    CREATE POLICY "bgr_insert" ON public.br_game_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='br_game_results' AND policyname='bgr_update') THEN
    CREATE POLICY "bgr_update" ON public.br_game_results FOR UPDATE
      USING (auth.uid() = submitted_by OR public.is_admin_or_moderator(auth.uid()));
  END IF;
END $$;

-- ── 3. TOURNAMENT ROOM CODES ──────────────────────────────────────────────────
-- Organizers publish room ID + password per session/game.
-- Only registered non-withdrawn participants can read these.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tournament_room_codes') THEN
    CREATE TABLE public.tournament_room_codes (
      id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      tournament_id   uuid        NOT NULL,
      session_number  integer     NOT NULL DEFAULT 1,
      game_number     integer     NOT NULL DEFAULT 1,
      room_id         text        NOT NULL,
      room_password   text        NOT NULL,
      opens_at        timestamptz,
      note            text,
      created_by      uuid        REFERENCES auth.users(id),
      created_at      timestamptz DEFAULT now(),
      UNIQUE (tournament_id, session_number, game_number)
    );
    ALTER TABLE public.tournament_room_codes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_room_codes' AND policyname='rc_manage') THEN
    CREATE POLICY "rc_manage" ON public.tournament_room_codes FOR ALL
      USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_room_codes' AND policyname='rc_organizer_insert') THEN
    CREATE POLICY "rc_organizer_insert" ON public.tournament_room_codes FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_room_codes' AND policyname='rc_organizer_update') THEN
    CREATE POLICY "rc_organizer_update" ON public.tournament_room_codes FOR UPDATE
      USING (auth.uid() = created_by OR public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_room_codes' AND policyname='rc_participant_read') THEN
    CREATE POLICY "rc_participant_read" ON public.tournament_room_codes FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.tournament_participants tp
        WHERE tp.tournament_id = tournament_room_codes.tournament_id
          AND tp.user_id = auth.uid()
          AND tp.status NOT IN ('withdrawn', 'dropped', 'disqualified')
      )
      OR public.is_admin_or_moderator(auth.uid())
    );
  END IF;
END $$;

-- ── 4. RPC: upsert_br_scoring_config ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_br_scoring_config(uuid, numeric, integer[], text, text, integer);
CREATE OR REPLACE FUNCTION public.upsert_br_scoring_config(
  p_tournament_id    uuid,
  p_kill_points      numeric,
  p_placement_points integer[],
  p_preset_name      text DEFAULT NULL,
  p_game_mode        text DEFAULT NULL,
  p_games_per_session integer DEFAULT 4
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.br_scoring_configs
    (tournament_id, kill_points, placement_points, preset_name, game_mode, games_per_session)
  VALUES
    (p_tournament_id, p_kill_points, p_placement_points, p_preset_name, p_game_mode, p_games_per_session)
  ON CONFLICT (tournament_id)
  DO UPDATE SET
    kill_points      = p_kill_points,
    placement_points = p_placement_points,
    preset_name      = p_preset_name,
    game_mode        = p_game_mode,
    games_per_session = p_games_per_session;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_br_scoring_config(uuid, numeric, integer[], text, text, integer) TO authenticated;

-- Add unique constraint on tournament_id for br_scoring_configs (needed for ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'br_scoring_configs_tournament_id_key'
  ) THEN
    ALTER TABLE public.br_scoring_configs ADD CONSTRAINT br_scoring_configs_tournament_id_key UNIQUE (tournament_id);
  END IF;
END $$;

-- ── 5. RPC: submit_br_game_result ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_br_game_result(uuid, integer, integer, uuid, integer, integer, text);
CREATE OR REPLACE FUNCTION public.submit_br_game_result(
  p_tournament_id   uuid,
  p_session_number  integer,
  p_game_number     integer,
  p_participant_id  uuid,
  p_kills           integer,
  p_placement       integer,
  p_proof_url       text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_config        RECORD;
  v_placement_pts integer;
  v_kill_pts      numeric(6,2);
  v_total_pts     numeric(6,2);
  v_result_id     uuid;
  v_arr_len       integer;
BEGIN
  -- Get scoring config
  SELECT * INTO v_config FROM public.br_scoring_configs
  WHERE tournament_id = p_tournament_id LIMIT 1;

  IF NOT FOUND THEN
    -- Default PUBG-style if no config
    v_placement_pts := CASE
      WHEN p_placement = 1        THEN 10
      WHEN p_placement = 2        THEN 6
      WHEN p_placement = 3        THEN 5
      WHEN p_placement = 4        THEN 4
      WHEN p_placement = 5        THEN 3
      WHEN p_placement BETWEEN 6  AND 10 THEN 2
      WHEN p_placement BETWEEN 11 AND 15 THEN 1
      ELSE 0
    END;
    v_kill_pts := p_kills::numeric;
  ELSE
    v_arr_len := array_length(v_config.placement_points, 1);
    v_placement_pts := COALESCE(
      CASE WHEN p_placement <= v_arr_len THEN (v_config.placement_points)[p_placement] ELSE 0 END,
      0
    );
    v_kill_pts := p_kills::numeric * v_config.kill_points;
  END IF;

  v_total_pts := v_placement_pts + v_kill_pts;

  INSERT INTO public.br_game_results (
    tournament_id, session_number, game_number, participant_id,
    kills, placement, placement_points, kill_points, total_points,
    proof_url, submitted_by
  ) VALUES (
    p_tournament_id, p_session_number, p_game_number, p_participant_id,
    p_kills, p_placement, v_placement_pts, v_kill_pts, v_total_pts,
    p_proof_url, auth.uid()
  )
  ON CONFLICT (tournament_id, session_number, game_number, participant_id)
  DO UPDATE SET
    kills             = p_kills,
    placement         = p_placement,
    placement_points  = v_placement_pts,
    kill_points       = v_kill_pts,
    total_points      = v_total_pts,
    proof_url         = COALESCE(p_proof_url, br_game_results.proof_url),
    submitted_by      = auth.uid()
  RETURNING id INTO v_result_id;

  -- Refresh aggregated BR standings
  INSERT INTO public.tournament_br_standings (
    tournament_id, participant_id,
    matches_played, total_kills, placement_points, total_placements, chicken_dinners
  )
  SELECT
    p_tournament_id,
    p_participant_id,
    COUNT(*)::integer,
    SUM(kills)::integer,
    SUM(placement_points)::integer,
    SUM(placement)::integer,
    COUNT(*) FILTER (WHERE placement = 1)::integer
  FROM public.br_game_results
  WHERE tournament_id = p_tournament_id AND participant_id = p_participant_id
  ON CONFLICT (tournament_id, participant_id)
  DO UPDATE SET
    matches_played    = EXCLUDED.matches_played,
    total_kills       = EXCLUDED.total_kills,
    placement_points  = EXCLUDED.placement_points,
    total_placements  = EXCLUDED.total_placements,
    chicken_dinners   = EXCLUDED.chicken_dinners;

  RETURN jsonb_build_object(
    'success',          true,
    'result_id',        v_result_id,
    'placement_points', v_placement_pts,
    'kill_points',      v_kill_pts,
    'total_points',     v_total_pts
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_br_game_result(uuid, integer, integer, uuid, integer, integer, text) TO authenticated;

-- ── 6. RPC: upsert_room_code ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_room_code(uuid, integer, integer, text, text, timestamptz, text);
CREATE OR REPLACE FUNCTION public.upsert_room_code(
  p_tournament_id  uuid,
  p_session        integer,
  p_game           integer,
  p_room_id        text,
  p_room_password  text,
  p_opens_at       timestamptz DEFAULT NULL,
  p_note           text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.tournament_room_codes
    (tournament_id, session_number, game_number, room_id, room_password, opens_at, note, created_by)
  VALUES
    (p_tournament_id, p_session, p_game, p_room_id, p_room_password, p_opens_at, p_note, auth.uid())
  ON CONFLICT (tournament_id, session_number, game_number)
  DO UPDATE SET
    room_id       = p_room_id,
    room_password = p_room_password,
    opens_at      = p_opens_at,
    note          = p_note;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_room_code(uuid, integer, integer, text, text, timestamptz, text) TO authenticated;
