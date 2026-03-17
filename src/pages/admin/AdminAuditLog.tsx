import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, RefreshCw, Search, ChevronDown, ChevronUp,
  Shield, Users, Gamepad2, Trophy, MessageSquare, AlertTriangle,
  Layers, FileText, Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Types ──────────────────────────────────────────────────────────────────
type AuditRow = {
  id: number;
  ts: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  data: Record<string, unknown>;
  actor?: { username: string } | null;
};

// ── Action grouping ────────────────────────────────────────────────────────
const ACTION_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  'tournament.join'         : { icon: Trophy,        color: 'text-cyan-400'    },
  'tournament.leave'        : { icon: Trophy,        color: 'text-white/40'    },
  'tournament.create'       : { icon: Trophy,        color: 'text-green-400'   },
  'tournament.update'       : { icon: Trophy,        color: 'text-yellow-400'  },
  'tournament.delete'       : { icon: Trophy,        color: 'text-red-400'     },
  'tournament.status_change': { icon: Trophy,        color: 'text-purple-400'  },
  'match.start'             : { icon: Layers,        color: 'text-green-400'   },
  'match.status_change'     : { icon: Layers,        color: 'text-purple-400'  },
  'dispute.open'            : { icon: AlertTriangle, color: 'text-red-400'     },
  'dispute.resolve'         : { icon: AlertTriangle, color: 'text-green-400'   },
  'dispute.cancel'          : { icon: AlertTriangle, color: 'text-white/40'    },
  'evidence.upload'         : { icon: FileText,      color: 'text-blue-400'    },
  'user.ban'                : { icon: Users,         color: 'text-red-400'     },
  'user.unban'              : { icon: Users,         color: 'text-green-400'   },
  'user.role_change'        : { icon: Users,         color: 'text-yellow-400'  },
  'game.create'             : { icon: Gamepad2,      color: 'text-cyan-400'    },
  'game.update'             : { icon: Gamepad2,      color: 'text-yellow-400'  },
  'game.delete'             : { icon: Gamepad2,      color: 'text-red-400'     },
  'announcement.create'     : { icon: MessageSquare, color: 'text-purple-400'  },
  'post.delete'             : { icon: FileText,      color: 'text-red-400'     },
};

function getMeta(action: string) {
  return ACTION_ICON[action] ?? { icon: Activity, color: 'text-white/40' };
}

function fmtTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── Row ────────────────────────────────────────────────────────────────────
function AuditRow({ row, i }: { row: AuditRow; i: number }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color } = getMeta(row.action);
  const hasData = row.data && Object.keys(row.data).length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.02 }}
      className="border border-white/8 rounded-xl overflow-hidden">
      <div
        onClick={() => hasData && setExpanded(v => !v)}
        className={'flex items-center gap-3 px-4 py-3 transition-all ' +
          (hasData ? 'cursor-pointer hover:bg-white/4' : '') +
          (expanded ? ' bg-white/4' : '')}>
        <div className={'w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0'}>
          <Icon className={'w-3.5 h-3.5 ' + color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-white/70 font-semibold">{row.action}</span>
            {row.entity_type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/6 text-white/35 font-mono">{row.entity_type}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/25">
            <span>{row.actor?.username ?? (row.actor_id ? 'user:' + row.actor_id.slice(0, 8) : 'system')}</span>
            <span>{fmtTs(row.ts)}</span>
            {row.entity_id && <span className="font-mono truncate max-w-[120px]">{row.entity_id.slice(0, 8)}…</span>}
          </div>
        </div>
        {hasData && (
          <div className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        )}
      </div>
      {expanded && hasData && (
        <div className="px-4 pb-3 border-t border-white/6">
          <pre className="text-[10px] text-white/40 font-mono mt-3 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto bg-black/20 rounded-lg p-3">
            {JSON.stringify(row.data, null, 2)}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

// ── Filter pills ────────────────────────────────────────────────────────────
const ENTITY_FILTERS = ['all', 'tournament', 'match', 'dispute', 'evidence', 'user', 'game'] as const;
type EntityFilter = typeof ENTITY_FILTERS[number];

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminAuditLog(): React.ReactElement {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const load = useCallback(async (p = 0) => {
    setLoading(true); setError('');
    let query = supabase
      .from('audit_log')
      .select('*, actor:profiles!actor_id(username)', { count: 'exact' })
      .order('ts', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1);

    if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
    if (search.trim()) query = query.ilike('action', `%${search.trim()}%`);

    const { data, error: err } = await query;
    if (err) {
      // Graceful fallback if table doesn't exist yet
      if (err.message.includes('does not exist') || err.code === '42P01') {
        setError('audit_log table not found — run supabase_trust_migration.sql first.');
      } else {
        setError(err.message);
      }
    } else {
      setRows((data as AuditRow[]) ?? []);
    }
    setLoading(false);
  }, [entityFilter, search]);

  useEffect(() => { setPage(0); load(0); }, [load]);

  const exportCSV = () => {
    const headers = ['id','ts','actor','action','entity_type','entity_id','data'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.id,
        r.ts,
        r.actor?.username ?? r.actor_id ?? '',
        r.action,
        r.entity_type,
        r.entity_id ?? '',
        JSON.stringify(r.data).replace(/,/g, ';'),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pulseplay-audit-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Audit Log</h1>
          <p className="text-white/35 text-sm">Immutable record of all sensitive platform actions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by action…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-44" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => load(page)} disabled={loading}
            className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV} disabled={rows.length === 0}
            className="text-white/40 hover:text-cyan-400 h-9 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
        </div>
      </motion.div>

      {/* Entity filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {ENTITY_FILTERS.map(f => (
          <button key={f} onClick={() => setEntityFilter(f)}
            className={'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border capitalize ' +
              (entityFilter === f
                ? 'bg-white/15 border-white/25 text-white'
                : 'border-white/8 text-white/35 hover:border-white/15 hover:text-white/60')}>
            {f}
          </button>
        ))}
      </div>

      {/* Graceful degradation banner */}
      {error && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm mb-5 flex items-start gap-3">
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold mb-1">Audit log unavailable</p>
            <p className="text-yellow-400/70 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Rows */}
      {loading && !error ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : !error && rows.length === 0 ? (
        <div className="text-center py-20">
          <Activity className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm">No audit entries yet.</p>
          <p className="text-white/20 text-xs mt-1">Entries appear as admins and users take actions on the platform.</p>
        </div>
      ) : !error ? (
        <>
          <div className="space-y-1.5">
            {rows.map((r, i) => <AuditRow key={r.id} row={r} i={i} />)}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/8">
            <p className="text-xs text-white/25">{rows.length} entries on this page</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setPage(p => p - 1); load(page - 1); }}
                disabled={page === 0 || loading} className="text-white/40 hover:text-white text-xs h-8">
                ← Prev
              </Button>
              <span className="text-xs text-white/30 px-2">Page {page + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => { setPage(p => p + 1); load(page + 1); }}
                disabled={rows.length < PAGE || loading} className="text-white/40 hover:text-white text-xs h-8">
                Next →
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
