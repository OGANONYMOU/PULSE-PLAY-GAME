import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Gamepad2, Users, Trophy, Star, Sparkles, RefreshCw,
  X, ArrowRight, Clock, Play, CheckCircle, Zap, Bell, ChevronRight,
  MessageSquare, Activity, Newspaper,
  BarChart2, Eye,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatDistanceToNow } from 'date-fns';

type Game = {
  id: string; name: string; description: string; icon: string;
  logo_url: string | null; badge: string | null;
  player_count: number; tournament_count: number;
  category: string; featured: boolean; created_at: string;
};
type Tournament = {
  id: string; name: string; status: 'upcoming' | 'ongoing' | 'completed';
  date: string; prize_pool: string; max_players: number; current_players: number;
};
type Post = {
  id: string; title: string; content: string; tag: string;
  likes: number; comments: number; created_at: string;
  profiles: { username: string } | null;
};

const CATEGORIES = [
  { value: 'all',           label: 'All' },
  { value: 'fps',           label: 'FPS' },
  { value: 'battle-royale', label: 'Battle Royale' },
  { value: 'moba',          label: 'MOBA' },
  { value: 'sports',        label: 'Sports' },
  { value: 'fighting',      label: 'Fighting' },
];

const BADGE_COLORS: Record<string, string> = {
  'Most Popular': 'bg-purple-500',
  Trending: 'bg-cyan-500',
  New: 'bg-pink-500',
  Featured: 'bg-yellow-500',
  Hot: 'bg-red-500',
  Popular: 'bg-purple-500',
};

const STATUS_META = {
  upcoming:  { icon: Clock,       color: 'text-blue-400',  bg: 'bg-blue-500/15 border-blue-500/30',   label: 'Upcoming' },
  ongoing:   { icon: Play,        color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', label: 'Live 🔴' },
  completed: { icon: CheckCircle, color: 'text-white/40',  bg: 'bg-white/8 border-white/10',           label: 'Done' },
};

// Mock update/news data (replace with DB queries when table exists)
const MOCK_UPDATES = [
  { id: '1', type: 'update' as const, title: 'Season 5 Battle Pass Live', summary: 'New weapons, skins and ranked rewards are now available.', time: new Date(Date.now() - 3600000 * 2), tag: 'Patch' },
  { id: '2', type: 'update' as const, title: 'Ranked Matchmaking Fix', summary: 'Addressed lag spikes and desync issues in ranked lobbies.', time: new Date(Date.now() - 3600000 * 24), tag: 'Hotfix' },
  { id: '3', type: 'update' as const, title: 'New Map: Desert Storm', summary: 'A brand-new 60-player arena drops this weekend.', time: new Date(Date.now() - 3600000 * 48), tag: 'Content' },
  { id: '4', type: 'news' as const, title: 'World Championship 2026 Announced', summary: '$500K prize pool — registration opens next month globally.', time: new Date(Date.now() - 3600000 * 6), tag: 'Esports' },
  { id: '5', type: 'news' as const, title: 'PulsePay Partners with Tournament Hub', summary: 'Exclusive in-game rewards for PulsePay tournament winners.', time: new Date(Date.now() - 3600000 * 30), tag: 'Partnership' },
  { id: '6', type: 'news' as const, title: 'Mobile Gaming Awards 2026', summary: 'Nominations are open — vote for your favourite titles.', time: new Date(Date.now() - 3600000 * 72), tag: 'Community' },
];

// ── Game logo ─────────────────────────────────────────────────────────────
function GameLogo({ game, size = 'sm', className }: { game: Game; size?: 'sm' | 'md' | 'lg'; className?: string }): React.ReactElement {
  const [err, setErr] = useState(false);
  const sz = size === 'lg' ? 'w-24 h-24 text-5xl' : size === 'md' ? 'w-20 h-20 text-4xl' : 'w-14 h-14 text-2xl';
  return (
    <div className={sz + ' rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 border border-white/10 ' + (className ?? '')}>
      {game.logo_url && !err
        ? <img src={game.logo_url} alt={game.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <span>{game.icon}</span>}
    </div>
  );
}

// ── Analytics mini bar ─────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden flex-1">
      <motion.div initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: 0.8, ease: 'easeOut' }}
        className={'h-full rounded-full ' + color} />
    </div>
  );
}

// ── Game Detail Panel ─────────────────────────────────────────────────────
function GameDetailPanel({ game, onClose, symbol, initialTab = 'overview' }: {
  game: Game; onClose: () => void; symbol: string;
  initialTab?: 'overview' | 'tournaments' | 'updates' | 'news';
}): React.ReactElement {
  const [tab, setTab] = useState<'overview' | 'tournaments' | 'updates' | 'news'>(initialTab);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('id,name,status,date,prize_pool,max_players,current_players')
          .eq('game_id', game.id).order('date', { ascending: false }).limit(10),
        supabase.from('posts').select('id,title,content,tag,likes,comments,created_at,profiles(username)')
          .order('created_at', { ascending: false }).limit(8),
      ]);
      if (!tRes.error) setTournaments((tRes.data as Tournament[]) ?? []);
      if (!pRes.error) setPosts((pRes.data as Post[]) ?? []);
      setLoading(false);
    };
    load();
  }, [game.id]);

  const players = game.player_count >= 1000 ? (game.player_count / 1000).toFixed(1) + 'K' : String(game.player_count);

  const TABS = [
    { id: 'overview'    as const, label: 'Overview',    icon: Gamepad2,   short: 'Info'  },
    { id: 'tournaments' as const, label: 'Tournaments',  icon: Trophy,     short: 'Events' },
    { id: 'updates'     as const, label: 'Updates',      icon: Activity,   short: 'Patch' },
    { id: 'news'        as const, label: 'News',         icon: Newspaper,  short: 'News'  },
  ];

  const updates = MOCK_UPDATES.filter(u => u.type === 'update');
  const news    = MOCK_UPDATES.filter(u => u.type === 'news');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-2xl bg-card border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[93vh] flex flex-col"
      >
        {/* Drag handle mobile */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Hero header */}
        <div className="relative overflow-hidden flex-shrink-0">
          {game.logo_url ? (
            <div className="absolute inset-0 overflow-hidden">
              <img src={game.logo_url} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-card/70 to-card" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-card" />
          )}

          <div className="relative z-10 p-5 sm:p-6 flex items-start gap-4">
            <GameLogo game={game} size="lg" />
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h2 className="font-orbitron font-black text-lg sm:text-xl text-white leading-snug">{game.name}</h2>
                {game.badge ? (
                  <span className={'text-[10px] px-2 py-0.5 rounded-full text-white font-bold ' + (BADGE_COLORS[game.badge] ?? 'bg-purple-500')}>
                    {game.badge}
                  </span>
                ) : null}
                {game.featured ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : null}
              </div>
              <p className="text-[10px] text-white/40 capitalize mb-2">{game.category}</p>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="flex items-center gap-1 text-cyan-400 font-bold text-xs"><Users className="w-3 h-3" />{players}</span>
                <span className="flex items-center gap-1 text-purple-400 font-bold text-xs"><Trophy className="w-3 h-3" />{game.tournament_count} events</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Notification bell */}
              <button
                onClick={() => { setNotifOn(n => !n); }}
                className={'w-8 h-8 rounded-full flex items-center justify-center transition-all ' +
                  (notifOn ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white')}
                title={notifOn ? 'Notifications on' : 'Enable notifications'}
              >
                <Bell className={'w-3.5 h-3.5 ' + (notifOn ? 'fill-yellow-400' : '')} />
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4-tab row */}
          <div className="relative z-10 flex border-t border-white/10 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap px-1 ' +
                  (tab === t.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-white/35 hover:text-white/65 hover:bg-white/4')}>
                <t.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}</div>
          ) : (
            <AnimatePresence mode="wait">

              {/* OVERVIEW */}
              {tab === 'overview' ? (
                <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-5">
                  <p className="text-white/60 text-sm leading-relaxed">{game.description || 'No description available.'}</p>

                  {/* Stat grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Players',     value: players,                           icon: Users,   color: 'text-cyan-400'   },
                      { label: 'Tournaments', value: String(game.tournament_count),      icon: Trophy,  color: 'text-purple-400' },
                      { label: 'Prize Pool',  value: symbol + '0',                      icon: Zap,     color: 'text-yellow-400' },
                    ].map(s => (
                      <div key={s.label} className="p-3.5 rounded-xl bg-white/5 border border-white/8 text-center">
                        <s.icon className={'w-4 h-4 mx-auto mb-1.5 ' + s.color} />
                        <div className="font-orbitron font-black text-base text-white">{s.value}</div>
                        <div className="text-[9px] text-white/30 mt-0.5 uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Engagement analytics */}
                  <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart2 className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-[10px] text-white/35 uppercase tracking-wider font-bold">Engagement</span>
                    </div>
                    {[
                      { label: 'Popularity', value: game.player_count, max: 30000, color: 'bg-cyan-500' },
                      { label: 'Activity',   value: game.tournament_count, max: 40,    color: 'bg-purple-500' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-[10px] text-white/40 w-16 flex-shrink-0">{row.label}</span>
                        <MiniBar value={row.value} max={row.max} color={row.color} />
                        <span className="text-[10px] text-white/40 w-8 text-right flex-shrink-0">
                          {Math.round((row.value / row.max) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" asChild className="border-white/15 text-white/70 hover:bg-white/5 gap-1.5 h-10">
                      <Link to="/tournaments" onClick={onClose}>
                        <Trophy className="w-3.5 h-3.5" />Tournaments
                      </Link>
                    </Button>
                    <Button size="sm" onClick={() => setTab('updates')}
                      className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-1.5 h-10">
                      <Activity className="w-3.5 h-3.5" />View Updates
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {/* TOURNAMENTS */}
              {tab === 'tournaments' ? (
                <motion.div key="tournaments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-2">
                  {tournaments.length === 0 ? (
                    <div className="text-center py-14">
                      <Trophy className="w-10 h-10 mx-auto text-white/15 mb-3" />
                      <p className="text-white/35 text-sm mb-4">No tournaments yet for this game.</p>
                      <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs">
                        <Link to="/tournaments" onClick={onClose}>Browse All Tournaments</Link>
                      </Button>
                    </div>
                  ) : tournaments.map((t, i) => {
                    const meta = STATUS_META[t.status];
                    const StatusIcon = meta.icon;
                    return (
                      <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
                        <div className={'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-bold flex-shrink-0 ' + meta.bg + ' ' + meta.color}>
                          <StatusIcon className="w-2.5 h-2.5" />{meta.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-semibold truncate">{t.name}</p>
                          <p className="text-xs text-white/35 truncate">Prize: {symbol}{t.prize_pool} · {t.current_players}/{t.max_players} players</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : null}

              {/* UPDATES */}
              {tab === 'updates' ? (
                <motion.div key="updates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Patch Notes & Events</h3>
                    <span className="ml-auto text-[10px] text-white/30">{updates.length} updates</span>
                  </div>
                  {updates.map((u, i) => (
                    <motion.div key={u.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/15 hover:border-cyan-500/30 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <p className="text-sm text-white font-semibold leading-snug group-hover:text-cyan-400 transition-colors">{u.title}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-bold flex-shrink-0">{u.tag}</span>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed mb-2">{u.summary}</p>
                      <p className="text-[10px] text-white/25">{formatDistanceToNow(u.time, { addSuffix: true })}</p>
                    </motion.div>
                  ))}
                  {posts.length > 0 && (
                    <div className="pt-2 border-t border-white/8">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3 font-bold">Community Discussions</p>
                      {posts.slice(0, 3).map((post, i) => (
                        <motion.div key={post.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all mb-2 cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white font-semibold truncate">{post.title}</p>
                            <p className="text-[10px] text-white/35 mt-0.5">by {post.profiles?.username ?? 'anonymous'}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/30 flex-shrink-0">
                            <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-orange-400" />{post.likes}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" />{post.comments}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : null}

              {/* NEWS */}
              {tab === 'news' ? (
                <motion.div key="news" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Newspaper className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Announcements & News</h3>
                    <span className="ml-auto text-[10px] text-white/30">{news.length} stories</span>
                  </div>
                  {news.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/15 hover:border-purple-500/30 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <p className="text-sm text-white font-semibold leading-snug group-hover:text-purple-400 transition-colors">{n.title}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20 font-bold flex-shrink-0">{n.tag}</span>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed mb-2">{n.summary}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-white/25">{formatDistanceToNow(n.time, { addSuffix: true })}</p>
                        <span className="text-[10px] text-purple-400/60 flex items-center gap-1"><Eye className="w-2.5 h-2.5" />Read more</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : null}

            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Game skeleton ─────────────────────────────────────────────────────────
function GameSkeleton(): React.ReactElement {
  return (
    <div className="gaming-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse" />
        <div className="w-16 h-5 rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-white/10 rounded w-full animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-5/6 animate-pulse" />
      </div>
      <div className="h-9 bg-white/10 rounded-xl animate-pulse" />
    </div>
  );
}

// ── Featured banner ───────────────────────────────────────────────────────
function FeaturedBanner({ game, symbol, onClick }: { game: Game; symbol: string; onClick: () => void }): React.ReactElement {
  const players = game.player_count >= 1000 ? (game.player_count / 1000).toFixed(1) + 'K' : String(game.player_count);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="max-w-7xl mx-auto mb-10 cursor-pointer group" onClick={onClick}>
      <div className="gaming-card p-7 md:p-10 relative overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
        {game.logo_url ? (
          <div className="absolute inset-0 overflow-hidden">
            <img src={game.logo_url} alt="" className="w-full h-full object-cover opacity-15 scale-105 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-cyan-500/10" />
        )}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500">
              <Star className="w-3 h-3 mr-1 fill-current" />Featured Game
            </Badge>
            <h2 className="font-orbitron text-3xl md:text-4xl font-black mb-3 group-hover:text-cyan-400 transition-colors">{game.name}</h2>
            <p className="text-muted-foreground mb-6 line-clamp-2">{game.description}</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Players',    value: players,                   color: 'text-cyan-400' },
                { label: 'Prize Pool', value: symbol + '0',              color: 'text-yellow-400' },
                { label: 'Events',     value: game.tournament_count + '+', color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className={'font-orbitron text-xl font-black ' + s.color}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2">
              <Gamepad2 className="w-4 h-4" />View Details <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="relative hidden lg:block">
            <div className="aspect-square max-w-xs mx-auto rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-yellow-500/20 via-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              {game.logo_url ? <img src={game.logo_url} alt={game.name} className="w-full h-full object-cover" /> : <span className="text-9xl">{game.icon}</span>}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Game card — fully clickable, deep-link to tab ─────────────────────────
function GameCard({ game, index, onOpen }: {
  game: Game;
  index: number;
  onOpen: (tab?: 'overview' | 'tournaments' | 'updates' | 'news') => void;
}): React.ReactElement {
  const badgeColor = game.badge ? (BADGE_COLORS[game.badge] ?? 'bg-purple-500') : '';
  const players = game.player_count >= 1000 ? (game.player_count / 1000).toFixed(1) + 'K' : String(game.player_count);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.06 }}>
      {/* Entire card is one clickable block */}
      <div
        className="gaming-card p-5 h-full flex flex-col cursor-pointer hover:border-cyan-500/30 hover:shadow-cyan-500/10 hover:shadow-lg transition-all duration-300 group select-none"
        onClick={() => onOpen('overview')}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen('overview')}
      >
        {/* Logo + badge */}
        <div className="flex items-start justify-between mb-4">
          <GameLogo game={game} size="sm" className="group-hover:border-cyan-500/30 transition-colors" />
          {game.badge ? (
            <Badge className={badgeColor + ' text-white text-[10px] gap-1'}>
              <Sparkles className="w-2.5 h-2.5" />{game.badge}
            </Badge>
          ) : null}
        </div>

        {/* Name + category */}
        <h3 className="font-orbitron text-base font-black mb-0.5 leading-snug group-hover:text-cyan-400 transition-colors">{game.name}</h3>
        <span className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{game.category}</span>
        <p className="text-muted-foreground text-xs mb-4 flex-1 leading-relaxed line-clamp-3">{game.description}</p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-cyan-400" />{players}</div>
          <div className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-purple-400" />{game.tournament_count} events</div>
        </div>

        {/* Quick-action buttons — stop propagation to open specific tab */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { tab: 'tournaments' as const, label: 'Events',  icon: Trophy,    cls: 'border-purple-500/25 hover:bg-purple-500/10 text-purple-300' },
            { tab: 'updates'     as const, label: 'Updates', icon: Activity,  cls: 'border-cyan-500/25 hover:bg-cyan-500/10 text-cyan-300' },
            { tab: 'news'        as const, label: 'News',    icon: Newspaper, cls: 'border-pink-500/25 hover:bg-pink-500/10 text-pink-300' },
          ].map(btn => (
            <button
              key={btn.tab}
              className={'flex items-center justify-center gap-1 h-8 rounded-lg border bg-white/4 text-[10px] font-bold transition-all active:scale-95 ' + btn.cls}
              onClick={(e) => { e.stopPropagation(); onOpen(btn.tab); }}
              title={'View ' + btn.label}
            >
              <btn.icon className="w-3 h-3" />{btn.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyGames({ isFiltered, onClear }: { isFiltered: boolean; onClear: () => void }): React.ReactElement {
  return (
    <div className="text-center py-20 col-span-3">
      <Gamepad2 className="w-16 h-16 mx-auto text-white/20 mb-4" />
      <h3 className="font-orbitron text-xl font-bold text-white mb-2">No games found</h3>
      <p className="text-white/40 text-sm mb-6">
        {isFiltered ? 'Try a different category or search term.' : 'No games have been added yet.'}
      </p>
      {isFiltered ? <Button onClick={onClear} variant="outline" className="border-white/20 text-white hover:bg-white/10">Clear Filters</Button> : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export function Games(): React.ReactElement {
  const { symbol } = useCurrency();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<Game | null>(null);
  const [openTab, setOpenTab] = useState<'overview' | 'tournaments' | 'updates' | 'news'>('overview');

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase.from('games').select('*')
      .order('featured', { ascending: false })
      .order('player_count', { ascending: false });
    if (error) setFetchError(error.message);
    else setAllGames((data as Game[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const open = (game: Game, tab: 'overview' | 'tournaments' | 'updates' | 'news' = 'overview') => {
    setSelected(game);
    setOpenTab(tab);
  };

  const featured = allGames.find(g => g.featured);
  const isFiltered = search.trim() !== '' || category !== 'all';

  const filtered = allGames.filter(g => {
    if (g.featured && !isFiltered) return false;
    const q = search.toLowerCase();
    return (g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
      && (category === 'all' || g.category === category);
  });

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto text-center mb-10">
        <h1 className="font-orbitron text-4xl md:text-5xl font-black mb-4">
          Trending <span className="gradient-text">Mobile Games</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Click any card to explore details — or jump straight to Updates, Events, or News
        </p>
      </motion.div>

      {/* Search + filter bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="max-w-4xl mx-auto mb-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input placeholder="Search games, categories…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
            {search ? (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {CATEGORIES.map(c => (
              <Button key={c.value} size="sm" onClick={() => setCategory(c.value)}
                className={'rounded-full flex-shrink-0 text-xs h-9 px-4 ' + (category === c.value
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                  : 'bg-white/5 border border-white/10 text-white/55 hover:bg-white/10 hover:text-white')}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Result count */}
        {!loading && allGames.length > 0 && (
          <p className="text-[11px] text-white/25 mt-2 pl-1">
            {isFiltered ? `${filtered.length} of ${allGames.length} games` : `${allGames.length} games`} · click a card to open, or use the tab buttons
          </p>
        )}
      </motion.div>

      {fetchError ? (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <Button onClick={load} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          </div>
        </div>
      ) : loading ? (
        <>
          <div className="max-w-7xl mx-auto mb-10">
            <div className="gaming-card p-8 h-52 animate-pulse bg-white/5" />
          </div>
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => <GameSkeleton key={i} />)}
          </div>
        </>
      ) : (
        <>
          {featured && !isFiltered ? (
            <FeaturedBanner game={featured} symbol={symbol} onClick={() => open(featured)} />
          ) : null}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.length > 0
                ? filtered.map((g, i) => <GameCard key={g.id} game={g} index={i} onOpen={(tab) => open(g, tab)} />)
                : <EmptyGames isFiltered={isFiltered} onClear={() => { setSearch(''); setCategory('all'); }} />
              }
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {selected ? (
          <GameDetailPanel key={selected.id} game={selected} symbol={symbol}
            initialTab={openTab} onClose={() => setSelected(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
