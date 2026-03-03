import { useEffect, useState } from 'react';
import { Users, Shield, UserCheck, Ban, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileRow {
  role: string;
  is_banned: boolean;
}

export function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, admins: 0, moderators: 0, banned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('role, is_banned').then(({ data }) => {
      const rows = (data ?? []) as ProfileRow[];
      setStats({
        total: rows.length,
        admins: rows.filter((p) => p.role === 'ADMIN').length,
        moderators: rows.filter((p) => p.role === 'MODERATOR').length,
        banned: rows.filter((p) => p.is_banned).length,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { icon: Users, label: 'Total Users', value: stats.total, color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-500/5', border: 'border-cyan-500/20' },
    { icon: Shield, label: 'Admins', value: stats.admins, color: 'text-red-400', bg: 'from-red-500/20 to-red-500/5', border: 'border-red-500/20' },
    { icon: UserCheck, label: 'Moderators', value: stats.moderators, color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/20' },
    { icon: Ban, label: 'Banned', value: stats.banned, color: 'text-rose-400', bg: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-500/20' },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="font-orbitron text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-white/40 text-sm">Platform overview and statistics</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <div key={card.label} className={'p-5 rounded-xl bg-gradient-to-br border ' + card.bg + ' ' + card.border}>
              <card.icon className={'w-7 h-7 mb-3 ' + card.color} />
              <div className="font-orbitron text-3xl font-bold text-white mb-1">{card.value}</div>
              <div className="text-sm text-white/50">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Growth</h2>
          </div>
          <p className="text-white/40 text-sm">Analytics coming soon.</p>
        </div>
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Activity</h2>
          </div>
          <p className="text-white/40 text-sm">Activity feed coming soon.</p>
        </div>
      </div>
    </div>
  );
}