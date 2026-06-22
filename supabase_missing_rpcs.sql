-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Missing RPCs + Games Table Extensions
-- Run AFTER all previous migrations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend games table with missing columns ────────────────────────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS image_url        TEXT    NULL,
  ADD COLUMN IF NOT EXISTS status           TEXT    NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active','inactive','coming_soon')),
  ADD COLUMN IF NOT EXISTS popularity_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

-- Sync logo_url → image_url if image_url is empty (non-destructive backfill)
UPDATE public.games SET image_url = logo_url WHERE image_url IS NULL AND logo_url IS NOT NULL;

-- ── 2. RLS for games (admins can manage, public can read) ─────────────────────
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public games visible"      ON public.games;
DROP POLICY IF EXISTS "Platform admins manage"    ON public.games;

CREATE POLICY "Public games visible"
  ON public.games FOR SELECT USING (true);

CREATE POLICY "Platform admins manage games"
  ON public.games FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')
    )
  );

-- ── 3. auto_expire_tournaments() ─────────────────────────────────────────────
-- Cancels upcoming tournaments with 0 players that are >24h past start,
-- and completes ongoing tournaments past their end_date.
CREATE OR REPLACE FUNCTION public.auto_expire_tournaments()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Cancel upcoming tournaments that are long past start and had no participants
  UPDATE public.tournaments
  SET status = 'cancelled'
  WHERE status = 'upcoming'
    AND date < now() - INTERVAL '24 hours'
    AND current_players = 0;

  -- Complete ongoing tournaments whose end_date has passed
  UPDATE public.tournaments
  SET status = 'completed'
  WHERE status = 'ongoing'
    AND end_date IS NOT NULL
    AND end_date < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_expire_tournaments() TO authenticated;

-- ── 4. rejoin_tournament(tournament_id, in_game_username) ─────────────────────
-- Allows a previously withdrawn/dropped participant to rejoin an upcoming tournament.
CREATE OR REPLACE FUNCTION public.rejoin_tournament(
  p_tournament_id    uuid,
  p_in_game_username text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tournament  record;
  v_participant record;
BEGIN
  -- Validate tournament exists
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  -- Only allow rejoin for upcoming tournaments
  IF v_tournament.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Cannot rejoin: tournament is not in upcoming state';
  END IF;

  -- Check capacity
  IF v_tournament.current_players >= v_tournament.max_players THEN
    RAISE EXCEPTION 'Tournament is full';
  END IF;

  -- Find existing participant record (must have withdrawn or dropped)
  SELECT * INTO v_participant
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No prior registration found for this tournament';
  END IF;

  IF v_participant.status NOT IN ('withdrawn', 'dropped') THEN
    RAISE EXCEPTION 'Cannot rejoin: current status is %', v_participant.status;
  END IF;

  -- Reinstate participant
  UPDATE public.tournament_participants
  SET
    status           = 'joined',
    in_game_username = p_in_game_username,
    checked_in_at    = NULL
  WHERE tournament_id = p_tournament_id AND user_id = auth.uid();

  -- Increment player count
  UPDATE public.tournaments
  SET current_players = current_players + 1
  WHERE id = p_tournament_id;

  -- In-app notification
  INSERT INTO public.notifications(user_id, type, title, body, ref_type, ref_id)
  VALUES (
    auth.uid(), 'info',
    'Rejoined tournament',
    'You have successfully rejoined ' || v_tournament.name || '.',
    'tournament', p_tournament_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rejoin_tournament(uuid, text) TO authenticated;
