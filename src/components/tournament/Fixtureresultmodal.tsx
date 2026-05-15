// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay — Fixture Result Modal
// Organizers, referees, reporters, and admins can record/edit fixture results.
// Includes: evidence upload, dispute initiation, forfeit handling, audit trail.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, AlertTriangle, CheckCircle2,
  Loader2, FileImage, Trash2, Clock,
  Flag, Shield, Edit3,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { writeAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FixtureParticipant {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export interface Fixture {
  id: string;
  tournament_id: string;
  round_number: number;
  group_id: string | null;
  home_participant_id: string | null;
  away_participant_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_forfeit: boolean;
  away_forfeit: boolean;
  scheduled_at: string | null;
  played_at: string | null;
  venue: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  notes: string | null;
  home_participant?: FixtureParticipant | null;
  away_participant?: FixtureParticipant | null;
}

export type StaffRole = 'host' | 'manager' | 'bracket_manager' | 'reporter' | 'referee' | 'observer';

interface FixtureResultModalProps {
  fixture: Fixture;
  /** Current user's staff role in this tournament */
  staffRole: StaffRole | null;
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
  /** Called after a successful result save so parent can refresh */
  onSaved: (updatedFixture: Fixture) => void;
}

type ModalView = 'result' | 'edit_confirm' | 'dispute' | 'postpone' | 'forfeit';

interface ScoreState {
  home: string;
  away: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function canRecordResult(role: StaffRole | null, isAdmin: boolean, fixture: Fixture): boolean {
  if (isAdmin) return true;
  if (!role) return false;
  if (fixture.status === 'cancelled') return false;
  return ['host', 'manager', 'bracket_manager', 'reporter', 'referee'].includes(role);
}

function canEditResult(role: StaffRole | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!role) return false;
  return ['host', 'manager'].includes(role);
}

function canDisputeResult(role: StaffRole | null, isAdmin: boolean): boolean {
  return isAdmin || (!!role && ['host', 'manager', 'referee'].includes(role));
}

function getOutcomeLabel(homeScore: number, awayScore: number, homeUser: string, awayUser: string) {
  if (homeScore > awayScore) return { winner: homeUser, loser: awayUser, isDraw: false };
  if (awayScore > homeScore) return { winner: awayUser, loser: homeUser, isDraw: false };
  return { winner: null, loser: null, isDraw: true };
}

const DISPUTE_REASONS = [
  'Incorrect score entered',
  'Match not played — reported incorrectly',
  'Wrong player credited',
  'Screenshot is invalid / tampered',
  'Match was a walkover',
  'Technical issue / disconnect',
  'Other',
] as const;

const POSTPONE_REASONS = [
  'Player unavailable',
  'Technical issues',
  'Scheduling conflict',
  'Both parties agreed to reschedule',
  'Tournament admin decision',
  'Other',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE INPUT STEPPER
// ═══════════════════════════════════════════════════════════════════════════════

function ScoreStepper({
  label, value, onChange, disabled, highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const num = parseInt(value) || 0;
  return (
    <div className={cn('flex flex-col items-center gap-2', highlight && 'opacity-100', !highlight && 'opacity-70')}>
      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, num - 1)))}
          disabled={disabled || num === 0}
          className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 text-white font-bold text-lg
                     hover:bg-white/14 disabled:opacity-30 transition-all active:scale-95"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          max="99"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          disabled={disabled}
          className={cn(
            'w-16 h-16 text-center font-orbitron font-black text-3xl rounded-2xl',
            'bg-white/5 border text-white transition-all outline-none',
            'disabled:opacity-40',
            highlight
              ? 'border-cyan-500/50 bg-cyan-500/8 shadow-lg shadow-cyan-500/10'
              : 'border-white/12',
          )}
        />
        <button
          type="button"
          onClick={() => onChange(String(Math.min(99, num + 1)))}
          disabled={disabled}
          className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 text-white font-bold text-lg
                     hover:bg-white/14 disabled:opacity-30 transition-all active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVIDENCE UPLOAD ZONE
// ═══════════════════════════════════════════════════════════════════════════════

function EvidenceUpload({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File | null) => {
    if (!f) { onChange(null); return; }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(f.type)) { toast.error('Invalid file type. Use JPEG, PNG, WebP, or MP4.'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('File too large. Maximum 20MB.'); return; }
    onChange(f);
  };

  const preview = file && file.type.startsWith('image/')
    ? URL.createObjectURL(file)
    : null;

  return (
    <div>
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
        Screenshot / Evidence <span className="text-red-400">*</span>
      </label>
      <div
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all',
          dragging ? 'border-cyan-400/60 bg-cyan-500/6' : 'border-white/12 bg-white/3',
          disabled && 'opacity-40 pointer-events-none',
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
      >
        {file ? (
          <div className="p-4">
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Evidence preview" className="w-full max-h-48 object-contain rounded-xl" />
                <button
                  onClick={() => onChange(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage className="w-8 h-8 text-cyan-400" />
                  <div>
                    <div className="text-sm font-semibold text-white truncate max-w-[200px]">{file.name}</div>
                    <div className="text-xs text-white/35">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                </div>
                <button onClick={() => onChange(null)} className="text-white/30 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full p-6 flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white/35" />
            </div>
            <div className="text-sm text-white/45">
              Drop screenshot here or{' '}
              <span className="text-cyan-400">browse files</span>
            </div>
            <div className="text-[10px] text-white/20">JPEG · PNG · WebP · MP4 — max 20MB</div>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function FixtureResultModal({
  fixture,
  staffRole,
  isAdmin,
  open,
  onClose,
  onSaved,
}: FixtureResultModalProps): React.ReactElement | null {
  const { user, profile } = useAuth();

  const [view, setView]         = useState<ModalView>('result');
  const [score, setScore]       = useState<ScoreState>({
    home: fixture.home_score !== null ? String(fixture.home_score) : '',
    away: fixture.away_score !== null ? String(fixture.away_score) : '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [notes, setNotes]               = useState(fixture.notes ?? '');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeNotes, setDisputeNotes]   = useState('');
  const [postponeReason, setPostponeReason] = useState('');
  const [newDate, setNewDate]           = useState('');
  const [forfeitSide, setForfeitSide]   = useState<'home' | 'away' | null>(null);
  const [saving, setSaving]             = useState(false);

  const homePlayer = fixture.home_participant;
  const awayPlayer = fixture.away_participant;

  // Reset on open
  useEffect(() => {
    if (open) {
      setView('result');
      setScore({
        home: fixture.home_score !== null ? String(fixture.home_score) : '',
        away: fixture.away_score !== null ? String(fixture.away_score) : '',
      });
      setEvidenceFile(null);
      setNotes(fixture.notes ?? '');
      setDisputeReason('');
      setDisputeNotes('');
      setPostponeReason('');
      setNewDate('');
      setForfeitSide(null);
    }
  }, [open, fixture]);

  const isCompleted   = fixture.status === 'completed';
  const canRecord     = canRecordResult(staffRole, isAdmin, fixture);
  const canEdit       = canEditResult(staffRole, isAdmin) && isCompleted;
  const canDispute    = canDisputeResult(staffRole, isAdmin) && isCompleted;
  const requireProof  = !isAdmin; // Admins can skip evidence
  const isEditMode    = isCompleted && view === 'result';

  // ── Upload evidence ───────────────────────────────────────────────────────
  const uploadEvidence = useCallback(async (fixtureId: string): Promise<string | null> => {
    if (!evidenceFile) return null;
    const ext  = evidenceFile.name.split('.').pop() ?? 'jpg';
    const path = `fixtures/${fixtureId}/${user!.id}-${Date.now()}.${ext}`;

    // Try match-proofs bucket first, fall back to avatars
    const { error: e1 } = await supabase.storage.from('match-proofs').upload(path, evidenceFile, { upsert: false });
    if (!e1) {
      const { data } = supabase.storage.from('match-proofs').getPublicUrl(path);
      return data.publicUrl;
    }
    const { error: e2 } = await supabase.storage.from('avatars').upload(`fixture-proofs/${path}`, evidenceFile, { upsert: false });
    if (!e2) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(`fixture-proofs/${path}`);
      return data.publicUrl;
    }
    return null;
  }, [evidenceFile, user]);

  // ── Submit result ─────────────────────────────────────────────────────────
  const handleSaveResult = async () => {
    if (!user) return;

    const homeNum = parseInt(score.home);
    const awayNum = parseInt(score.away);

    if (isNaN(homeNum) || isNaN(awayNum)) { toast.error('Enter valid scores for both sides'); return; }
    if (requireProof && !evidenceFile && !isCompleted) { toast.error('Screenshot evidence is required'); return; }
    if (homeNum < 0 || awayNum < 0) { toast.error('Scores cannot be negative'); return; }

    // Warn on unexpectedly high scores
    if (homeNum > 30 || awayNum > 30) {
      const ok = window.confirm(`Score ${homeNum}-${awayNum} seems unusually high. Confirm?`);
      if (!ok) return;
    }

    setSaving(true);
    try {
      let proofUrl: string | null = null;
      if (evidenceFile) {
        proofUrl = await uploadEvidence(fixture.id);
        if (!proofUrl) { toast.error('Evidence upload failed'); setSaving(false); return; }
      }

      const { error, data } = await supabase
        .from('fixtures')
        .update({
          home_score: homeNum,
          away_score: awayNum,
          status: 'completed',
          played_at: new Date().toISOString(),
          notes: notes.trim() || null,
          ...(proofUrl ? { evidence_url: proofUrl } : {}),
        } as never)
        .eq('id', fixture.id)
        .select('*')
        .single();

      if (error) { toast.error(error.message); setSaving(false); return; }

      // Audit
      await writeAuditLog({
        actor_id:    user.id,
        action:      isCompleted ? 'fixture.result_edited' : 'fixture.result_recorded',
        entity_type: 'fixture',
        entity_id:   fixture.id,
        data: {
          home_score: homeNum,
          away_score: awayNum,
          has_evidence: !!proofUrl,
          tournament_id: fixture.tournament_id,
          round_number: fixture.round_number,
          previous_home: fixture.home_score,
          previous_away: fixture.away_score,
          staff_role: staffRole,
        },
      });

      toast.success(isCompleted ? 'Result updated!' : 'Result recorded!');
      onSaved(data as Fixture);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // ── Dispute ───────────────────────────────────────────────────────────────
  const handleDispute = async () => {
    if (!user) return;
    if (!disputeReason) { toast.error('Select a dispute reason'); return; }
    setSaving(true);
    try {
      // Write to disputes table
      const { error } = await supabase.from('disputes').insert({
        match_id:   null,
        fixture_id: fixture.id,
        tournament_id: fixture.tournament_id,
        raised_by:  user.id,
        reason:     disputeReason,
        notes:      disputeNotes.trim() || null,
        state:      'open',
        due_by:     new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      } as never);

      if (error && error.code !== '23505') { toast.error(error.message); setSaving(false); return; }

      // Update fixture status
      await supabase.from('fixtures').update({ status: 'completed' } as never).eq('id', fixture.id);

      await writeAuditLog({
        actor_id:    user.id,
        action:      'fixture.disputed',
        entity_type: 'fixture',
        entity_id:   fixture.id,
        data:        { reason: disputeReason, tournament_id: fixture.tournament_id },
      });

      toast.success('Dispute raised — admin will review within 48h');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // ── Postpone ──────────────────────────────────────────────────────────────
  const handlePostpone = async () => {
    if (!user) return;
    if (!postponeReason) { toast.error('Select a postponement reason'); return; }
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        status: 'postponed',
        notes: `[Postponed: ${postponeReason}] ${notes}`.trim(),
      };
      if (newDate) updates.scheduled_at = newDate;

      const { data, error } = await supabase
        .from('fixtures')
        .update(updates as never)
        .eq('id', fixture.id)
        .select('*')
        .single();

      if (error) { toast.error(error.message); setSaving(false); return; }

      await writeAuditLog({
        actor_id:    user.id,
        action:      'fixture.postponed',
        entity_type: 'fixture',
        entity_id:   fixture.id,
        data:        { reason: postponeReason, new_date: newDate, tournament_id: fixture.tournament_id },
      });

      toast.success('Fixture postponed');
      onSaved(data as Fixture);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // ── Forfeit ───────────────────────────────────────────────────────────────
  const handleForfeit = async () => {
    if (!user) return;
    if (!forfeitSide) { toast.error('Select which side forfeited'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('fixtures')
        .update({
          home_forfeit: forfeitSide === 'home',
          away_forfeit: forfeitSide === 'away',
          home_score:   forfeitSide === 'home' ? 0 : 3,
          away_score:   forfeitSide === 'away' ? 0 : 3,
          status: 'completed',
          played_at: new Date().toISOString(),
          notes: `Forfeit by ${forfeitSide} side. ${notes}`.trim(),
        } as never)
        .eq('id', fixture.id)
        .select('*')
        .single();

      if (error) { toast.error(error.message); setSaving(false); return; }

      await writeAuditLog({
        actor_id:    user.id,
        action:      'fixture.forfeit_recorded',
        entity_type: 'fixture',
        entity_id:   fixture.id,
        data:        { forfeit_side: forfeitSide, tournament_id: fixture.tournament_id },
      });

      toast.success(`Forfeit recorded — ${forfeitSide} side loses 3-0`);
      onSaved(data as Fixture);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // ── Derived outcome display ───────────────────────────────────────────────
  const homeNum    = parseInt(score.home);
  const awayNum    = parseInt(score.away);
  const bothFilled = !isNaN(homeNum) && !isNaN(awayNum) && score.home !== '' && score.away !== '';
  const outcome    = bothFilled
    ? getOutcomeLabel(homeNum, awayNum, homePlayer?.username ?? 'Home', awayPlayer?.username ?? 'Away')
    : null;

  if (!open) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          className="relative z-10 w-full sm:max-w-lg bg-[#0b0b18] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div>
              <div className="font-orbitron font-bold text-sm text-white">
                {view === 'dispute'  && 'Raise a Dispute'}
                {view === 'postpone' && 'Postpone Fixture'}
                {view === 'forfeit'  && 'Record Forfeit'}
                {view === 'edit_confirm' && 'Confirm Edit'}
                {view === 'result' && (isCompleted ? 'Edit Result' : 'Record Result')}
              </div>
              <div className="text-[10px] text-white/35 mt-0.5">
                Round {fixture.round_number}
                {fixture.scheduled_at && ` · ${format(new Date(fixture.scheduled_at), 'MMM d, yyyy')}`}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/12 transition-colors">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Status bar for completed fixtures */}
          {isCompleted && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-green-500/6 border-b border-green-500/15">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <span className="text-xs text-green-400 font-semibold">Result recorded</span>
              <div className="flex items-center gap-1.5 ml-auto">
                {canDispute && view === 'result' && (
                  <button
                    onClick={() => setView('dispute')}
                    className="text-[10px] text-red-400/80 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Flag className="w-3 h-3" />Dispute
                  </button>
                )}
                {canEdit && view === 'result' && (
                  <button
                    onClick={() => setView('edit_confirm')}
                    className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors ml-1"
                  >
                    <Edit3 className="w-3 h-3" />Edit
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* ── RESULT VIEW ─────────────────────────────────────────────── */}
            {view === 'result' && (
              <>
                {/* Existing result display (when completed and not editing) */}
                {isCompleted && (
                  <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-right">
                        <PlayerBlock player={homePlayer} />
                        {fixture.home_forfeit && <div className="text-[9px] text-red-400 font-bold mt-0.5">FORFEIT</div>}
                      </div>
                      <div className="text-center px-4">
                        <div className="font-orbitron font-black text-2xl text-white">
                          {fixture.home_score ?? '—'} – {fixture.away_score ?? '—'}
                        </div>
                        <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Final Score</div>
                      </div>
                      <div className="flex-1">
                        <PlayerBlock player={awayPlayer} />
                        {fixture.away_forfeit && <div className="text-[9px] text-red-400 font-bold mt-0.5">FORFEIT</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Entry form (when not completed OR in admin edit mode) */}
                {(!isCompleted || (isAdmin && isEditMode)) && canRecord && (
                  <>
                    {/* Player matchup header */}
                    <div className="flex items-center gap-4">
                      <PlayerBlock player={homePlayer} align="right" />
                      <div className="text-xs text-white/25 font-bold uppercase tracking-widest flex-shrink-0">vs</div>
                      <PlayerBlock player={awayPlayer} align="left" />
                    </div>

                    {/* Score steppers */}
                    <div className="flex items-center justify-center gap-4 sm:gap-8">
                      <ScoreStepper
                        label={homePlayer?.username?.split(' ')[0] ?? 'Home'}
                        value={score.home}
                        onChange={v => setScore(s => ({ ...s, home: v }))}
                        disabled={saving}
                        highlight={(parseInt(score.home) || 0) > (parseInt(score.away) || 0)}
                      />
                      <div className="font-orbitron text-2xl font-black text-white/25">–</div>
                      <ScoreStepper
                        label={awayPlayer?.username?.split(' ')[0] ?? 'Away'}
                        value={score.away}
                        onChange={v => setScore(s => ({ ...s, away: v }))}
                        disabled={saving}
                        highlight={(parseInt(score.away) || 0) > (parseInt(score.home) || 0)}
                      />
                    </div>

                    {/* Live outcome preview */}
                    <AnimatePresence>
                      {outcome && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            'rounded-xl px-4 py-2.5 border text-center',
                            outcome.isDraw
                              ? 'bg-yellow-500/8 border-yellow-500/20 text-yellow-400'
                              : 'bg-cyan-500/8 border-cyan-500/20 text-cyan-400',
                          )}
                        >
                          <div className="text-xs font-bold">
                            {outcome.isDraw
                              ? '⚖️  Draw'
                              : `🏆  ${outcome.winner} wins`
                            }
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Evidence */}
                    <EvidenceUpload
                      file={evidenceFile}
                      onChange={setEvidenceFile}
                      disabled={saving}
                    />

                    {/* Notes */}
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        disabled={saving}
                        rows={2}
                        placeholder="Any additional notes about this match…"
                        className="w-full bg-white/4 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none
                                   outline-none focus:border-cyan-500/50 placeholder:text-white/20 transition-colors"
                      />
                    </div>

                    {/* Actions row */}
                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        onClick={handleSaveResult}
                        disabled={saving || !bothFilled}
                        className="w-full h-11 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl disabled:opacity-50"
                      >
                        {saving
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                          : isCompleted ? 'Update Result' : 'Record Result'
                        }
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setView('forfeit')}
                          disabled={saving}
                          className="h-9 rounded-xl border border-orange-500/30 bg-orange-500/8 text-orange-400 text-xs font-bold hover:bg-orange-500/15 transition-colors"
                        >
                          <Flag className="w-3 h-3 inline mr-1.5" />Forfeit
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setView('postpone')}
                            disabled={saving}
                            className="h-9 rounded-xl border border-white/12 bg-white/4 text-white/40 text-xs font-bold hover:bg-white/8 hover:text-white/70 transition-colors"
                          >
                            <Clock className="w-3 h-3 inline mr-1.5" />Postpone
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Unauthorized state */}
                {!canRecord && (
                  <div className="text-center py-8">
                    <Shield className="w-10 h-10 mx-auto text-white/15 mb-3" />
                    <p className="text-sm text-white/40">You don't have permission to record results for this fixture.</p>
                    <p className="text-xs text-white/20 mt-1">Contact the tournament host or admin.</p>
                  </div>
                )}
              </>
            )}

            {/* ── EDIT CONFIRM VIEW ────────────────────────────────────────── */}
            {view === 'edit_confirm' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-amber-400 mb-1">Edit existing result?</div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      This result is already marked as completed. Editing will overwrite the
                      existing score and create an audit log entry. Only hosts and admins can do this.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setView('result')} className="border-white/15 text-white/50">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setView('result')}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" />Proceed to Edit
                  </Button>
                </div>
              </div>
            )}

            {/* ── DISPUTE VIEW ─────────────────────────────────────────────── */}
            {view === 'dispute' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-500/8 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/50 leading-relaxed">
                    A dispute will be assigned to platform admins for review. Results remain
                    recorded until the dispute is resolved. SLA: 48 hours.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                    Reason <span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {DISPUTE_REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setDisputeReason(r)}
                        className={cn(
                          'w-full text-left text-xs px-3.5 py-2.5 rounded-xl border transition-all',
                          disputeReason === r
                            ? 'bg-red-500/12 border-red-500/40 text-red-300'
                            : 'bg-white/3 border-white/8 text-white/50 hover:border-white/18 hover:text-white/75',
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={disputeNotes}
                    onChange={e => setDisputeNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe the issue in detail…"
                    className="w-full bg-white/4 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none
                               outline-none focus:border-red-500/50 placeholder:text-white/20 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setView('result')} className="border-white/15 text-white/50">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDispute}
                    disabled={saving || !disputeReason}
                    className="bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flag className="w-4 h-4 mr-1" />}
                    Raise Dispute
                  </Button>
                </div>
              </div>
            )}

            {/* ── POSTPONE VIEW ────────────────────────────────────────────── */}
            {view === 'postpone' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                    Reason <span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {POSTPONE_REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setPostponeReason(r)}
                        className={cn(
                          'w-full text-left text-xs px-3.5 py-2.5 rounded-xl border transition-all',
                          postponeReason === r
                            ? 'bg-amber-500/12 border-amber-500/40 text-amber-300'
                            : 'bg-white/3 border-white/8 text-white/50 hover:border-white/18 hover:text-white/75',
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                    Rescheduled date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full bg-white/4 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5
                               outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setView('result')} className="border-white/15 text-white/50">
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePostpone}
                    disabled={saving || !postponeReason}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
                    Postpone
                  </Button>
                </div>
              </div>
            )}

            {/* ── FORFEIT VIEW ─────────────────────────────────────────────── */}
            {view === 'forfeit' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-orange-500/8 border border-orange-500/20">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/50 leading-relaxed">
                    The forfeiting side will receive 0 goals / 0 points. The opponent will
                    receive a 3-0 win by default.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-3">
                    Which side forfeited? <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['home', 'away'] as const).map(side => {
                      const player = side === 'home' ? homePlayer : awayPlayer;
                      return (
                        <button
                          key={side}
                          onClick={() => setForfeitSide(side)}
                          className={cn(
                            'rounded-2xl border p-4 text-center transition-all',
                            forfeitSide === side
                              ? 'bg-red-500/12 border-red-500/40'
                              : 'bg-white/3 border-white/8 hover:border-white/18',
                          )}
                        >
                          <Avatar className="h-10 w-10 mx-auto mb-2">
                            <AvatarImage src={player?.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-600 text-white text-xs font-bold">
                              {player?.username?.[0]?.toUpperCase() ?? '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-xs font-bold text-white truncate">{player?.username ?? (side === 'home' ? 'Home' : 'Away')}</div>
                          <div className="text-[10px] text-white/30 mt-0.5 capitalize">{side}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setView('result')} className="border-white/15 text-white/50">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleForfeit}
                    disabled={saving || !forfeitSide}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flag className="w-4 h-4 mr-1" />}
                    Confirm Forfeit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer meta */}
          <div className="px-5 py-3 border-t border-white/6 flex items-center justify-between">
            <div className="text-[10px] text-white/20">
              {profile?.username ?? 'You'} · {staffRole ?? (isAdmin ? 'admin' : 'viewer')}
            </div>
            {fixture.played_at && (
              <div className="text-[10px] text-white/20">
                Played: {format(new Date(fixture.played_at), 'MMM d · HH:mm')}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Micro component: player avatar + name ─────────────────────────────────────
function PlayerBlock({
  player,
  align = 'center',
}: {
  player: FixtureParticipant | null | undefined;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <div className={cn(
      'flex items-center gap-2',
      align === 'right' && 'flex-row-reverse',
      align === 'center' && 'flex-col',
    )}>
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={player?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
          {player?.username?.[0]?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-semibold text-white truncate max-w-[90px]">
        {player?.username ?? 'TBD'}
      </span>
    </div>
  );
}