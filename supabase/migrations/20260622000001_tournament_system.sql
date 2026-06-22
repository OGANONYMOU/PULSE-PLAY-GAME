-- ═══════════════════════════════════════════════════════════════════════════════
-- PulsePlay — Tournament System, Missing RPCs & Support Tables
-- Run AFTER all previous migrations.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. PULSEPOINTS BALANCES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulsepoints_balances (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pulsepoints_balances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pulsepoints_balances' AND policyname='pp_select') THEN
    CREATE POLICY "pp_select" ON public.pulsepoints_balances FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pulsepoints_balances' AND policyname='pp_own') THEN
    CREATE POLICY "pp_own" ON public.pulsepoints_balances FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. GAMERCRED SCORES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gamercred_scores (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score              integer NOT NULL DEFAULT 0,
  wins               integer NOT NULL DEFAULT 0,
  losses             integer NOT NULL DEFAULT 0,
  tournaments_played integer NOT NULL DEFAULT 0,
  verified_badge     boolean NOT NULL DEFAULT false,
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.gamercred_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gamercred_scores' AND policyname='gs_select') THEN
    CREATE POLICY "gs_select" ON public.gamercred_scores FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gamercred_scores' AND policyname='gs_own') THEN
    CREATE POLICY "gs_own" ON public.gamercred_scores FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. NOTIFICATIONS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  title      text        NOT NULL,
  message    text,
  link       text,
  data       jsonb       DEFAULT '{}',
  read       boolean     NOT NULL DEFAULT false,
  priority   text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notif_own') THEN
    CREATE POLICY "notif_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. TOURNAMENT POSTS (live feed) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_posts (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid        NOT NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type          text        NOT NULL DEFAULT 'update'
                            CHECK (type IN ('bracket','result','system','update','hype')),
  content       text        NOT NULL,
  match_id      uuid,
  created_at    timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='tournament_posts_tournament_id_fkey' AND table_name='tournament_posts') THEN
      ALTER TABLE public.tournament_posts
        ADD CONSTRAINT tournament_posts_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tposts_tournament ON public.tournament_posts(tournament_id, created_at DESC);

ALTER TABLE public.tournament_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_posts' AND policyname='tp_select') THEN
    CREATE POLICY "tp_select" ON public.tournament_posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_posts' AND policyname='tp_insert') THEN
    CREATE POLICY "tp_insert" ON public.tournament_posts FOR INSERT WITH CHECK (
      auth.uid() = user_id OR user_id IS NULL
    );
  END IF;
END $$;

-- ── 5. TOURNAMENT STAFF ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_staff (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid        NOT NULL,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text        NOT NULL DEFAULT 'referee'
                            CHECK (role IN ('host','co_host','referee','commentator','admin')),
  added_by      uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='tournament_staff_tournament_id_fkey' AND table_name='tournament_staff') THEN
      ALTER TABLE public.tournament_staff
        ADD CONSTRAINT tournament_staff_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tstaff_tournament ON public.tournament_staff(tournament_id);

ALTER TABLE public.tournament_staff ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_staff' AND policyname='tstaff_select') THEN
    CREATE POLICY "tstaff_select" ON public.tournament_staff FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_staff' AND policyname='tstaff_own') THEN
    CREATE POLICY "tstaff_own" ON public.tournament_staff FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. MATCH REPORTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_reports (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id          uuid        NOT NULL,
  reporter_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player1_score     integer     NOT NULL DEFAULT 0,
  player2_score     integer     NOT NULL DEFAULT 0,
  proof_url         text,
  proof_storage_key text,
  notes             text,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','confirmed','disputed','rejected')),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (match_id, reporter_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='matches') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='match_reports_match_id_fkey' AND table_name='match_reports') THEN
      ALTER TABLE public.match_reports
        ADD CONSTRAINT match_reports_match_id_fkey
        FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_match_reports_match ON public.match_reports(match_id);

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='match_reports' AND policyname='mr_select') THEN
    CREATE POLICY "mr_select" ON public.match_reports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='match_reports' AND policyname='mr_insert') THEN
    CREATE POLICY "mr_insert" ON public.match_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

-- ── 7. TOURNAMENT FIXTURES (league/round-robin) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_fixtures (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id        uuid        NOT NULL,
  round                integer     NOT NULL,
  match_number         integer     NOT NULL,
  home_participant_id  uuid        NOT NULL REFERENCES auth.users(id),
  away_participant_id  uuid        NOT NULL REFERENCES auth.users(id),
  home_score           integer,
  away_score           integer,
  winner_id            uuid        REFERENCES auth.users(id),
  status               text        NOT NULL DEFAULT 'scheduled'
                                   CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_at         timestamptz DEFAULT now(),
  is_walkover          boolean     NOT NULL DEFAULT false,
  created_at           timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='tournament_fixtures_tournament_id_fkey' AND table_name='tournament_fixtures') THEN
      ALTER TABLE public.tournament_fixtures
        ADD CONSTRAINT tournament_fixtures_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tfixtures_tournament ON public.tournament_fixtures(tournament_id, round);

ALTER TABLE public.tournament_fixtures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_fixtures' AND policyname='tf_select') THEN
    CREATE POLICY "tf_select" ON public.tournament_fixtures FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_fixtures' AND policyname='tf_admin') THEN
    CREATE POLICY "tf_admin" ON public.tournament_fixtures FOR ALL USING (
      public.is_admin_or_moderator(auth.uid())
    );
  END IF;
END $$;

-- ── 8. TOURNAMENT STANDINGS (league) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_standings (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id   uuid    NOT NULL,
  participant_id  uuid    NOT NULL REFERENCES auth.users(id),
  played          integer NOT NULL DEFAULT 0,
  won             integer NOT NULL DEFAULT 0,
  drawn           integer NOT NULL DEFAULT 0,
  lost            integer NOT NULL DEFAULT 0,
  goals_for       integer NOT NULL DEFAULT 0,
  goals_against   integer NOT NULL DEFAULT 0,
  goal_difference integer NOT NULL DEFAULT 0,
  points          integer NOT NULL DEFAULT 0,
  form            text[]  NOT NULL DEFAULT '{}',
  UNIQUE (tournament_id, participant_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='tournament_standings_tournament_id_fkey' AND table_name='tournament_standings') THEN
      ALTER TABLE public.tournament_standings
        ADD CONSTRAINT tournament_standings_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tstandings_tournament ON public.tournament_standings(tournament_id, points DESC);

ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_standings' AND policyname='tst_select') THEN
    CREATE POLICY "tst_select" ON public.tournament_standings FOR SELECT USING (true);
  END IF;
END $$;

-- ── 9. TOURNAMENT BR STANDINGS (battle royale) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_br_standings (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id    uuid    NOT NULL,
  participant_id   uuid    NOT NULL REFERENCES auth.users(id),
  matches_played   integer NOT NULL DEFAULT 0,
  total_kills      integer NOT NULL DEFAULT 0,
  placement_points integer NOT NULL DEFAULT 0,
  total_placements integer NOT NULL DEFAULT 0,
  chicken_dinners  integer NOT NULL DEFAULT 0,
  UNIQUE (tournament_id, participant_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='tournament_br_standings_tournament_id_fkey' AND table_name='tournament_br_standings') THEN
      ALTER TABLE public.tournament_br_standings
        ADD CONSTRAINT tournament_br_standings_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tbr_tournament ON public.tournament_br_standings(tournament_id, total_kills DESC);

ALTER TABLE public.tournament_br_standings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_br_standings' AND policyname='tbr_select') THEN
    CREATE POLICY "tbr_select" ON public.tournament_br_standings FOR SELECT USING (true);
  END IF;
END $$;

-- ── 10. DISPUTES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_number            text        UNIQUE NOT NULL,
  tournament_id             uuid        NOT NULL,
  match_id                  uuid,
  initiator_id              uuid        NOT NULL REFERENCES auth.users(id),
  initiator_username        text        NOT NULL,
  respondent_id             uuid        REFERENCES auth.users(id),
  respondent_username       text,
  type                      text        NOT NULL
                                        CHECK (type IN ('cheating','harassment','no_show','disputed_result','rule_violation','other')),
  status                    text        NOT NULL DEFAULT 'submitted'
                                        CHECK (status IN ('submitted','under_review','evidence_requested','awaiting_response','decided','resolved','dismissed')),
  priority                  text        NOT NULL DEFAULT 'medium'
                                        CHECK (priority IN ('low','medium','high','urgent')),
  initiator_claim           text        NOT NULL,
  respondent_claim          text,
  assigned_referee_id       uuid        REFERENCES auth.users(id),
  assigned_referee_username text,
  assigned_at               timestamptz,
  decision                  jsonb,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  resolved_at               timestamptz,
  due_at                    timestamptz,
  is_auto_generated         boolean     DEFAULT false,
  parent_dispute_id         uuid        REFERENCES public.disputes(id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='disputes_tournament_id_fkey' AND table_name='disputes') THEN
      ALTER TABLE public.disputes
        ADD CONSTRAINT disputes_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON public.disputes(tournament_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON public.disputes(status, priority);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator  ON public.disputes(initiator_id);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='disp_parties') THEN
    CREATE POLICY "disp_parties" ON public.disputes FOR SELECT USING (
      auth.uid() = initiator_id OR auth.uid() = respondent_id
      OR public.is_admin_or_moderator(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='disp_insert') THEN
    CREATE POLICY "disp_insert" ON public.disputes FOR INSERT WITH CHECK (auth.uid() = initiator_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='disp_update') THEN
    CREATE POLICY "disp_update" ON public.disputes FOR UPDATE USING (
      auth.uid() = respondent_id
      OR public.is_admin_or_moderator(auth.uid())
    );
  END IF;
END $$;

-- Convenience view used by admin metrics RPC (match_disputes)
CREATE OR REPLACE VIEW public.match_disputes AS
SELECT id, created_at, updated_at,
  CASE WHEN status = 'submitted' THEN 'pending' ELSE status END AS status,
  tournament_id, match_id, initiator_id, respondent_id, type, priority
FROM public.disputes;

-- ── 11. DISPUTE EVIDENCE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id        uuid        NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  uploaded_by       uuid        NOT NULL REFERENCES auth.users(id),
  uploader_username text        NOT NULL,
  evidence_type     text        NOT NULL DEFAULT 'screenshot'
                                CHECK (evidence_type IN ('screenshot','video','replay','chat_log','witness_statement','other')),
  file_url          text        NOT NULL,
  file_hash         text        DEFAULT '',
  description       text        NOT NULL DEFAULT '',
  uploaded_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disp_evidence_dispute ON public.dispute_evidence(dispute_id);

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dispute_evidence' AND policyname='de_select') THEN
    CREATE POLICY "de_select" ON public.dispute_evidence FOR SELECT USING (
      auth.uid() = uploaded_by
      OR public.is_admin_or_moderator(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dispute_evidence' AND policyname='de_insert') THEN
    CREATE POLICY "de_insert" ON public.dispute_evidence FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
  END IF;
END $$;

-- ── 12. FRAUD FLAGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id       uuid,
  match_id            uuid,
  user_id             uuid        REFERENCES auth.users(id),
  flag_type           text        NOT NULL
                                  CHECK (flag_type IN ('repeated_winner','abnormal_scores','suspicious_timing','account_cluster','reported_by_users')),
  severity            text        NOT NULL DEFAULT 'low'
                                  CHECK (severity IN ('low','medium','high')),
  evidence            jsonb       NOT NULL DEFAULT '{}',
  status              text        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','under_investigation','confirmed','dismissed')),
  investigated_by     uuid        REFERENCES auth.users(id),
  investigation_notes text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='fraud_flags_tournament_id_fkey' AND table_name='fraud_flags') THEN
      ALTER TABLE public.fraud_flags
        ADD CONSTRAINT fraud_flags_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fraud_flags_tournament ON public.fraud_flags(tournament_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status     ON public.fraud_flags(status, severity);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fraud_flags' AND policyname='ff_admin') THEN
    CREATE POLICY "ff_admin" ON public.fraud_flags FOR ALL USING (
      public.is_admin_or_moderator(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fraud_flags' AND policyname='ff_select_own') THEN
    CREATE POLICY "ff_select_own" ON public.fraud_flags FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 13. MATCH-PROOFS STORAGE BUCKET ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-proofs', 'match-proofs', false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='mp_select') THEN
    CREATE POLICY "mp_select" ON storage.objects FOR SELECT
      USING (bucket_id = 'match-proofs' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='mp_insert') THEN
    CREATE POLICY "mp_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'match-proofs' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='mp_delete') THEN
    CREATE POLICY "mp_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'match-proofs' AND auth.uid()::text = (storage.foldername(name))[2]);
  END IF;
END $$;

-- ── 14. RPC: create_notification ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_message text DEFAULT NULL,
  p_link    text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link);
EXCEPTION WHEN OTHERS THEN
  -- Silently fail — notifications are non-critical
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated, service_role;

-- Overload with named params (used by disputeSystem.ts via rpc call)
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id uuid,
  type    text,
  title   text,
  message text DEFAULT NULL,
  link    text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (user_id, type, title, message, link);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated, service_role;

-- ── 15. RPC: add_user_warning ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_user_warning(
  p_user_id uuid,
  p_reason  text,
  p_source  text DEFAULT 'system'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, priority)
  VALUES (p_user_id, 'warning', 'Account Warning', p_reason, 'high');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_user_warning(uuid, text, text) TO authenticated, service_role;

-- Overload for named params
CREATE OR REPLACE FUNCTION public.add_user_warning(
  user_id uuid,
  reason  text,
  source  text DEFAULT 'system'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, priority)
  VALUES (user_id, 'warning', 'Account Warning', reason, 'high');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_user_warning(uuid, text, text) TO authenticated, service_role;

-- ── 16. RPC: tournament_check_in ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tournament_check_in(
  p_tournament_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_t_status         text;
  v_check_in_open    text;
  v_check_in_close   text;
  v_participant_id   uuid;
  v_participant_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, check_in_open::text, check_in_close::text
  INTO v_t_status, v_check_in_open, v_check_in_close
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF v_t_status NOT IN ('upcoming', 'ongoing') THEN
    RAISE EXCEPTION 'Tournament is not accepting check-ins';
  END IF;

  IF v_check_in_open IS NOT NULL AND now() < v_check_in_open::timestamptz THEN
    RAISE EXCEPTION 'Check-in has not opened yet';
  END IF;

  IF v_check_in_close IS NOT NULL AND now() > v_check_in_close::timestamptz THEN
    RAISE EXCEPTION 'Check-in window has closed';
  END IF;

  SELECT id, status
  INTO v_participant_id, v_participant_status
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not registered for this tournament';
  END IF;

  IF v_participant_status = 'checked_in' THEN
    RETURN;
  END IF;

  IF v_participant_status NOT IN ('joined', 'registered') THEN
    RAISE EXCEPTION 'Cannot check in with status: %', v_participant_status;
  END IF;

  UPDATE public.tournament_participants
  SET status = 'checked_in'
  WHERE id = v_participant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tournament_check_in(uuid) TO authenticated;

-- ── 17. RPC: deduct_entry_fee ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_entry_fee(
  p_tournament_id uuid,
  p_user_id       uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry_fee integer;
  v_balance   integer;
BEGIN
  SELECT entry_fee INTO v_entry_fee
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF COALESCE(v_entry_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.pulsepoints_balances (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.pulsepoints_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < v_entry_fee THEN
    RAISE EXCEPTION 'Insufficient PulsePoints. Need % PP, have % PP.', v_entry_fee, v_balance;
  END IF;

  UPDATE public.pulsepoints_balances
  SET balance = balance - v_entry_fee, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.deduct_entry_fee(uuid, uuid) TO authenticated;

-- ── 18. RPC: withdraw_from_tournament ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_from_tournament(
  p_tournament_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_t_status         text;
  v_entry_fee        integer;
  v_bracket_gen      boolean;
  v_participant_id   uuid;
  v_part_status      text;
  v_walkovers        integer := 0;
  v_refunded         integer := 0;
  v_username         text;
  v_rec              record;
  v_opponent_id      uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, entry_fee, bracket_generated
  INTO v_t_status, v_entry_fee, v_bracket_gen
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'Cannot withdraw from a completed tournament';
  END IF;
  IF v_t_status = 'cancelled' THEN
    RAISE EXCEPTION 'Tournament is cancelled';
  END IF;

  SELECT id, status INTO v_participant_id, v_part_status
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not registered';
  END IF;

  IF v_part_status = 'withdrawn' THEN
    RAISE EXCEPTION 'already withdrawn';
  END IF;

  UPDATE public.tournament_participants
  SET status = 'withdrawn'
  WHERE id = v_participant_id;

  UPDATE public.tournaments
  SET current_players = GREATEST(0, current_players - 1)
  WHERE id = p_tournament_id;

  IF NOT COALESCE(v_bracket_gen, false) THEN
    -- Refund entry fee
    IF COALESCE(v_entry_fee, 0) > 0 THEN
      INSERT INTO public.pulsepoints_balances (user_id, balance)
      VALUES (v_user_id, v_entry_fee)
      ON CONFLICT (user_id) DO UPDATE
        SET balance = pulsepoints_balances.balance + v_entry_fee,
            updated_at = now();
      v_refunded := v_entry_fee;
    END IF;
  ELSE
    -- Award walkovers in bracket (matches table)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='matches') THEN
      FOR v_rec IN
        SELECT id, player1_id, player2_id, next_match_id, next_match_slot
        FROM public.matches
        WHERE tournament_id = p_tournament_id
          AND status IN ('scheduled','in_progress')
          AND (player1_id = v_user_id OR player2_id = v_user_id)
      LOOP
        v_opponent_id := CASE
          WHEN v_rec.player1_id = v_user_id THEN v_rec.player2_id
          ELSE v_rec.player1_id
        END;

        UPDATE public.matches
        SET status = 'walkover', winner_id = v_opponent_id
        WHERE id = v_rec.id;

        IF v_rec.next_match_id IS NOT NULL AND v_opponent_id IS NOT NULL THEN
          UPDATE public.matches
          SET
            player1_id = CASE WHEN v_rec.next_match_slot = 1 THEN v_opponent_id ELSE player1_id END,
            player2_id = CASE WHEN v_rec.next_match_slot = 2 THEN v_opponent_id ELSE player2_id END
          WHERE id = v_rec.next_match_id;
        END IF;

        v_walkovers := v_walkovers + 1;
      END LOOP;
    END IF;

    -- Award walkovers in fixtures (tournament_fixtures table)
    FOR v_rec IN
      SELECT id, home_participant_id, away_participant_id
      FROM public.tournament_fixtures
      WHERE tournament_id = p_tournament_id
        AND status = 'scheduled'
        AND (home_participant_id = v_user_id OR away_participant_id = v_user_id)
    LOOP
      v_opponent_id := CASE
        WHEN v_rec.home_participant_id = v_user_id THEN v_rec.away_participant_id
        ELSE v_rec.home_participant_id
      END;

      UPDATE public.tournament_fixtures
      SET status = 'cancelled', winner_id = v_opponent_id, is_walkover = true
      WHERE id = v_rec.id;

      v_walkovers := v_walkovers + 1;
    END LOOP;
  END IF;

  BEGIN
    SELECT username INTO v_username FROM public.profiles WHERE id = v_user_id;
  EXCEPTION WHEN undefined_table THEN
    v_username := NULL;
  END;

  INSERT INTO public.tournament_posts (tournament_id, user_id, type, content)
  VALUES (
    p_tournament_id, NULL, 'system',
    COALESCE(v_username, 'A player') || ' has withdrawn from the tournament.'
  );

  RETURN jsonb_build_object(
    'refunded',          v_refunded,
    'walkovers_awarded', v_walkovers,
    'bracket_generated', COALESCE(v_bracket_gen, false)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.withdraw_from_tournament(uuid) TO authenticated;

-- ── 19. RPC: confirm_match_result ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_match_result(
  p_match_id  uuid,
  p_report_id uuid,
  p_decision  text,
  p_reason    text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_reporter_id     uuid;
  v_p1_score        integer;
  v_p2_score        integer;
  v_player1_id      uuid;
  v_player2_id      uuid;
  v_next_match_id   uuid;
  v_next_slot       integer;
  v_tournament_id   uuid;
  v_winner_id       uuid;
  v_loser_id        uuid;
  v_winner_username text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load report
  SELECT reporter_id, player1_score, player2_score
  INTO v_reporter_id, v_p1_score, v_p2_score
  FROM public.match_reports
  WHERE id = p_report_id AND match_id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  -- Load match
  SELECT player1_id, player2_id, next_match_id, next_match_slot, tournament_id
  INTO v_player1_id, v_player2_id, v_next_match_id, v_next_slot, v_tournament_id
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_user_id = v_reporter_id THEN
    RAISE EXCEPTION 'You cannot confirm your own report';
  END IF;

  IF v_user_id NOT IN (v_player1_id, v_player2_id) THEN
    RAISE EXCEPTION 'You are not a player in this match';
  END IF;

  -- Determine winner
  v_winner_id := CASE
    WHEN v_p1_score > v_p2_score THEN v_player1_id
    WHEN v_p2_score > v_p1_score THEN v_player2_id
    ELSE NULL
  END;

  -- Update match
  UPDATE public.matches
  SET player1_score = v_p1_score,
      player2_score = v_p2_score,
      winner_id     = v_winner_id,
      status        = 'verified'
  WHERE id = p_match_id;

  -- Confirm report
  UPDATE public.match_reports
  SET status = 'confirmed'
  WHERE id = p_report_id;

  -- Advance winner to next bracket match
  IF v_winner_id IS NOT NULL AND v_next_match_id IS NOT NULL THEN
    UPDATE public.matches
    SET
      player1_id = CASE WHEN v_next_slot = 1 THEN v_winner_id ELSE player1_id END,
      player2_id = CASE WHEN v_next_slot = 2 THEN v_winner_id ELSE player2_id END
    WHERE id = v_next_match_id;
  END IF;

  -- Update gamercred scores
  IF v_winner_id IS NOT NULL THEN
    INSERT INTO public.gamercred_scores (user_id, score, wins, tournaments_played)
    VALUES (v_winner_id, 10, 1, 0)
    ON CONFLICT (user_id) DO UPDATE
    SET score      = gamercred_scores.score + 10,
        wins       = gamercred_scores.wins + 1,
        updated_at = now();

    v_loser_id := CASE
      WHEN v_winner_id = v_player1_id THEN v_player2_id
      ELSE v_player1_id
    END;

    IF v_loser_id IS NOT NULL THEN
      INSERT INTO public.gamercred_scores (user_id, score, losses, tournaments_played)
      VALUES (v_loser_id, 0, 1, 0)
      ON CONFLICT (user_id) DO UPDATE
      SET losses     = gamercred_scores.losses + 1,
          updated_at = now();
    END IF;
  END IF;

  -- Post result to live feed
  IF v_tournament_id IS NOT NULL THEN
    BEGIN
      SELECT username INTO v_winner_username FROM public.profiles WHERE id = v_winner_id;
    EXCEPTION WHEN undefined_table THEN
      v_winner_username := NULL;
    END;
    INSERT INTO public.tournament_posts (tournament_id, user_id, type, content, match_id)
    VALUES (
      v_tournament_id, NULL, 'result',
      COALESCE(v_winner_username, 'A player') || ' wins the match!',
      p_match_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_match_result(uuid, uuid, text, text) TO authenticated;

-- ── 20. RPC: generate_fixtures_auto ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_fixtures_auto(
  p_tournament_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_t_status       text;
  v_t_created_by   uuid;
  v_t_date         timestamptz;
  v_is_organizer   boolean;
  v_participants   uuid[];
  v_n              integer;
  v_n_padded       integer;
  v_rounds         integer;
  v_fixtures_count integer := 0;
  v_round          integer;
  v_half           integer;
  v_i              integer;
  v_home           uuid;
  v_away           uuid;
  v_temp           uuid;
  v_match_num      integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, created_by, date::timestamptz
  INTO v_t_status, v_t_created_by, v_t_date
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  -- Permission check
  SELECT (
    v_t_created_by = v_user_id
    OR EXISTS (SELECT 1 FROM public.tournament_staff WHERE tournament_id = p_tournament_id AND user_id = v_user_id)
    OR public.is_admin_or_moderator(v_user_id)
  ) INTO v_is_organizer;

  IF NOT v_is_organizer THEN
    RAISE EXCEPTION 'Only the organizer or admin can generate fixtures';
  END IF;

  -- Gather participants (checked_in first, then joined)
  SELECT ARRAY_AGG(user_id ORDER BY
    CASE status WHEN 'checked_in' THEN 0 ELSE 1 END,
    joined_at
  )
  INTO v_participants
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id
    AND status IN ('checked_in','joined','registered');

  IF v_participants IS NULL OR array_length(v_participants, 1) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to generate fixtures';
  END IF;

  v_n := array_length(v_participants, 1);

  -- Clear existing fixtures
  DELETE FROM public.tournament_fixtures WHERE tournament_id = p_tournament_id;

  -- Round-robin using circle algorithm (everyone plays everyone once)
  v_n_padded := v_n;
  IF v_n_padded % 2 = 1 THEN
    v_n_padded := v_n_padded + 1;
    v_participants := array_append(v_participants, NULL::uuid);
  END IF;

  v_rounds := v_n_padded - 1;
  v_half   := v_n_padded / 2;

  FOR v_round IN 1..v_rounds LOOP
    FOR v_i IN 1..v_half LOOP
      v_home := v_participants[v_i];
      v_away := v_participants[v_n_padded - v_i + 1];

      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        v_match_num := v_match_num + 1;
        INSERT INTO public.tournament_fixtures (
          tournament_id, round, match_number,
          home_participant_id, away_participant_id,
          status, scheduled_at
        ) VALUES (
          p_tournament_id, v_round, v_match_num,
          v_home, v_away,
          'scheduled',
          COALESCE(v_t_date, now()) + ((v_round - 1) || ' days')::interval
        );
        v_fixtures_count := v_fixtures_count + 1;
      END IF;
    END LOOP;

    -- Rotate: keep index 1 fixed, rotate 2..n_padded
    v_temp := v_participants[v_n_padded];
    FOR v_i IN REVERSE v_n_padded..3 LOOP
      v_participants[v_i] := v_participants[v_i - 1];
    END LOOP;
    v_participants[2] := v_temp;
  END LOOP;

  -- Initialize standings
  INSERT INTO public.tournament_standings (tournament_id, participant_id)
  SELECT p_tournament_id, user_id
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id
    AND status IN ('checked_in','joined','registered')
    AND user_id IS NOT NULL
  ON CONFLICT (tournament_id, participant_id) DO NOTHING;

  -- Mark bracket as generated
  UPDATE public.tournaments
  SET bracket_generated = true
  WHERE id = p_tournament_id;

  -- System post
  INSERT INTO public.tournament_posts (tournament_id, user_id, type, content)
  VALUES (
    p_tournament_id, NULL, 'bracket',
    'Fixtures generated! ' || v_fixtures_count || ' matches across ' || v_rounds || ' rounds.'
  );

  RETURN jsonb_build_object(
    'fixtures_created', v_fixtures_count,
    'rounds',           v_rounds,
    'participants',     v_n
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_fixtures_auto(uuid) TO authenticated;

-- ── 21. AUTO-EXPIRE + REJOIN RPCs (idempotent re-creation) ───────────────────
CREATE OR REPLACE FUNCTION public.auto_expire_tournaments()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Cancel upcoming tournaments >24h past start with no active players
  UPDATE public.tournaments
  SET status = 'cancelled'
  WHERE status = 'upcoming'
    AND date < now() - INTERVAL '24 hours'
    AND current_players = 0;

  -- Complete ongoing tournaments past their end_date
  UPDATE public.tournaments
  SET status = 'completed'
  WHERE status = 'ongoing'
    AND end_date IS NOT NULL
    AND end_date::timestamptz < now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_expire_tournaments() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rejoin_tournament(
  p_tournament_id    uuid,
  p_in_game_username text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_t_status text;
  v_max_players integer;
  v_current_players integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, max_players, current_players
  INTO v_t_status, v_max_players, v_current_players
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF v_t_status != 'upcoming' THEN
    RAISE EXCEPTION 'Tournament is no longer open for registration';
  END IF;

  IF v_current_players >= v_max_players THEN
    RAISE EXCEPTION 'Tournament is full';
  END IF;

  UPDATE public.tournament_participants
  SET status = 'joined', in_game_username = COALESCE(p_in_game_username, in_game_username)
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id
    AND status IN ('withdrawn','dropped');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No withdrawn registration found to rejoin';
  END IF;

  UPDATE public.tournaments
  SET current_players = current_players + 1
  WHERE id = p_tournament_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_user_id, 'tournament', 'Rejoined Tournament', 'You have successfully rejoined the tournament.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rejoin_tournament(uuid, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done.
-- Tables:   pulsepoints_balances, gamercred_scores, notifications,
--           tournament_posts, tournament_staff, match_reports,
--           tournament_fixtures, tournament_standings, tournament_br_standings,
--           disputes, dispute_evidence, fraud_flags
-- Views:    match_disputes
-- Buckets:  match-proofs
-- RPCs:     create_notification, add_user_warning, tournament_check_in,
--           deduct_entry_fee, withdraw_from_tournament, confirm_match_result,
--           generate_fixtures_auto, auto_expire_tournaments, rejoin_tournament
-- ═══════════════════════════════════════════════════════════════════════════════
