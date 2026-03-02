import { useEffect, useState } from 'react';
import { Users, Trophy, Gamepad2, MessageSquare, Megaphone, RefreshCw, ExternalLink, Database } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AdminSettings() {
  const [userCount, setUserCount] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
    ]);
    setUserCount(a.count ?? 0);
    setGameCount(b.count ?? 0);
    setTournamentCount(c.count ?? 0);
    setPostCount(d.count ?? 0);
    setAnnouncementCount(e.count ?? 0);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast.success('Stats refreshed.');
  };

  return (
    <div className="p-8 min-h-screen">
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
          <div className="gaming-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-orbitron text-2xl font-bold">{userCount}</div>
              <div className="text-xs text-muted-foreground">profiles</div>
            </div>
          </div>
          <div className="gaming-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-orbitron text-2xl font-bold">{gameCount}</div>
              <div className="text-xs text-muted-foreground">games</div>
            </div>
          </div>
          <div className="gaming-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-orbitron text-2xl font-bold">{tournamentCount}</div>
              <div className="text-xs text-muted-foreground">tournaments</div>
            </div>
          </div>
          <div className="gaming-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-orbitron text-2xl font-bold">{postCount}</div>
              <div className="text-xs text-muted-foreground">posts</div>
            </div>
          </div>
          <div className="gaming-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-orbitron text-2xl font-bold">{announcementCount}</div>
              <div className="text-xs text-muted-foreground">announcements</div>
            </div>
          </div>
        </div>
      </div>

      <div className="gaming-card p-6">
        <h2 className="font-orbitron font-bold mb-4">Management Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
            <div>
              <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">Supabase Dashboard</div>
              <div className="text-xs text-muted-foreground">Manage database, auth, storage</div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
            <div>
              <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">Vercel Dashboard</div>
              <div className="text-xs text-muted-foreground">Deployments, logs, domains</div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  );
}