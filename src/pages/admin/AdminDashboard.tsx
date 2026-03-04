import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, UserCheck, Ban, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
}

function StatCard(p: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
  delay: number;
}): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.delay, duration: 0.3 }}
      className={'p-5 rounded-2xl bg-gradient-to-br border ' + p.bg + ' ' + p.border}
    >
      <p.Icon className={'w-7 h-7 mb-3 ' + p.color} />
      <div className="font-orbitron text-3xl font-bold text-white mb-1">{p.value}</div>
      <div className="text-sm text-white/50">{p.label}</div>
    </motion.div>
  );
}

export function AdminDashboard(): React.ReactElement {
  const [stats, setStats] = useState<Stats>({ total: 0, admins: 0, moderators: 0, banned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('role, is_banned, created_at')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        const rows = (data ?? []) as ProfileRow[];
        setStats({
          total: rows.length,
          admins: rows.filter((r) => r.role === 'ADMIN').length,
          moderators: rows.filter((r) => r.role === 'MODERATOR').length,
          banned: rows.filter((r) => r.is_banned).length,
        });
        setLoading(false);
      });
  }, []);

  const cards = [
    { Icon: Users, label: 'Total Users', key: 'total' as keyof Stats, color: 'text-cyan-400', bg: 'from-cyan-500/15 to-transparent', border: 'border-cyan-500/20' },
    { Icon: Shield, label: 'Admins', key: 'admins' as keyof Stats, color: 'text-red-400', bg: 'from-red-500/15 to-transparent', border: 'border-red-500/20' },
    { Icon: UserCheck, label: 'Moderators', key: 'moderators' as keyof Stats, color: 'text-yellow-400', bg: 'from-yellow-500/15 to-transparent', border: 'border-yellow-500/20' },
    { Icon: Ban, label: 'Banned', key: 'banned' as keyof Stats, color: 'text-rose-400', bg: 'from-rose-500/15 to-transparent', border: 'border-rose-500/20' },
  ];

  return (
    <div className="p-6 sm:p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-orbitron text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-white/40 text-sm">Platform overview and statistics</p>
      </motion.div>

      {loading ? (
        <div className="flex items-center gap-3 text-white/40 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading stats…</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c, i) => (
            <StatCard key={c.label} Icon={c.Icon} label={c.label} value={stats[c.key]}
              color={c.color} bg={c.bg} border={c.border} delay={i * 0.06} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Growth Analytics</h2>
          </div>
          <p className="text-white/30 text-sm">Detailed charts coming soon.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
          className="p-5 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Activity Feed</h2>
          </div>
          <p className="text-white/30 text-sm">Real-time activity coming soon.</p>
        </motion.div>
      </div>
    </div>
  );
}