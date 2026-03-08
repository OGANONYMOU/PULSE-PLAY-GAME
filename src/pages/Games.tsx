import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Gamepad2, Users, Trophy, Star, Sparkles, RefreshCw,
  X, ArrowRight, Clock, Play, CheckCircle, Zap, Bell, ChevronRight,
  MessageSquare, Activity,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatDistanceToNow } from 'date-fns';

type Game = {
  id: string;
  name: string;
  description: string;
  icon: string;
  logo_url: string | null;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: string;
  featured: boolean;
  created_at: string;
};

type Tournament = {
  id: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
};

type Post = {
  id: string;
  title: string;
  content: string;
  tag: string;
  likes: number;
  comments: number;
  created_at: string;
  profiles: { username: string } | null;
};

const CATEGORIES = [
  { value: 'all',           label: 'All Games' },
  { value: 'fps',           label: 'FPS' },
  { value: 'battle-royale', label: 'Battle Royale' },
  { value: 'moba',          label: 'MOBA' },
  { value: 'sports',        label: 'Sports' },
  { value: 'fighting',      label: 'Fighting' },
];

const BADGE_COLORS: Record<string, string> = {
  'Most Popular': 'bg-purple-500',
  Trending:       'bg-cyan-500',
  New:            'bg-pink-500',
  Featured:       'bg-yellow-500',
  Hot:            'bg-red-500',
  Popular:        'bg-purple-500',
};

const STATUS_META = {
  upcoming:  { icon: Clock,        color: 'text-blue-400',  bg: 'bg-blue-500/15 border-blue-500/30',   label: 'Upcoming' },
  ongoing:   { icon: Play,         color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', label: 'Live 🔴' },
  completed: { icon: CheckCircle,  color: 'text-white/40',  bg: 'bg-white/8 border-white/10',           label: 'Done' },
};

// ── Game logo component ───────────────────────────────────────────────────
function GameLogo(p: { game: Game; size?: 'sm' | 'md' | 'lg' }): React.ReactElement {
  const [err, setErr] = useState(false);
  const sz = p.size === 'lg' ? 'w-24 h-24 text-5xl' : p.size === 'md' ? 'w-20 h-20 text-4xl' : 'w-14 h-14 text-2xl';
  const hasLogo = p.game.logo_url && !err;
  return (
    <div className={sz + ' rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 border border-white/10'}>
      {hasLogo ? (
        <img
          src={p.game.logo_url!}
          alt={p.game.name}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        <span>{p.game.icon}</span>
      )}
    </div>
  );
}

// ── Game Detail Panel ─────────────────────────────────────────────────────
function GameDetailPanel(p: { game: Game; onClose: () => void; symbol: string }): React.ReactElement {
  const [tab, setTab] = useState<'overview' | 'tournaments' | 'updates'>('overview');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('id,name,status,date,prize_pool,max_players,current_players')
          .eq('game_id', p.game.id).order('date', { ascending: false }).limit(10),
        supabase.from('posts').select('id,title,content,tag,likes,comments,created_at,profiles(username)')
          .eq('tag', 'tournament').order('created_at', { ascending: false }).limit(8),
      ]);
      if (!tRes.error) setTournaments((tRes.data as Tournament[]) ?? []);
      if (!pRes.error) setPosts((pRes.data as Post[]) ?? []);
      setLoading(false);
    };
    load();
  }, [p.game.id]);

  const players = p.game.player_count >= 1000
    ? (p.game.player_count / 1000).toFixed(1) + 'K'
    : String(p.game.player_count);

  const TABS = [
    { id: 'overview'    as const, label: 'Overview',    icon: Gamepad2      },
    { id: 'tournaments' as const, label: 'Tournaments',  icon: Trophy        },
    { id: 'updates'     as const, label: 'Updates',      icon: Activity      },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}
    >
      <motion.div
        ref={panelRef}
        initial={{ y: 80, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-2xl bg-card border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Hero header */}
        <div className="relative overflow-hidden flex-shrink-0">
          {/* Background blur from logo */}
          {p.game.logo_url ? (
            <div className="absolute inset-0 overflow-hidden">
              <img src={p.game.logo_url} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-card/60 to-card" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-card" />
          )}

          <div className="relative z-10 p-6 flex items-start gap-5">
            <GameLogo game={p.game} size="lg" />
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-orbitron font-black text-xl text-white">{p.game.name}</h2>
                {p.game.badge ? (
                  <span className={'text-[10px] px-2 py-0.5 rounded-full text-white font-bold ' + (BADGE_COLORS[p.game.badge] ?? 'bg-purple-500')}>
                    {p.game.badge}
                  </span>
                ) : null}
                {p.game.featured ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : null}
              </div>
              <p className="text-xs text-white/50 capitalize mb-3">{p.game.category}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Users className="w-3.5 h-3.5" />{players}
                </span>
                <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <Trophy className="w-3.5 h-3.5" />{p.game.tournament_count} events
                </span>
                <span className="text-white/30 text-xs capitalize">{p.game.category}</span>
              </div>
            </div>
            <button onClick={p.onClose} className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="relative z-10 flex border-t border-white/10">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all ' +
                  (tab === t.id ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-white/40 hover:text-white/70 hover:bg-white/5')}
              >
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}</div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' ? (
                <div className="space-y-5">
                  <p className="text-white/60 text-sm leading-relaxed">{p.game.description || 'No description available.'}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Players',     value: players,                     icon: Users,   color: 'text-cyan-400'   },
                      { label: 'Tournaments', value: String(p.game.tournament_count), icon: Trophy,  color: 'text-purple-400' },
                      { label: 'Prize Pool',  value: p.symbol + '0',              icon: Zap,     color: 'text-yellow-400' },
                    ].map(s => (
                      <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/8 text-center">
                        <s.icon className={'w-5 h-5 mx-auto mb-2 ' + s.color} />
                        <div className="font-orbitron font-black text-lg text-white">{s.value}</div>
                        <div className="text-[10px] text-white/35 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <Button asChild className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2">
                    <Link to="/tournaments" onClick={p.onClose}>
                      <Trophy className="w-4 h-4" />Join a Tournament <ArrowRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                </div>
              ) : null}

              {/* TOURNAMENTS TAB */}
              {tab === 'tournaments' ? (
                <div className="space-y-2">
                  {tournaments.length === 0 ? (
                    <div className="text-center py-12">
                      <Trophy className="w-10 h-10 mx-auto text-white/15 mb-3" />
                      <p className="text-white/35 text-sm">No tournaments yet for this game.</p>
                      <Button asChild size="sm" className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs">
                        <Link to="/tournaments" onClick={p.onClose}>View All Tournaments</Link>
                      </Button>
                    </div>
                  ) : (
                    tournaments.map((t, i) => {
                      const meta = STATUS_META[t.status];
                      const StatusIcon = meta.icon;
                      return (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all"
                        >
                          <div className={'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-bold flex-shrink-0 ' + meta.bg + ' ' + meta.color}>
                            <StatusIcon className="w-2.5 h-2.5" />{meta.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-orbitron font-bold text-xs text-white truncate">{t.name}</p>
                            <p className="text-[10px] text-white/35">{t.current_players}/{t.max_players} players · {p.symbol}{t.prize_pool}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                        </motion.div>
                      );
                    })
                  )}
                  {tournaments.length > 0 ? (
                    <Button asChild variant="ghost" size="sm" className="w-full border border-white/10 text-white/50 hover:text-white text-xs mt-2">
                      <Link to="/tournaments" onClick={p.onClose}>See All Tournaments <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* UPDATES TAB */}
              {tab === 'updates' ? (
                <div className="space-y-2">
                  {posts.length === 0 ? (
                    <div className="text-center py-12">
                      <Bell className="w-10 h-10 mx-auto text-white/15 mb-3" />
                      <p className="text-white/35 text-sm">No community updates yet.</p>
                      <Button asChild size="sm" className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs">
                        <Link to="/community" onClick={p.onClose}>Go to Community</Link>
                      </Button>
                    </div>
                  ) : (
                    posts.map((post, i) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-cyan-400">{post.profiles?.username ?? 'Unknown'}</span>
                          <span className="text-[10px] text-white/25 ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                        </div>
                        <p className="font-orbitron font-bold text-xs text-white mb-1 truncate">{post.title}</p>
                        <p className="text-[11px] text-white/40 line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/25">
                          <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-orange-400" />{post.likes}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" />{post.comments}</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Game card skeleton ────────────────────────────────────────────────────
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
function FeaturedBanner(p: { game: Game; symbol: string; onClick: () => void }): React.ReactElement {
  const g = p.game;
  const players = g.player_count >= 1000 ? (g.player_count / 1000).toFixed(1) + 'K' : String(g.player_count);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="max-w-7xl mx-auto mb-10 cursor-pointer group"
      onClick={p.onClick}
    >
      <div className="gaming-card p-7 md:p-10 relative overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
        {g.logo_url ? (
          <div className="absolute inset-0 overflow-hidden">
            <img src={g.logo_url} alt="" className="w-full h-full object-cover opacity-15 scale-105 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-cyan-500/10" />
        )}

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500">
              <Star className="w-3 h-3 mr-1 fill-current" />Featured Game of the Month
            </Badge>
            <h2 className="font-orbitron text-3xl md:text-4xl font-black mb-3 group-hover:text-cyan-400 transition-colors">{g.name}</h2>
            <p className="text-muted-foreground mb-6 line-clamp-2">{g.description}</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Players',    value: players,         color: 'text-cyan-400'   },
                { label: 'Prize Pool', value: p.symbol + '0',  color: 'text-yellow-400' },
                { label: 'Events',     value: g.tournament_count + '+', color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className={'font-orbitron text-xl font-black ' + s.color}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2">
              <Gamepad2 className="w-4 h-4" />View Game Details <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="relative hidden lg:block">
            <div className="aspect-square max-w-xs mx-auto rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-yellow-500/20 via-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              {g.logo_url ? (
                <img src={g.logo_url} alt={g.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-9xl">{g.icon}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────
function GameCard(p: { game: Game; index: number; onClick: () => void }): React.ReactElement {
  const g = p.game;
  const badgeColor = g.badge ? (BADGE_COLORS[g.badge] ?? 'bg-purple-500') : '';
  const players = g.player_count >= 1000 ? (g.player_count / 1000).toFixed(1) + 'K' : String(g.player_count);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: p.index * 0.06 }}
    >
      <div
        className="gaming-card p-5 h-full flex flex-col cursor-pointer hover:border-cyan-500/30 hover:shadow-cyan-500/10 hover:shadow-lg transition-all duration-300 group"
        onClick={p.onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && p.onClick()}
      >
        {/* Top row: logo + badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 group-hover:border-cyan-500/30 transition-colors">
            <GameLogo game={g} size="sm" />
          </div>
          {g.badge ? (
            <Badge className={badgeColor + ' text-white text-[10px] gap-1'}>
              <Sparkles className="w-2.5 h-2.5" />{g.badge}
            </Badge>
          ) : null}
        </div>

        {/* Name + category */}
        <h3 className="font-orbitron text-base font-black mb-1 leading-snug group-hover:text-cyan-400 transition-colors">{g.name}</h3>
        <span className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{g.category}</span>
        <p className="text-muted-foreground text-xs mb-4 flex-1 leading-relaxed line-clamp-3">{g.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-cyan-400" />{players}</div>
          <div className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-purple-400" />{g.tournament_count} events</div>
        </div>

        {/* Action button */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-purple-500/30 hover:bg-purple-500/10 text-xs gap-1.5 w-full"
            onClick={(e) => { e.stopPropagation(); p.onClick(); }}
          >
            <Gamepad2 className="w-3.5 h-3.5" />Details
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-cyan-500/80 to-purple-600/80 text-white text-xs gap-1.5 w-full hover:from-cyan-500 hover:to-purple-600"
            onClick={(e) => { e.stopPropagation(); p.onClick(); }}
          >
            <Activity className="w-3.5 h-3.5" />Updates
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyGames(p: { isFiltered: boolean; onClear: () => void }): React.ReactElement {
  return (
    <div className="text-center py-20 col-span-3">
      <Gamepad2 className="w-16 h-16 mx-auto text-white/20 mb-4" />
      <h3 className="font-orbitron text-xl font-bold text-white mb-2">No games found</h3>
      <p className="text-white/40 text-sm mb-6">
        {p.isFiltered ? 'Try a different category or search term.' : 'No games have been added yet.'}
      </p>
      {p.isFiltered ? (
        <Button onClick={p.onClear} variant="outline" className="border-white/20 text-white hover:bg-white/10">Clear Filters</Button>
      ) : null}
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

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase
      .from('games').select('*')
      .order('featured', { ascending: false })
      .order('player_count', { ascending: false });
    if (error) { setFetchError(error.message); }
    else { setAllGames((data as Game[]) ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const featured = allGames.find(g => g.featured);
  const isFiltered = search.trim() !== '' || category !== 'all';

  const filtered = allGames.filter(g => {
    if (g.featured && !isFiltered) return false;
    const q = search.toLowerCase();
    const matchSearch = g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    const matchCat = category === 'all' || g.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen pt-24 px-4 sm:px-6 pb-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto text-center mb-10">
        <h1 className="font-orbitron text-4xl md:text-5xl font-black mb-4">
          Trending <span className="gradient-text">Mobile Games</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Click any card to explore tournaments, updates, and stats
        </p>
      </motion.div>

      {/* Search + filter */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="max-w-4xl mx-auto mb-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search games…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map(c => (
              <Button key={c.value} size="sm" onClick={() => setCategory(c.value)}
                className={'rounded-full flex-shrink-0 text-xs h-9 ' + (category === c.value
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white')}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>
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
            <FeaturedBanner game={featured} symbol={symbol} onClick={() => setSelected(featured)} />
          ) : null}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.length > 0
                ? filtered.map((g, i) => <GameCard key={g.id} game={g} index={i} onClick={() => setSelected(g)} />)
                : <EmptyGames isFiltered={isFiltered} onClear={() => { setSearch(''); setCategory('all'); }} />
              }
            </div>
            {allGames.length > 0 ? (
              <p className="text-center text-white/25 text-xs mt-8">
                {filtered.length} game{filtered.length !== 1 ? 's' : ''} shown · click any card to explore
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* Game detail panel */}
      <AnimatePresence>
        {selected ? (
          <GameDetailPanel key={selected.id} game={selected} symbol={symbol} onClose={() => setSelected(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
