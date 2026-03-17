import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Clock, CheckCircle, AlertTriangle, X, Plus, RefreshCw,
  Search, ChevronRight, Loader2, ArrowRight, Shield,
  XCircle, Layers, Calendar, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'awaiting_proof'
  | 'disputed'
  | 'verified'
  | 'settled'
  | 'canceled';

type Match = {
  id: string;
  tournament_id: string;
  round: number;
  status: MatchStatus;
  started_at: string | null;
  proof_due_at: string | null;
  created_at: string;
  tournaments: { name: string; games: { name: string; icon: string } | null } | null;
};

type Tournament = { id: string; name: string };

// ── State machine: valid transitions ──────────────────────────────────────
const TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  scheduled      : ['in_progress', 'canceled'],
  in_progress    : ['awaiting_proof', 'canceled'],
  awaiting_proof : ['verified', 'disputed', 'canceled'],
  disputed       : ['verified', 'settled', 'canceled'],
  verified       : ['settled'],
  settled        : [],
  canceled       : [],
};

// ── Status metadata ────────────────────────────────────────────────────────
const STATUS_META: Record<MatchStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  scheduled      : { label: 'Scheduled',      icon: Calendar,      color: 'text-blue-400',   bg: 'bg-blue-500/12 border-blue-500/25'    },
  in_progress    : { label: 'In Progress',    icon: Play,          color: 'text-green-400',  bg: 'bg-green-500/12 border-green-500/25'  },
  awaiting_proof : { label: 'Awaiting Proof', icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-500/12 border-yellow-500/25'},
  disputed       : { label: 'Disputed',       icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/12 border-red-500/25'      },
  verified       : { label: 'Verified',       icon: CheckCircle,   color: 'text-cyan-400',   bg: 'bg-cyan-500/12 border-cyan-500/25'    },
  settled        : { label: 'Settled',        icon: Shield,        color: 'text-purple-400', bg: 'bg-purple-500/12 border-purple-500/25'},
  canceled       : { label: 'Canceled',       icon: XCircle,       color: 'text-white/30',   bg: 'bg-white/5 border-white/10'           },
};

const TRANSITION_LABELS: Partial<Record<MatchStatus, string>> = {
  in_progress    : '▶ Start',
  awaiting_proof : '📸 Request Proof',
  verified       : '✓ Verify',
  disputed       : '⚠ Dispute',
  settled        : '✅ Settle',
  canceled       : '✗ Cancel',
};

// ── New match modal ────────────────────────────────────────────────────────
function NewMatchModal(p: {
  tournaments: Tournament[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const { user } = useAuth();
  const [tournamentId, setTournamentId] = useState('');
  const [round, setRound] = useState(1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!tournamentId) { toast.error('Select a tournament'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('matches').insert({
      tournament_id : tournamentId,
      round,
      status        : 'scheduled',
    } as never).select('id').single();
    if (error) {
      toast.error(error.message);
    } else {
      await writeAuditLog({ actor_id: user?.id, action: 'match.start', entity_type: 'match', entity_id: (data as { id: string }).id, data: { tournament_id: tournamentId, round } });
      toast.success('Match scheduled.');
      p.onSaved();
      p.onClose();
    }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />Schedule Match
          </h2>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Tournament</label>
            <select value={tournamentId} onChange={e => setTournamentId(e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50">
              <option value="" className="bg-card text-white/40">Select tournament…</option>
              {p.tournaments.map(t => <option key={t.id} value={t.id} className="bg-card">{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Round</label>
            <Input type="number" value={round} min={1} onChange={e => setRound(Number(e.target.value))} className={inputCls} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Schedule
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Match detail drawer ────────────────────────────────────────────────────
function MatchDrawer(p: { match: Match; onClose: () => void; onUpdated: () => void }): React.ReactElement {
  const { user } = useAuth();
  const [transitioning, setTransitioning] = useState<MatchStatus | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const meta = STATUS_META[p.match.status];
  const StatusIcon = meta.icon;
  const allowed = TRANSITIONS[p.match.status];

  const transition = async (next: MatchStatus) => {
    setTransitioning(next);
    const updates: Record<string, unknown> = { status: next };
    if (next === 'in_progress') updates.started_at = new Date().toISOString();
    if (next === 'awaiting_proof') {
      const due = new Date();
      due.setHours(due.getHours() + 24);
      updates.proof_due_at = due.toISOString();
    }
    const { error } = await supabase.from('matches').update(updates as never).eq('id', p.match.id);
    if (error) {
      toast.error(error.message);
    } else {
      await writeAuditLog({
        actor_id: user?.id, action: 'match.status_change', entity_type: 'match', entity_id: p.match.id,
        data: { from: p.match.status, to: next },
      });
      toast.success(`Match ${next.replace(/_/g, ' ')}.`);
      p.onUpdated();
    }
    setTransitioning(null);
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed top-0 right-0 bottom-0 z-50 w-96 bg-[#0a0a16]/98 border-l border-white/10 backdrop-blur-2xl flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="font-orbitron font-bold text-sm text-white">Round {p.match.round}</p>
            <p className="text-[10px] text-white/35 truncate max-w-[180px]">{p.match.tournaments?.name}</p>
          </div>
        </div>
        <button onClick={p.onClose} className="w-8 h-8 rounded-xl hover:bg-white/8 flex items-center justify-center text-white/35 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status */}
        <div className={'p-4 rounded-2xl border flex items-center gap-3 ' + meta.bg}>
          <StatusIcon className={'w-5 h-5 ' + meta.color} />
          <div>
            <p className={'font-bold text-sm ' + meta.color}>{meta.label}</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {p.match.started_at ? `Started ${new Date(p.match.started_at).toLocaleString()}` : 'Not started'}
            </p>
          </div>
        </div>

        {/* State machine diagram */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-3 font-mono">State Machine</p>
          <div className="space-y-1.5">
            {(['scheduled','in_progress','awaiting_proof','disputed','verified','settled','canceled'] as MatchStatus[]).map((s) => {
              const m = STATUS_META[s];
              const Icon = m.icon;
              const isCurrent = s === p.match.status;
              return (
                <div key={s} className={'flex items-center gap-2.5 px-3 py-2 rounded-xl border ' +
                  (isCurrent ? m.bg + ' ' + m.color : 'border-white/5 text-white/20')}>
                  <Icon className={'w-3.5 h-3.5 flex-shrink-0 ' + (isCurrent ? m.color : 'text-white/15')} />
                  <span className={'text-xs font-medium ' + (isCurrent ? '' : 'text-white/20')}>{m.label}</span>
                  {isCurrent && <span className="ml-auto text-[9px] font-mono text-white/40">CURRENT</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Proof due date */}
        {p.match.proof_due_at ? (
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-xs text-yellow-400">
              ⏰ Proof due: {new Date(p.match.proof_due_at).toLocaleString()}
            </p>
          </div>
        ) : null}

        {/* Evidence */}
        {(p.match.status === 'awaiting_proof' || p.match.status === 'disputed') && (
          <button onClick={() => setShowEvidence(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all">
            <FileText className="w-3.5 h-3.5" />Submit Evidence
          </button>
        )}

        {/* Metadata */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-white/35">
            <span>Match ID</span><span className="font-mono text-white/50 truncate max-w-[180px]">{p.match.id}</span>
          </div>
          <div className="flex justify-between text-white/35">
            <span>Game</span><span className="text-white/60">{p.match.tournaments?.games?.icon} {p.match.tournaments?.games?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between text-white/35">
            <span>Created</span><span className="text-white/50">{new Date(p.match.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {allowed.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/8 p-4 space-y-2">
          <p className="text-[10px] text-white/25 uppercase tracking-wider font-mono mb-2">Transition to</p>
          {allowed.map((next) => (
            <Button key={next} size="sm" variant="outline" onClick={() => transition(next)}
              disabled={!!transitioning}
              className={'w-full text-xs font-semibold border justify-start gap-2 ' + STATUS_META[next].bg + ' ' + STATUS_META[next].color + ' hover:opacity-80'}>
              {transitioning === next
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ArrowRight className="w-3.5 h-3.5" />}
              {TRANSITION_LABELS[next] ?? next}
            </Button>
          ))}
        </div>
      )}
      <AnimatePresence>
        {showEvidence && (
          <EvidenceUploadModal
            matchId={p.match.id}
            onClose={() => setShowEvidence(false)}
            onUploaded={() => { setShowEvidence(false); p.onUpdated(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminMatches(): React.ReactElement {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'all'>('all');
  const [selected, setSelected] = useState<Match | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, tRes] = await Promise.all([
      supabase.from('matches')
        .select('*, tournaments(name, games(name, icon))')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('tournaments').select('id, name').order('name'),
    ]);
    if (!mRes.error) setMatches((mRes.data as Match[]) ?? []);
    if (!tRes.error) setTournaments((tRes.data as Tournament[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = matches.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || (m.tournaments?.name ?? '').toLowerCase().includes(q) || m.id.includes(q);
  });

  const counts = Object.fromEntries(
    (['scheduled','in_progress','awaiting_proof','disputed','verified','settled','canceled'] as MatchStatus[])
      .map(s => [s, matches.filter(m => m.status === s).length])
  );

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Matches</h1>
          <p className="text-white/35 text-sm">
            {counts['in_progress'] ?? 0} live · {counts['awaiting_proof'] ?? 0} awaiting proof · {counts['disputed'] ?? 0} disputed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-40" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}
            className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />New Match
          </Button>
        </div>
      </motion.div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['all', 'scheduled', 'in_progress', 'awaiting_proof', 'disputed', 'verified', 'settled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ' +
              (statusFilter === s
                ? (s === 'all' ? 'bg-white/15 border-white/20 text-white' : STATUS_META[s as MatchStatus].bg + ' ' + STATUS_META[s as MatchStatus].color)
                : 'border-white/8 text-white/35 hover:border-white/15 hover:text-white/60')}>
            {s === 'all' ? `All (${matches.length})` : `${STATUS_META[s as MatchStatus].label} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Matches list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Layers className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm mb-4">{search ? 'No matches found.' : 'No matches yet. Schedule the first one.'}</p>
          {!search && (
            <Button size="sm" onClick={() => setShowNew(true)}
              className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold gap-2">
              <Plus className="w-3.5 h-3.5" />Schedule Match
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const meta = STATUS_META[m.status];
            const StatusIcon = meta.icon;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(m)}
                className="p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all cursor-pointer group flex items-center gap-4">
                <div className={'w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ' + meta.bg}>
                  <StatusIcon className={'w-4 h-4 ' + meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{m.tournaments?.name ?? '—'}</span>
                    <span className="text-[10px] text-white/30">Round {m.round}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/35">
                    <span className={'font-medium ' + meta.color}>{meta.label}</span>
                    {m.tournaments?.games?.icon && <span>{m.tournaments.games.icon} {m.tournaments.games.name}</span>}
                    {m.proof_due_at && <span className="text-yellow-400/70">Due {new Date(m.proof_due_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Drawers + Modals */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelected(null)} />
            <MatchDrawer key="drawer" match={selected} onClose={() => setSelected(null)}
              onUpdated={() => { load(); setSelected(null); }} />
          </>
        )}
        {showNew && (
          <NewMatchModal key="new" tournaments={tournaments} onClose={() => setShowNew(false)} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Evidence Upload Modal (appended) ──────────────────────────────────────
// Imported and used externally — also accessible from the MatchDrawer
export function EvidenceUploadModal(p: {
  matchId: string;
  onClose: () => void;
  onUploaded: () => void;
}): React.ReactElement {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'screenshot'|'video'|'log'|'other'>('screenshot');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file || !user) { toast.error('Select a file first.'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `evidence/${p.matchId}/${user.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: false });
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setUploading(false); return; }

    // Compute a simple client-side "hash" (pseudo — real SHA256 done server-side by a worker)
    // We store the file size as a placeholder; real implementation uses a BFF worker
    const sha256_placeholder = `client-${file.size}-${file.lastModified}`;

    const { error: dbErr } = await supabase.from('evidence_objects').insert({
      match_id   : p.matchId,
      user_id    : user.id,
      kind,
      object_key : path,
      sha256     : sha256_placeholder,
    } as never);

    if (dbErr) {
      toast.error('DB record failed: ' + dbErr.message);
    } else {
      await import('@/lib/auditLog').then(({ writeAuditLog }) =>
        writeAuditLog({ actor_id: user.id, action: 'evidence.upload', entity_type: 'match', entity_id: p.matchId, data: { kind, path } })
      );
      toast.success('Evidence uploaded ✓');
      p.onUploaded();
      p.onClose();
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.16 }}
        className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />Submit Evidence
          </h2>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Evidence Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['screenshot','video','log','other'] as const).map(k => (
                <button key={k} onClick={() => setKind(k)}
                  className={'px-3 py-2 rounded-xl border text-xs font-semibold transition-all capitalize ' +
                    (kind === k ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'border-white/10 text-white/35 hover:border-white/20')}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">File</label>
            <input ref={fileRef} type="file"
              accept={kind === 'screenshot' ? 'image/*' : kind === 'video' ? 'video/*' : '*'}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-white/15 hover:border-white/30 text-white/40 hover:text-white/70 transition-all">
              <FileText className="w-6 h-6" />
              {file ? (
                <span className="text-xs text-white/70 font-medium">{file.name}</span>
              ) : (
                <span className="text-xs">Click to choose file</span>
              )}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
            <p className="text-[10px] text-blue-400/70">
              ⚠ SHA-256 hashing is computed server-side after upload. The evidence record will be updated automatically once the worker processes the file.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={upload} disabled={uploading || !file}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold gap-2">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Submit Evidence
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
