import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, ArrowRight, Sparkles, Flame, Video, Zap, Sword,
  TrendingUp, Shield, Globe, ChevronRight, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ── Live stat counter ──────────────────────────────────────────────────────
function AnimatedNumber({ target, delay = 0, suffix = '' }: { target: number; delay?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const steps = 40; let step = 0;
      const interval = setInterval(() => {
        step++;
        setVal(Math.round((target * step) / steps));
        if (step >= steps) clearInterval(interval);
      }, 30);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, delay]);
  return <span>{val.toLocaleString()}{suffix}</span>;
}

// ── Live tournament hype card ──────────────────────────────────────────────
type LiveTournament = { id: string; name: string; current_players: number; max_players: number; games: { name: string; icon: string } | null };

function LiveHypeCard({ t }: { t: LiveTournament }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative p-4 rounded-2xl border border-red-500/20 bg-red-500/6 hover:border-red-500/40 hover:bg-red-500/10 transition-all overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-2xl flex-shrink-0">
          {t.games?.icon ?? '🎮'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE NOW
            </span>
          </div>
          <p className="font-orbitron font-bold text-sm text-white truncate">{t.name}</p>
          <p className="text-[11px] text-white/45 mt-0.5">{t.games?.name} · {t.current_players}/{t.max_players} players</p>
        </div>
        <Link to="/tournaments"
          className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/40 transition-all group-hover:scale-105">
          Watch
        </Link>
      </div>
    </motion.div>
  );
}

// ── Feature card ───────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, to, delay }: {
  icon: React.ElementType; title: string; desc: string;
  color: string; to: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.5, delay }}>
      <Link to={to} className="block group h-full">
        <div className="h-full p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-white/18 hover:bg-white/5 transition-all duration-300">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-orbitron font-bold text-base text-white mb-2 group-hover:text-cyan-400 transition-colors">{title}</h3>
          <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
          <div className="flex items-center gap-1 mt-4 text-xs text-white/25 group-hover:text-cyan-400 transition-colors">
            Explore <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Top player row ─────────────────────────────────────────────────────────
type TopPlayer = { user_id: string; score: number; profiles: { username: string; avatar_url: string | null } | null };

function TopPlayerRow({ p, rank }: { p: TopPlayer; rank: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Link to={`/profile/${p.profiles?.username}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group">
      <span className="w-7 text-center text-lg flex-shrink-0">{medals[rank] ?? `${rank + 1}`}</span>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-orbitron font-black flex-shrink-0">
        {p.profiles?.username?.[0]?.toUpperCase() ?? 'U'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">{p.profiles?.username ?? '—'}</p>
      </div>
      <span className="font-orbitron font-black text-sm text-cyan-400 flex-shrink-0">{p.score.toLocaleString()}</span>
    </Link>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function Home() {
  const { isAuthenticated } = useAuth();
  const [liveTournaments, setLiveTournaments] = useState<LiveTournament[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [realStats, setRealStats] = useState({ players: 0, tournaments: 0, clubs: 0, clips: 0 });

  useEffect(() => {
    // Load live tournaments
    supabase.from('tournaments').select('id, name, current_players, max_players, games(name, icon)')
      .eq('status', 'ongoing').limit(3)
      .then(({ data }) => setLiveTournaments((data as LiveTournament[]) ?? []));

    // Load top GamerCred players
    supabase.from('gamercred_scores').select('user_id, score, profiles(username, avatar_url)')
      .order('score', { ascending: false }).limit(5)
      .then(({ data }) => setTopPlayers((data as TopPlayer[]) ?? []));

    // Load real platform stats
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'USER'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('clubs').select('*', { count: 'exact', head: true }),
      supabase.from('clips').select('*', { count: 'exact', head: true }).eq('is_published', true),
    ]).then(([players, tourn, clubs, clips]) => {
      setRealStats({
        players: players.count ?? 0,
        tournaments: tourn.count ?? 0,
        clubs: clubs.count ?? 0,
        clips: clips.count ?? 0,
      });
    });
  }, []);

  const platformStats = [
    { icon: Users,   value: realStats.players,     suffix: '+', label: 'Players',      color: 'text-cyan-400'   },
    { icon: Trophy,  value: realStats.tournaments,  suffix: '',  label: 'Tournaments',  color: 'text-yellow-400' },
    { icon: Users,   value: realStats.clubs,        suffix: '',  label: 'Clubs',        color: 'text-purple-400' },
    { icon: Video,   value: realStats.clips,        suffix: '',  label: 'Clips Shared', color: 'text-pink-400'   },
  ];

  const features = [
    { icon: Trophy,    title: 'Tournaments',   desc: 'Join live competitions and compete for real prizes across eFootball, CODM, Free Fire and more.',   color: 'bg-gradient-to-br from-yellow-500 to-orange-600', to: '/tournaments', delay: 0    },
    { icon: Video,     title: 'Clips',         desc: 'Upload your best goals and clutch plays. Like, comment, repost, and share to TikTok and WhatsApp.', color: 'bg-gradient-to-br from-pink-500 to-purple-600',   to: '/community',  delay: 0.05 },
    { icon: Users,     title: 'Clubs',         desc: 'Form a crew with your friends. Compete in club wars, share scrims, and climb the leaderboards.',    color: 'bg-gradient-to-br from-cyan-500 to-blue-600',    to: '/clubs',       delay: 0.1  },
    { icon: TrendingUp,title: 'Leaderboards',  desc: 'Earn GamerCred through wins and sportsmanship. Climb regional and global rankings.',                 color: 'bg-gradient-to-br from-emerald-500 to-cyan-600', to: '/leaderboards',delay: 0.15 },
    { icon: Globe,     title: 'Community',     desc: 'Discuss tactics, make friends, follow rivals, and be part of the biggest mobile gaming community.',  color: 'bg-gradient-to-br from-violet-500 to-purple-600',to: '/community',  delay: 0.2  },
    { icon: Sword,     title: 'Rivalries',     desc: 'Play the same opponent repeatedly and an automatic rivalry page generates your head-to-head record.', color: 'bg-gradient-to-br from-red-500 to-orange-600',   to: '/community',  delay: 0.25 },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 overflow-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] sm:min-h-[75vh] md:min-h-[80vh] flex flex-col items-center justify-center w-full px-4 sm:px-6">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { size: 'w-44 h-44 sm:w-72 sm:h-72', pos: 'top-12 -left-12 sm:top-20 sm:-left-20', color: 'from-cyan-500/15', delay: 0 },
            { size: 'w-36 h-36 sm:w-64 sm:h-64', pos: 'top-16 right-0 sm:top-32',      color: 'from-purple-500/12', delay: 1 },
            { size: 'w-48 h-48 sm:w-80 sm:h-80', pos: '-bottom-16 left-1/4 sm:-bottom-20 sm:left-1/3', color: 'from-pink-500/10', delay: 2 },
          ].map((orb, i) => (
            <motion.div key={i}
              className={`absolute ${orb.size} ${orb.pos} rounded-full bg-gradient-to-br ${orb.color} to-transparent blur-3xl`}
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 5 + i, repeat: Infinity, delay: orb.delay }} />
          ))}
          {/* Floating game icons */}
          {['⚽', '🎮', '🏆', '🔥', '⚡'].map((emoji, i) => (
            <motion.span key={i} className="absolute text-3xl sm:text-4xl select-none pointer-events-none opacity-20"
              style={{ left: `${10 + i * 18}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ y: [0, -20, 0], rotate: [0, i % 2 === 0 ? 10 : -10, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.6 }}>
              {emoji}
            </motion.span>
          ))}
        </div>

        {/* Hero content */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }} className="text-center max-w-4xl mx-auto relative z-10">

          {/* Live badge */}
          {liveTournaments.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold mb-6">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {liveTournaments.length} tournament{liveTournaments.length > 1 ? 's' : ''} live right now
            </motion.div>
          )}
          {liveTournaments.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 text-xs font-bold mb-6">
              <Sparkles className="w-3.5 h-3.5" />Africa's Premier Mobile Esports Platform
            </motion.div>
          )}

          <h1 className="font-orbitron text-3xl sm:text-5xl md:text-7xl font-black leading-[1.05] mb-6">
            <span className="gradient-text">Compete.</span>{' '}
            <span className="text-white">Clip.</span>{' '}
            <span className="text-white/70">Conquer.</span>
          </h1>

          <p className="text-base sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            {isAuthenticated
              ? "Welcome back. Your next tournament, your next rival, your next clip — it’s waiting."
              : 'Tournaments · Clubs · Clips · GamerCred. The full mobile esports experience, built for Africa.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Button asChild size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-8 h-12 rounded-2xl shadow-lg shadow-cyan-500/25">
                  <Link to="/tournaments"><Trophy className="mr-2 w-5 h-5" />Browse Tournaments</Link>
                </Button>
                <Button asChild size="lg" variant="outline"
                  className="w-full sm:w-auto border-white/15 text-white hover:bg-white/8 h-12 rounded-2xl">
                  <Link to="/community"><Video className="mr-2 w-5 h-5" />Community Feed</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-10 h-12 rounded-2xl shadow-lg shadow-cyan-500/25">
                  <Link to="/register"><Zap className="mr-2 w-5 h-5" />Join Free</Link>
                </Button>
                <Button asChild size="lg" variant="outline"
                  className="w-full sm:w-auto border-white/15 text-white hover:bg-white/8 h-12 rounded-2xl">
                  <Link to="/tournaments">View Tournaments <ArrowRight className="ml-2 w-5 h-5" /></Link>
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Stat bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }} className="relative z-10 mt-16 w-full max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 px-4">
            {platformStats.map((s, i) => (
              <div key={s.label} className="text-center p-3 sm:p-4 rounded-2xl bg-white/4 border border-white/8">
                <p className={`font-orbitron font-black text-xl sm:text-2xl ${s.color}`}>
                  {realStats.players > 0
                    ? <AnimatedNumber target={s.value} delay={600 + i * 100} suffix={s.suffix} />
                    : '—'}
                </p>
                <p className="text-[10px] sm:text-xs text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── LIVE HYPE ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {liveTournaments.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="py-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-400 animate-pulse" />
                  <h2 className="font-orbitron font-black text-lg text-white">Live Right Now</h2>
                </div>
                <Link to="/tournaments" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  All tournaments <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveTournaments.map(t => <LiveHypeCard key={t.id} t={t} />)}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── PLATFORM FEATURES ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-orbitron text-3xl sm:text-4xl font-black text-white mb-4">
              Everything You Need to <span className="gradient-text">Dominate</span>
            </h2>
            <p className="text-white/45 max-w-xl mx-auto text-sm sm:text-base">
              PulsePlay combines competition, community, and content into one platform built for African mobile gamers.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── TOP PLAYERS ────────────────────────────────────────────────── */}
      {topPlayers.length > 0 && (
        <section className="py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Leaderboard preview */}
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-3xl bg-white/3 border border-white/8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-orbitron font-bold text-sm text-white">Top Players</h3>
                  </div>
                  <Link to="/leaderboards" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    Full rankings <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-1">
                  {topPlayers.map((p, i) => <TopPlayerRow key={p.user_id} p={p} rank={i} />)}
                </div>
              </motion.div>

              {/* GamerCred info */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/8 to-purple-500/8 border border-white/10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-sm text-white">GamerCred System</h3>
                    <p className="text-[11px] text-white/40">Your reputation on PulsePlay</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { emoji: '🏆', text: 'Win tournaments to earn GamerCred', color: 'text-yellow-400' },
                    { emoji: '🤝', text: 'Good sportsmanship boosts your score', color: 'text-green-400' },
                    { emoji: '✓', text: 'Reach 800+ for Verified badge', color: 'text-cyan-400' },
                    { emoji: '👑', text: 'Priority matchmaking for high-cred players', color: 'text-purple-400' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">{item.emoji}</span>
                      <span className={`text-sm ${item.color}`}>{item.text}</span>
                    </motion.div>
                  ))}
                </div>
                <Link to="/leaderboards"
                  className="flex items-center gap-2 mt-6 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 transition-all text-sm text-white/70 hover:text-white font-semibold">
                  <TrendingUp className="w-4 h-4" />View Leaderboards <ChevronRight className="w-4 h-4 ml-auto" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="py-16 sm:py-24 px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="max-w-4xl mx-auto text-center">
            <div className="relative overflow-hidden rounded-3xl p-10 sm:p-16 border border-white/10"
              style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(139,92,246,0.10) 50%, rgba(236,72,153,0.07) 100%)' }}>
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/15 blur-3xl rounded-full" />
              </div>
              <div className="relative z-10">
                <p className="font-orbitron text-xs text-cyan-400 uppercase tracking-widest mb-4 font-bold">Join the Movement</p>
                <h2 className="font-orbitron text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
                  Ready to <span className="gradient-text">Level Up?</span>
                </h2>
                <p className="text-white/45 text-base sm:text-lg mb-8 max-w-xl mx-auto">
                  Create your free account. Build your Esports Passport. Compete for real prizes.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-base px-10 h-14 rounded-2xl shadow-xl shadow-cyan-500/20">
                    <Link to="/register"><Zap className="mr-2 w-5 h-5" />Create Free Account</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline"
                    className="w-full sm:w-auto border-white/15 text-white hover:bg-white/8 h-14 rounded-2xl text-base">
                    <Link to="/about">Learn more <ArrowRight className="ml-2 w-5 h-5" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      )}
    </div>
  );
}
