import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Gamepad2, Trophy, TrendingUp, Activity,
  RefreshCw, ArrowUpRight, BarChart2, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { format, subDays, subMonths, startOfDay } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────
interface SignupPoint  { date: string; signups: number }
interface RolePie     { name: string; value: number; color: string }
interface TopGame     { name: string; icon: string; players: number; tournaments: number }

// ── Custom tooltip ────────────────────────────────────────────────────────
function Tip(p: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }): React.ReactElement {
  return p.active && p.payload?.length ? (
    <div className="bg-card/98 border border-white/10 rounded-xl px-4 py-2.5 text-xs shadow-xl">
      <p className="text-white/40 mb-1.5">{p.label}</p>
      {p.payload.map(e => (
        <p key={e.name} className="font-bold" style={{ color: e.color }}>{e.name}: {e.value}</p>
      ))}
    </div>
  ) : <span />;
}

// ── KPI card ──────────────────────────────────────────────────────────────
function Kpi(p: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string;
  color: string; border: string; glow: string; delay: number;
}): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.delay }}
      className={'relative p-5 rounded-2xl border overflow-hidden ' + p.border}
    >
      <div className={'absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-15 ' + p.glow} />
      <div className="relative">
        <div className={'w-9 h-9 rounded-xl flex items-center justify-center mb-3 ' + p.glow + '/20'}>
          <p.Icon className={'w-4.5 h-4.5 ' + p.color} />
        </div>
        <div className="font-orbitron text-2xl font-black text-white mb-0.5">{p.value}</div>
        <div className="text-xs text-white/45 font-medium">{p.label}</div>
        <div className="flex items-center gap-1 mt-1.5">
          <ArrowUpRight className="w-3 h-3 text-green-400" />
          <span className="text-[10px] text-green-400">{p.sub}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section(p: {
  title: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.delay }}
      className="p-5 rounded-2xl bg-white/4 border border-white/8"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2">
            <p.icon className="w-4 h-4 text-cyan-400" />
            {p.title}
          </h2>
          {p.sub ? <p className="text-xs text-white/30 mt-0.5">{p.sub}</p> : null}
        </div>
      </div>
      {p.children}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export function AdminAnalytics(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Data state
  const [signups30,  setSignups30]  = useState<SignupPoint[]>([]);
  const [signups7,   setSignups7]   = useState<SignupPoint[]>([]);
  const [roleData,   setRoleData]   = useState<RolePie[]>([]);
  const [topGames,   setTopGames]   = useState<TopGame[]>([]);
  const [kpis, setKpis] = useState({ users: 0, games: 0, tournaments: 0, newThisMonth: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ── Profiles ──────────────────────────────────────────────────────
      const { data: profiles, error: pErr } = await supabase
        .from('profiles').select('role, is_banned, created_at');
      if (pErr) throw pErr;
      const rows = (profiles ?? []) as { role: string; is_banned: boolean; created_at: string }[];

      const oneMonthAgo = subMonths(new Date(), 1).toISOString();
      setKpis(prev => ({
        ...prev,
        users: rows.length,
        newThisMonth: rows.filter(r => r.created_at >= oneMonthAgo).length,
      }));

      // Role distribution pie
      const roleMap: Record<string, number> = { USER: 0, MODERATOR: 0, ADMIN: 0 };
      rows.forEach(r => { roleMap[r.role] = (roleMap[r.role] ?? 0) + 1; });
      setRoleData([
        { name: 'Players',    value: roleMap.USER ?? 0,      color: '#06b6d4' },
        { name: 'Moderators', value: roleMap.MODERATOR ?? 0, color: '#eab308' },
        { name: 'Admins',     value: roleMap.ADMIN ?? 0,     color: '#ef4444' },
      ].filter(d => d.value > 0));

      // 30-day signup trend
      const days30 = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(new Date(), 29 - i);
        const iso = format(startOfDay(d), 'yyyy-MM-dd');
        return {
          date: format(d, 'MMM d'),
          signups: rows.filter(r => r.created_at.startsWith(iso)).length,
        };
      });
      setSignups30(days30);

      // 7-day signup trend
      const days7 = days30.slice(-7);
      setSignups7(days7);

      // ── Games ─────────────────────────────────────────────────────────
      const { data: gamesData, error: gErr } = await supabase
        .from('games').select('name, icon, player_count, tournament_count').order('player_count', { ascending: false }).limit(5);
      if (gErr) throw gErr;
      const gRows = (gamesData ?? []) as { name: string; icon: string; player_count: number; tournament_count: number }[];
      setTopGames(gRows.map(g => ({ name: g.name, icon: g.icon, players: g.player_count, tournaments: g.tournament_count })));
      setKpis(prev => ({ ...prev, games: gRows.length }));

      // ── Tournaments ───────────────────────────────────────────────────
      const { count: tCount } = await supabase.from('tournaments').select('id', { count: 'exact', head: true });
      setKpis(prev => ({ ...prev, tournaments: tCount ?? 0 }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ROLE_COLORS = ['#06b6d4', '#eab308', '#ef4444'];

  return (
    <div className="p-5 sm:p-7 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-7"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Analytics</h1>
          <p className="text-white/35 text-sm">Platform performance and engagement metrics</p>
        </div>
        <Button
          variant="ghost" size="sm" onClick={load} disabled={loading}
          className="text-white/40 hover:text-white hover:bg-white/8 h-8 gap-2 text-xs"
        >
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />Refresh
        </Button>
      </motion.div>

      {/* Error */}
      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error} — <button onClick={load} className="underline">retry</button>
        </div>
      ) : null}

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi Icon={Users}    label="Total Players"   value={kpis.users.toLocaleString()}       sub={`+${kpis.newThisMonth} this month`} color="text-cyan-400"   glow="bg-cyan-500"   border="border-cyan-500/15"   delay={0} />
          <Kpi Icon={Gamepad2} label="Games Listed"    value={kpis.games.toString()}             sub="in library"                         color="text-purple-400" glow="bg-purple-500" border="border-purple-500/15" delay={0.06} />
          <Kpi Icon={Trophy}   label="Tournaments"     value={kpis.tournaments.toString()}       sub="total created"                      color="text-yellow-400" glow="bg-yellow-500" border="border-yellow-500/15" delay={0.12} />
          <Kpi Icon={TrendingUp} label="New This Month" value={kpis.newThisMonth.toString()}     sub="signups"                            color="text-green-400"  glow="bg-green-500"  border="border-green-500/15"  delay={0.18} />
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* 30-day signups */}
        <Section title="30-Day Signups" sub="Daily new player registrations" icon={TrendingUp} delay={0.24}>
          <div className="lg:col-span-2">
            {loading ? (
              <div className="h-44 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={signups30} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g30" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false}
                    interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(6,182,212,0.15)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="signups" name="Signups" stroke="#06b6d4" strokeWidth={1.5} fill="url(#g30)"
                    dot={false} activeDot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Role distribution */}
        <Section title="User Roles" sub="Distribution by role" icon={Users} delay={0.3}>
          {loading ? (
            <div className="h-44 rounded-xl bg-white/5 animate-pulse" />
          ) : roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={176}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="45%" innerRadius={44} outerRadius={68}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {roleData.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<Tip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/25 text-xs text-center py-8">No data yet</p>
          )}
        </Section>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 7-day bar */}
        <Section title="7-Day Signups" sub="Day-by-day this week" icon={BarChart2} delay={0.36}>
          {loading ? (
            <div className="h-44 rounded-xl bg-white/5 animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={signups7} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="signups" name="Signups" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Top games */}
        <Section title="Top Games by Players" sub="Most active games on the platform" icon={Activity} delay={0.42}>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : topGames.length > 0 ? (
            <div className="space-y-2.5">
              {topGames.map((g, i) => {
                const max = topGames[0]?.players || 1;
                const pct = Math.round((g.players / max) * 100);
                return (
                  <div key={g.name} className="flex items-center gap-3">
                    <span className="text-white/25 text-xs w-4 text-right font-mono">{i + 1}</span>
                    <span className="text-xl flex-shrink-0">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white truncate">{g.name}</span>
                        <span className="text-xs text-white/35 flex items-center gap-1 flex-shrink-0 ml-2">
                          <Clock className="w-3 h-3" />
                          {g.players.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-700"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/25 text-xs text-center py-8">No game data yet</p>
          )}
        </Section>
      </div>
    </div>
  );
}