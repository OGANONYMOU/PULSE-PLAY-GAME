import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Shield, UserCheck, Ban, TrendingUp, Activity,
  Loader2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Gamepad2, Trophy, MessageSquare, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface ProfileRow {
  role: string;
  is_banned: boolean;
  created_at: string;
}
interface Stats {
  total: number;
  admins: number;
  moderators: number;
  banned: number;
  newThisWeek: number;
}
interface ChartPoint { date: string; users: number }
interface ActivityItem { id: string; username: string; action: string; created_at: string }

// ── Stat card ────────────────────────────────────────────────────────────────
function KpiCard(p: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  delta?: number;
  color: string;
  glow: string;
  border: string;
  delay: number;
}): React.ReactElement {
  const up = (p.delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.delay, duration: 0.3 }}
      className={'relative p-5 rounded-2xl border overflow-hidden ' + p.border}
    >
      {/* Background glow blob */}
      <div className={'absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ' + p.glow} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + p.glow + '/20'}>
            <p.Icon className={'w-5 h-5 ' + p.color} />
          </div>
          {p.delta !== undefined ? (
            <span className={'flex items-center gap-0.5 text-xs font-bold ' + (up ? 'text-green-400' : 'text-red-400')}>
              {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(p.delta)}%
            </span>
          ) : null}
        </div>
        <div className="font-orbitron text-3xl font-black text-white mb-0.5">{p.value.toLocaleString()}</div>
        <div className="text-xs text-white/45 font-medium">{p.label}</div>
      </div>
    </motion.div>
  );
}

// ── Custom tooltip for chart ─────────────────────────────────────────────────
function ChartTooltip(p: { active?: boolean; payload?: Array<{ value: number }>; label?: string }): React.ReactElement {
  return p.active && p.payload?.length ? (
    <div className="bg-card/95 border border-white/10 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="text-white/50 text-xs mb-1">{p.label}</p>
      <p className="font-orbitron font-bold text-cyan-400">{p.payload[0].value} users</p>
    </div>
  ) : <span />;
}

// ── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow(p: { item: ActivityItem; index: number }): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: p.index * 0.04 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0"
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
      <span className="text-xs text-white/25 flex-shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {format(new Date(p.item.created_at), 'HH:mm')}
      </span>
    </motion.div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export function AdminDashboard(): React.ReactElement {
  const [stats, setStats] = useState<Stats>({ total: 0, admins: 0, moderators: 0, banned: 0, newThisWeek: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Profiles stats
      const { data: profiles, error: pErr } = await supabase
        .from('profiles').select('role, is_banned, created_at, username').order('created_at', { ascending: false });
      if (pErr) throw pErr;
      const rows = (profiles ?? []) as ProfileRow[];
      const oneWeekAgo = subDays(new Date(), 7).toISOString();
      setStats({
        total:       rows.length,
        admins:      rows.filter(r => r.role === 'ADMIN').length,
        moderators:  rows.filter(r => r.role === 'MODERATOR').length,
        banned:      rows.filter(r => r.is_banned).length,
        newThisWeek: rows.filter(r => r.created_at >= oneWeekAgo).length,
      });

      // Build 7-day signup chart
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return { date: format(d, 'MMM d'), iso: format(d, 'yyyy-MM-dd') };
      });
      setChartData(days.map(d => ({
        date: d.date,
        users: rows.filter(r => r.created_at.startsWith(d.iso)).length,
      })));

      // Recent signups as activity feed
      const recent = (profiles ?? []).slice(0, 8) as (ProfileRow & { username: string })[];
      setActivity(recent.map((r, i) => ({
        id: String(i),
        username: r.username,
        action: 'joined the platform',
        created_at: r.created_at,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = [
    { Icon: Users,     label: 'Total Players',  key: 'total'       as keyof Stats, color: 'text-cyan-400',   glow: 'bg-cyan-500',   border: 'border-cyan-500/15',   delta: stats.newThisWeek },
    { Icon: Shield,    label: 'Admins',          key: 'admins'      as keyof Stats, color: 'text-red-400',    glow: 'bg-red-500',    border: 'border-red-500/15',    delta: undefined },
    { Icon: UserCheck, label: 'Moderators',      key: 'moderators'  as keyof Stats, color: 'text-yellow-400', glow: 'bg-yellow-500', border: 'border-yellow-500/15', delta: undefined },
    { Icon: Ban,       label: 'Banned',          key: 'banned'      as keyof Stats, color: 'text-rose-400',   glow: 'bg-rose-500',   border: 'border-rose-500/15',   delta: undefined },
  ];

  const quickStats = [
    { Icon: Gamepad2,     label: 'Games Listed',    value: '—', color: 'text-purple-400' },
    { Icon: Trophy,       label: 'Tournaments',     value: '—', color: 'text-yellow-400' },
    { Icon: MessageSquare,label: 'Community Posts', value: '—', color: 'text-pink-400' },
  ];

  return (
    <div className="p-5 sm:p-7 max-w-7xl">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-7"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Dashboard</h1>
          <p className="text-white/35 text-sm">Welcome back — here's your platform overview</p>
        </div>
        <Button
          variant="ghost" size="sm" onClick={load} disabled={loading}
          className="text-white/40 hover:text-white hover:bg-white/8 h-8 gap-2 text-xs"
        >
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          Refresh
        </Button>
      </motion.div>

      {error ? (
        <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error} —
          <button onClick={load} className="underline ml-1">retry</button>
        </div>
      ) : null}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {kpis.map((k, i) => (
            <KpiCard
              key={k.label}
              Icon={k.Icon}
              label={k.label}
              value={stats[k.key]}
              delta={k.delta}
              color={k.color}
              glow={k.glow}
              border={k.border}
              delay={i * 0.06}
            />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        {/* Signups chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="lg:col-span-2 p-5 rounded-2xl bg-white/4 border border-white/8"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-orbitron font-bold text-sm text-white">Signups — Last 7 Days</h2>
              <p className="text-white/30 text-xs mt-0.5">{stats.newThisWeek} new this week</p>
            </div>
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          {loading ? (
            <div className="h-40 rounded-xl bg-white/5 animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(6,182,212,0.2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={2} fill="url(#cyanGrad)" dot={{ fill: '#06b6d4', r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
          className="p-5 rounded-2xl bg-white/4 border border-white/8 flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Quick Stats</h2>
          </div>
          {quickStats.map(s => (
            <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
              <div className="flex items-center gap-2.5">
                <s.Icon className={'w-4 h-4 ' + s.color} />
                <span className="text-sm text-white/60">{s.label}</span>
              </div>
              <span className="font-orbitron text-sm font-bold text-white">{s.value}</span>
            </div>
          ))}
          <div className="mt-auto p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/15">
            <p className="text-xs text-white/40 mb-1">This week</p>
            <p className="font-orbitron text-lg font-black text-cyan-400">+{stats.newThisWeek}</p>
            <p className="text-xs text-white/40">new players joined</p>
          </div>
        </motion.div>
      </div>

      {/* Activity feed */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="p-5 rounded-2xl bg-white/4 border border-white/8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Recent Activity</h2>
          </div>
          <span className="text-xs text-white/25">Latest 8 signups</span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : activity.length > 0 ? (
          activity.map((item, i) => <ActivityRow key={item.id} item={item} index={i} />)
        ) : (
          <p className="text-white/25 text-sm text-center py-6">No recent activity yet.</p>
        )}
      </motion.div>
    </div>
  );
}