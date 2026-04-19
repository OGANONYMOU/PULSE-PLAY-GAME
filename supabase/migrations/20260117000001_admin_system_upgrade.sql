-- ═══════════════════════════════════════════════════════════════════════════════
-- PulsePlay Admin System Upgrade Migration
-- Production-grade admin, audit, moderation, and security schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. AUDIT SYSTEM ENHANCEMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enhanced audit_logs table with state tracking
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS actor_email TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS action_category TEXT,
  ADD COLUMN IF NOT EXISTS previous_state JSONB,
  ADD COLUMN IF NOT EXISTS new_state JSONB,
  ADD COLUMN IF NOT EXISTS change_summary TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'critical')),
  ADD COLUMN IF NOT EXISTS is_reversible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Create audit log indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_is_reversed ON audit_logs(is_reversible, reversed_at) WHERE is_reversible = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MODERATION CASE SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moderation_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'reviewing', 'evidence_gathering', 'awaiting_response', 'action_taken', 'escalated', 'resolved', 'dismissed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Reporter info
    reporter_id UUID NOT NULL REFERENCES profiles(id),
    reporter_username TEXT NOT NULL,
    
    -- Subject info (who/what is being reported)
    subject_type TEXT NOT NULL CHECK (subject_type IN ('post', 'clip', 'comment', 'user', 'tournament', 'message')),
    subject_id TEXT NOT NULL,
    subject_author_id UUID NOT NULL REFERENCES profiles(id),
    subject_author_username TEXT NOT NULL,
    subject_content TEXT,
    subject_url TEXT,
    
    -- Report details
    offense_type TEXT NOT NULL CHECK (offense_type IN ('harassment', 'hate_speech', 'spam', 'inappropriate_content', 'cheating', 'impersonation', 'scam', 'copyright', 'violence', 'other')),
    description TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT '{}',
    
    -- Assignment
    assigned_to UUID REFERENCES profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES profiles(id),
    
    -- Timeline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    reviewing_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Action taken
    action_taken TEXT,
    action_reason TEXT,
    action_metadata JSONB,
    
    -- Violation tracking
    is_violation BOOLEAN,
    violation_severity TEXT CHECK (violation_severity IN ('minor', 'moderate', 'severe')),
    
    -- Stats
    notes_count INTEGER DEFAULT 0,
    history JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_priority ON moderation_cases(priority);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_assigned ON moderation_cases(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_subject ON moderation_cases(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_author ON moderation_cases(subject_author_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_created ON moderation_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_due ON moderation_cases(due_at) WHERE due_at IS NOT NULL;

-- Case notes table
CREATE TABLE IF NOT EXISTS case_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    author_username TEXT NOT NULL,
    author_role TEXT NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'internal' CHECK (note_type IN ('internal', 'user_visible', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case ON case_notes(case_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. OFFENDER TRACKING SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS offender_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id),
    total_cases INTEGER DEFAULT 0,
    violations_confirmed INTEGER DEFAULT 0,
    violations_dismissed INTEGER DEFAULT 0,
    current_strikes INTEGER DEFAULT 0,
    last_offense_at TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offense_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    case_id UUID NOT NULL REFERENCES moderation_cases(id),
    offense_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
    action_taken TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offense_history_user ON offense_history(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SCOPED PERMISSIONS SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    permission TEXT NOT NULL,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'organizer', 'tournament', 'community')),
    scope_id TEXT,
    granted_by UUID NOT NULL REFERENCES profiles(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permissions_unique 
    ON user_permissions(user_id, permission, scope_type, scope_id) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_scope ON user_permissions(scope_type, scope_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. INCIDENT MANAGEMENT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('report_spike', 'dispute_spike', 'suspicious_activity', 'failed_action', 'moderation_backlog', 'no_show_spike', 'system_health', 'security_alert', 'fraud_detected')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'escalated')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Affected entities
    affected_entities JSONB DEFAULT '[]',
    
    -- Metrics at time of incident
    metrics JSONB DEFAULT '[]',
    
    -- Assignment
    assigned_to UUID REFERENCES profiles(id),
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- SLA
    sla_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Auto-generated
    automated_response BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);

-- Incident notes
CREATE TABLE IF NOT EXISTS incident_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    author_username TEXT NOT NULL,
    content TEXT NOT NULL,
    is_system_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_notes_incident ON incident_notes(incident_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. DISPUTE MANAGEMENT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_number TEXT UNIQUE NOT NULL,
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    match_id UUID,
    
    -- Parties
    initiator_id UUID NOT NULL REFERENCES profiles(id),
    initiator_username TEXT NOT NULL,
    respondent_id UUID REFERENCES profiles(id),
    respondent_username TEXT,
    
    -- Dispute details
    type TEXT NOT NULL CHECK (type IN ('cheating', 'harassment', 'no_show', 'disputed_result', 'rule_violation', 'other')),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'evidence_requested', 'awaiting_response', 'decided', 'resolved', 'dismissed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Claims
    initiator_claim TEXT NOT NULL,
    respondent_claim TEXT,
    
    -- Evidence
    initiator_evidence JSONB DEFAULT '[]',
    respondent_evidence JSONB DEFAULT '[]',
    
    -- Assignment
    assigned_referee UUID REFERENCES profiles(id),
    
    -- Decision
    decision TEXT,
    decision_reason TEXT,
    decided_by UUID REFERENCES profiles(id),
    decided_at TIMESTAMP WITH TIME ZONE,
    
    -- Penalties (if any)
    initiator_penalty TEXT,
    respondent_penalty TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON disputes(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned ON disputes(assigned_referee, status);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON disputes(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. TOURNAMENT HEALTH & FRAUD DETECTION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tournament_health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    
    -- Health indicators
    participant_fill_rate DECIMAL(5,2),
    check_in_rate DECIMAL(5,2),
    dispute_count INTEGER DEFAULT 0,
    pending_reports INTEGER DEFAULT 0,
    fraud_risk TEXT CHECK (fraud_risk IN ('none', 'low', 'medium', 'high')),
    
    -- Completion metrics
    matches_total INTEGER DEFAULT 0,
    matches_completed INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    
    -- Assessment
    status TEXT CHECK (status IN ('healthy', 'warning', 'critical', 'suspended')),
    indicators JSONB DEFAULT '[]',
    
    last_assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_health_unique ON tournament_health_metrics(tournament_id);

-- Fraud flags table
CREATE TABLE IF NOT EXISTS fraud_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    match_id UUID,
    user_id UUID REFERENCES profiles(id),
    
    flag_type TEXT NOT NULL CHECK (flag_type IN ('repeated_winner', 'abnormal_scores', 'suspicious_timing', 'account_cluster', 'reported_by_users')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    evidence JSONB,
    
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_investigation', 'confirmed', 'dismissed')),
    investigated_by UUID REFERENCES profiles(id),
    investigation_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_tournament ON fraud_flags(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON fraud_flags(user_id, status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RLS POLICIES FOR SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE offender_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE offense_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin/moderator
CREATE OR REPLACE FUNCTION is_admin_or_moderator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id 
        AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Moderation cases policies
CREATE POLICY "moderation_cases_select_admin" ON moderation_cases
    FOR SELECT USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "moderation_cases_insert_admin" ON moderation_cases
    FOR INSERT WITH CHECK (is_admin_or_moderator(auth.uid()));

CREATE POLICY "moderation_cases_update_admin" ON moderation_cases
    FOR UPDATE USING (is_admin_or_moderator(auth.uid()));

-- Case notes policies
CREATE POLICY "case_notes_select_admin" ON case_notes
    FOR SELECT USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "case_notes_insert_admin" ON case_notes
    FOR INSERT WITH CHECK (is_admin_or_moderator(auth.uid()));

-- Incidents policies
CREATE POLICY "incidents_select_admin" ON incidents
    FOR SELECT USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "incidents_update_admin" ON incidents
    FOR UPDATE USING (is_admin_or_moderator(auth.uid()));

-- Disputes policies (viewable by participants and admins)
CREATE POLICY "disputes_select_participants" ON disputes
    FOR SELECT USING (
        auth.uid() = initiator_id OR 
        auth.uid() = respondent_id OR 
        is_admin_or_moderator(auth.uid())
    );

CREATE POLICY "disputes_update_admin" ON disputes
    FOR UPDATE USING (is_admin_or_moderator(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to increment case notes count
CREATE OR REPLACE FUNCTION increment_case_notes(case_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE moderation_cases 
    SET notes_count = notes_count + 1,
        updated_at = NOW()
    WHERE id = case_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to append to case history
CREATE OR REPLACE FUNCTION append_case_history(case_uuid UUID, entry JSONB)
RETURNS VOID AS $$
BEGIN
    UPDATE moderation_cases 
    SET history = history || entry,
        updated_at = NOW()
    WHERE id = case_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to record offense and update offender profile
CREATE OR REPLACE FUNCTION record_offense(
    p_user_id UUID,
    p_case_id UUID,
    p_offense_type TEXT,
    p_severity TEXT,
    p_action_taken TEXT
)
RETURNS VOID AS $$
DECLARE
    v_current_strikes INTEGER;
    v_total_cases INTEGER;
    v_violations INTEGER;
    v_risk_score INTEGER;
BEGIN
    -- Insert offense record
    INSERT INTO offense_history (user_id, case_id, offense_type, severity, action_taken)
    VALUES (p_user_id, p_case_id, p_offense_type, p_severity, p_action_taken);
    
    -- Get updated counts
    SELECT 
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE is_violation = TRUE)::INTEGER
    INTO v_total_cases, v_violations
    FROM moderation_cases
    WHERE subject_author_id = p_user_id;
    
    -- Calculate strikes
    SELECT COALESCE(SUM(
        CASE 
            WHEN severity = 'minor' THEN 0.33
            WHEN severity = 'moderate' THEN 1
            WHEN severity = 'severe' THEN 2
            ELSE 0
        END
    ), 0)::INTEGER
    INTO v_current_strikes
    FROM offense_history
    WHERE user_id = p_user_id;
    
    -- Calculate risk score
    v_risk_score := LEAST(100, 
        (v_violations * 10) + 
        (v_current_strikes * 15) +
        (SELECT COUNT(*) * 20 FROM offense_history WHERE user_id = p_user_id AND action_taken = 'ban')
    );
    
    -- Upsert offender profile
    INSERT INTO offender_profiles (
        user_id, total_cases, violations_confirmed, current_strikes, 
        last_offense_at, risk_score, updated_at
    )
    VALUES (
        p_user_id, v_total_cases, v_violations, v_current_strikes,
        NOW(), v_risk_score, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_cases = v_total_cases,
        violations_confirmed = v_violations,
        current_strikes = v_current_strikes,
        last_offense_at = NOW(),
        risk_score = v_risk_score,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on moderation_cases
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_moderation_cases_updated_at
    BEFORE UPDATE ON moderation_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at
    BEFORE UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fraud_flags_updated_at
    BEFORE UPDATE ON fraud_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
