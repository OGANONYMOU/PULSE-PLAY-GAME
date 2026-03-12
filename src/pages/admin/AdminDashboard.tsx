import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Shield, UserCheck, Ban, TrendingUp, Activity, RefreshCw,
  ArrowUpRight, Gamepad2, Trophy, Clock, Zap, Star,
  CheckCircle, Target, FileText, Megaphone,
  ChevronRight, Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProfileRow { role: string; is_banned: boolean; created_at: string; username: string }
interface Stats { total: number; admins: number; moderators: number; banned: number; newThisWeek: number }
interface ChartPoint { date: string; users: number }
interface ActivityItem { id: string; username: string; action: string; created_at: string }
interface PlatformCounts { games: number; tournaments: number; posts: number; announcements: number }

// ── Level system ──────────────────────────────────────────────────────────────
interface AdminLevel { name: string; emoji: string; min: number; max: number; color: string; barFrom: string; barTo: string }
const LEVELS: AdminLevel[] = [
  { name: 'Recruit',     emoji: '🥉', min: 0,    max: 499,  color: 'text-orange-400', barFrom: '#f97316', barTo: '#fbbf24' },
  { name: 'Sergeant',    emoji: '🥈', min: 500,  max: 1499, color: 'text-slate-300',  barFrom: '#94a3b8', barTo: '#e2e8f0' },
  { name: 'Lieutenant',  emoji: '🥇', min: 1500, max: 3499, color: 'text-yellow-400', barFrom: '#eab308', barTo: '#fde047' },
  { name: 'Commander',   emoji: '💎', min: 3500, max: 6999, color: 'text-cyan-400',   barFrom: '#06b6d4', barTo: '#818cf8' },
  { name: 'Grand Master',emoji: '👑', min: 7000, max: Infinity, color: 'text-pink-400', barFrom: '#ec4899', barTo: '#a855f7' },
];
function getLevel(xp: number): AdminLevel { return LEVELS.find(l => xp >= l.min && xp <= l.max) ?? LEVELS[0]; }
function getLevelPct(xp: number, lvl: AdminLevel): number {
  if (lvl.max === Infinity) return 100;
  return Math.min(100, Math.round(((xp - lvl.min) / (lvl.max - lvl.min)) * 100));
}

// ── Badge system ──────────────────────────────────────────────────────────────
interface BadgeDef { id: string; label: string; emoji: string; desc: string; threshold: number; metric: keyof PlatformCounts }
const BADGE_DEFS: BadgeDef[] = [
  { id: 'first-cmd',   label: 'First Command', emoji: '🎖️', desc: 'At least 1 user managed',      threshold: 1,  metric: 'games' },
  { id: 'post-patrol', label: 'Post Patrol',   emoji: '📋', desc: '10+ posts moderated',           threshold: 10, metric: 'posts' },
  { id: 'host',        label: 'Event Host',    emoji: '🏆', desc: '5+ tournaments created',        threshold: 5,  metric: 'tournaments' },
  { id: 'broadcaster', label: 'Broadcaster',   emoji: '📣', desc: '10+ announcements published',   threshold: 10, metric: 'announcements' },
  { id: 'game-warden', label: 'Game Warden',   emoji: '🎮', desc: '5+ games added to platform',   threshold: 5,  metric: 'games' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChartTip(p: { active?: boolean; payload?: Array<{ value: number }>; label?: string }): React.ReactElement {
  return p.active && p.payload?.length ? (
    <div className="bg-[#0d0d1a]/95 border border-white/10 rounded-xl px-4 py-3 text-sm shadow-2xl">
      <p className="text-white/45 text-xs mb-1">{p.label}</p>
      <p className="font-orbitron font-bold text-cyan-400">{p.payload[0].value} players</p>
    </div>
  ) : <span />;
}

function KpiCard(p: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; delta?: number;
  color: string; glow: string; border: string; delay: number;
  href?: string;
}): React.ReactElement {
  const up = (p.delta ?? 0) >= 0;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.delay, duration: 0.25 }}
      className={'relative p-5 rounded-2xl border overflow-hidden cursor-pointer group ' + p.border +
        ' hover:scale-[1.02] transition-transform duration-200'}
    >
      <div className={'absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-15 ' + p.glow} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={'w-10 h-10 rounded-xl flex items-center justify-center border ' + p.border}>
            <p.Icon className={'w-5 h-5 ' + p.color} />
          </div>
          {p.delta !== undefined ? (
            <span className={'flex items-center gap-0.5 text-xs font-bold ' + (up ? 'text-emerald-400' : 'text-red-400')}>
              <ArrowUpRight className={'w-3 h-3 ' + (up ? '' : 'rotate-90')} />
              {Math.abs(p.delta)}
            </span>
          ) : null}
        </div>
        <div className="font-orbitron text-3xl font-black text-white mb-0.5 tabular-nums">
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </div>
        <div className="text-xs text-white/40 font-medium">{p.label}</div>
      </div>
      {p.href ? <ChevronRight className="absolute bottom-4 right-4 w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors" /> : null}
    </motion.div>
  );
  return p.href ? <Link to={p.href}>{inner}</Link> : inner;
}

function ActivityRow(p: { item: ActivityItem; i: number }): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: p.i * 0.035 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 group"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {p.item.username[0]?.toUpperCase() ?? 'U'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          <span className="font-bold">{p.item.username}</span>
          <span className="text-white/40"> {p.item.action}</span>
        </p>
      </div>
      <span className="text-[11px] text-white/25 flex-shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {format(new Date(p.item.created_at), 'HH:mm')}
      </span>
    </motion.div>
  );
}

// ── Hero loyalty bar ──────────────────────────────────────────────────────────
function LoyaltyHero(p: { xp: number; counts: PlatformCounts | null }): React.ReactElement {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const lvl = getLevel(p.xp);
  const pct = getLevelPct(p.xp, lvl);
  const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];
  const earnedBadges = p.counts ? BADGE_DEFS.filter(b => (p.counts![b.metric] as number) >= b.threshold) : [];

  const breakdown = [
    { label: 'Users managed',    pts: (p.counts?.games ?? 0) * 15,         color: '#06b6d4', icon: '👥' },
    { label: 'Posts moderated',  pts: (p.counts?.posts ?? 0) * 5,          color: '#a855f7', icon: '📋' },
    { label: 'Tournaments',      pts: (p.counts?.tournaments ?? 0) * 25,   color: '#eab308', icon: '🏆' },
    { label: 'Announcements',    pts: (p.counts?.announcements ?? 0) * 20, color: '#ec4899', icon: '📣' },
    { label: 'Games added',      pts: (p.counts?.games ?? 0) * 15,         color: '#10b981', icon: '🎮' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative p-6 rounded-2xl border border-white/8 overflow-hidden mb-6"
      style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.05) 0%, rgba(168,85,247,0.05) 50%, rgba(236,72,153,0.04) 100%)' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-32 rounded-full blur-3xl opacity-20"
          style={{ background: `radial-gradient(circle, ${lvl.barFrom}44 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 right-0 w-48 h-24 rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${lvl.barTo}44 0%, transparent 70%)` }} />
      </div>

      <div className="relative">
        {/* Top row */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border border-white/10"
                style={{ background: `linear-gradient(135deg, ${lvl.barFrom}22, ${lvl.barTo}22)` }}>
                {lvl.emoji}
              </div>
              {pct >= 100 ? (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Star className="w-2.5 h-2.5 text-black" />
                </div>
              ) : null}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={'font-orbitron text-xl font-black ' + lvl.color}>{lvl.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border text-white/50 border-white/10 font-mono">
                  Lvl {LEVELS.indexOf(lvl) + 1}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="font-mono font-bold text-white">{p.xp.toLocaleString()}</span>
                <span>XP total</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">Earned Badges</p>
            <div className="flex items-center gap-2">
              {BADGE_DEFS.map(b => {
                const earned = earnedBadges.includes(b);
                return (
                  <div key={b.id} title={b.desc + (earned ? ' ✓' : ' (locked)')}
                    className={'text-xl transition-all ' + (earned ? 'opacity-100 scale-100' : 'opacity-20 grayscale scale-90')}>
                    {b.emoji}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Progress to {nextLvl ? nextLvl.name : 'Max Level'}</span>
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <Target className="w-3 h-3" />
              {showBreakdown ? 'Hide' : 'Show'} Breakdown
            </button>
          </div>
          <div className="h-4 rounded-full bg-white/6 overflow-hidden border border-white/8 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: pct + '%' }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full relative overflow-hidden"
              style={{ background: `linear-gradient(90deg, ${lvl.barFrom}, ${lvl.barTo})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmerHero_2.5s_ease-in-out_infinite]" />
            </motion.div>
            {/* Milestone markers */}
            {[25, 50, 75].map(m => (
              <div key={m} className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: m + '%' }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold font-mono text-white mix-blend-plus-lighter">{pct}%</span>
            </div>
          </div>
          {nextLvl ? (
            <div className="flex justify-between mt-1.5 text-[10px] text-white/25 font-mono">
              <span>{lvl.name} ({lvl.min.toLocaleString()} XP)</span>
              <span>{nextLvl.name} ({nextLvl.min.toLocaleString()} XP)</span>
            </div>
          ) : null}
        </div>

        {/* XP breakdown */}
        <AnimatePresence>
          {showBreakdown ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-3 border-t border-white/8">
                {breakdown.map(b => (
                  <div key={b.label} className="p-3 rounded-xl bg-white/4 border border-white/6 text-center">
                    <div className="text-lg mb-1">{b.icon}</div>
                    <div className="font-orbitron font-bold text-sm" style={{ color: b.color }}>{b.pts.toLocaleString()}</div>
                    <div className="text-[10px] text-white/35 mt-0.5 leading-tight">{b.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes shimmerHero { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
      `}</style>
    </motion.div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Add Game',        href: '/admin/games',         Icon: Gamepad2,     color: 'from-cyan-500/20 to-blue-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400' },
  { label: 'New Tournament',  href: '/admin/tournaments',   Icon: Trophy,       color: 'from-yellow-500/20 to-orange-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
  { label: 'Post Announcement', href: '/admin/announcements', Icon: Megaphone,  color: 'from-purple-500/20 to-pink-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  { label: 'Manage Users',    href: '/admin/users',         Icon: Users,        color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  { label: 'Review Posts',    href: '/admin/posts',         Icon: FileText,     color: 'from-pink-500/20 to-rose-500/10',   border: 'border-pink-500/20',   text: 'text-pink-400' },
  { label: 'View Analytics',  href: '/admin/analytics',     Icon: TrendingUp,   color: 'from-indigo-500/20 to-violet-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400' },
];

// ── Goal tracker ──────────────────────────────────────────────────────────────
function GoalBar(p: { label: string; current: number; target: number; color: string; icon: string }): React.ReactElement {
  const pct = Math.min(100, Math.round((p.current / p.target) * 100));
  const done = pct >= 100;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-lg flex-shrink-0">{p.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/60 font-medium">{p.label}</span>
          <span className={'text-xs font-mono font-bold ' + (done ? 'text-emerald-400' : 'text-white/50')}>
            {done ? <CheckCircle className="w-3.5 h-3.5 inline" /> : `${p.current}/${p.target}`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: pct + '%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: done ? 'linear-gradient(90deg, #10b981, #34d399)' : p.color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AdminDashboard(): React.ReactElement {
  const { profile } = useAuth();
  const [stats, setStats]     = useState<Stats>({ total: 0, admins: 0, moderators: 0, banned: 0, newThisWeek: 0 });
  const [chart, setChart]     = useState<ChartPoint[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [counts, setCounts]   = useState<PlatformCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const xp = counts
    ? (counts.games * 15 + counts.posts * 5 + counts.tournaments * 25 + counts.announcements * 20)
    : 0;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // Profiles stats — fetch all for display, but loyalty XP uses USER-only count
      const { data: profiles, error: pErr } = await supabase
        .from('profiles').select('role, is_banned, created_at, username').order('created_at', { ascending: false });
      if (pErr) throw pErr;
      const rows = (profiles ?? []) as ProfileRow[];
      // Loyalty: exclude ADMIN and MODERATOR accounts
      const userRows = rows.filter(r => r.role === 'USER');
      const weekAgo = subDays(new Date(), 7).toISOString();
      setStats({
        total: userRows.length,
        admins: rows.filter(r => r.role === 'ADMIN').length,
        moderators: rows.filter(r => r.role === 'MODERATOR').length,
        banned: userRows.filter(r => r.is_banned).length,
        newThisWeek: userRows.filter(r => r.created_at >= weekAgo).length,
      });

      // 7-day chart — user-role signups only
      setChart(Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        const iso = format(d, 'yyyy-MM-dd');
        return { date: format(d, 'MMM d'), users: userRows.filter(r => r.created_at.startsWith(iso)).length };
      }));

      // Activity feed — user-role only
      setActivity(userRows.slice(0, 8).map((r, i) => ({
        id: String(i), username: r.username, action: 'joined the platform', created_at: r.created_at,
      })));

      // Platform counts
      const [g, t, p, a] = await Promise.all([
        supabase.from('games').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
      ]);
      setCounts({ games: g.count ?? 0, tournaments: t.count ?? 0, posts: p.count ?? 0, announcements: a.count ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = [
    { Icon: Users,     label: 'Total Players', value: stats.total,      delta: stats.newThisWeek, color: 'text-cyan-400',   glow: 'bg-cyan-500',   border: 'border-cyan-500/15',   href: '/admin/users' },
    { Icon: Shield,    label: 'Admins',         value: stats.admins,     delta: undefined,         color: 'text-red-400',    glow: 'bg-red-500',    border: 'border-red-500/15',    href: '/admin/users' },
    { Icon: UserCheck, label: 'Moderators',     value: stats.moderators, delta: undefined,         color: 'text-yellow-400', glow: 'bg-yellow-500', border: 'border-yellow-500/15', href: '/admin/users' },
    { Icon: Ban,       label: 'Banned',         value: stats.banned,     delta: undefined,         color: 'text-rose-400',   glow: 'bg-rose-500',   border: 'border-rose-500/15',   href: '/admin/users' },
    { Icon: Gamepad2,  label: 'Games',          value: counts?.games ?? 0, delta: undefined,       color: 'text-purple-400', glow: 'bg-purple-500', border: 'border-purple-500/15', href: '/admin/games' },
    { Icon: Trophy,    label: 'Tournaments',    value: counts?.tournaments ?? 0, delta: undefined, color: 'text-amber-400',  glow: 'bg-amber-500',  border: 'border-amber-500/15',  href: '/admin/tournaments' },
    { Icon: FileText,  label: 'Posts',          value: counts?.posts ?? 0, delta: undefined,       color: 'text-pink-400',   glow: 'bg-pink-500',   border: 'border-pink-500/15',   href: '/admin/posts' },
    { Icon: Megaphone, label: 'Announcements',  value: counts?.announcements ?? 0, delta: undefined, color: 'text-emerald-400', glow: 'bg-emerald-500', border: 'border-emerald-500/15', href: '/admin/announcements' },
  ];

  const goals = [
    { label: 'Tournaments this month', current: counts?.tournaments ?? 0, target: 10, color: 'linear-gradient(90deg,#eab308,#f97316)', icon: '🏆' },
    { label: 'Posts moderated',        current: counts?.posts ?? 0,        target: 50, color: 'linear-gradient(90deg,#a855f7,#ec4899)', icon: '📋' },
    { label: 'Active players',         current: stats.total,               target: 100, color: 'linear-gradient(90deg,#06b6d4,#818cf8)', icon: '👥' },
    { label: 'Announcements published', current: counts?.announcements ?? 0, target: 20, color: 'linear-gradient(90deg,#ec4899,#f43f5e)', icon: '📣' },
  ];

  return (
    <div className="p-5 sm:p-7 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">
            Dashboard
            {profile?.username ? <span className="text-white/30 text-lg font-medium ml-2">· {profile.username}</span> : null}
          </h1>
          <p className="text-white/35 text-sm">Your platform command center</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}
          className="text-white/40 hover:text-white hover:bg-white/8 h-8 gap-2 text-xs">
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />Refresh
        </Button>
      </motion.div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline text-xs">retry</button>
        </div>
      ) : null}

      {/* ── Loyalty Hero Bar ── */}
      <LoyaltyHero xp={xp} counts={counts} />

      {/* ── KPI Grid (8 cards) ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 mb-6">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/4 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {kpis.map((k, i) => (
            <KpiCard key={k.label} Icon={k.Icon} label={k.label} value={k.value}
              delta={k.delta} color={k.color} glow={k.glow} border={k.border} delay={i * 0.04} href={k.href} />
          ))}
        </div>
      )}

      {/* ── Middle Row: chart + goals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* 7-day signups chart */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
          className="lg:col-span-2 p-5 rounded-2xl bg-white/4 border border-white/8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />Signups — Last 7 Days
              </h2>
              <p className="text-white/30 text-xs mt-0.5">
                <span className="text-emerald-400 font-bold">+{stats.newThisWeek}</span> new this week
              </p>
            </div>
            <Link to="/admin/analytics" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
              Full Analytics <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? <div className="h-44 rounded-xl bg-white/5 animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={chart} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.28)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.28)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(6,182,212,0.15)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={2} fill="url(#grad)"
                  dot={false} activeDot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Goals / KPI tracker */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="p-5 rounded-2xl bg-white/4 border border-white/8 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-purple-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Monthly Goals</h2>
          </div>
          <div className="flex-1">
            {loading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}</div>
            ) : (
              goals.map(g => <GoalBar key={g.label} {...g} />)
            )}
          </div>
          <div className="mt-4 p-3 rounded-xl border border-white/8" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(168,85,247,0.06))' }}>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-white/50 font-medium">Total XP Earned</span>
            </div>
            <div className="font-orbitron text-2xl font-black text-white">{xp.toLocaleString()}</div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Row: quick actions + activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick actions */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
          className="p-5 rounded-2xl bg-white/4 border border-white/8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((a, i) => (
              <motion.div key={a.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + i * 0.04 }}>
                <Link to={a.href}
                  className={'flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br ' +
                    a.color + ' ' + a.border + ' hover:scale-105 transition-all duration-200 group text-center'}>
                  <a.Icon className={'w-5 h-5 ' + a.text} />
                  <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors leading-tight">{a.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="p-5 rounded-2xl bg-white/4 border border-white/8 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="font-orbitron font-bold text-sm text-white">Recent Signups</h2>
            </div>
            <Link to="/admin/users" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-11 rounded-xl bg-white/5 animate-pulse" />)}</div>
            ) : activity.length > 0
              ? activity.map((item, i) => <ActivityRow key={item.id} item={item} i={i} />)
              : <p className="text-white/25 text-sm text-center py-8">No activity yet.</p>
            }
          </div>
        </motion.div>
      </div>
    </div>
  );
}
