-- ═══════════════════════════════════════════════════════════════════════════════
-- [PULSEPLAY] Admin System Upgrade Migration
-- Paste the entire file into Supabase SQL Editor and click Run.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS / ON CONFLICT everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── [1/9] EXTENSIONS ──────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── [2/9] AUDIT LOG ENHANCEMENTS (only if audit_logs table exists) ────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    -- Add new columns (all IF NOT EXISTS)
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN actor_email TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN actor_role TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN action_category TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN previous_state JSONB; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN new_state JSONB; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN change_summary TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN reason TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN severity TEXT DEFAULT 'info'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN is_reversible BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN reversed_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN reversed_by UUID REFERENCES auth.users(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE public.audit_logs ADD COLUMN reversal_reason TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id   ON public.audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
  END IF;
END $$;

-- ── [3/9] MODERATION CASE SYSTEM ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.moderation_cases (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number            TEXT UNIQUE NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'new'
                             CHECK (status IN ('new','assigned','reviewing','evidence_gathering',
                                               'awaiting_response','action_taken','escalated','resolved','dismissed')),
    priority               TEXT NOT NULL DEFAULT 'medium'
                             CHECK (priority IN ('low','medium','high','urgent')),

    reporter_id            UUID NOT NULL REFERENCES auth.users(id),
    reporter_username      TEXT NOT NULL,

    subject_type           TEXT NOT NULL
                             CHECK (subject_type IN ('post','clip','comment','user','tournament','message')),
    subject_id             TEXT NOT NULL,
    subject_author_id      UUID NOT NULL REFERENCES auth.users(id),
    subject_author_username TEXT NOT NULL,
    subject_content        TEXT,
    subject_url            TEXT,

    offense_type           TEXT NOT NULL
                             CHECK (offense_type IN ('harassment','hate_speech','spam','inappropriate_content',
                                                     'cheating','impersonation','scam','copyright','violence','other')),
    description            TEXT NOT NULL,
    evidence_urls          TEXT[] DEFAULT '{}',

    assigned_to            UUID REFERENCES auth.users(id),
    assigned_at            TIMESTAMP WITH TIME ZONE,
    assigned_by            UUID REFERENCES auth.users(id),

    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_at                 TIMESTAMP WITH TIME ZONE,
    resolved_at            TIMESTAMP WITH TIME ZONE,
    reviewing_started_at   TIMESTAMP WITH TIME ZONE,

    action_taken           TEXT,
    action_reason          TEXT,
    action_metadata        JSONB,

    is_violation           BOOLEAN,
    violation_severity     TEXT CHECK (violation_severity IN ('minor','moderate','severe')),

    notes_count            INTEGER DEFAULT 0,
    history                JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status   ON public.moderation_cases(status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_priority ON public.moderation_cases(priority);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_assigned ON public.moderation_cases(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_subject  ON public.moderation_cases(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_author   ON public.moderation_cases(subject_author_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_created  ON public.moderation_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_due      ON public.moderation_cases(due_at) WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.case_notes (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id        UUID NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
    author_id      UUID NOT NULL REFERENCES auth.users(id),
    author_username TEXT NOT NULL,
    author_role    TEXT NOT NULL,
    content        TEXT NOT NULL,
    note_type      TEXT NOT NULL DEFAULT 'internal'
                     CHECK (note_type IN ('internal','user_visible','system')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case ON public.case_notes(case_id, created_at DESC);

-- ── [4/9] OFFENDER TRACKING ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offender_profiles (
    user_id              UUID PRIMARY KEY REFERENCES auth.users(id),
    total_cases          INTEGER DEFAULT 0,
    violations_confirmed INTEGER DEFAULT 0,
    violations_dismissed INTEGER DEFAULT 0,
    current_strikes      INTEGER DEFAULT 0,
    last_offense_at      TIMESTAMP WITH TIME ZONE,
    risk_score           INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offense_history (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES auth.users(id),
    case_id      UUID NOT NULL REFERENCES public.moderation_cases(id),
    offense_type TEXT NOT NULL,
    severity     TEXT NOT NULL CHECK (severity IN ('minor','moderate','severe')),
    action_taken TEXT NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offense_history_user ON public.offense_history(user_id, created_at DESC);

-- ── [5/9] SCOPED PERMISSIONS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_permissions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    permission TEXT NOT NULL,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('global','organizer','tournament','community')),
    scope_id   TEXT,
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active  BOOLEAN DEFAULT TRUE,
    notes      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permissions_unique
    ON public.user_permissions(user_id, permission, scope_type, scope_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user  ON public.user_permissions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_scope ON public.user_permissions(scope_type, scope_id);

-- ── [6/9] INCIDENT MANAGEMENT ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incidents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_number   TEXT UNIQUE NOT NULL,
    type              TEXT NOT NULL
                        CHECK (type IN ('report_spike','dispute_spike','suspicious_activity','failed_action',
                                        'moderation_backlog','no_show_spike','system_health','security_alert','fraud_detected')),
    severity          TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    status            TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','acknowledged','investigating','resolved','escalated')),
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    affected_entities JSONB DEFAULT '[]',
    metrics           JSONB DEFAULT '[]',
    assigned_to       UUID REFERENCES auth.users(id),
    acknowledged_by   UUID REFERENCES auth.users(id),
    acknowledged_at   TIMESTAMP WITH TIME ZONE,
    resolved_by       UUID REFERENCES auth.users(id),
    resolved_at       TIMESTAMP WITH TIME ZONE,
    sla_deadline      TIMESTAMP WITH TIME ZONE,
    automated_response BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status   ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_type     ON public.incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON public.incidents(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_incidents_created  ON public.incidents(created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_notes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id         UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES auth.users(id),
    author_username     TEXT NOT NULL,
    content             TEXT NOT NULL,
    is_system_generated BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_notes_incident ON public.incident_notes(incident_id, created_at DESC);

-- ── [7/9] DISPUTES + TOURNAMENT HEALTH + FRAUD FLAGS ──────────────────────────

CREATE TABLE IF NOT EXISTS public.disputes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_number      TEXT UNIQUE NOT NULL,
    tournament_id       UUID NOT NULL,   -- FK added conditionally below
    match_id            UUID,
    initiator_id        UUID NOT NULL REFERENCES auth.users(id),
    initiator_username  TEXT NOT NULL,
    respondent_id       UUID REFERENCES auth.users(id),
    respondent_username TEXT,
    type                TEXT NOT NULL
                          CHECK (type IN ('cheating','harassment','no_show','disputed_result','rule_violation','other')),
    status              TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted','under_review','evidence_requested','awaiting_response',
                                            'decided','resolved','dismissed')),
    priority            TEXT NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high','urgent')),
    initiator_claim     TEXT NOT NULL,
    respondent_claim    TEXT,
    initiator_evidence  JSONB DEFAULT '[]',
    respondent_evidence JSONB DEFAULT '[]',
    assigned_referee    UUID REFERENCES auth.users(id),
    decision            TEXT,
    decision_reason     TEXT,
    decided_by          UUID REFERENCES auth.users(id),
    decided_at          TIMESTAMP WITH TIME ZONE,
    initiator_penalty   TEXT,
    respondent_penalty  TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at         TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON public.disputes(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned   ON public.disputes(assigned_referee, status);
CREATE INDEX IF NOT EXISTS idx_disputes_created    ON public.disputes(created_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_health_metrics (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id         UUID NOT NULL,  -- FK added conditionally below
    participant_fill_rate DECIMAL(5,2),
    check_in_rate         DECIMAL(5,2),
    dispute_count         INTEGER DEFAULT 0,
    pending_reports       INTEGER DEFAULT 0,
    fraud_risk            TEXT CHECK (fraud_risk IN ('none','low','medium','high')),
    matches_total         INTEGER DEFAULT 0,
    matches_completed     INTEGER DEFAULT 0,
    no_shows              INTEGER DEFAULT 0,
    status                TEXT CHECK (status IN ('healthy','warning','critical','suspended')),
    indicators            JSONB DEFAULT '[]',
    last_assessed_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_health_unique ON public.tournament_health_metrics(tournament_id);

CREATE TABLE IF NOT EXISTS public.fraud_flags (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id        UUID,           -- FK added conditionally below
    match_id             UUID,
    user_id              UUID REFERENCES auth.users(id),
    flag_type            TEXT NOT NULL
                           CHECK (flag_type IN ('repeated_winner','abnormal_scores','suspicious_timing',
                                                'account_cluster','reported_by_users')),
    severity             TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
    evidence             JSONB,
    status               TEXT NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','under_investigation','confirmed','dismissed')),
    investigated_by      UUID REFERENCES auth.users(id),
    investigation_notes  TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_tournament ON public.fraud_flags(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user       ON public.fraud_flags(user_id, status);

-- Add tournament FKs only if tournaments table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tournaments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='disputes_tournament_id_fkey') THEN
      ALTER TABLE public.disputes ADD CONSTRAINT disputes_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='thm_tournament_id_fkey') THEN
      ALTER TABLE public.tournament_health_metrics ADD CONSTRAINT thm_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fraud_flags_tournament_id_fkey') THEN
      ALTER TABLE public.fraud_flags ADD CONSTRAINT fraud_flags_tournament_id_fkey
        FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);
    END IF;
  END IF;
END $$;

-- ── [8/9] ROW LEVEL SECURITY + POLICIES ───────────────────────────────────────

ALTER TABLE public.moderation_cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offender_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offense_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags              ENABLE ROW LEVEL SECURITY;

-- Admin/moderator check — uses dynamic SQL so it works even if profiles table
-- hasn't been created yet (returns false safely until profiles exists).
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = $1 AND role IN (''ADMIN'',''SUPER_ADMIN'',''MODERATOR''))'
      INTO v_result USING p_user_id;
  END IF;
  RETURN COALESCE(v_result, FALSE);
END;
$$;

-- Policies (all wrapped in IF NOT EXISTS to allow re-run)
DO $$ BEGIN
  -- moderation_cases
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='moderation_cases' AND policyname='moderation_cases_select_admin') THEN
    CREATE POLICY "moderation_cases_select_admin" ON public.moderation_cases FOR SELECT USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='moderation_cases' AND policyname='moderation_cases_insert_admin') THEN
    CREATE POLICY "moderation_cases_insert_admin" ON public.moderation_cases FOR INSERT WITH CHECK (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='moderation_cases' AND policyname='moderation_cases_update_admin') THEN
    CREATE POLICY "moderation_cases_update_admin" ON public.moderation_cases FOR UPDATE USING (public.is_admin_or_moderator(auth.uid()));
  END IF;

  -- case_notes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='case_notes' AND policyname='case_notes_select_admin') THEN
    CREATE POLICY "case_notes_select_admin" ON public.case_notes FOR SELECT USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='case_notes' AND policyname='case_notes_insert_admin') THEN
    CREATE POLICY "case_notes_insert_admin" ON public.case_notes FOR INSERT WITH CHECK (public.is_admin_or_moderator(auth.uid()));
  END IF;

  -- incidents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incidents' AND policyname='incidents_select_admin') THEN
    CREATE POLICY "incidents_select_admin" ON public.incidents FOR SELECT USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incidents' AND policyname='incidents_update_admin') THEN
    CREATE POLICY "incidents_update_admin" ON public.incidents FOR UPDATE USING (public.is_admin_or_moderator(auth.uid()));
  END IF;

  -- disputes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='disputes_select_participants') THEN
    CREATE POLICY "disputes_select_participants" ON public.disputes FOR SELECT USING (
      auth.uid() = initiator_id OR auth.uid() = respondent_id OR public.is_admin_or_moderator(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='disputes_update_admin') THEN
    CREATE POLICY "disputes_update_admin" ON public.disputes FOR UPDATE USING (public.is_admin_or_moderator(auth.uid()));
  END IF;
END $$;

-- ── [9/9] FUNCTIONS + TRIGGERS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_case_notes(case_uuid UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.moderation_cases
  SET notes_count = notes_count + 1, updated_at = NOW()
  WHERE id = case_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_case_history(case_uuid UUID, entry JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.moderation_cases
  SET history = history || entry, updated_at = NOW()
  WHERE id = case_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_offense(
  p_user_id    UUID,
  p_case_id    UUID,
  p_offense_type TEXT,
  p_severity   TEXT,
  p_action_taken TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_strikes    INTEGER;
  v_total      INTEGER;
  v_violations INTEGER;
  v_risk       INTEGER;
BEGIN
  INSERT INTO public.offense_history (user_id, case_id, offense_type, severity, action_taken)
  VALUES (p_user_id, p_case_id, p_offense_type, p_severity, p_action_taken);

  SELECT COUNT(*)::INTEGER,
         COUNT(*) FILTER (WHERE is_violation = TRUE)::INTEGER
  INTO v_total, v_violations
  FROM public.moderation_cases
  WHERE subject_author_id = p_user_id;

  SELECT COALESCE(SUM(
    CASE severity
      WHEN 'minor'    THEN 0.33
      WHEN 'moderate' THEN 1
      WHEN 'severe'   THEN 2
      ELSE 0
    END
  ), 0)::INTEGER
  INTO v_strikes
  FROM public.offense_history WHERE user_id = p_user_id;

  v_risk := LEAST(100,
    (v_violations * 10) + (v_strikes * 15) +
    (SELECT COUNT(*) * 20 FROM public.offense_history WHERE user_id = p_user_id AND action_taken = 'ban')
  );

  INSERT INTO public.offender_profiles
    (user_id, total_cases, violations_confirmed, current_strikes, last_offense_at, risk_score, updated_at)
  VALUES
    (p_user_id, v_total, v_violations, v_strikes, NOW(), v_risk, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_cases = v_total, violations_confirmed = v_violations,
    current_strikes = v_strikes, last_offense_at = NOW(),
    risk_score = v_risk, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE TRIGGER is supported in PostgreSQL 14+ (Supabase uses PG15)
CREATE OR REPLACE TRIGGER update_moderation_cases_updated_at
  BEFORE UPDATE ON public.moderation_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_fraud_flags_updated_at
  BEFORE UPDATE ON public.fraud_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables: moderation_cases, case_notes, offender_profiles, offense_history,
--   user_permissions, incidents, incident_notes, disputes,
--   tournament_health_metrics, fraud_flags
-- Functions: is_admin_or_moderator, increment_case_notes, append_case_history,
--   record_offense, update_updated_at_column
-- ═══════════════════════════════════════════════════════════════════════════════
