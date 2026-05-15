import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Search,
  ChevronRight, X, MessageSquare, Shield, Loader2, Info, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { writeAuditLog, writeOutboxEvent } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
type DisputeState = 'open' | 'needs_more_info' | 'resolved' | 'canceled';

type Dispute = {
  id: string;
  match_id: string;
  reason: string;
  state: DisputeState;
  due_by: string | null;
  resolution: string | null;
  notes: string | null;
  resolved_at: string | null;
  created_at?: string;
  opened_by_profile?: { username: string; avatar_url: string | null } | null;
  resolved_by_profile?: { username: string } | null;
  match?: { round: number; tournaments: { name: string; games: { name: string; icon: string } | null } | null } | null;
};

type Evidence = {
  id: string;
  kind: string;
  object_key: string;
  sha256: string;
  phash: string | null;
  created_at: string;
  user?: { username: string } | null;
};

// ── Status meta ────────────────────────────────────────────────────────────
const STATE_META: Record<DisputeState, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open            : { label: 'Open',             icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/12 border-red-500/25'    },
  needs_more_info : { label: 'Needs More Info',  icon: Info,          color: 'text-yellow-400', bg: 'bg-yellow-500/12 border-yellow-500/25' },
  resolved        : { label: 'Resolved',         icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/12 border-green-500/25' },
  canceled        : { label: 'Canceled',         icon: XCircle,       color: 'text-white/30',   bg: 'bg-white/5 border-white/10'         },
};

// ── SLA helper ─────────────────────────────────────────────────────────────
function slaColor(due: string | null): string {
  if (!due) return 'text-white/30';
  const hrs = (new Date(due).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0)  return 'text-red-500';
  if (hrs < 4)  return 'text-red-400';
  if (hrs < 24) return 'text-yellow-400';
  return 'text-white/40';
}

// ── Resolve / update modal ─────────────────────────────────────────────────
function ResolveModal(p: {
  dispute: Dispute;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const { user } = useAuth();
  const [newState, setNewState] = useState<DisputeState>(p.dispute.state);
  const [resolution, setResolution] = useState(p.dispute.resolution ?? '');
  const [notes, setNotes] = useState(p.dispute.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const updates: Record<string, unknown> = { state: newState, notes };
    if (newState === 'resolved') {
      if (!resolution.trim()) { toast.error('Resolution text is required to resolve.'); setSaving(false); return; }
      updates.resolution = resolution.trim();
      updates.resolved_by = user?.id;
      updates.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('disputes').update(updates as never).eq('id', p.dispute.id);
    if (error) {
      toast.error(error.message);
    } else {
      await writeAuditLog({
        actor_id: user?.id, action: 'dispute.resolve', entity_type: 'dispute', entity_id: p.dispute.id,
        data: { from: p.dispute.state, to: newState, resolution },
      });
      await writeOutboxEvent('dispute.updated', p.dispute.id, { state: newState, match_id: p.dispute.match_id });
      toast.success(`Dispute ${newState}.`);
      p.onSaved();
      p.onClose();
    }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.16 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />Adjudicate Dispute
          </h2>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Match info */}
          <div className="p-3 rounded-xl bg-white/4 border border-white/8 text-sm">
            <p className="text-white/60 mb-1">
              {p.dispute.match?.tournaments?.games?.icon} {p.dispute.match?.tournaments?.name ?? '—'} — Round {p.dispute.match?.round}
            </p>
            <p className="text-white/35 text-xs">{p.dispute.reason}</p>
          </div>

          {/* New state */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Decision</label>
            <div className="grid grid-cols-2 gap-2">
              {(['needs_more_info','resolved','canceled','open'] as DisputeState[]).map(s => (
                <button key={s} onClick={() => setNewState(s)}
                  className={'px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ' +
                    (newState === s ? STATE_META[s].bg + ' ' + STATE_META[s].color : 'border-white/10 text-white/35 hover:border-white/20')}>
                  {STATE_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution (required when resolving) */}
          {newState === 'resolved' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Resolution *</label>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)}
                rows={3} placeholder="Explain the resolution…"
                className={inputCls + ' w-full rounded-lg border px-3 py-2 resize-none'} />
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Internal Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Optional admin notes (not shown to users)"
              className={inputCls + ' w-full rounded-lg border px-3 py-2 resize-none'} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            Save Decision
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Dispute detail drawer ──────────────────────────────────────────────────
function DisputeDrawer(p: {
  dispute: Dispute;
  onClose: () => void;
  onAdjudicate: () => void;
  onUpdated: () => void;
}): React.ReactElement {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingEv, setLoadingEv] = useState(true);
  const meta = STATE_META[p.dispute.state];
  const Icon = meta.icon;

  useEffect(() => {
    setLoadingEv(true); // eslint-disable-line react-hooks/set-state-in-effect
    supabase.from('evidence_objects')
      .select('*, user:profiles!user_id(username)')
      .eq('match_id', p.dispute.match_id)
      .order('created_at')
      .then(({ data }) => {
        setEvidence((data as Evidence[]) ?? []);
        setLoadingEv(false);
      });
  }, [p.dispute.match_id]);

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] max-w-full bg-[#0a0a16]/98 border-l border-white/10 backdrop-blur-2xl flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + meta.bg}>
            <Icon className={'w-4 h-4 ' + meta.color} />
          </div>
          <div>
            <p className={'font-orbitron font-bold text-sm ' + meta.color}>{meta.label}</p>
            <p className="text-[10px] text-white/35">{p.dispute.match?.tournaments?.name ?? '—'}</p>
          </div>
        </div>
        <button onClick={p.onClose} className="w-8 h-8 rounded-xl hover:bg-white/8 flex items-center justify-center text-white/35 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Reason */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-mono mb-2">Dispute Reason</p>
          <div className="p-3.5 rounded-xl bg-white/4 border border-white/8">
            <p className="text-sm text-white/80">{p.dispute.reason}</p>
          </div>
        </div>

        {/* Opened by */}
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            {(p.dispute.opened_by_profile?.username ?? 'U')[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold">{p.dispute.opened_by_profile?.username ?? 'Unknown'}</p>
            <p className="text-white/30 text-[10px]">Opened dispute</p>
          </div>
          {p.dispute.due_by && (
            <div className="ml-auto text-right">
              <p className={'text-xs font-mono ' + slaColor(p.dispute.due_by)}>
                SLA: {new Date(p.dispute.due_by).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Resolution */}
        {p.dispute.resolution && (
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-wider font-mono mb-2">Resolution</p>
            <div className="p-3.5 rounded-xl bg-green-500/8 border border-green-500/20">
              <p className="text-sm text-green-300/80">{p.dispute.resolution}</p>
              {p.dispute.resolved_by_profile && (
                <p className="text-[10px] text-white/30 mt-2">
                  by {p.dispute.resolved_by_profile.username} · {p.dispute.resolved_at ? new Date(p.dispute.resolved_at).toLocaleString() : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {p.dispute.notes && (
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-wider font-mono mb-2">Admin Notes</p>
            <div className="p-3 rounded-xl bg-white/4 border border-white/8">
              <p className="text-xs text-white/50">{p.dispute.notes}</p>
            </div>
          </div>
        )}

        {/* Evidence */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-mono mb-2">
            Evidence ({evidence.length})
          </p>
          {loadingEv ? (
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ) : evidence.length === 0 ? (
            <div className="p-4 rounded-xl border border-white/8 text-center">
              <FileText className="w-6 h-6 mx-auto text-white/15 mb-2" />
              <p className="text-xs text-white/30">No evidence submitted yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {evidence.map(ev => (
                <div key={ev.id} className="p-3 rounded-xl bg-white/4 border border-white/8">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white/70 capitalize">{ev.kind}</span>
                    <span className="text-[10px] text-white/30">{ev.user?.username ?? '—'}</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/30 truncate">SHA256: {ev.sha256}</p>
                  {ev.phash && <p className="text-[10px] font-mono text-white/25 truncate">pHash: {ev.phash}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Adjudicate action */}
      {(p.dispute.state === 'open' || p.dispute.state === 'needs_more_info') && (
        <div className="flex-shrink-0 border-t border-white/8 p-4">
          <Button size="sm" onClick={p.onAdjudicate}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold gap-2 h-10">
            <Shield className="w-3.5 h-3.5" />Adjudicate Dispute
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminDisputes(): React.ReactElement {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<DisputeState | 'all'>('all');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolving, setResolving] = useState<Dispute | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        opened_by_profile:profiles!opened_by(username, avatar_url),
        resolved_by_profile:profiles!resolved_by(username),
        match:matches!match_id(round, tournaments(name, games(name, icon)))
      `)
      .order('due_by', { ascending: true, nullsFirst: false });
    if (error) { console.error(error.message); }
    else setDisputes((data as Dispute[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = disputes.filter(d => {
    if (stateFilter !== 'all' && d.state !== stateFilter) return false;
    const q = search.toLowerCase();
    return !q
      || (d.match?.tournaments?.name ?? '').toLowerCase().includes(q)
      || d.reason.toLowerCase().includes(q)
      || (d.opened_by_profile?.username ?? '').toLowerCase().includes(q);
  });

  const counts: Record<string, number> = { all: disputes.length };
  (['open','needs_more_info','resolved','canceled'] as DisputeState[]).forEach(s => {
    counts[s] = disputes.filter(d => d.state === s).length;
  });

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Disputes</h1>
          <p className="text-white/35 text-sm">
            {counts['open'] ?? 0} open · {counts['needs_more_info'] ?? 0} pending info · {counts['resolved'] ?? 0} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-44" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
        </div>
      </motion.div>

      {/* State filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['all','open','needs_more_info','resolved','canceled'] as const).map(s => (
          <button key={s} onClick={() => setStateFilter(s)}
            className={'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ' +
              (stateFilter === s
                ? (s === 'all' ? 'bg-white/15 border-white/20 text-white' : STATE_META[s as DisputeState].bg + ' ' + STATE_META[s as DisputeState].color)
                : 'border-white/8 text-white/35 hover:border-white/15 hover:text-white/60')}>
            {s === 'all' ? `All (${counts.all})` : `${STATE_META[s as DisputeState].label} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm">{search ? 'No disputes match your search.' : 'No disputes yet — great sign!'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d, i) => {
            const meta = STATE_META[d.state];
            const Icon = meta.icon;
            // eslint-disable-next-line react-hooks/purity
            const isUrgent = d.state === "open" && d.due_by && (new Date(d.due_by).getTime() - Date.now()) < 4 * 3_600_000;
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(d)}
                className={'p-4 rounded-xl border transition-all cursor-pointer group flex items-start gap-4 ' +
                  (isUrgent ? 'bg-red-500/6 border-red-500/20 hover:border-red-500/35' : 'bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5')}>
                <div className={'w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ' + meta.bg}>
                  <Icon className={'w-4 h-4 ' + meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-white truncate">
                      {d.match?.tournaments?.games?.icon} {d.match?.tournaments?.name ?? '—'}
                      <span className="text-white/35 ml-1.5 font-normal text-xs">Round {d.match?.round}</span>
                    </span>
                    {isUrgent && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">URGENT</span>}
                  </div>
                  <p className="text-xs text-white/45 truncate mb-1">{d.reason}</p>
                  <div className="flex items-center gap-3 text-[11px] text-white/30">
                    <span className={'font-medium ' + meta.color}>{meta.label}</span>
                    <span>by {d.opened_by_profile?.username ?? '—'}</span>
                    {d.due_by && <span className={slaColor(d.due_by)}>Due {new Date(d.due_by).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(d.state === 'open' || d.state === 'needs_more_info') && (
                    <button onClick={e => { e.stopPropagation(); setResolving(d); }}
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-400 text-[10px] font-bold transition-all border border-red-500/25">
                      Adjudicate
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Drawers + Modals */}
      <AnimatePresence>
        {selected && !resolving && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelected(null)} />
            <DisputeDrawer
              key="drawer"
              dispute={selected}
              onClose={() => setSelected(null)}
              onAdjudicate={() => setResolving(selected)}
              onUpdated={() => { load(); setSelected(null); }}
            />
          </>
        )}
        {resolving && (
          <ResolveModal key="resolve" dispute={resolving} onClose={() => setResolving(null)}
            onSaved={() => { load(); setSelected(null); setResolving(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
