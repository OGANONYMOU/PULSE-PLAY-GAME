import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Users, Calendar, Clock, Zap,
  Play, CheckCircle, Loader2, X, Upload, Send,
  ArrowLeft, Sword, Crown, Flag, Bell, Info,
  UserCheck, UserPlus, Lock, UserX, Settings,
  Target, Crosshair,
} from 'lucide-react';
import { FootballBracket } from '@/components/tournament/FootballBracket';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { submitDispute } from '@/lib/dispute/disputeSystem';
import { type FraudFlag } from '@/lib/fraud/fraudDetection';
import { resolveGameImage } from '@/lib/gameImages';
import { TournamentOrganizerPanel } from '@/components/tournament/Tournamentorganizerpanel';
import { BRGameResultModal, type BRScoringConfig } from '@/components/tournament/BRGameResultModal';
import { RoomCodePanel } from '@/components/tournament/RoomCodePanel';

// ── Types ──────────────────────────────────────────────────────────────────
type TournamentFull = {
  id: string; name: string; status: string; date: string; end_date: string | null;
  prize_pool: string; prize_amount: number; entry_fee: number; currency: string;
  max_players: number; current_players: number; duration: string;
  winner: string | null; runner_up: string | null;
  bracket_generated: boolean; total_rounds: number | null; current_round: number;
  easy_mode: boolean; format: string; rules: string | null; is_public: boolean;
  description: string | null; banner_url: string | null;
  check_in_open: string | null; check_in_close: string | null;
  registration_closes: string | null; created_by: string | null;
  games: { id: string; name: string; icon: string; logo_url: string | null } | null;
};

type Participant = {
  id: string; user_id: string; status: string; seed: number | null;
  in_game_username: string | null; joined_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

type Round = {
  id: string; round_number: number; round_name: string;
  total_matches: number; completed_matches: number; status: string;
};

type Match = {
  id: string; round: number; round_id: string; status: string;
  player1_id: string | null; player2_id: string | null;
  player1_score: number | null; player2_score: number | null;
  winner_id: string | null; is_bye: boolean; match_number: number | null;
  next_match_id: string | null; next_match_slot: number | null;
  player1: { username: string; avatar_url: string | null } | null;
  player2: { username: string; avatar_url: string | null } | null;
  winner: { username: string } | null;
};

type TournPost = {
  id: string; type: string; content: string; created_at: string;
  match_id: string | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

type Fixture = {
  id: string;
  round: number;
  match_number: number;
  home_participant_id: string;
  away_participant_id: string;
  home_score: number | null;
  away_score: number | null;
  winner_id: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string;
  is_walkover: boolean;
  home_participant: { username: string; avatar_url: string | null } | null;
  away_participant: { username: string; avatar_url: string | null } | null;
};

type Standing = {
  participant_id: string;
  username: string;
  avatar_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string[];
};

type BRStanding = {
  participant_id: string;
  username: string;
  avatar_url: string | null;
  matches_played: number;
  total_kills: number;
  placement_points: number;
  total_points: number;
  chicken_dinners: number;
  avg_placement: number;
};

// ── Avatar helper ──────────────────────────────────────────────────────────
function PlayerAvatar({ username, url, size = 'sm' }: { username: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-9 w-9' : 'h-7 w-7';
  return (
    <Avatar className={`${cls} flex-shrink-0`}>
      <AvatarImage src={url ?? undefined} />
      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-orbitron font-black text-xs">
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Match action drawer ────────────────────────────────────────────────────
function MatchActionDrawer({ match, tournament, myId, onClose, onRefresh }: {
  match: Match; tournament: TournamentFull; myId: string;
  onClose: () => void; onRefresh: () => void;
}) {
  const [view, setView] = useState<'main' | 'submit' | 'confirm' | 'dispute'>('main');
  const [p1Score, setP1Score] = useState('');
  const [p2Score, setP2Score] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const [existingReport, setExistingReport] = useState<{
    id: string; player1_score: number; player2_score: number;
    proof_url: string; reporter_id: string; status: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isPlayer1 = match.player1_id === myId;
  const isPlayer2 = match.player2_id === myId;
  void (isPlayer1 ? match.player2 : match.player1); // opponent ref for future use

  useEffect(() => {
    // Load existing report for this match
    supabase.from('match_reports').select('*').eq('match_id', match.id)
      .neq('reporter_id', myId).maybeSingle()
      .then(({ data }) => setExistingReport(data as typeof existingReport));
  }, [match.id, myId]);

  const submitReport = async () => {
    if (!p1Score || !p2Score) { toast.error('Enter both scores'); return; }
    if (!proofFile) { toast.error('Screenshot proof is required'); return; }
    setUploading(true);
    try {
      const path = `proofs/${match.id}/${myId}-${Date.now()}.${proofFile.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('match-proofs').upload(path, proofFile, { upsert: false });
      if (upErr) {
        // Fallback to avatars bucket if match-proofs doesn't exist yet
        const { error: fbErr } = await supabase.storage.from('avatars').upload(`match-proofs/${path}`, proofFile, { upsert: false });
        if (fbErr) throw new Error(fbErr.message);
      }
      const { data: urlData } = supabase.storage.from('match-proofs').getPublicUrl(path);
      const proofUrl = urlData?.publicUrl ?? '';

      const { error } = await supabase.from('match_reports').insert({
        match_id: match.id,
        reporter_id: myId,
        player1_score: parseInt(p1Score),
        player2_score: parseInt(p2Score),
        proof_url: proofUrl,
        proof_storage_key: path,
        notes: notes.trim() || null,
      } as never);

      if (error?.code === '23505') {
        toast.error('You have already submitted a report for this match.');
      } else if (error) {
        throw new Error(error.message);
      } else {
        await supabase.from('matches').update({ status: 'awaiting_proof' } as never).eq('id', match.id);
        toast.success('Result submitted! Waiting for opponent confirmation.');
        onRefresh();
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
  };

  const confirmResult = async (decision: 'confirm' | 'dispute') => {
    if (!existingReport) return;
    if (decision === 'dispute' && !disputeReason.trim()) { toast.error('Please explain the dispute'); return; }
    setUploading(true);
    try {
      if (decision === 'confirm') {
        const { error } = await (supabase as any).rpc('confirm_match_result', {
          p_match_id: match.id,
          p_report_id: existingReport.id,
          p_decision: decision,
          p_reason: null,
        });
        if (error) throw new Error(error.message);
        toast.success('Result confirmed! You advance. 🎉');
      } else {
        // Use the real dispute system
        const result = await submitDispute({
          tournament_id: tournament.id,
          match_id: match.id,
          initiator_id: myId,
          respondent_id: existingReport.reporter_id,
          type: 'disputed_result',
          claim: disputeReason,
          evidence_urls: existingReport.proof_url ? [existingReport.proof_url] : [],
        });
        if (!result.success) throw new Error(result.error || 'Failed to submit dispute');
        toast.success('Dispute opened. An admin will review.');
      }
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
    setUploading(false);
  };

  const canSubmit = (isPlayer1 || isPlayer2) && match.status !== 'awaiting_proof' && match.status !== 'verified' && match.status !== 'settled';
  const canConfirm = existingReport && existingReport.reporter_id !== myId && match.status === 'awaiting_proof';

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 max-w-full bg-[#0a0a16]/99 border-l border-white/10 backdrop-blur-2xl flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <Sword className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="font-orbitron font-bold text-sm text-white">Match #{match.match_number}</p>
            <p className="text-[10px] text-white/35 capitalize">{match.status.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-white/8 flex items-center justify-center text-white/35 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Players */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/4 border border-white/8">
          <div className="flex flex-col items-center gap-2 flex-1">
            <PlayerAvatar username={match.player1?.username ?? 'TBD'} url={match.player1?.avatar_url} size="md" />
            <span className="text-xs font-semibold text-white truncate max-w-[80px] text-center">{match.player1?.username ?? 'TBD'}</span>
            {match.player1_score !== null && <span className="font-orbitron font-black text-2xl text-cyan-400">{match.player1_score}</span>}
          </div>
          <div className="flex flex-col items-center gap-1 px-3">
            <span className="font-orbitron font-black text-white/20 text-sm">VS</span>
            {tournament.format !== 'best_of_1' && <span className="text-[9px] text-white/25">{tournament.format.replace('_', ' ')}</span>}
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <PlayerAvatar username={match.player2?.username ?? 'TBD'} url={match.player2?.avatar_url} size="md" />
            <span className="text-xs font-semibold text-white truncate max-w-[80px] text-center">{match.player2?.username ?? 'TBD'}</span>
            {match.player2_score !== null && <span className="font-orbitron font-black text-2xl text-cyan-400">{match.player2_score}</span>}
          </div>
        </div>

        {/* Existing report from opponent */}
        {existingReport && match.status === 'awaiting_proof' && (
          <div className="p-4 rounded-2xl bg-yellow-500/8 border border-yellow-500/20">
            <p className="text-xs font-bold text-yellow-400 mb-2">⚠ Opponent submitted a result</p>
            <div className="flex items-center justify-between text-sm text-white/70 mb-3">
              <span>{match.player1?.username}</span>
              <span className="font-orbitron font-black text-lg text-white">{existingReport.player1_score} – {existingReport.player2_score}</span>
              <span>{match.player2?.username}</span>
            </div>
            {existingReport.proof_url && (
              <a href={existingReport.proof_url} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-xs text-cyan-400 hover:underline mb-3">
                View screenshot proof →
              </a>
            )}
            {!canConfirm ? null : (
              view === 'dispute' ? (
                <div className="space-y-2">
                  <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Explain why you disagree with this result…" rows={3}
                    className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-red-500/40 placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <button onClick={() => setView('main')} className="flex-1 py-2 rounded-xl border border-white/12 text-white/50 text-xs hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={() => confirmResult('dispute')} disabled={uploading}
                      className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all flex items-center justify-center gap-1.5">
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}Dispute
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setView('dispute')} className="flex-1 py-2.5 rounded-xl border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-all">
                    Dispute
                  </button>
                  <button onClick={() => confirmResult('confirm')} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Confirm Result
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Submit result form */}
        {canSubmit && !existingReport && (
          view === 'submit' ? (
            <div className="space-y-4">
              <h3 className="font-orbitron font-bold text-sm text-white">Submit Match Result</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-white/45 uppercase tracking-wider">{match.player1?.username ?? 'Player 1'} Score</label>
                  <input type="number" min="0" value={p1Score} onChange={e => setP1Score(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white text-center font-orbitron font-black text-2xl rounded-xl px-3 py-3 focus:outline-none focus:border-cyan-500/50 w-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-white/45 uppercase tracking-wider">{match.player2?.username ?? 'Player 2'} Score</label>
                  <input type="number" min="0" value={p2Score} onChange={e => setP2Score(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white text-center font-orbitron font-black text-2xl rounded-xl px-3 py-3 focus:outline-none focus:border-cyan-500/50 w-full" />
                </div>
              </div>

              {/* Proof upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/45 uppercase tracking-wider">Screenshot Proof *</label>
                <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e => setProofFile(e.target.files?.[0] ?? null)} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-500/40 text-white/35 hover:text-white/60 transition-all">
                  <Upload className="w-6 h-6" />
                  {proofFile ? (
                    <span className="text-xs text-cyan-400 font-semibold">{proofFile.name}</span>
                  ) : (
                    <><span className="text-sm font-medium">Upload screenshot</span><span className="text-xs">Full scoreboard required</span></>
                  )}
                </button>
              </div>

              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Optional notes (disconnects, lag, etc.)"
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25" />

              <div className="flex gap-2">
                <button onClick={() => setView('main')} className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/50 text-xs hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={submitReport} disabled={uploading || !proofFile}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Submit Result
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setView('submit')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold hover:opacity-90 transition-all">
              <Upload className="w-4 h-4" />Submit Match Result
            </button>
          )
        )}

        {/* Waiting for opponent */}
        {match.status === 'awaiting_proof' && !canConfirm && (
          <div className="p-4 rounded-2xl bg-white/4 border border-white/8 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-white/30 animate-spin mb-3" />
            <p className="text-sm text-white/50">Waiting for opponent to confirm your result…</p>
          </div>
        )}

        {/* Tournament rules */}
        {tournament.rules && (
          <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-mono mb-2">Tournament Rules</p>
            <p className="text-xs text-white/55 leading-relaxed whitespace-pre-line">{tournament.rules}</p>
          </div>
        )}

        {/* Easy mode hint */}
        {tournament.easy_mode && (
          <div className="p-3 rounded-xl bg-green-500/8 border border-green-500/15">
            <p className="text-[10px] text-green-400 font-semibold">⚡ Easy Tournament Mode</p>
            <p className="text-[10px] text-white/35 mt-0.5">Results are self-reported. Keep it fair — reports go to admin review if disputed.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Participants list ──────────────────────────────────────────────────────
function ParticipantsList({ participants, checkedInCount }: {
  participants: Participant[]; checkedInCount: number;
}) {
  const sorted = [...participants].sort((a, b) => {
    if (a.status === 'checked_in' && b.status !== 'checked_in') return -1;
    if (b.status === 'checked_in' && a.status !== 'checked_in') return 1;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/40">{participants.length} registered · {checkedInCount} checked in</p>
      </div>
      {sorted.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
          <Link to={`/profile/${p.profiles?.username}`}>
            <PlayerAvatar username={p.profiles?.username ?? '?'} url={p.profiles?.avatar_url} />
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${p.profiles?.username}`}>
              <p className="text-sm font-semibold text-white hover:text-cyan-400 transition-colors">{p.profiles?.username ?? '—'}</p>
            </Link>
            {p.in_game_username && <p className="text-[10px] text-white/35">IGN: {p.in_game_username}</p>}
          </div>
          {p.seed && <span className="text-[10px] font-mono text-white/30">#{p.seed}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
            p.status === 'checked_in' ? 'bg-green-500/15 border-green-500/25 text-green-400' :
            p.status === 'dropped' ? 'bg-red-500/10 border-red-500/20 text-red-400/60' :
            'bg-white/6 border-white/12 text-white/40'
          }`}>
            {p.status === 'checked_in' ? '✓ Ready' : p.status === 'dropped' ? 'Eliminated' : 'Registered'}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Live feed ──────────────────────────────────────────────────────────────
function LiveFeed({ posts }: { posts: TournPost[] }) {
  const TYPE_STYLE: Record<string, string> = {
    bracket: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    result: 'bg-green-500/10 border-green-500/20 text-green-300',
    system: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    update: 'bg-white/5 border-white/10 text-white/60',
    hype: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  };
  return (
    <div className="space-y-3">
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-10 h-10 mx-auto text-white/15 mb-3" />
          <p className="text-white/30 text-sm">No updates yet. Come back when the tournament starts.</p>
        </div>
      ) : posts.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className={`p-3.5 rounded-xl border ${TYPE_STYLE[p.type] ?? TYPE_STYLE.update}`}>
          <p className="text-sm leading-relaxed">{p.content}</p>
          <p className="text-[10px] text-white/25 mt-1.5">
            {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
            {p.profiles && <span className="ml-2">by @{p.profiles.username}</span>}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Fixture view (for football/league tournaments) ──────────────────────────
function FixtureView({ fixtures, onOpenFixture }: { fixtures: Fixture[]; onOpenFixture?: (f: Fixture) => void }) {
  if (fixtures.length === 0) return (
    <div className="text-center py-16">
      <Trophy className="w-14 h-14 mx-auto text-white/15 mb-4" />
      <p className="text-white/35 text-sm">Fixtures not generated yet.</p>
      <p className="text-white/20 text-xs mt-1">Waiting for registration to complete.</p>
    </div>
  );

  const fixturesByRound = fixtures.reduce((acc, f) => {
    acc[f.round] = acc[f.round] || [];
    acc[f.round].push(f);
    return acc;
  }, {} as Record<number, Fixture[]>);

  return (
    <div className="space-y-6">
      {Object.entries(fixturesByRound).map(([round, roundFixtures]) => (
        <div key={round} className="space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-orbitron font-bold text-white/50">Round {round}</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-2">
            {roundFixtures.map(f => {
              const homeWon = f.winner_id === f.home_participant_id;
              const awayWon = f.winner_id === f.away_participant_id;
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onOpenFixture?.(f)}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    f.is_walkover ? 'bg-orange-500/5 border-orange-500/20' :
                    f.status === 'completed' ? 'bg-green-500/5 border-green-500/20' :
                    f.status === 'in_progress' ? 'bg-cyan-500/5 border-cyan-500/30' :
                    'bg-white/3 border-white/8'
                  } ${onOpenFixture ? 'cursor-pointer hover:bg-white/5' : ''} transition-all`}
                >
                  <div className={`flex-1 flex items-center justify-end gap-2 ${f.status === 'completed' && !homeWon ? 'opacity-40' : ''}`}>
                    <span className={`text-sm font-semibold ${homeWon ? 'text-green-400' : 'text-white'}`}>{f.home_participant?.username ?? 'TBD'}</span>
                    <PlayerAvatar username={f.home_participant?.username ?? '?'} url={f.home_participant?.avatar_url} />
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 min-w-[80px] text-center">
                    {f.is_walkover ? (
                      <span className="text-[10px] font-orbitron font-bold text-orange-400 tracking-wider">W/O</span>
                    ) : f.status === 'completed' ? (
                      <span className="font-orbitron font-black text-lg text-white">{f.home_score} - {f.away_score}</span>
                    ) : (
                      <span className="text-xs text-white/40">VS</span>
                    )}
                  </div>
                  <div className={`flex-1 flex items-center gap-2 ${f.status === 'completed' && !awayWon ? 'opacity-40' : ''}`}>
                    <PlayerAvatar username={f.away_participant?.username ?? '?'} url={f.away_participant?.avatar_url} />
                    <span className={`text-sm font-semibold ${awayWon ? 'text-green-400' : 'text-white'}`}>{f.away_participant?.username ?? 'TBD'}</span>
                  </div>
                  {f.status === 'in_progress' && <span className="text-[10px] text-cyan-400 animate-pulse">● Live</span>}
                  {f.is_walkover && <span className="text-[9px] text-orange-400/70 font-mono">walkover</span>}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Standings table (for league/round-robin tournaments) ────────────────────
function StandingsTable({ standings }: { standings: Standing[] }) {
  if (standings.length === 0) return (
    <div className="text-center py-16">
      <Trophy className="w-14 h-14 mx-auto text-white/15 mb-4" />
      <p className="text-white/35 text-sm">Standings not available yet.</p>
      <p className="text-white/20 text-xs mt-1">Waiting for matches to complete.</p>
    </div>
  );

  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    return b.goals_for - a.goals_for;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">#</th>
            <th className="text-left py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">Player</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">P</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">W</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">D</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">L</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">GF</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">GA</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">GD</th>
            <th className="text-center py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">Pts</th>
            <th className="text-left py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">Form</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.participant_id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td className="py-3 px-2">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  i === 1 ? 'bg-slate-400/20 text-slate-300' :
                  i === 2 ? 'bg-orange-600/20 text-orange-400' :
                  'bg-white/5 text-white/50'
                }`}>
                  {i + 1}
                </span>
              </td>
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar username={s.username} url={s.avatar_url} />
                  <span className="text-sm font-medium text-white">{s.username}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-center text-sm text-white/60">{s.played}</td>
              <td className="py-3 px-2 text-center text-sm text-green-400">{s.won}</td>
              <td className="py-3 px-2 text-center text-sm text-yellow-400">{s.drawn}</td>
              <td className="py-3 px-2 text-center text-sm text-red-400">{s.lost}</td>
              <td className="py-3 px-2 text-center text-sm text-white/60">{s.goals_for}</td>
              <td className="py-3 px-2 text-center text-sm text-white/60">{s.goals_against}</td>
              <td className="py-3 px-2 text-center text-sm font-bold text-cyan-400">{s.goal_difference > 0 ? '+' : ''}{s.goal_difference}</td>
              <td className="py-3 px-2 text-center">
                <span className="font-orbitron font-black text-lg text-white">{s.points}</span>
              </td>
              <td className="py-3 px-2">
                <div className="flex gap-1">
                  {s.form.slice(-5).map((r, idx) => (
                    <span key={idx} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                      r === 'W' ? 'bg-green-500/20 text-green-400' :
                      r === 'D' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {r}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Battle Royale standings ────────────────────────────────────────────────
function BRStandingsTable({ standings }: { standings: BRStanding[] }) {
  if (standings.length === 0) return (
    <div className="text-center py-16">
      <Crosshair className="w-14 h-14 mx-auto text-white/15 mb-4" />
      <p className="text-white/35 text-sm">No battle royale stats yet.</p>
      <p className="text-white/20 text-xs mt-1">Stats will appear as matches are recorded.</p>
    </div>
  );

  const sorted = [...standings].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {['#', 'Player', 'MP', 'Kills', 'Placement Pts', 'Total Pts', '#1 Wins', 'Avg Pos'].map(h => (
              <th key={h} className={`${h === 'Player' ? 'text-left' : 'text-center'} py-3 px-2 text-[10px] font-bold text-white/40 uppercase tracking-wider`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.participant_id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td className="py-3 px-2">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  i === 1 ? 'bg-slate-400/20 text-slate-300' :
                  i === 2 ? 'bg-orange-600/20 text-orange-400' :
                  'bg-white/5 text-white/50'
                }`}>{i + 1}</span>
              </td>
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar username={s.username} url={s.avatar_url} />
                  <span className="text-sm font-medium text-white">{s.username}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-center text-sm text-white/60">{s.matches_played}</td>
              <td className="py-3 px-2 text-center">
                <span className="font-orbitron font-bold text-sm text-red-400">{s.total_kills}</span>
              </td>
              <td className="py-3 px-2 text-center text-sm text-blue-400">{s.placement_points}</td>
              <td className="py-3 px-2 text-center">
                <span className="font-orbitron font-black text-lg text-cyan-400">{s.total_points}</span>
              </td>
              <td className="py-3 px-2 text-center">
                {s.chicken_dinners > 0 ? (
                  <span className="inline-flex items-center gap-1 text-yellow-400 font-bold text-sm">
                    🍗 {s.chicken_dinners}
                  </span>
                ) : <span className="text-white/30 text-sm">—</span>}
              </td>
              <td className="py-3 px-2 text-center text-sm text-white/60">
                {s.avg_placement > 0 ? `#${Math.round(s.avg_placement)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Withdraw Confirm Modal ─────────────────────────────────────────────────
function WithdrawConfirmModal({
  open, onClose, onConfirm, tournamentName, entryFee, bracketGenerated, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  tournamentName: string; entryFee: number; bracketGenerated: boolean; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f1117] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-red-500/15">
            <UserX className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-white text-base">Withdraw from Tournament</h3>
            <p className="text-xs text-white/40">{tournamentName}</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <p className="text-xs text-white/60 font-semibold uppercase tracking-wider mb-2">Consequences</p>
          {!bracketGenerated ? (
            <>
              <div className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Your slot becomes available for another player</span>
              </div>
              {entryFee > 0 && (
                <div className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Entry fee of <span className="text-yellow-400 font-semibold">{entryFee} PP</span> will be refunded</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-white/30 mt-0.5">•</span>
                <span>No fixtures affected (brackets not yet generated)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-orange-400 mt-0.5">!</span>
                <span>All your remaining scheduled matches will be awarded as <span className="text-orange-400 font-semibold">Walkover Wins</span> to your opponents</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-red-400 mt-0.5">✗</span>
                <span>No entry fee refund — brackets have already been generated</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-white/70">
                <span className="text-red-400 mt-0.5">✗</span>
                <span>This action cannot be undone</span>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-semibold hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            {loading ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<TournamentFull | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [posts, setPosts] = useState<TournPost[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [brStandings, setBRStandings] = useState<BRStanding[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [fraudRisk, setFraudRisk] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    'overview' | 'bracket' | 'fixtures' | 'standings' | 'br_standings' |
    'participants' | 'feed' | 'organizer'
  >('overview');
  const [joining, setJoining] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [myStaffRole, setMyStaffRole] = useState<string | null>(null);
  const [brConfig, setBRConfig] = useState<BRScoringConfig | null>(null);
  const [brModalOpen, setBRModalOpen] = useState(false);
  const [inGameUsername, setInGameUsername] = useState('');
  const [showIGNModal, setShowIGNModal] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [tRes, pRes, rRes, mRes, postRes, fRes, sRes, brRes] = await Promise.all([
      supabase.from('tournaments')
        .select('*, games(id, name, icon, logo_url)')
        .eq('id', id).single(),
      supabase.from('tournament_participants')
        .select('*, profiles(username, avatar_url)')
        .eq('tournament_id', id)
        .neq('status', 'withdrawn')
        .order('joined_at'),
      supabase.from('tournament_rounds')
        .select('*').eq('tournament_id', id)
        .order('round_number'),
      supabase.from('matches')
        .select('*, player1:profiles!player1_id(username, avatar_url), player2:profiles!player2_id(username, avatar_url), winner:profiles!winner_id(username)')
        .eq('tournament_id', id)
        .order('match_number'),
      supabase.from('tournament_posts')
        .select('*, profiles(username, avatar_url)')
        .eq('tournament_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('tournament_fixtures')
        .select('*, home_participant:profiles!home_participant_id(username, avatar_url), away_participant:profiles!away_participant_id(username, avatar_url)')
        .eq('tournament_id', id)
        .order('round').order('match_number'),
      supabase.from('tournament_standings')
        .select('*, participant:profiles!participant_id(username, avatar_url)')
        .eq('tournament_id', id)
        .order('points', { ascending: false })
        .order('goal_difference', { ascending: false }),
      supabase.from('tournament_br_standings')
        .select('*, participant:profiles!participant_id(username, avatar_url)')
        .eq('tournament_id', id)
        .order('total_kills', { ascending: false }),
    ]);

    if (tRes.error) { toast.error('Tournament not found'); navigate('/tournaments'); return; }
    setTournament(tRes.data as TournamentFull);

    // Load BR scoring config
    const { data: brConfigData } = await (supabase as any)
      .from('br_scoring_configs')
      .select('*')
      .eq('tournament_id', id)
      .maybeSingle();
    if (brConfigData) {
      setBRConfig({
        kill_points: brConfigData.kill_points,
        placement_points: brConfigData.placement_points,
        preset_name: brConfigData.preset_name ?? null,
        game_mode: brConfigData.game_mode ?? null,
        games_per_session: brConfigData.games_per_session ?? 4,
      });
    }
    setParticipants((pRes.data as Participant[]) ?? []);
    setRounds((rRes.data as Round[]) ?? []);
    setMatches((mRes.data as Match[]) ?? []);
    setPosts((postRes.data as TournPost[]) ?? []);

    // Transform fixtures data
    const rawFixtures = fRes.data ?? [];
    setFixtures(rawFixtures.map((f: Record<string, unknown>) => ({
      id: f.id as string,
      round: f.round as number,
      match_number: f.match_number as number,
      home_participant_id: f.home_participant_id as string,
      away_participant_id: f.away_participant_id as string,
      home_score: f.home_score as number | null,
      away_score: f.away_score as number | null,
      winner_id: f.winner_id as string | null,
      status: f.status as Fixture['status'],
      scheduled_at: f.scheduled_at as string,
      is_walkover: (f.is_walkover as boolean) ?? false,
      home_participant: f.home_participant as { username: string; avatar_url: string | null } | null,
      away_participant: f.away_participant as { username: string; avatar_url: string | null } | null,
    })));

    // Transform standings data
    const rawStandings = sRes.data ?? [];
    setStandings(rawStandings.map((s: Record<string, unknown>) => ({
      participant_id: s.participant_id as string,
      username: (s.participant as { username: string })?.username ?? 'Unknown',
      avatar_url: (s.participant as { avatar_url: string | null })?.avatar_url ?? null,
      played: s.played as number,
      won: s.won as number,
      drawn: s.drawn as number,
      lost: s.lost as number,
      goals_for: s.goals_for as number,
      goals_against: s.goals_against as number,
      goal_difference: s.goal_difference as number,
      points: s.points as number,
      form: (s.form as string[]) ?? [],
    })));

    // Transform battle royale standings
    const rawBR = brRes.data ?? [];
    setBRStandings(rawBR.map((s: Record<string, unknown>) => {
      const mp = (s.matches_played as number) || 0;
      const tp = (s.total_placements as number) || 0;
      return {
        participant_id: s.participant_id as string,
        username: (s.participant as { username: string })?.username ?? 'Unknown',
        avatar_url: (s.participant as { avatar_url: string | null })?.avatar_url ?? null,
        matches_played: mp,
        total_kills: (s.total_kills as number) || 0,
        placement_points: (s.placement_points as number) || 0,
        total_points: ((s.total_kills as number) || 0) + ((s.placement_points as number) || 0),
        chicken_dinners: (s.chicken_dinners as number) || 0,
        avg_placement: mp > 0 ? Math.round(tp / mp) : 0,
      };
    }));

    if (user) {
      const mine = (pRes.data as Participant[])?.find(p => p.user_id === user.id) ?? null;
      setMyParticipant(mine);

      // Check organizer/staff role
      const tData = tRes.data as { created_by: string | null };
      const isOwner = tData?.created_by === user.id;
      const { data: staffRow } = await supabase
        .from('tournament_staff').select('role')
        .eq('tournament_id', id).eq('user_id', user.id)
        .maybeSingle();
      const { data: profileRow } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      const profileRole = (profileRow as { role?: string } | null)?.role ?? '';
      const isAdmin = ['ADMIN','MODERATOR','SUPER_ADMIN'].includes(profileRole);
      setIsOrganizer(isOwner || !!staffRow || isAdmin);
      setMyStaffRole(isOwner ? 'host' : ((staffRow as { role?: string } | null)?.role ?? (isAdmin ? 'admin' : null)));
    }

    // Fetch fraud flags for this tournament
    const { data: fraudData } = await supabase
      .from('fraud_flags')
      .select('*')
      .eq('tournament_id', id)
      .order('created_at', { ascending: false });

    const typedFraudFlags = (fraudData ?? []) as FraudFlag[];
    setFraudFlags(typedFraudFlags);

    // Calculate risk score from flags
    const calculatedRisk = typedFraudFlags.reduce((score, flag) => {
      const severityWeight = { low: 10, medium: 30, high: 50 }[flag.severity] || 10;
      return score + severityWeight;
    }, 0);
    setFraudRisk(Math.min(calculatedRisk, 100));

    setLoading(false);
  }, [id, user, navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`tournament_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_rounds', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_posts', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_fixtures', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_standings', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'br_game_results', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_room_codes', filter: `tournament_id=eq.${id}` }, load)
      .subscribe();
    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const handleJoin = async () => {
    if (!isAuthenticated || !user) { toast.error('Sign in to join tournaments'); return; }
    if (!tournament) return;
    if (tournament.entry_fee > 0 && !showIGNModal) { setShowIGNModal(true); return; }
    setJoining(true);
    try {
      if (tournament.entry_fee > 0) {
        const { error: feeErr } = await (supabase as any).rpc('deduct_entry_fee', {
          p_tournament_id: tournament.id, p_user_id: user.id,
        });
        if (feeErr) throw new Error(feeErr.message);
      }
      const { error } = await supabase.from('tournament_participants').insert({
        tournament_id: tournament.id, user_id: user.id,
        in_game_username: inGameUsername.trim() || null,
        status: 'joined',
      } as never);
      if (error?.code === '23505') {
        // Unique constraint hit — might be a re-registration after withdrawal
        const { error: rejoinErr } = await (supabase as any).rpc('rejoin_tournament', {
          p_tournament_id: tournament.id,
          p_in_game_username: inGameUsername.trim() || null,
        });
        if (!rejoinErr) {
          toast.success('Registered! Check in before the tournament starts. 🎮');
          setShowIGNModal(false); setInGameUsername('');
          load();
        } else {
          toast.info('Already registered!');
        }
      } else if (error) throw new Error(error.message);
      else {
        toast.success('Registered! Check in before the tournament starts. 🎮');
        setShowIGNModal(false); setInGameUsername('');
        load();
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    setJoining(false);
  };

  const handleCheckIn = async () => {
    if (!user || !tournament) return;
    setCheckingIn(true);
    const { error } = await (supabase as any).rpc('tournament_check_in', { p_tournament_id: tournament.id });
    if (error) toast.error(error.message);
    else { toast.success('Checked in! ✅'); load(); }
    setCheckingIn(false);
  };

  const handleWithdraw = async () => {
    if (!user || !tournament) return;
    setWithdrawing(true);
    try {
      const { data, error } = await (supabase as any).rpc('withdraw_from_tournament', {
        p_tournament_id: tournament.id,
      });
      if (error) {
        const msg: string = error.message ?? '';
        if (msg.includes('not registered') || msg.includes('not found'))
          toast.error('Registration not found.');
        else if (msg.includes('completed'))
          toast.error('Tournament is already completed.');
        else if (msg.includes('already withdrawn'))
          toast.error('Already withdrawn from this tournament.');
        else
          toast.error(msg || 'Withdrawal failed. Please try again.');
      } else {
        const result = data as { refunded: number; walkovers_awarded: number; bracket_generated: boolean };
        if (result?.walkovers_awarded > 0)
          toast.success(`Withdrawn. ${result.walkovers_awarded} opponent${result.walkovers_awarded > 1 ? 's' : ''} received walkover wins.`);
        else if (result?.refunded > 0)
          toast.success(`Withdrawn and ${result.refunded} PP refunded.`);
        else
          toast.success('Successfully withdrawn from tournament.');
        setWithdrawModalOpen(false);
        setMyParticipant(null);
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdrawal failed.');
    }
    setWithdrawing(false);
  };

  if (loading) return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Header Skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-4" />
        <div className="flex flex-col sm:flex-row gap-5 mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-8 w-64 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-24 bg-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="space-y-4">
          <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );

  if (!tournament) return null;

  const checkedIn = participants.filter(p => p.status === 'checked_in').length;
  const myMatch = matches.find(m =>
    (m.player1_id === user?.id || m.player2_id === user?.id) &&
    ['scheduled', 'in_progress', 'awaiting_proof'].includes(m.status)
  );

  const STATUS_META = {
    upcoming : { label: 'Upcoming',   color: 'text-blue-400',   bg: 'bg-blue-500/15  border-blue-500/25'  },
    ongoing  : { label: 'Live',       color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/25' },
    completed: { label: 'Completed',  color: 'text-white/40',   bg: 'bg-white/8      border-white/12'     },
    cancelled: { label: 'Cancelled',  color: 'text-red-400',    bg: 'bg-red-500/12   border-red-500/25'   },
  }[tournament.status] ?? { label: tournament.status, color: 'text-white/40', bg: 'bg-white/8 border-white/12' };

  // Game-type detection
  const gameName = tournament.games?.name?.toLowerCase() ?? '';
  const isBRGame = ['pubg', 'bgmi', 'free fire', 'cod', 'call of duty'].some(g => gameName.includes(g));
  const tFamily = (tournament as unknown as { tournament_family?: string }).tournament_family ?? '';
  const isBRTournament = tFamily === 'battle_royale' || (isBRGame && brConfig !== null);

  // Tournament structure detection
  const tType = (tournament as unknown as { tournament_type?: string }).tournament_type ?? '';
  const bType = tournament.bracket_generated ? 'bracket' : '';
  const isBracketTournament =
    tType.includes('elimination') || bType === 'bracket' ||
    rounds.length > 0 || matches.length > 0;

  const TABS = [
    { id: 'overview',     label: 'Overview',   icon: Info       },
    ...(isBracketTournament && (rounds.length > 0 || matches.length > 0)
        ? [{ id: 'bracket', label: 'Bracket', icon: Trophy }] : []),
    ...(fixtures.length > 0
        ? [{ id: 'fixtures', label: 'Fixtures', icon: Calendar }] : []),
    ...(standings.length > 0
        ? [{ id: 'standings', label: 'Standings', icon: Trophy }] : []),
    ...(brStandings.length > 0 || isBRTournament || isBRGame
        ? [{ id: 'br_standings', label: isBRTournament ? 'Rankings' : 'BR Standings', icon: Target }] : []),
    { id: 'participants', label: 'Players',     icon: Users      },
    { id: 'feed',         label: 'Live Feed',   icon: Bell       },
    ...(isOrganizer
        ? [{ id: 'organizer', label: 'Manage', icon: Settings }] : []),
  ] as { id: typeof tab; label: string; icon: typeof Info }[];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16">
      {/* ── Header ── */}
      <div className="relative overflow-hidden mb-0"
        style={{ background: 'linear-gradient(180deg, rgba(6,182,212,0.07) 0%, transparent 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-0">
          <Link to="/tournaments" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Tournaments
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-6">
            {/* Game logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 bg-white/5">
              {resolveGameImage(tournament.games?.name ?? '', tournament.games?.logo_url)
                ? <img src={resolveGameImage(tournament.games?.name ?? '', tournament.games?.logo_url)!} alt={tournament.games?.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-4xl">{tournament.games?.icon ?? '🎮'}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${STATUS_META.bg} ${STATUS_META.color}`}>
                  {tournament.status === 'ongoing' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1.5 animate-pulse" />}
                  {STATUS_META.label}
                </span>
                {tournament.easy_mode && <span className="text-[10px] px-2.5 py-1 rounded-full border font-bold bg-yellow-500/15 border-yellow-500/25 text-yellow-400">⚡ Easy Mode</span>}
                {tournament.games && <span className="text-[10px] text-white/40">{tournament.games.icon} {tournament.games.name}</span>}
              </div>
              <h1 className="font-orbitron text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">{tournament.name}</h1>
              {/* Fraud Risk Indicator - visible to all when risk exists, or admins always */}
              {fraudRisk > 0 && (
                <div className={`mb-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                  fraudRisk >= 70 ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                  fraudRisk >= 40 ? 'bg-orange-500/15 border-orange-500/30 text-orange-400' :
                  'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                }`}>
                  <Flag className="w-3.5 h-3.5" />
                  <span className="font-semibold">Risk: {fraudRisk}/100</span>
                  {fraudFlags.length > 0 && (
                    <span className="text-white/50">({fraudFlags.length} flag{fraudFlags.length !== 1 ? 's' : ''})</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-white/40">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{format(new Date(tournament.date), 'MMM d, yyyy HH:mm')}</span>
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{tournament.current_players}/{tournament.max_players} players</span>
                {tournament.entry_fee > 0 && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400" />Entry: {tournament.entry_fee} PP</span>}
                <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-yellow-400" />Prize: {tournament.prize_amount > 0 ? `${tournament.prize_amount} PP` : tournament.prize_pool}</span>
              </div>
            </div>

            {/* Join / check-in CTA */}
            <div className="flex-shrink-0 flex flex-col gap-2 sm:min-w-[160px]">
              {!myParticipant && tournament.status === 'upcoming' && (
                <button onClick={handleJoin} disabled={joining || tournament.current_players >= tournament.max_players}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {tournament.current_players >= tournament.max_players ? 'Tournament Full' : `Join${tournament.entry_fee > 0 ? ` (${tournament.entry_fee} PP)` : ' Free'}`}
                </button>
              )}
              {myParticipant?.status === 'joined' && (
                <button onClick={handleCheckIn} disabled={checkingIn}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}Check In
                </button>
              )}
              {myParticipant?.status === 'checked_in' && (
                <div className="py-3 px-5 rounded-2xl bg-green-500/15 border border-green-500/25 text-green-400 text-sm font-bold text-center flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />Ready ✓
                </div>
              )}
              {/* Withdraw button — shown when registered + tournament not completed/cancelled */}
              {myParticipant && ['joined', 'checked_in'].includes(myParticipant.status ?? '') &&
               ['upcoming', 'ongoing'].includes(tournament.status) && (
                <button onClick={() => setWithdrawModalOpen(true)} disabled={withdrawing}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5">
                  {withdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Withdraw
                </button>
              )}
              {myMatch && (
                <button onClick={() => { setActiveMatch(myMatch); setTab('bracket'); }}
                  className="w-full py-2.5 px-4 rounded-xl bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-xs font-bold hover:bg-yellow-500/25 transition-all flex items-center justify-center gap-1.5 animate-pulse">
                  <Sword className="w-3.5 h-3.5" />Your Match Awaits!
                </button>
              )}
            </div>
          </div>

          {/* Winner banner */}
          {tournament.status === 'completed' && tournament.winner && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-yellow-500/15 via-orange-500/10 to-yellow-500/15 border border-yellow-500/25 text-center">
              <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="font-orbitron font-black text-xl text-white mb-1">🏆 {tournament.winner}</p>
              <p className="text-sm text-white/50">Tournament Champion</p>
              {tournament.runner_up && <p className="text-xs text-white/30 mt-1">🥈 Runner-up: {tournament.runner_up}</p>}
            </motion.div>
          )}

          {/* Progress bar */}
          {tournament.status === 'ongoing' && tournament.total_rounds && (
            <div className="mb-4 p-3 rounded-xl bg-white/4 border border-white/8 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                  <span>Round {tournament.current_round} of {tournament.total_rounds}</span>
                  <span>{Math.round((tournament.current_round / tournament.total_rounds) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(tournament.current_round / tournament.total_rounds) * 100}%` }}
                    transition={{ duration: 0.8 }} className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600" />
                </div>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-white/8 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                  tab === t.id ? 'text-cyan-400 border-cyan-400' : 'text-white/40 border-transparent hover:text-white/70'
                }`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
                {t.id === 'feed' && posts.length > 0 && <span className="ml-1 text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 rounded-full">{posts.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Format', val: tournament.format.replace('_', ' '), icon: Trophy, color: 'text-cyan-400' },
                  { label: 'Players', val: `${tournament.current_players}/${tournament.max_players}`, icon: Users, color: 'text-purple-400' },
                  { label: 'Checked In', val: `${checkedIn}`, icon: UserCheck, color: 'text-green-400' },
                  { label: 'Prize', val: tournament.prize_amount > 0 ? `${tournament.prize_amount} PP` : tournament.prize_pool, icon: Zap, color: 'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-2xl bg-white/4 border border-white/8 text-center">
                    <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                    <p className={`font-orbitron font-black text-base ${s.color}`}>{s.val}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="p-5 rounded-2xl bg-white/3 border border-white/8 space-y-3">
                <h3 className="font-orbitron font-bold text-sm text-white mb-4">Tournament Timeline</h3>
                {[
                  { label: 'Registration Closes', time: tournament.registration_closes, icon: Lock },
                  { label: 'Check-in Opens', time: tournament.check_in_open, icon: UserCheck },
                  { label: 'Check-in Closes', time: tournament.check_in_close, icon: Clock },
                  { label: 'Matches Start', time: tournament.date, icon: Play },
                ].filter(e => e.time).map((e, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center flex-shrink-0">
                      <e.icon className="w-4 h-4 text-white/40" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white/70">{e.label}</p>
                      <p className="text-[11px] text-white/35">{format(new Date(e.time!), 'MMM d, HH:mm')}</p>
                    </div>
                    <span className="text-[10px] text-white/25">{formatDistanceToNow(new Date(e.time!), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>

              {/* Rules */}
              {tournament.rules && (
                <div className="p-5 rounded-2xl bg-white/3 border border-white/8">
                  <h3 className="font-orbitron font-bold text-sm text-white mb-3">Rules</h3>
                  <p className="text-sm text-white/55 leading-relaxed whitespace-pre-line">{tournament.rules}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Recent activity */}
              <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
                <h3 className="font-orbitron font-bold text-xs text-white mb-3 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-cyan-400" />Latest Updates
                </h3>
                <div className="space-y-2">
                  {posts.slice(0, 4).map(p => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-white/4 border border-white/6">
                      <p className="text-xs text-white/60 line-clamp-2">{p.content}</p>
                      <p className="text-[9px] text-white/25 mt-1">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                    </div>
                  ))}
                  {posts.length === 0 && <p className="text-xs text-white/25 text-center py-3">No updates yet</p>}
                </div>
                {posts.length > 4 && (
                  <button onClick={() => setTab('feed')} className="mt-2 w-full text-xs text-cyan-400 hover:text-cyan-300 text-center">
                    See all {posts.length} updates →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'bracket' && (
          <FootballBracket rounds={rounds} matches={matches} myId={user?.id ?? null} onOpenMatch={setActiveMatch} />
        )}

        {tab === 'fixtures' && (
          fixtures.length > 0
            ? <FixtureView fixtures={fixtures} onOpenFixture={() => {}} />
            : (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Calendar className="w-12 h-12 text-white/20" />
                <p className="text-white/40 text-sm">Fixtures not yet available.</p>
                {isOrganizer && (
                  <p className="text-[11px] text-white/25 text-center">Use the <span className="text-amber-400">Manage</span> tab → Fixtures to generate them.</p>
                )}
              </div>
            )
        )}

        {tab === 'standings' && (
          <StandingsTable standings={standings} />
        )}

        {tab === 'participants' && (
          <ParticipantsList participants={participants} checkedInCount={checkedIn} />
        )}

        {tab === 'feed' && <LiveFeed posts={posts} />}

        {tab === 'br_standings' && (
          <div className="space-y-6">
            {/* Submit result CTA for registered participants */}
            {myParticipant && ['joined', 'checked_in'].includes(myParticipant.status ?? '') &&
             ['upcoming', 'ongoing'].includes(tournament.status) && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <Crosshair className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Submit Your Game Result</p>
                    <p className="text-[10px] text-white/40">Record kills + placement after each game</p>
                  </div>
                </div>
                <button
                  onClick={() => setBRModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Submit Result
                </button>
              </div>
            )}

            {/* Standings table */}
            <BRStandingsTable standings={brStandings} />

            {/* Room Codes section */}
            {(isBRTournament || isBRGame) && (
              <div className="pt-4 border-t border-white/8">
                <RoomCodePanel
                  tournamentId={tournament.id}
                  canManage={false}
                  gamesPerSession={brConfig?.games_per_session ?? 4}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'organizer' && isOrganizer && tournament && (
          <TournamentOrganizerPanel
            tournament={tournament as any}
            myRole={(myStaffRole ?? (isOrganizer ? 'host' : null)) as import('@/components/tournament/Fixtureresultmodal').StaffRole | null}
            isAdmin={!!(user as any)?.role && ['ADMIN','MODERATOR'].includes((user as any).role)}
            fixtures={fixtures as any[]}
            onFixturesUpdated={load}
            onTournamentStatusChange={load}
            onTournamentDeleted={() => navigate('/tournaments')}
            onTournamentEdited={load}
          />
        )}
      </div>

      {/* BR Game Result Modal */}
      {myParticipant && user && (
        <BRGameResultModal
          open={brModalOpen}
          onClose={() => setBRModalOpen(false)}
          onSubmitted={() => { setBRModalOpen(false); load(); }}
          tournamentId={tournament.id}
          participantId={myParticipant.id}
          myUserId={user.id}
          config={brConfig}
        />
      )}

      {/* IGN Modal */}
      <AnimatePresence>
        {showIGNModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              className="w-full max-w-md bg-[#0d0d1e] border border-white/10 rounded-3xl p-6 shadow-2xl">
              <h3 className="font-orbitron font-bold text-base text-white mb-2">Register for Tournament</h3>
              {tournament.entry_fee > 0 && (
                <p className="text-sm text-yellow-400 mb-4">Entry fee: {tournament.entry_fee} PulsePoints will be deducted.</p>
              )}
              <label className="text-xs text-white/45 uppercase tracking-wider mb-1.5 block">In-Game Username (optional)</label>
              <input value={inGameUsername} onChange={e => setInGameUsername(e.target.value)}
                placeholder={`Your ${tournament.games?.name ?? 'game'} username`}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 placeholder:text-white/25 mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setShowIGNModal(false)} className="flex-1 py-3 rounded-xl border border-white/12 text-white/50 text-sm hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={handleJoin} disabled={joining}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Confirm Join
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Match action drawer */}
      <AnimatePresence>
        {activeMatch && user && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50" onClick={() => setActiveMatch(null)} />
            <MatchActionDrawer
              key="drawer" match={activeMatch} tournament={tournament} myId={user.id}
              onClose={() => setActiveMatch(null)} onRefresh={() => { load(); setActiveMatch(null); }}
            />
          </>
        )}
      </AnimatePresence>

      {tournament && (
        <WithdrawConfirmModal
          open={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          onConfirm={handleWithdraw}
          tournamentName={tournament.name}
          entryFee={tournament.entry_fee}
          bracketGenerated={tournament.bracket_generated}
          loading={withdrawing}
        />
      )}
    </div>
  );
}
