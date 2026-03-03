import { useEffect, useState } from 'react';
import { Users, Shield, UserCheck, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  total: number;
  admins: number;
  moderators: number;
  banned: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, admins: 0, moderators: 0, banned: 0 });

  useEffect(() => {
    supabase.from('profiles').select('role, is_banned').then(({ data }) => {
      if (!data) return;
      setStats({
        total: data.length,
        admins: data.filter((p) => p.role === 'ADMIN').length,
        moderators: data.filter((p) => p.role === 'MODERATOR').length,
        banned: data.filter((p) => p.is_banned).length,
      });
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="font-orbitron text-2xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gaming-card p-6">
          <Users className="w-8 h-8 text-cyan-400 mb-3" />
          <div className="font-orbitron text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground mt-1">Total Users</div>
        </div>
        <div className="gaming-card p-6">
          <Shield className="w-8 h-8 text-red-400 mb-3" />
          <div className="font-orbitron text-3xl font-bold">{stats.admins}</div>
          <div className="text-sm text-muted-foreground mt-1">Admins</div>
        </div>
        <div className="gaming-card p-6">
          <UserCheck className="w-8 h-8 text-yellow-400 mb-3" />
          <div className="font-orbitron text-3xl font-bold">{stats.moderators}</div>
          <div className="text-sm text-muted-foreground mt-1">Moderators</div>
        </div>
        <div className="gaming-card p-6">
          <Ban className="w-8 h-8 text-destructive mb-3" />
          <div className="font-orbitron text-3xl font-bold">{stats.banned}</div>
          <div className="text-sm text-muted-foreground mt-1">Banned</div>
        </div>
      </div>
    </div>
  );
}