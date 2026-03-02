import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Users, Trophy, Gamepad2, MessageSquare,
  Megaphone, RefreshCw, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type TableStat = {
  table: string;
  count: number;
  icon: React.ElementType;
  color: string;
};

const externalLinks = [
  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', desc: 'Manage database, auth, storage' },
  { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', desc: 'Deployments, logs, domains' },
  { label: 'Supabase Auth', url: 'https://supabase.com/dashboard', desc: 'Users, providers, policies' },
  { label: 'Supabase Storage', url: 'https://supabase.com/dashboard', desc: 'Avatar and banner files' },
];

export function AdminSettings() {
  const [stats, setStats] = useState<TableStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    const [profiles, games, tournaments, posts, announcements] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
    ]);

    setStats([
      { table: 'profiles', count: profiles.count ?? 0, icon: Users, color: 'from-cyan-500 to-blue-500' },
      { table: 'games', count: games.count ?? 0, icon: Gamepad2, color: 'from-purple-500 to-pink-500' },
      { table: 'tournaments', count: tournaments.count ?? 0, icon: Trophy, color: 'from-yellow-500 to-orange-500' },
      { table: 'posts', count: posts.count ?? 0, icon: MessageSquare, color: 'from-green-500 to-emerald-500' },
      { table: 'announcements', count: announcements.count ?? 0, icon: Megaphone, color: 'from-red-500 to-pink-500' },
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast.success('Stats refreshed.');
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              Platform <span className="gradient-text">Settings</span>
            </h1>
            <p className="text-muted-foreground">Database overview and platform management</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-8">
          <h2 className="font-orbitron font-bold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            Database Tables
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))
              : stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.table}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="gaming-card p-5 flex items-center gap-4"
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-orbitron text-2xl font-bold">{stat.count}</div>
                        <div className="text-xs text-muted-foreground capitalize">{stat.table}</div>
                      </div>
                    </motion.div>
                  );
                })}
          </div>
        </div>

        <div className="gaming-card p-6">
          <h2 className="font-orbitron font-bold mb-4">Management Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {externalLinks.map((link) => (
              
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div>
                  <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">
                    {link.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{link.desc}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}