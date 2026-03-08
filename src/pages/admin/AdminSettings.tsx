import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Trophy, Gamepad2, MessageSquare, Megaphone,
  RefreshCw, ExternalLink, Database, Globe, CheckCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AdminSettings() {
  const [userCount, setUserCount]             = useState(0);
  const [gameCount, setGameCount]             = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [postCount, setPostCount]             = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [isRefreshing, setIsRefreshing]       = useState(false);

  const { currency, symbol, setCurrency } = useCurrency();

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

  const handleCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    toast.success('Currency updated to ' + code);
  };

  const dbCards = [
    { icon: Users,         label: 'profiles',      count: userCount,         color: 'from-cyan-500 to-blue-500' },
    { icon: Gamepad2,      label: 'games',          count: gameCount,         color: 'from-purple-500 to-pink-500' },
    { icon: Trophy,        label: 'tournaments',    count: tournamentCount,   color: 'from-yellow-500 to-orange-500' },
    { icon: MessageSquare, label: 'posts',          count: postCount,         color: 'from-green-500 to-emerald-500' },
    { icon: Megaphone,     label: 'announcements',  count: announcementCount, color: 'from-red-500 to-pink-500' },
  ];

  return (
    <div className="p-6 sm:p-8 min-h-screen max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-orbitron text-3xl font-bold mb-1">
            Platform <span className="gradient-text">Settings</span>
          </h1>
          <p className="text-muted-foreground">Database overview and platform management</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={'w-4 h-4 mr-2 ' + (isRefreshing ? 'animate-spin' : '')} />
          Refresh
        </Button>
      </motion.div>

      {/* ── Currency Preferences ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="mb-8">
        <h2 className="font-orbitron font-bold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          Currency Preference
        </h2>
        <div className="gaming-card p-6">
          <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center font-orbitron font-black text-cyan-400 text-lg">
              {symbol}
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Active: {CURRENCY_OPTIONS.find(o => o.code === currency)?.label ?? currency}
              </p>
              <p className="text-xs text-white/40">Applied across prizes, stats, and tournament display</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CURRENCY_OPTIONS.map(opt => {
              const active = opt.code === currency;
              return (
                <button
                  key={opt.code}
                  onClick={() => handleCurrency(opt.code)}
                  className={
                    'relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ' +
                    (active
                      ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 border-cyan-500/40 text-white'
                      : 'border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 text-white/60 hover:text-white/85')
                  }
                >
                  <span className="font-orbitron font-black text-base w-7 text-center flex-shrink-0">
                    {CURRENCY_OPTIONS.find(o => o.code === opt.code)?.label.match(/\((.+)\)/)?.[1] ?? opt.code}
                  </span>
                  <span className="text-xs font-medium leading-tight">{opt.label.split(' (')[0]}</span>
                  {active ? (
                    <CheckCircle className="w-3.5 h-3.5 text-cyan-400 absolute top-2 right-2" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-white/30 mt-4">
            Auto-detected from your browser timezone. Your choice is saved locally and persists across sessions.
          </p>
        </div>
      </motion.div>

      {/* ── Database Tables ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
        className="mb-8">
        <h2 className="font-orbitron font-bold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          Database Tables
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {dbCards.map(c => (
            <div key={c.label} className="gaming-card p-5 flex items-center gap-4">
              <div className={'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 ' + c.color}>
                <c.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-orbitron text-2xl font-bold">{c.count}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Management Links ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="gaming-card p-6">
          <h2 className="font-orbitron font-bold mb-4">Management Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
              <div>
                <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">Supabase Dashboard</div>
                <div className="text-xs text-muted-foreground">Manage database, auth, storage</div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
              <div>
                <div className="font-medium text-sm group-hover:text-cyan-400 transition-colors">Vercel Dashboard</div>
                <div className="text-xs text-muted-foreground">Deployments, logs, domains</div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}