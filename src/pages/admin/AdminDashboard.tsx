import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Trophy, Gamepad2, MessageSquare, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

type Stats = {
  users: number;
  games: number;
  tournaments: number;
  posts: number;
  ongoingTournaments: number;
};

const statCards = (stats: Stats) => [
  { label: 'Total Users', value: stats.users, icon: Users, color: 'from-cyan-500 to-blue-500' },
  { label: 'Games', value: stats.games, icon: Gamepad2, color: 'from-purple-500 to-pink-500' },
  { label: 'Tournaments', value: stats.tournaments, icon: Trophy, color: 'from-yellow-500 to-orange-500' },
  { label: 'Community Posts', value: stats.posts, icon: MessageSquare, color: 'from-green-500 to-emerald-500' },
  { label: 'Live Now', value: stats.ongoingTournaments, icon: Activity, color: 'from-red-500 to-pink-500' },
];

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [users, games, tournaments, posts, ongoing] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('games').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'ongoing'),
      ]);

      setStats({
        users: users.count ?? 0,
        games: games.count ?? 0,
        tournaments: tournaments.count ?? 0,
        posts: posts.count ?? 0,
        ongoingTournaments: ongoing.count ?? 0,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, []);

  return (
    <div className="p-8 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="font-orbitron text-3xl font-bold mb-1">
            Admin <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">Overview of your PulsePay platform</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
          {isLoading
            ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            : stats && statCards(stats).map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="gaming-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="w-6 h-6 text-white" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="font-orbitron text-3xl font-bold mb-1">{card.value}</div>
                <div className="text-sm text-muted-foreground">{card.label}</div>
              </motion.div>
            ))}
        </div>

        {/* Quick Links */}
        <div className="gaming-card p-6">
          <h2 className="font-orbitron font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Add Game', href: '/admin/games', icon: Gamepad2 },
              { label: 'Add Tournament', href: '/admin/tournaments', icon: Trophy },
              { label: 'Manage Users', href: '/admin/users', icon: Users },
              { label: 'Moderate Posts', href: '/admin/posts', icon: MessageSquare },
            ].map((action) => (
              
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-center"
              >
                <action.icon className="w-6 h-6 text-cyan-400" />
                <span className="text-sm font-medium">{action.label}</span>
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}