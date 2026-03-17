import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, Shield, RefreshCw, Search, CheckCircle, X, Eye,
  Trash2, AlertTriangle, MessageSquare, Video, User, Loader2,
  ChevronDown, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
type Report = {
  id: string;
  content_type: 'post' | 'clip' | 'comment' | 'profile';
  content_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  created_at: string;
  reporter: { username: string } | null;
  reviewed_at: string | null;
  action_taken: string | null;
};

type ModLog = {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  moderator: { username: string } | null;
};

const REASON_LABELS: Record<string, string> = {
  spam: '🚫 Spam', hate_speech: '🤬 Hate speech', harassment: '👊 Harassment',
  misinformation: '❌ Misinformation', adult_content: '🔞 Adult content',
  violence: '⚠️ Violence', cheating: '🎭 Cheating', other: '📝 Other',
};

const STATUS_STYLE: Record<string, string> = {
  pending   : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  reviewed  : 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  actioned  : 'bg-green-500/15 text-green-400 border-green-500/25',
  dismissed : 'bg-white/8 text-white/35 border-white/15',
};

const CONTENT_ICON: Record<string, React.ElementType> = {
  post: FileText, clip: Video, comment: MessageSquare, profile: User,
};

// ── Action modal ───────────────────────────────────────────────────────────
function ActionModal(p: { report: Report; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [action, setAction] = useState<'actioned' | 'dismissed'>('actioned');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const ACTIONS_FOR_TYPE: Record<string, { value: string; label: string; color: string }[]> = {
    post:    [{ value: 'delete_post',   label: 'Delete post',    color: 'text-red-400'   }, { value: 'warn_user', label: 'Warn user', color: 'text-yellow-400' }],
    clip:    [{ value: 'delete_clip',   label: 'Remove clip',    color: 'text-red-400'   }, { value: 'warn_user', label: 'Warn user', color: 'text-yellow-400' }],
    comment: [{ value: 'delete_comment',label: 'Remove comment', color: 'text-red-400'   }, { value: 'warn_user', label: 'Warn user', color: 'text-yellow-400' }],
    profile: [{ value: 'ban_user',      label: 'Ban user',       color: 'text-red-400'   }, { value: 'warn_user', label: 'Warn user', color: 'text-yellow-400' }, { value: 'mute_user', label: 'Mute user', color: 'text-orange-400' }],
  };

  const [modAction, setModAction] = useState(ACTIONS_FOR_TYPE[p.report.content_type]?.[0]?.value ?? 'warn_user');

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    // Update report
    await supabase.from('content_reports').update({
      status: action, reviewed_by: user.id, reviewed_at: new Date().toISOString(), action_taken: modAction,
    } as never).eq('id', p.report.id);
    // Log moderation action
    await supabase.from('moderation_logs').insert({
      moderator_id: user.id, action: modAction, target_type: p.report.content_type,
      target_id: p.report.content_id, reason: note.trim() || p.report.reason,
    } as never);
    toast.success(`Report ${action}. Action: ${modAction}`);
    p.onDone(); p.onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.16 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />Review Report
          </h2>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <div className="flex items-center gap-2 mb-1">
              <span className={'text-[10px] px-2 py-0.5 rounded-full border font-bold ' + STATUS_STYLE[p.report.status]}>{p.report.status}</span>
              <span className="text-xs text-white/40">{p.report.content_type} · {REASON_LABELS[p.report.reason] ?? p.report.reason}</span>
            </div>
            <p className="text-xs text-white/60">Reported by @{p.report.reporter?.username ?? '—'}</p>
            {p.report.description && <p className="text-xs text-white/40 mt-1">{p.report.description}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Moderation Action</label>
            <div className="space-y-1.5">
              {(ACTIONS_FOR_TYPE[p.report.content_type] ?? []).map(a => (
                <button key={a.value} onClick={() => setModAction(a.value)}
                  className={'w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ' +
                    (modAction === a.value ? 'bg-white/8 border-white/20 ' + a.color : 'border-white/8 text-white/45 hover:border-white/18')}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setAction('actioned')}
              className={'py-2.5 rounded-xl border text-xs font-semibold transition-all ' + (action === 'actioned' ? 'bg-green-500/20 border-green-500/35 text-green-400' : 'border-white/10 text-white/40 hover:border-white/20')}>
              ✓ Take Action
            </button>
            <button onClick={() => setAction('dismissed')}
              className={'py-2.5 rounded-xl border text-xs font-semibold transition-all ' + (action === 'dismissed' ? 'bg-white/12 border-white/20 text-white' : 'border-white/10 text-white/40 hover:border-white/20')}>
              ✗ Dismiss
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Internal moderator note…"
              className="bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25 w-full" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}
            className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}Submit Decision
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminModeration(): React.ReactElement {
  const [reports, setReports] = useState<Report[]>([]);
  const [modLogs, setModLogs] = useState<ModLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'actioned' | 'dismissed' | 'all'>('pending');
  const [tab, setTab] = useState<'reports' | 'logs'>('reports');
  const [reviewing, setReviewing] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, lRes] = await Promise.all([
      supabase.from('content_reports')
        .select('*, reporter:profiles!reporter_id(username)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('moderation_logs')
        .select('*, moderator:profiles!moderator_id(username)')
        .order('created_at', { ascending: false }).limit(50),
    ]);
    if (!rRes.error) setReports((rRes.data as Report[]) ?? []);
    if (!lRes.error) setModLogs((lRes.data as ModLog[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || r.reason.includes(q) || (r.reporter?.username ?? '').toLowerCase().includes(q);
  });

  const counts = { pending: reports.filter(r => r.status === 'pending').length, all: reports.length };

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />Moderation
          </h1>
          <p className="text-white/35 text-sm">{counts.pending} pending reports · {modLogs.length} actions taken</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-44" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
        </div>
      </motion.div>

      {/* Tab + filter */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
          {(['reports','logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ' + (tab === t ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white/70')}>
              {t === 'reports' ? `Reports (${counts.pending} pending)` : 'Mod Logs'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'reports' && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {(['all','pending','reviewed','actioned','dismissed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={'px-3 py-1.5 rounded-full text-[11px] font-semibold border capitalize transition-all ' +
                  (statusFilter === s ? 'bg-white/15 border-white/25 text-white' : 'border-white/8 text-white/35 hover:border-white/15')}>
                {s === 'all' ? `All (${reports.length})` : `${s} (${reports.filter(r => r.status === s).length})`}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20"><Flag className="w-12 h-12 mx-auto text-white/15 mb-4" /><p className="text-white/35 text-sm">No reports found.</p></div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r, i) => {
                const Icon = CONTENT_ICON[r.content_type] ?? FileText;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={'flex items-center gap-4 p-4 rounded-xl border transition-all ' +
                      (r.status === 'pending' ? 'bg-red-500/5 border-red-500/15 hover:border-red-500/25' : 'bg-white/3 border-white/8 hover:border-white/15')}>
                    <div className={'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' + (r.status === 'pending' ? 'bg-red-500/15' : 'bg-white/6')}>
                      <Icon className={'w-4 h-4 ' + (r.status === 'pending' ? 'text-red-400' : 'text-white/35')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-white capitalize">{r.content_type} Report</span>
                        <span className={'text-[10px] px-1.5 py-0.5 rounded-full border font-bold ' + STATUS_STYLE[r.status]}>{r.status}</span>
                        {r.status === 'pending' && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">ACTION NEEDED</span>}
                      </div>
                      <p className="text-xs text-white/40">{REASON_LABELS[r.reason] ?? r.reason} · by @{r.reporter?.username ?? '—'}</p>
                      {r.description && <p className="text-[10px] text-white/30 mt-0.5 truncate">{r.description}</p>}
                    </div>
                    {r.status === 'pending' && (
                      <button onClick={() => setReviewing(r)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 text-red-400 text-xs font-bold border border-red-500/25 transition-all">
                        Review
                      </button>
                    )}
                    {r.action_taken && <span className="text-[10px] text-white/30 flex-shrink-0">{r.action_taken}</span>}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'logs' && (
        <div className="space-y-2">
          {modLogs.length === 0 ? (
            <div className="text-center py-16"><FileText className="w-10 h-10 mx-auto text-white/15 mb-3" /><p className="text-white/35 text-sm">No moderation actions yet.</p></div>
          ) : modLogs.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-white/3 border border-white/8">
              <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/70 font-semibold">{l.action}</span>
                  <span className="text-[10px] text-white/30">on {l.target_type}</span>
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">by @{l.moderator?.username ?? '—'} · {l.reason}</p>
              </div>
              <span className="text-[10px] text-white/25 flex-shrink-0">{new Date(l.created_at).toLocaleDateString()}</span>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {reviewing && (
          <ActionModal key="action" report={reviewing} onClose={() => setReviewing(null)} onDone={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
