// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay — Game Hub (GameDetail.tsx)
// Transforms each game into a dedicated ecosystem: tournaments, clips,
// leaderboard, clans, discussions, news — all in one cinematic hub.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Gamepad2, Trophy, Users, ArrowLeft, Share2,
  Target, Shield, Calendar, ChevronRight,
  Star, MessageSquare, Play, Crown,
  Swords, Bell, BellOff, Plus, Heart,
  BarChart3, Medal, Loader2, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GameDetailSEO } from '@/components/SEO';
import { resolveGameImage } from '@/lib/gameImages';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  image_url: string | null;
  logo_url: string | null;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  follower_count: number;
  category: string;
  featured: boolean;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
  entry_fee: string | null;
  tournament_family: string | null;
  tournament_type: string | null;
}

interface Clip {
  id: string;
  title: string;
  object_key: string | null;
  thumbnail_key: string | null;
  likes_count: number;
  views_count: number;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

interface Club {
  id: string;
  name: string;
  tag: string;
  description: string;
  logo_url: string | null;
  member_count: number;
  wins: number;
  points: number;
  is_public: boolean;
  game_id: string | null;
  games: { name: string; icon: string } | null;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string; avatar_url: string | null } | null;
  tag: string;
  likes: number;
  comments: number;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  gamercred: number;
  pulse_points: number;
  tournament_wins: number;
  tournaments_played: number;
  rank: number;
}

interface GameNews {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'patch_notes' | 'esports' | 'featured' | 'announcement';
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

type HubTab = 'overview' | 'tournaments' | 'clips' | 'leaderboard' | 'clans' | 'discuss';
const HUB_TAB_VALUES: HubTab[] = ['overview', 'tournaments', 'clips', 'leaderboard', 'clans', 'discuss'];
function isHubTab(v: string | null): v is HubTab {
  return v !== null && (HUB_TAB_VALUES as string[]).includes(v);
}
type TournamentFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const BADGE_COLORS: Record<string, string> = {
  'Most Popular': 'bg-purple-500',
  Trending: 'bg-cyan-500',
  New: 'bg-pink-500',
  Featured: 'bg-yellow-500',
  Hot: 'bg-red-500',
};

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; accent: string }> = {
  fps:           { icon: <Target className="w-3.5 h-3.5" />, label: 'FPS',          accent: '#ef4444' },
  'battle-royale':{ icon: <Shield className="w-3.5 h-3.5" />, label: 'Battle Royale', accent: '#f97316' },
  football:      { icon: <span>⚽</span>,                      label: 'Football',      accent: '#22c55e' },
  sports:        { icon: <Trophy className="w-3.5 h-3.5" />,  label: 'Sports',        accent: '#3b82f6' },
  moba:          { icon: <Swords className="w-3.5 h-3.5" />,  label: 'MOBA',          accent: '#a855f7' },
  'card-game':   { icon: <span>🃏</span>,                      label: 'Card Game',     accent: '#eab308' },
  racing:        { icon: <span>🏎️</span>,                      label: 'Racing',        accent: '#06b6d4' },
  other:         { icon: <Gamepad2 className="w-3.5 h-3.5" />,label: 'Gaming',         accent: '#6b7280' },
};

const NEWS_TYPE: Record<string, { label: string; cls: string }> = {
  update:       { label: 'Update',       cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25'   },
  patch_notes:  { label: 'Patch Notes',  cls: 'bg-green-500/15 text-green-400 border-green-500/25' },
  esports:      { label: 'Esports',      cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  featured:     { label: 'Featured',     cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  announcement: { label: 'Announcement', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'   },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  const display = typeof value === 'number' && value >= 1000
    ? `${(value / 1000).toFixed(1)}K`
    : String(value);
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/6 border border-white/10 select-none">
      <span className="text-cyan-400">{icon}</span>
      <span className="text-xs font-bold text-white">{display}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

function EmptyState({
  icon, title, description, action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-16">
      <div className="text-white/12 mb-4 flex justify-center">{icon}</div>
      <h3 className="font-orbitron font-bold text-sm text-white mb-1.5">{title}</h3>
      <p className="text-white/35 text-xs max-w-xs mx-auto mb-4">{description}</p>
      {action && (
        <Button asChild size="sm" variant="outline" className="border-white/20 hover:border-white/40 text-white/60 hover:text-white">
          <Link to={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

// ── Tournament card ───────────────────────────────────────────────────────────
function HubTournamentCard({ t, game }: { t: Tournament; game: Game }) {
  const STATUS = {
    upcoming:  { label: 'Upcoming', cls: 'text-cyan-400 bg-cyan-500/12 border-cyan-500/25' },
    ongoing:   { label: '● LIVE',   cls: 'text-green-400 bg-green-500/12 border-green-500/25 animate-pulse' },
    completed: { label: 'Ended',    cls: 'text-white/35 bg-white/5 border-white/10' },
  };
  const s = STATUS[t.status] ?? STATUS.upcoming;
  const fill = Math.min(100, Math.round((t.current_players / t.max_players) * 100));
  const isLeague = t.tournament_family === 'football' || t.tournament_family === 'league';

  return (
    <Link to={`/tournaments/${t.id}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="rounded-2xl bg-white/[0.03] border border-white/8 hover:border-cyan-500/30 hover:bg-white/[0.055] p-4 transition-colors group cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{game.icon}</span>
            <div className="min-w-0">
              {isLeague && (
                <div className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">
                  {t.tournament_family === 'football' ? 'Football League' : 'League'}
                </div>
              )}
            </div>
          </div>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0', s.cls)}>
            {s.label}
          </span>
        </div>

        <h3 className="font-orbitron font-bold text-sm text-white mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
          {t.name}
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-white/40 mb-3">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            {t.prize_pool}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(t.date), 'MMM d, yyyy')}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{t.current_players}/{t.max_players} players</span>
            <span>{fill}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all duration-500"
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────
function LbRow({ entry }: { entry: LeaderboardEntry }) {
  const MEDAL = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
  const isTop3 = entry.rank <= 3;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: entry.rank * 0.03, duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        entry.rank === 1
          ? 'bg-yellow-500/6 border-yellow-500/18'
          : 'bg-white/[0.02] border-white/6 hover:border-white/12',
      )}
    >
      <div className="w-7 text-center flex-shrink-0">
        {isTop3
          ? <Medal className={cn('w-4 h-4 mx-auto', MEDAL[entry.rank - 1])} />
          : <span className="text-[11px] text-white/25 font-mono font-bold">{entry.rank}</span>
        }
      </div>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={entry.avatar_url ?? undefined} />
        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px] font-bold">
          {entry.username?.[0]?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate leading-none mb-0.5">{entry.username}</div>
        <div className="text-[10px] text-white/35">
          {entry.tournaments_played} {entry.tournaments_played === 1 ? 'tournament' : 'tournaments'}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-cyan-400 tabular-nums">
          {(entry.gamercred ?? 0).toLocaleString()}
        </div>
        <div className="text-[9px] text-white/30 uppercase tracking-wider">GamerCred</div>
      </div>
      {entry.tournament_wins > 0 && (
        <div className="flex-shrink-0 px-2 py-0.5 rounded-full bg-yellow-500/12 border border-yellow-500/22">
          <span className="text-[10px] text-yellow-400 font-bold">🏆 {entry.tournament_wins}W</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Clan card ─────────────────────────────────────────────────────────────────
function ClanCard({ club }: { club: Club }) {
  return (
    <Link to="/clubs">
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="rounded-2xl bg-white/[0.03] border border-white/8 hover:border-purple-500/30 p-4 transition-colors group"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-purple-600/30 to-cyan-600/30 border border-white/8 flex items-center justify-center flex-shrink-0">
            {club.logo_url
              ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
              : <span className="font-orbitron font-black text-white text-base">{club.tag?.[0] ?? '?'}</span>
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] text-purple-400 font-bold tracking-wider mb-0.5">[{club.tag}]</div>
            <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
              {club.name}
            </div>
          </div>
        </div>

        {club.description && (
          <p className="text-[11px] text-white/40 line-clamp-2 mb-3 leading-relaxed">{club.description}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/6">
          <div className="flex items-center gap-3 text-[10px] text-white/35">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{club.member_count}
            </span>
            {club.wins > 0 && (
              <span className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-500/70" />{club.wins}W
              </span>
            )}
          </div>
          <span className={cn(
            'text-[9px] px-2 py-0.5 rounded-full border font-semibold',
            club.is_public
              ? 'text-green-400 bg-green-500/12 border-green-500/22'
              : 'text-white/35 bg-white/5 border-white/10'
          )}>
            {club.is_public ? 'Open' : 'Invite Only'}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────
function NewsCard({ news }: { news: GameNews }) {
  const t = NEWS_TYPE[news.type] ?? NEWS_TYPE.announcement;
  return (
    <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.025] border border-white/6 hover:border-white/12 transition-colors">
      {news.is_pinned && <div className="w-0.5 rounded-full bg-cyan-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-bold', t.cls)}>{t.label}</span>
          {news.is_pinned && <span className="text-[9px] text-cyan-400 font-bold">📌 Pinned</span>}
          <span className="text-[10px] text-white/25 ml-auto">
            {formatDistanceToNow(new Date(news.created_at), { addSuffix: true })}
          </span>
        </div>
        <h4 className="text-sm font-semibold text-white mb-0.5 line-clamp-1">{news.title}</h4>
        <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">{news.content}</p>
      </div>
    </div>
  );
}

// ── Mini clip card ────────────────────────────────────────────────────────────
function ClipMini({ clip, full = false }: { clip: Clip; full?: boolean }) {
  return (
    <Link to="/clips">
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'rounded-xl overflow-hidden bg-white/[0.04] border border-white/8',
          'hover:border-cyan-500/30 transition-colors group',
          full && 'flex gap-3 p-3 rounded-2xl',
        )}
      >
        <div className={cn(
          'bg-gradient-to-br from-purple-900/60 to-cyan-900/60 flex items-center justify-center relative overflow-hidden',
          full ? 'w-20 h-14 rounded-lg flex-shrink-0' : 'aspect-video',
        )}>
          <Play className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
        </div>
        <div className={cn('p-2.5', full && 'flex-1 min-w-0 p-0')}>
          <h4 className="text-xs font-semibold text-white line-clamp-1 mb-1">{clip.title}</h4>
          <div className="flex items-center justify-between text-[10px] text-white/35">
            <span>{clip.profiles?.username ?? 'Player'}</span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-pink-400/80" />{clip.likes_count}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Discussion post row ───────────────────────────────────────────────────────
function DiscussRow({ post }: { post: Post }) {
  return (
    <Link to="/community">
      <div className="flex gap-3 p-4 rounded-xl bg-white/[0.025] border border-white/6 hover:border-white/14 transition-colors group">
        <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
          <AvatarImage src={post.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px] font-bold">
            {post.author?.username?.[0]?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors line-clamp-1 mb-0.5">
            {post.title}
          </h4>
          <p className="text-[11px] text-white/35 line-clamp-1 mb-1.5">{post.content}</p>
          <div className="flex items-center gap-3 text-[10px] text-white/25">
            <span>{post.author?.username}</span>
            <span className="flex items-center gap-1"><Heart className="w-2.5 h-2.5" />{post.likes}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" />{post.comments}</span>
            <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function GameHubSkeleton() {
  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-16 animate-pulse">
      <div className="h-56 bg-white/4" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="h-5 bg-white/5 rounded w-32 mb-2" />
        <div className="h-8 bg-white/5 rounded w-56 mb-3" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(i => <div key={i} className="h-7 bg-white/5 rounded-full w-24" />)}
        </div>
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-9 bg-white/5 rounded-lg w-28" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/4 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function GameDetail(): React.ReactElement {
  const { id: gameId } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // Core data
  const [game, setGame]           = useState<Game | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<HubTab>(isHubTab(tabParam) ? tabParam : 'overview');

  // Per-tab data
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [clips, setClips]             = useState<Clip[]>([]);
  const [clubs, setClubs]             = useState<Club[]>([]);
  const [posts, setPosts]             = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [news, setNews]               = useState<GameNews[]>([]);

  // UI state
  const [isFollowing, setIsFollowing]       = useState(false);
  const [followLoading, setFollowLoading]   = useState(false);
  const [tournamentFilter, setTournamentFilter] = useState<TournamentFilter>('all');
  const [lbLoading, setLbLoading]           = useState(false);
  const didLoadSecondary = useRef(false);

  // ── Primary data load ───────────────────────────────────────────────────────
  const loadPrimary = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);

    const [gRes, tRes, clipRes, clubRes, postRes] = await Promise.all([
      (supabase as any).from('games').select('*').eq('id', gameId).single(),

      supabase.from('tournaments')
        .select('id, name, status, date, prize_pool, max_players, current_players, entry_fee, tournament_family, tournament_type')
        .eq('game_id', gameId)
        .order('date', { ascending: true })
        .limit(24),

      (supabase as any).from('clips')
        .select('id, title, object_key, thumbnail_key, likes_count, views_count, created_at, profiles(username, avatar_url)')
        .eq('game_id', gameId)
        .order('likes_count', { ascending: false })
        .limit(12),

      (supabase as any).from('clubs')
        .select('id, name, tag, description, logo_url, member_count, wins, points, is_public, game_id, games(name, icon)')
        .eq('game_id', gameId)
        .order('member_count', { ascending: false })
        .limit(12),

      (supabase as any).from('posts')
        .select('id, title, content, tag, likes, comments, created_at, author:profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    if (gRes.error || !gRes.data) {
      setError('Game not found');
      setLoading(false);
      return;
    }

    setGame(gRes.data as unknown as Game);
    setTournaments((tRes.data ?? []) as unknown as Tournament[]);
    setClips((clipRes.data ?? []) as unknown as Clip[]);
    setClubs((clubRes.data ?? []) as unknown as Club[]);

    // Normalise author: PostgREST can return array or object
    const rawPosts = (postRes.data ?? []) as unknown as Array<Post & { author: Post['author'] | Post['author'][] }>;
    setPosts(rawPosts.map(p => ({
      ...p,
      author: Array.isArray(p.author) ? p.author[0] : p.author,
    })));

    setLoading(false);
  }, [gameId]);

  // ── Secondary data load (follow status, leaderboard, news) ─────────────────
  const loadSecondary = useCallback(async () => {
    if (!gameId || didLoadSecondary.current) return;
    didLoadSecondary.current = true;

    // Follow status
    if (user) {
      const { data: fData } = await (supabase as any)
        .from('game_follows')
        .select('id')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsFollowing(!!fData);
    }

    // Leaderboard: 2-step query to avoid complex join
    setLbLoading(true);
    try {
      const { data: tIds } = await supabase
        .from('tournaments')
        .select('id')
        .eq('game_id', gameId);

      if (tIds && tIds.length > 0) {
        const ids = tIds.map((t: { id: string }) => t.id);
        const { data: participants } = await (supabase as any)
          .from('tournament_participants')
          .select('user_id, final_placement, profiles(username, avatar_url, gamercred_score, pulse_points)')
          .in('tournament_id', ids)
          .limit(200);

        if (participants && participants.length > 0) {
          type RawParticipant = {
            user_id: string;
            final_placement: number | null;
            profiles: { username: string; avatar_url: string | null; gamercred_score: number | null; pulse_points: number | null } | null;
          };

          const map = new Map<string, LeaderboardEntry>();

          (participants as unknown as RawParticipant[]).forEach(p => {
            const prof = p.profiles;
            if (!prof) return;
            const existing = map.get(p.user_id);
            if (!existing) {
              map.set(p.user_id, {
                user_id: p.user_id,
                username: prof.username,
                avatar_url: prof.avatar_url,
                gamercred: prof.gamercred_score ?? 0,
                pulse_points: prof.pulse_points ?? 0,
                tournament_wins: p.final_placement === 1 ? 1 : 0,
                tournaments_played: 1,
                rank: 0,
              });
            } else {
              existing.tournaments_played++;
              if (p.final_placement === 1) existing.tournament_wins++;
            }
          });

          const sorted = Array.from(map.values())
            .sort((a, b) => b.gamercred - a.gamercred || b.tournament_wins - a.tournament_wins)
            .slice(0, 25)
            .map((e, i) => ({ ...e, rank: i + 1 }));

          setLeaderboard(sorted);
        }
      }
    } catch (err) {
      console.error('[GameHub] leaderboard load error:', err);
    } finally {
      setLbLoading(false);
    }

    // Game news
    const { data: newsData } = await (supabase as any)
      .from('game_news')
      .select('*, profiles(username, avatar_url)')
      .eq('game_id', gameId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8);

    if (newsData) setNews(newsData as unknown as GameNews[]);
  }, [gameId, user]);

  useEffect(() => {
    loadPrimary();
    return () => { didLoadSecondary.current = false; };
  }, [loadPrimary]);

  useEffect(() => {
    if (!loading && game) loadSecondary();
  }, [loading, game, loadSecondary]);

  // ── Follow / Unfollow ───────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!isAuthenticated || !user) { toast.error('Sign in to follow games'); return; }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await (supabase as any).from('game_follows').delete().eq('game_id', gameId!).eq('user_id', user.id);
        setIsFollowing(false);
        setGame(prev => prev ? { ...prev, follower_count: Math.max(0, (prev.follower_count || 0) - 1) } : prev);
      } else {
        await (supabase as any).from('game_follows').insert({ game_id: gameId!, user_id: user.id });
        setIsFollowing(true);
        setGame(prev => prev ? { ...prev, follower_count: (prev.follower_count || 0) + 1 } : prev);
        toast.success(`Following ${game?.name}! 🎮`);
      }
    } catch {
      toast.error('Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url = `${window.location.origin}/games/${gameId}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${game?.name} on PulsePlay`, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  if (loading) return <GameHubSkeleton />;

  if (error || !game) {
    return (
      <div className="min-h-screen pt-20 sm:pt-24 px-4 pb-16 flex items-center justify-center">
        <div className="text-center">
          <Gamepad2 className="w-16 h-16 mx-auto text-white/15 mb-4" />
          <h1 className="font-orbitron text-2xl font-bold mb-2 text-white">{error ?? 'Game not found'}</h1>
          <Button asChild variant="outline" className="border-white/20">
            <Link to="/games"><ArrowLeft className="w-4 h-4 mr-2" />Back to Games</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cat     = CATEGORY_META[game.category] ?? CATEGORY_META.other;
  const badgeCls = game.badge ? (BADGE_COLORS[game.badge] ?? 'bg-purple-500') : '';
  const gameImg  = resolveGameImage(game.name, game.logo_url ?? game.image_url);
  const liveTournaments     = tournaments.filter(t => t.status === 'ongoing');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const filteredTournaments = tournamentFilter === 'all'
    ? tournaments
    : tournaments.filter(t => t.status === tournamentFilter);

  const HUB_TABS: { id: HubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview',     label: 'Overview',     icon: <Star className="w-3.5 h-3.5" /> },
    { id: 'tournaments',  label: 'Tournaments',  icon: <Trophy className="w-3.5 h-3.5" />, count: tournaments.length },
    { id: 'clips',        label: 'Clips',        icon: <Play className="w-3.5 h-3.5" />,  count: clips.length },
    { id: 'leaderboard',  label: 'Leaderboard',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'clans',        label: 'Clans',        icon: <Swords className="w-3.5 h-3.5" />, count: clubs.length },
    { id: 'discuss',      label: 'Discuss',      icon: <MessageSquare className="w-3.5 h-3.5" />, count: posts.length },
  ];

  return (
    <div className="min-h-screen pb-24">
      <GameDetailSEO name={game.name} />

      {/* ═══ CINEMATIC HERO ═══════════════════════════════════════════════════ */}
      <div className="relative pt-16 sm:pt-20 overflow-hidden">

        {/* Background layers */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 50% -10%,
                ${cat.accent}22 0%,
                ${cat.accent}08 40%,
                transparent 70%
              )
            `,
          }}
        />
        {gameImg && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src={gameImg}
              alt=""
              aria-hidden
              className="w-full h-full object-cover opacity-[0.04] scale-110 blur-2xl"
            />
          </div>
        )}

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-0">
          {/* Breadcrumb */}
          <Link
            to="/games"
            className="inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 mb-5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />Games
          </Link>

          {/* Hero row */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-6">

            {/* Game icon / cover */}
            <div className="flex-shrink-0">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shadow-xl"
                style={{ boxShadow: `0 0 30px ${cat.accent}30` }}
              >
                {gameImg ? (
                  <img
                    src={gameImg}
                    alt={game.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl leading-none">{game.icon}</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1"
                  style={{
                    borderColor: `${cat.accent}40`,
                    background: `${cat.accent}18`,
                    color: cat.accent,
                  }}
                >
                  {cat.icon}{cat.label}
                </span>
                {game.badge && (
                  <span className={cn('text-[10px] px-2.5 py-1 rounded-full text-white font-bold', badgeCls)}>
                    {game.badge}
                  </span>
                )}
                {liveTournaments.length > 0 && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {liveTournaments.length} LIVE
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="font-orbitron text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                {game.name}
              </h1>
              <p className="text-white/45 text-sm leading-relaxed mb-4 max-w-2xl line-clamp-2">
                {game.description}
              </p>

              {/* Stats pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                <StatPill icon={<Users className="w-3 h-3" />}    value={game.player_count || 0}       label="players" />
                <StatPill icon={<Trophy className="w-3 h-3" />}   value={tournaments.length}             label="tournaments" />
                <StatPill icon={<Swords className="w-3 h-3" />}   value={clubs.length}                   label="clans" />
                <StatPill icon={<Bell className="w-3 h-3" />}     value={fmt(game.follower_count || 0)}  label="following" />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={cn(
                    'gap-1.5 font-semibold h-8 px-3 text-xs transition-all',
                    isFollowing
                      ? 'bg-white/8 hover:bg-white/14 text-white border border-white/20'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90',
                  )}
                >
                  {followLoading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : isFollowing
                      ? <><BellOff className="w-3 h-3" />Following</>
                      : <><Bell className="w-3 h-3" />Follow</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShare}
                  className="border-white/18 hover:border-white/40 gap-1.5 h-8 px-3 text-xs text-white/60 hover:text-white"
                >
                  <Share2 className="w-3 h-3" />Share
                </Button>
                {upcomingTournaments.length > 0 && (
                  <Button
                    size="sm"
                    asChild
                    className="bg-white/6 hover:bg-white/12 text-white border border-white/14 gap-1.5 h-8 px-3 text-xs"
                  >
                    <Link to={`/tournaments?game=${gameId}`}>
                      <Zap className="w-3 h-3 text-yellow-400" />
                      {upcomingTournaments.length} Open {upcomingTournaments.length === 1 ? 'Tournament' : 'Tournaments'}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ═══ TAB BAR ═══════════════════════════════════════════════════════ */}
          <div
            className="flex items-center gap-0 overflow-x-auto scrollbar-none border-b border-white/8"
            role="tablist"
          >
            {HUB_TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold whitespace-nowrap',
                  'transition-all border-b-2 -mb-px outline-none',
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-white/38 hover:text-white/65 hover:border-white/20',
                )}
              >
                {tab.icon}
                {tab.label}
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className={cn(
                    'text-[8px] px-1.5 py-0.5 rounded-full font-black ml-0.5',
                    activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/8 text-white/35',
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TAB CONTENT ══════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-7">

                {/* Quick-stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Live Now',   val: liveTournaments.length > 0 ? `${liveTournaments.length} Live` : '—', color: 'text-green-400',  from: 'from-green-500/8' },
                    { label: 'Upcoming',   val: upcomingTournaments.length || '—',                                   color: 'text-cyan-400',   from: 'from-cyan-500/8'  },
                    { label: 'Clans',      val: clubs.length || '—',                                                  color: 'text-purple-400', from: 'from-purple-500/8'},
                    { label: 'Community',  val: fmt(game.player_count || 0),                                          color: 'text-yellow-400', from: 'from-yellow-500/8'},
                  ].map(s => (
                    <div key={s.label} className={cn('rounded-2xl bg-gradient-to-br to-transparent border border-white/7 p-4', s.from)}>
                      <div className={cn('font-orbitron text-2xl font-black mb-0.5', s.color)}>{s.val}</div>
                      <div className="text-[10px] text-white/35 uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Active/Upcoming Tournaments */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-orbitron font-bold text-sm text-white">Tournaments</h2>
                      <button
                        onClick={() => setActiveTab('tournaments')}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors"
                      >
                        See all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {tournaments.slice(0, 3).length > 0 ? (
                      <div className="space-y-3">
                        {tournaments.slice(0, 3).map(t => (
                          <HubTournamentCard key={t.id} t={t} game={game} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white/[0.02] border border-white/6 p-8 text-center">
                        <Trophy className="w-8 h-8 mx-auto text-white/12 mb-2" />
                        <p className="text-xs text-white/25">No tournaments yet</p>
                      </div>
                    )}
                  </div>

                  {/* Right column: clips + news or leaderboard preview */}
                  <div className="space-y-5">
                    {clips.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="font-orbitron font-bold text-sm text-white">Top Clips</h2>
                          <button onClick={() => setActiveTab('clips')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
                            See all <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {clips.slice(0, 4).map(c => <ClipMini key={c.id} clip={c} />)}
                        </div>
                      </div>
                    )}

                    {news.length > 0 && (
                      <div>
                        <h2 className="font-orbitron font-bold text-sm text-white mb-3">Latest News</h2>
                        <div className="space-y-2">
                          {news.slice(0, 3).map(n => <NewsCard key={n.id} news={n} />)}
                        </div>
                      </div>
                    )}

                    {clips.length === 0 && news.length === 0 && leaderboard.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="font-orbitron font-bold text-sm text-white">Top Players</h2>
                          <button onClick={() => setActiveTab('leaderboard')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
                            Full board <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {leaderboard.slice(0, 5).map(e => <LbRow key={e.user_id} entry={e} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clans preview */}
                {clubs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-orbitron font-bold text-sm text-white">Active Clans</h2>
                      <button onClick={() => setActiveTab('clans')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
                        See all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {clubs.slice(0, 3).map(c => <ClanCard key={c.id} club={c} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TOURNAMENTS ──────────────────────────────────────────────── */}
            {activeTab === 'tournaments' && (
              <div>
                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  {(['all', 'upcoming', 'ongoing', 'completed'] as TournamentFilter[]).map(f => {
                    const count = f === 'all' ? tournaments.length
                      : f === 'ongoing' ? liveTournaments.length
                      : f === 'upcoming' ? upcomingTournaments.length
                      : tournaments.filter(t => t.status === 'completed').length;
                    return (
                      <button
                        key={f}
                        onClick={() => setTournamentFilter(f)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full font-semibold capitalize border transition-all',
                          tournamentFilter === f
                            ? 'bg-cyan-500/18 text-cyan-400 border-cyan-500/40'
                            : 'bg-white/4 text-white/40 border-white/10 hover:border-white/25 hover:text-white/65',
                        )}
                      >
                        {f === 'ongoing' ? '● Live' : f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1.5 opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {filteredTournaments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTournaments.map(t => <HubTournamentCard key={t.id} t={t} game={game} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Trophy className="w-12 h-12" />}
                    title="No tournaments"
                    description={`No ${tournamentFilter === 'all' ? '' : tournamentFilter + ' '}tournaments for ${game.name} yet.`}
                    action={{ label: 'Browse All Tournaments', href: '/tournaments' }}
                  />
                )}
              </div>
            )}

            {/* ── CLIPS ────────────────────────────────────────────────────── */}
            {activeTab === 'clips' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">{game.name} Clips</h2>
                    <p className="text-xs text-white/35 mt-0.5">Best moments from the community</p>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-8 px-3 text-xs gap-1.5">
                    <Link to="/clips/upload"><Plus className="w-3.5 h-3.5" />Submit Clip</Link>
                  </Button>
                </div>

                {clips.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clips.map(c => <ClipMini key={c.id} clip={c} full={false} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Play className="w-12 h-12" />}
                    title="No clips yet"
                    description={`Be the first to share a ${game.name} clip with the community!`}
                    action={{ label: 'Submit a Clip', href: '/clips/upload' }}
                  />
                )}
              </div>
            )}

            {/* ── LEADERBOARD ──────────────────────────────────────────────── */}
            {activeTab === 'leaderboard' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">{game.name} Leaderboard</h2>
                    <p className="text-xs text-white/35 mt-0.5">Ranked by GamerCred & tournament wins</p>
                  </div>
                  <Badge className="bg-yellow-500/18 text-yellow-400 border-yellow-500/28 text-[10px]">
                    <Crown className="w-3 h-3 mr-1" />Top 25
                  </Badge>
                </div>

                {lbLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-14 bg-white/4 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map(e => <LbRow key={e.user_id} entry={e} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BarChart3 className="w-12 h-12" />}
                    title="No rankings yet"
                    description="Compete in tournaments to earn GamerCred and appear here."
                    action={{ label: 'Find a Tournament', href: '/tournaments' }}
                  />
                )}
              </div>
            )}

            {/* ── CLANS ────────────────────────────────────────────────────── */}
            {activeTab === 'clans' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">{game.name} Clans</h2>
                    <p className="text-xs text-white/35 mt-0.5">Competitive teams in this game</p>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-purple-500 to-pink-600 text-white h-8 px-3 text-xs gap-1.5">
                    <Link to="/clubs"><Plus className="w-3.5 h-3.5" />Create Clan</Link>
                  </Button>
                </div>

                {clubs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clubs.map(c => <ClanCard key={c.id} club={c} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Swords className="w-12 h-12" />}
                    title="No clans yet"
                    description={`Start or join the first ${game.name} clan!`}
                    action={{ label: 'Browse Clubs', href: '/clubs' }}
                  />
                )}
              </div>
            )}

            {/* ── DISCUSS ──────────────────────────────────────────────────── */}
            {activeTab === 'discuss' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">{game.name} Discussions</h2>
                    <p className="text-xs text-white/35 mt-0.5">Community conversations</p>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-8 px-3 text-xs gap-1.5">
                    <Link to="/community"><Plus className="w-3.5 h-3.5" />New Post</Link>
                  </Button>
                </div>

                {posts.length > 0 ? (
                  <>
                    <div className="space-y-2 mb-5">
                      {posts.map(p => <DiscussRow key={p.id} post={p} />)}
                    </div>
                    <div className="text-center">
                      <Button asChild variant="outline" size="sm" className="border-white/18 hover:border-white/40 text-white/55 hover:text-white">
                        <Link to="/community">
                          View All Discussions <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<MessageSquare className="w-12 h-12" />}
                    title="No discussions yet"
                    description={`Start the first conversation about ${game.name}!`}
                    action={{ label: 'Post in Community', href: '/community' }}
                  />
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}