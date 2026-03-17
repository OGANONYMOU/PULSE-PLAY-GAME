import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, MessageSquare, TrendingUp, Trophy, Users, Video, Upload,
  Plus, Globe, Zap, ChevronRight, Search, Hash, Gamepad2,
  Loader2, Bell, Calendar, Star, BookOpen, X, Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { usePosts, type PostTag, type ReactionType } from '@/hooks/usePosts';
import { useTournaments } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { writeAuditLog } from '@/lib/auditLog';
import { PostCard } from '@/components/community/PostCard';
import { ClipCard, type Clip } from '@/components/community/ClipCard';

// ── Types ──────────────────────────────────────────────────────────────────
type CommunityEvent = {
  id: string; title: string; description: string; type: string;
  starts_at: string; ends_at: string; prize_pool: string | null; is_active: boolean;
  games: { name: string; icon: string } | null;
};

type DailyChallenge = {
  id: string; title: string; description: string; type: string; points_reward: number;
};

// ── Tags ───────────────────────────────────────────────────────────────────
const TABS_CONFIG = [
  { id: 'feed',       label: 'Feed',       icon: Flame       },
  { id: 'clips',      label: 'Clips',      icon: Video       },
  { id: 'events',     label: 'Events',     icon: Calendar    },
  { id: 'discover',   label: 'Discover',   icon: TrendingUp  },
] as const;

type TabId = typeof TABS_CONFIG[number]['id'];

const POST_CATEGORIES: { value: PostTag | 'all'; label: string; color: string }[] = [
  { value: 'all',         label: '🌐 All',          color: 'border-white/15 text-white/60' },
  { value: 'general',     label: '💬 General',       color: 'border-blue-500/25 text-blue-400' },
  { value: 'tournament',  label: '🏆 Tournament',    color: 'border-purple-500/25 text-purple-400' },
  { value: 'tips',        label: '💡 Tips',          color: 'border-green-500/25 text-green-400' },
  { value: 'strategy',    label: '♟️ Strategy',      color: 'border-emerald-500/25 text-emerald-400' },
  { value: 'clips',       label: '🎬 Clips',         color: 'border-pink-500/25 text-pink-400' },
  { value: 'matchmaking', label: '🎯 Matchmaking',   color: 'border-cyan-500/25 text-cyan-400' },
];

// ── Compose box ────────────────────────────────────────────────────────────
function ComposeBox({ onCreate }: { onCreate: (content: string, tag: PostTag) => Promise<void> }) {
  const { profile, isAuthenticated } = useAuth();
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<PostTag>('general');
  const [busy, setBusy] = useState(false);
  const avatarSrc = profile?.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.username ?? 'U'}&backgroundColor=0f172a`;

  if (!isAuthenticated) return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
      <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-white/30" /></div>
      <p className="text-sm text-white/40 flex-1">Sign in to post and join the conversation</p>
      <Button asChild size="sm" className="flex-shrink-0 bg-gradient-to-r from-cyan-500 to-purple-600 text-xs font-bold h-8">
        <Link to="/signin">Sign In</Link>
      </Button>
    </div>
  );

  return (
    <div className="p-4 rounded-2xl bg-white/4 border border-white/10">
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="Share tactics, reactions, clips, tournament results…"
            rows={3}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/25 resize-none focus:outline-none leading-relaxed" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {POST_CATEGORIES.filter(c => c.value !== 'all').map(c => (
              <button key={c.value} onClick={() => setTag(c.value as PostTag)}
                className={'text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ' +
                  (tag === c.value ? c.color + ' bg-white/8' : 'border-white/8 text-white/30 hover:border-white/15')}>
                {c.label}
              </button>
            ))}
            <Button size="sm" onClick={async () => { setBusy(true); await onCreate(content, tag); setContent(''); setBusy(false); }}
              disabled={busy || !content.trim()}
              className="ml-auto bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-8 gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Clip Upload modal ──────────────────────────────────────────────────────
function ClipUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [gameId, setGameId] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [games, setGames] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('games').select('id, name, icon').order('name'),
      supabase.from('tournaments').select('id, name').eq('status', 'upcoming').order('date').limit(10),
    ]).then(([g, t]) => { setGames((g.data as typeof games) ?? []); setTournaments((t.data as typeof tournaments) ?? []); });
  }, []);

  const upload = async () => {
    if (!file || !title.trim() || !user) { toast.error('Title and file required'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'mp4';
    const path = `clips/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: dbErr } = await supabase.from('clips').insert({
      user_id: user.id, game_id: gameId || null, tournament_id: tournamentId || null,
      title: title.trim(), object_key: path, is_published: true,
    } as never);
    if (dbErr) toast.error(dbErr.message);
    else { await writeAuditLog({ actor_id: user.id, action: 'evidence.upload', entity_type: 'clip', data: { title, path } }); toast.success('Clip uploaded! 🎬'); onUploaded(); onClose(); }
    setUploading(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/40 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-[#0d0d1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2"><Video className="w-4 h-4 text-pink-400" />Upload Clip</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Insane last-minute goal 🔥" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Game</label>
              <select value={gameId} onChange={e => setGameId(e.target.value)} className="bg-white/5 border border-white/10 text-white rounded-xl px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/40">
                <option value="" className="bg-card text-white/40">Any game</option>
                {games.map(g => <option key={g.id} value={g.id} className="bg-card">{g.icon} {g.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Tournament</label>
              <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} className="bg-white/5 border border-white/10 text-white rounded-xl px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/40">
                <option value="" className="bg-card text-white/40">None</option>
                {tournaments.map(t => <option key={t.id} value={t.id} className="bg-card">{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Video / Screenshot *</label>
            <input ref={fileRef} type="file" accept="video/*,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-white/12 hover:border-pink-500/40 text-white/35 hover:text-white/60 transition-all">
              <Video className="w-8 h-8" />
              {file ? <span className="text-xs text-white/70 font-semibold">{file.name}</span> : <><span className="text-sm font-medium">Tap to pick video or screenshot</span><span className="text-xs">MP4, MOV, JPG — max 50MB</span></>}
            </button>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={upload} disabled={uploading || !file || !title.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Share Clip
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Events section ─────────────────────────────────────────────────────────
function EventsSection({ events, challenges }: { events: CommunityEvent[]; challenges: DailyChallenge[] }) {
  const EVENT_ICONS: Record<string, string> = {
    clip_of_week: '🎬', strategy_friday: '♟️', community_tournament: '🏆',
    king_of_hill: '👑', weekly_challenge: '⚡', season_finale: '🌟',
  };

  return (
    <div className="space-y-6">
      {/* Weekly events */}
      <div>
        <h2 className="font-orbitron text-sm font-black text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />Community Events
        </h2>
        {events.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
            <Calendar className="w-10 h-10 mx-auto text-white/15 mb-3" />
            <p className="text-white/30 text-sm">No active events right now.</p>
            <p className="text-white/20 text-xs mt-1">Check back soon for Clip of the Week and more!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {events.map((ev, i) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(ev.ends_at).getTime() - Date.now()) / 86400000));
              return (
                <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/8 to-purple-500/8 border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl flex-shrink-0">{EVENT_ICONS[ev.type] ?? '🎮'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-orbitron font-bold text-sm text-white">{ev.title}</p>
                      <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{ev.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {ev.prize_pool && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/25 font-bold">🏆 {ev.prize_pool}</span>}
                        <span className="text-[10px] text-white/30">{daysLeft}d left</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily challenges */}
      <div>
        <h2 className="font-orbitron text-sm font-black text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />Daily Challenges
        </h2>
        <div className="space-y-2">
          {challenges.map((ch, i) => (
            <motion.div key={ch.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{ch.title}</p>
                <p className="text-[11px] text-white/40">{ch.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-orbitron font-black text-sm text-yellow-400">+{ch.points_reward}</p>
                <p className="text-[9px] text-white/25">PP</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Discover section ───────────────────────────────────────────────────────
function DiscoverSection() {
  const [topPlayers, setTopPlayers] = useState<Array<{ user_id: string; score: number; profiles: { username: string; avatar_url: string | null } | null }>>([]);

  useEffect(() => {
    supabase.from('gamercred_scores').select('user_id, score, profiles(username, avatar_url)')
      .order('score', { ascending: false }).limit(5)
      .then(({ data }) => setTopPlayers((data as typeof topPlayers) ?? []));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top players */}
      <div>
        <h2 className="font-orbitron text-sm font-black text-white mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />Top Players
          <Link to="/leaderboards" className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">See all <ChevronRight className="w-3 h-3" /></Link>
        </h2>
        {topPlayers.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">No rankings yet</p>
        ) : topPlayers.map((p, i) => (
          <Link key={p.user_id} to={`/profile/${p.profiles?.username}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
            <span className="w-6 text-center text-sm">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={p.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">{p.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{p.profiles?.username}</p>
            </div>
            <span className="font-orbitron font-black text-sm text-cyan-400">{p.score.toLocaleString()}</span>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="font-orbitron text-sm font-black text-white mb-3">Explore</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { to: '/clubs',        icon: Users,      label: 'Clubs',       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { to: '/leaderboards', icon: TrendingUp, label: 'Rankings',    color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            { to: '/games',        icon: Gamepad2,   label: 'Games Hub',   color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
            { to: '/tournaments',  icon: Trophy,     label: 'Tournaments', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className={'flex items-center gap-2.5 p-3.5 rounded-xl border transition-all hover:opacity-80 ' + l.bg}>
              <l.icon className={'w-4 h-4 ' + l.color} />
              <span className="text-sm font-semibold text-white/80">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ tournaments }: { tournaments: ReturnType<typeof useTournaments>['tournaments'] }) {
  const live = tournaments.filter(t => t.status === 'ongoing').slice(0, 3);
  const upcoming = tournaments.filter(t => t.status === 'upcoming').slice(0, 4);

  return (
    <div className="space-y-6">
      {live.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-red-400 animate-pulse" />
            <h3 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">🔴 Live Now</h3>
          </div>
          <div className="space-y-2">
            {live.map(t => (
              <Link key={t.id} to="/tournaments"
                className="flex items-center gap-3 p-3 rounded-xl bg-red-500/8 border border-red-500/18 hover:border-red-500/35 transition-all">
                <span className="text-xl flex-shrink-0">{t.games?.icon ?? '🎮'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{t.name}</p>
                  <p className="text-[10px] text-red-400/70">{t.current_players}/{t.max_players} players</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-cyan-400" />
            <h3 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Upcoming</h3>
          </div>
          <div className="space-y-2">
            {upcoming.map(t => (
              <Link key={t.id} to="/tournaments"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/18 transition-all">
                <span className="text-lg flex-shrink-0">{t.games?.icon ?? '🎮'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{t.name}</p>
                  <p className="text-[10px] text-white/35">{t.current_players}/{t.max_players}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              </Link>
            ))}
          </div>
          <Link to="/tournaments" className="flex items-center justify-center gap-1.5 mt-2 py-2 rounded-xl text-xs text-white/35 hover:text-cyan-400 transition-colors">
            View all tournaments <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function Community() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('feed');
  const [categoryFilter, setCategoryFilter] = useState<PostTag | 'all'>('all');
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const { posts, isLoading: postsLoading, createPost, reactToPost, savePost, refetch } = usePosts(
    categoryFilter === 'all' ? undefined : categoryFilter
  );
  const { tournaments } = useTournaments();

  const loadClips = useCallback(async () => {
    setClipsLoading(true);
    const { data } = await supabase.from('clips')
      .select('*, games(name, icon), profiles(username, avatar_url), tournaments(name)')
      .eq('is_published', true).order('created_at', { ascending: false }).limit(12);
    setClips((data as Clip[]) ?? []);
    setClipsLoading(false);
  }, []);

  useEffect(() => {
    loadClips();
    supabase.from('community_events').select('*, games(name, icon)').eq('is_active', true)
      .then(({ data }) => setEvents((data as CommunityEvent[]) ?? []));
    supabase.from('daily_challenges').select('*').eq('is_active', true)
      .then(({ data }) => setChallenges((data as DailyChallenge[]) ?? []));
  }, [loadClips]);

  const handlePost = async (content: string, tag: PostTag) => {
    if (!user) return;
    const title = content.split('\n')[0].slice(0, 80);
    const { error } = await createPost(user.id, title, content, tag);
    if (error) toast.error('Failed to post. Try again.');
    else toast.success('Posted! 🎉');
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-7xl mx-auto">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-white/8"
          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.07) 0%, rgba(139,92,246,0.07) 50%, rgba(236,72,153,0.05) 100%)' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div key={i} className="absolute rounded-full opacity-15"
                style={{ width: 50 + i * 25, height: 50 + i * 25, left: `${8 + i * 18}%`, top: `${15 + (i % 3) * 35}%`, background: `hsl(${180 + i * 30}, 70%, 60%)`, filter: 'blur(25px)' }}
                animate={{ y: [0, -12, 0] }} transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.4 }} />
            ))}
          </div>
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-semibold mb-4">
              <Globe className="w-3.5 h-3.5" />{tournaments.filter(t => t.status === 'ongoing').length} tournaments live · {posts.length} posts today
            </div>
            <h1 className="font-orbitron text-2xl sm:text-4xl font-black text-white mb-3">
              The <span className="gradient-text">PulsePlay</span> Community
            </h1>
            <p className="text-white/50 text-sm max-w-xl mx-auto">Share clips · talk tactics · rep your club · dominate leaderboards</p>
          </div>
        </motion.div>

        {/* Main 2-col layout */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left: main content */}
          <div className="flex-1 min-w-0">
            {/* Tab bar */}
            <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-white/5 border border-white/8 mb-5">
              {TABS_CONFIG.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ' +
                    (activeTab === t.id ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white/70')}>
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>

            {/* ── FEED ── */}
            {activeTab === 'feed' && (
              <div className="space-y-4">
                <ComposeBox onCreate={handlePost} />
                {/* Category filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {POST_CATEGORIES.map((c, idx) => (
                    <button key={c.value} onClick={() => setCategoryFilter(c.value)}
                      className={'flex-shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all ' +
                        (categoryFilter === c.value
                          ? 'bg-white/12 border-white/25 text-white'
                          : 'border-white/8 text-white/35 hover:border-white/18 hover:text-white/60')}>
                      {c.label}
                      {categoryFilter === c.value && posts.length > 0 && <span className="ml-1.5 opacity-60">({posts.length})</span>}
                    </button>
                  ))}
                </div>
                {/* Posts */}
                {postsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl bg-white/5 animate-pulse" />)}</div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-white/8 rounded-2xl">
                    <MessageSquare className="w-12 h-12 mx-auto text-white/15 mb-4" />
                    <p className="text-white/35 text-sm mb-3">No posts yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map(post => (
                      <PostCard key={post.id} post={post} onReact={reactToPost} onSave={savePost} onRefresh={refetch} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CLIPS ── */}
            {activeTab === 'clips' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-white/40">{clips.length} clips shared</p>
                  {isAuthenticated && (
                    <Button size="sm" onClick={() => setShowUpload(true)}
                      className="bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold h-8 gap-1.5">
                      <Video className="w-3.5 h-3.5" />Upload Clip
                    </Button>
                  )}
                </div>
                {clipsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-72 rounded-2xl bg-white/5 animate-pulse" />)}
                  </div>
                ) : clips.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-white/8 rounded-2xl">
                    <Video className="w-12 h-12 mx-auto text-white/15 mb-4" />
                    <p className="text-white/35 text-sm mb-3">No clips yet — be the first!</p>
                    {isAuthenticated && (
                      <Button size="sm" onClick={() => setShowUpload(true)}
                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold gap-1.5">
                        <Video className="w-3.5 h-3.5" />Upload First Clip
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {clips.map((c, i) => <ClipCard key={c.id} clip={c} index={i} onRefresh={loadClips} />)}
                  </div>
                )}
              </div>
            )}

            {/* ── EVENTS ── */}
            {activeTab === 'events' && <EventsSection events={events} challenges={challenges} />}

            {/* ── DISCOVER ── */}
            {activeTab === 'discover' && <DiscoverSection />}
          </div>

          {/* Right sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="sticky top-24">
              <Sidebar tournaments={tournaments} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showUpload && <ClipUploadModal key="upload" onClose={() => setShowUpload(false)} onUploaded={loadClips} />}
      </AnimatePresence>
    </div>
  );
}
