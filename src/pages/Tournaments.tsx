import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy, Calendar, Users, DollarSign, Clock,
  Flame, CheckCircle, Loader2, X, Info, UserCheck, Share2,
  Play, Zap, Shield, Crown, Search, ChevronRight,
  Tv, Swords, BookOpen, ChevronDown, Globe,
  BarChart2, Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';
import { TournamentsSEO } from '@/components/SEO';
import { resolveGameImage } from '@/lib/gameImages';
import { awardXpAndNotify } from '@/hooks/useLevelUp';

// ── Types ─────────────────────────────────────────────────────────────────────
type TStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

function isVisibleOnPublic(t: Tournament): boolean {
  return t.status !== 'cancelled';
}

type Tournament = {
  id: string; name: string; game_id: string; status: TStatus;
  date: string; prize_pool: string; max_players: number; current_players: number;
  duration: string; winner: string | null; description: string | null;
  rules: string | null; entry_fee: string | null; created_at: string;
  games: { name: string; icon: string; image_url: string | null } | null;
};

type Participant = {
  id: string; status: string; checked_in: boolean; registered_at: string;
  seed: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

type LiveUpdate = { id: string; message: string; created_at: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try { return format(new Date(iso), 'MMM d, yyyy · h:mm a'); } catch { return iso; }
}

function gameGradient(name = '') {
  const lc = name.toLowerCase();
  if (lc.includes('efootball') || lc.includes('fifa') || lc.includes('ea fc')) return 'from-emerald-600 via-green-500 to-teal-400';
  if (lc.includes('pubg')) return 'from-amber-600 via-yellow-500 to-orange-400';
  if (lc.includes('free fire')) return 'from-red-600 via-orange-500 to-yellow-400';
  if (lc.includes('cod') || lc.includes('duty')) return 'from-sky-600 via-blue-500 to-cyan-400';
  if (lc.includes('fortnite')) return 'from-violet-600 via-purple-500 to-pink-400';
  if (lc.includes('mobile legends')) return 'from-amber-500 via-orange-500 to-red-500';
  return 'from-cyan-600 via-purple-500 to-pink-400';
}

function prizeNumber(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const dur = 1200;
    const animate = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toLocaleString()}{suffix}</>;
}

// ── Countdown timer ───────────────────────────────────────────────────────────
function Countdown({ to }: { to: string }) {
  const [secs, setSecs] = useState(Math.max(0, differenceInSeconds(new Date(to), new Date())));
  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, differenceInSeconds(new Date(to), new Date()))), 1000);
    return () => clearInterval(id);
  }, [to]);
  if (secs <= 0) return <span className="text-green-400 font-bold font-orbitron text-sm">STARTING NOW</span>;
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
    m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1 font-orbitron text-sm">
      {d > 0 && <><span className="text-white font-black">{d}</span><span className="text-white/40 text-xs">d</span><span className="text-white/20 mx-0.5">:</span></>}
      <span className="text-cyan-400 font-black">{pad(h)}</span><span className="text-white/40 text-xs">h</span>
      <span className="text-white/20 mx-0.5">:</span>
      <span className="text-cyan-400 font-black">{pad(m)}</span><span className="text-white/40 text-xs">m</span>
      <span className="text-white/20 mx-0.5">:</span>
      <span className="text-purple-400 font-black">{pad(s)}</span><span className="text-white/40 text-xs">s</span>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: TStatus }) {
  if (status === 'ongoing') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />LIVE
    </span>
  );
  if (status === 'upcoming') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs font-bold">
      <Calendar className="w-3 h-3" />UPCOMING
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold">
      <CheckCircle className="w-3 h-3" />COMPLETED
    </span>
  );
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
function PAv({ username, url, size = 'sm' }: { username: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' }[size];
  return (
    <Avatar className={`${sz} flex-shrink-0 ring-2 ring-white/10`}>
      <AvatarImage src={url ?? undefined} />
      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-black text-xs">
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TSkel() {
  return (
    <div className="gaming-card overflow-hidden">
      <div className="h-44 bg-white/5 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-white/8 rounded w-3/4 animate-pulse" />
        <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i=><div key={i} className="h-3 bg-white/5 rounded animate-pulse"/>)}</div>
        <div className="h-1.5 bg-white/5 rounded animate-pulse" />
        <div className="h-9 bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// ── Prize tier data ───────────────────────────────────────────────────────────
const PRIZE_TIERS = [
  { place: 1, label: '1st Place', icon: '🥇', pct: 50, color: 'from-yellow-500 to-amber-400', border: 'border-yellow-500/40', text: 'text-yellow-400' },
  { place: 2, label: '2nd Place', icon: '🥈', pct: 30, color: 'from-slate-400 to-gray-300',   border: 'border-slate-400/40', text: 'text-slate-300' },
  { place: 3, label: '3rd Place', icon: '🥉', pct: 15, color: 'from-amber-700 to-orange-600', border: 'border-amber-700/40', text: 'text-amber-600' },
  { place: 4, label: 'MVP Award', icon: '🏅', pct: 5,  color: 'from-purple-500 to-pink-500',  border: 'border-purple-500/40', text: 'text-purple-400' },
];

function PrizeTierCard({ tier, totalStr }: { tier: typeof PRIZE_TIERS[0]; totalStr: string }) {
  const total = prizeNumber(totalStr);
  const currency = totalStr.replace(/[0-9,.\s]/g, '').trim() || '₦';
  const amt = total > 0 ? `${currency}${(total * tier.pct / 100).toLocaleString()}` : '—';
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}
      className={`p-5 rounded-2xl bg-card/60 border ${tier.border} group overflow-hidden relative`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tier.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
      <div className="text-3xl mb-3">{tier.icon}</div>
      <p className="text-xs text-muted-foreground mb-1">{tier.label}</p>
      <p className={`font-orbitron font-black text-lg ${tier.text}`}>{amt}</p>
      <p className="text-[10px] text-white/30 mt-1">{tier.pct}% of pool</p>
      <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${tier.pct}%` }} transition={{ duration: 1, delay: 0.3 }}
          className={`h-full bg-gradient-to-r ${tier.color} rounded-full`} />
      </div>
    </motion.div>
  );
}

// ── Schedule timeline ─────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Registration Opens', icon: '📋', offset: 0 },
  { label: 'Registration Closes', icon: '🔒', offset: 1 },
  { label: 'Qualifiers', icon: '⚡', offset: 3 },
  { label: 'Group Stage', icon: '🎮', offset: 5 },
  { label: 'Quarter Finals', icon: '⚔️', offset: 7 },
  { label: 'Semi Finals', icon: '🔥', offset: 8 },
  { label: 'Grand Finals', icon: '🏆', offset: 10 },
];

function ScheduleTimeline({ tournament }: { tournament: Tournament }) {
  const base = new Date(tournament.date).getTime();
  const phases = PHASES.map((p, i) => {
    const d = new Date(base + p.offset * 86400000);
    const done = isPast(d);
    const prev = PHASES[i - 1];
    const active = !done && (i === 0 || isPast(new Date(base + (prev?.offset ?? -1) * 86400000)));
    return { ...p, date: d, done, active };
  });
  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-purple-500/20 to-transparent" />
      <div className="space-y-3 pl-14">
        {phases.map((ph, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`relative p-4 rounded-xl border transition-all ${ph.done ? 'bg-green-500/5 border-green-500/15 opacity-60' : ph.active ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/3 border-white/8'}`}>
            <div className={`absolute -left-9 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-sm
              ${ph.done ? 'bg-green-500/20 border border-green-500/30' : ph.active ? 'bg-cyan-500/20 border border-cyan-500/40 animate-pulse' : 'bg-white/5 border border-white/10'}`}>
              {ph.done ? '✓' : ph.icon}
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className={`font-bold text-sm ${ph.active ? 'text-cyan-400' : ph.done ? 'text-green-400' : 'text-white/70'}`}>{ph.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(ph.date, 'EEE, MMM d · h:mm a')}</p>
              </div>
              {ph.done && <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px]">Done</Badge>}
              {ph.active && <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/20 text-[10px] animate-pulse">Active</Badge>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Rules accordion ───────────────────────────────────────────────────────────
const RULES_DATA = [
  { cat: 'General Rules', icon: '📋', items: ['All participants must register before the deadline.', 'Players must use their registered in-game username.', 'Late arrivals forfeit their match.', 'All decisions by tournament officials are final.'] },
  { cat: 'Match Rules', icon: '⚔️', items: ['Matches are best-of-1 (group stage) and best-of-3 (finals).', 'Both players must be ready at match time.', 'Screenshot proof of results is required.', 'Technical issues must be reported immediately.'] },
  { cat: 'Fair Play Policy', icon: '🛡️', items: ['No cheating, modding, or exploiting game bugs.', 'Unsportsmanlike conduct results in disqualification.', 'Smurfing or account sharing is prohibited.', 'Respect all opponents and officials.'] },
  { cat: 'Disqualification', icon: '🚫', items: ['Using unauthorized software or hardware.', 'Intentional disconnects to avoid losing.', 'Threatening or harassing other participants.', 'Failure to comply with admin instructions.'] },
];

function RulesSection({ rulesText }: { rulesText: string | null }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {RULES_DATA.map((s, i) => (
        <div key={i} className="rounded-xl border border-white/8 overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{s.icon}</span>
              <span className="font-bold text-sm">{s.cat}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="px-4 pb-4 pt-3 border-t border-white/8 space-y-2">
                  {s.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-500/60 mt-0.5 flex-shrink-0" />{item}
                    </div>
                  ))}
                  {i === 0 && rulesText && (
                    <div className="mt-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-xs text-white/60 whitespace-pre-line">{rulesText}</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ── Stream section ────────────────────────────────────────────────────────────
function StreamSection() {
  const platforms = [
    { name: 'YouTube', icon: '▶', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', viewers: '2.4K' },
    { name: 'Twitch',  icon: '🟣', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', viewers: '1.8K' },
    { name: 'Kick',    icon: '🟢', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', viewers: '840' },
  ];
  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 aspect-video flex items-center justify-center group cursor-pointer">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/5 to-pink-500/10" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
          <p className="font-orbitron font-bold text-white">Live Stream</p>
          <p className="text-xs text-muted-foreground mt-1">Stream starts when tournament goes live</p>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span className="text-xs text-white/50 font-bold">OFFLINE</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {platforms.map(p => (
          <button key={p.name} className={`p-3 rounded-xl border ${p.bg} text-center hover:scale-105 transition-transform`}>
            <span className="text-2xl block mb-1">{p.icon}</span>
            <p className={`font-bold text-xs ${p.color}`}>{p.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{p.viewers} viewers</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sponsors ──────────────────────────────────────────────────────────────────
const SPONSORS = [
  { name: 'PulsePlay',   logo: '⚡', color: 'text-cyan-400',    tier: 'title' },
  { name: 'GameFuel',    logo: '🔥', color: 'text-yellow-400', tier: 'gold' },
  { name: 'NexusGear',   logo: '🎮', color: 'text-yellow-400', tier: 'gold' },
  { name: 'StreamZone',  logo: '📺', color: 'text-slate-300',  tier: 'silver' },
  { name: 'ProSetup',    logo: '🖥', color: 'text-slate-300',  tier: 'silver' },
  { name: 'AfriEsports', logo: '🌍', color: 'text-purple-400', tier: 'partner' },
];

// ── Hall of Fame ──────────────────────────────────────────────────────────────
function HallOfFame({ completed }: { completed: Tournament[] }) {
  const winners = completed.filter(t => t.winner).slice(0, 6);
  if (!winners.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="max-w-7xl mx-auto px-4 sm:px-6 mt-20 content-section">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
          <Crown className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="font-orbitron text-2xl font-bold">Hall of Fame</h2>
          <p className="text-sm text-muted-foreground">Champions who conquered the arena</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {winners.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="relative gaming-card p-5 overflow-hidden group cursor-pointer">
            <div className={`absolute inset-0 bg-gradient-to-br ${gameGradient(t.games?.name)} opacity-5 group-hover:opacity-10 transition-opacity`} />
            <div className="absolute top-3 right-3 text-3xl opacity-10 group-hover:opacity-20 transition-opacity">🏆</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{t.games?.icon ?? '🎮'}</span>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t.games?.name}</p>
                  <p className="text-xs text-white/30">{format(new Date(t.created_at), 'yyyy')}</p>
                </div>
              </div>
              <h3 className="font-orbitron font-bold text-sm mb-2 line-clamp-2">{t.name}</h3>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="font-bold text-yellow-400 text-sm truncate">{t.winner}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-yellow-500/60" />{t.prize_pool}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.current_players} players</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

// ── Tournament card ───────────────────────────────────────────────────────────
function TournamentCard({ t, isReg, onOpen, onRegister, onWithdraw, onShare, registering }: {
  t: Tournament; isReg: boolean;
  onOpen: () => void; onRegister: () => void; onWithdraw: () => void; onShare: () => void;
  registering: boolean;
}) {
  const gameName = t.games?.name ?? 'Unknown';
  const gameIcon = t.games?.icon ?? '🎮';
  const gameImg  = resolveGameImage(gameName, t.games?.image_url);
  const pct      = Math.round((t.current_players / t.max_players) * 100);
  const isFull   = t.current_players >= t.max_players;

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
      <div className="gaming-card overflow-hidden h-full flex flex-col group">
        {/* Banner */}
        <div className={`relative h-44 bg-gradient-to-br ${gameGradient(gameName)} cursor-pointer overflow-hidden`} onClick={onOpen}>
          {gameImg && <img src={gameImg} alt={gameName} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute top-3 left-3"><StatusPill status={t.status} /></div>
          <button onClick={e => { e.stopPropagation(); onShare(); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm">
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {isReg && (
            <div className="absolute bottom-3 right-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold">
                <UserCheck className="w-2.5 h-2.5" />YOU'RE IN
              </span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="text-3xl drop-shadow-lg">{gameIcon}</span>
            <div>
              <p className="text-white font-bold text-sm leading-none drop-shadow">{t.name}</p>
              <p className="text-white/60 text-xs mt-0.5">{gameName}</p>
            </div>
          </div>
          {t.status === 'upcoming' && !isPast(new Date(t.date)) && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 text-center border border-white/10">
                <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Starts In</p>
                <Countdown to={t.date} />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
            {[
              { icon: DollarSign, val: t.prize_pool, color: 'text-yellow-400' },
              { icon: Calendar,   val: format(new Date(t.date), 'MMM d, yyyy'), color: 'text-cyan-400' },
              { icon: Users,      val: `${t.current_players}/${t.max_players}`, color: 'text-purple-400' },
              { icon: Clock,      val: t.duration, color: 'text-pink-400' },
            ].map(({ icon: Icon, val, color }, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white/3 rounded-lg px-2.5 py-2">
                <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                <span className="truncate">{val}</span>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-muted-foreground">Slots filled</span>
              <span className={isFull ? 'text-red-400 font-bold' : 'text-white/50'}>{isFull ? 'FULL' : `${pct}%`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-purple-500'}`}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
            </div>
          </div>

          {t.winner && (
            <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-400 font-bold text-xs truncate">🏆 {t.winner}</span>
            </div>
          )}

          <div className="flex gap-2 mt-auto pt-1">
            <Button size="sm" variant="outline" className="border-white/10 text-white/50 hover:bg-white/5 hover:text-white text-xs h-9 gap-1.5" onClick={onOpen}>
              <Info className="w-3.5 h-3.5" />Details
            </Button>
            {t.status === 'upcoming' && !isReg && (
              <Button size="sm" disabled={registering || isFull}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs h-9 gap-1.5 font-bold"
                onClick={onRegister}>
                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {isFull ? 'Full' : 'Register'}
              </Button>
            )}
            {t.status === 'upcoming' && isReg && (
              <Button size="sm" variant="outline" className="flex-1 border-red-500/25 text-red-400 hover:bg-red-500/8 text-xs h-9" onClick={onWithdraw}>
                Withdraw
              </Button>
            )}
            {t.status === 'ongoing' && (
              <Button size="sm" className="flex-1 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs h-9 gap-1.5" onClick={onOpen}>
                <Flame className="w-3.5 h-3.5 animate-pulse" />View Live
              </Button>
            )}
            {t.status === 'completed' && (
              <Button size="sm" variant="outline" className="flex-1 border-white/10 text-white/40 text-xs h-9 gap-1.5" onClick={onOpen}>
                <BarChart2 className="w-3.5 h-3.5" />Results
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ t, isReg, participants, liveUpdates, loading, onClose, onRegister, onWithdraw, onShare, registering }: {
  t: Tournament; isReg: boolean; participants: Participant[]; liveUpdates: LiveUpdate[];
  loading: boolean; onClose: () => void; onRegister: () => void; onWithdraw: () => void;
  onShare: () => void; registering: boolean;
}) {
  const [searchP, setSearchP] = useState('');
  const gameImg  = resolveGameImage(t.games?.name ?? '', t.games?.image_url);
  const gameName = t.games?.name ?? 'Unknown';
  const isFull   = t.current_players >= t.max_players;
  const pct      = Math.round((t.current_players / t.max_players) * 100);
  const filtered = useMemo(() =>
    participants.filter(p => p.profiles?.username?.toLowerCase().includes(searchP.toLowerCase())),
    [participants, searchP]);

  const modalTabs = [
    { value: 'overview', label: 'Overview', icon: Info },
    { value: 'prizes',   label: 'Prizes',   icon: Trophy },
    { value: 'schedule', label: 'Schedule', icon: Calendar },
    { value: 'players',  label: `Players (${participants.length})`, icon: Users },
    { value: 'stream',   label: 'Stream',   icon: Tv },
    { value: 'rules',    label: 'Rules',    icon: BookOpen },
    ...(t.status === 'ongoing' ? [{ value: 'live', label: 'Live', icon: Flame }] : []),
  ];

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Hero */}
      <div className={`relative h-40 sm:h-52 flex-shrink-0 overflow-hidden bg-gradient-to-br ${gameGradient(gameName)}`}>
        {gameImg && <img src={gameImg} alt={gameName} className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d1a]/70 via-transparent to-transparent" />
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white backdrop-blur-sm transition-all z-20">
          <X className="w-4 h-4" />
        </button>
        <button onClick={onShare} className="absolute top-4 right-16 w-9 h-9 rounded-xl bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white backdrop-blur-sm transition-all z-20">
          <Share2 className="w-4 h-4" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <div className="flex items-end gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/50 border-2 border-white/20 flex items-center justify-center flex-shrink-0">
              {gameImg ? <img src={gameImg} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">{t.games?.icon ?? '🎮'}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-orbitron font-black text-lg sm:text-xl text-white leading-tight line-clamp-2">{t.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusPill status={t.status} />
                <span className="text-xs text-white/50">{gameName}</span>
                {isReg && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold"><UserCheck className="w-2.5 h-2.5" />Registered</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="overview" className="flex flex-col">
          <div className="px-4 pt-2 border-b border-white/8 sticky top-0 bg-card/95 backdrop-blur-xl z-10">
            <TabsList className="w-full h-auto p-0 bg-transparent gap-0 overflow-x-auto scrollbar-hide flex">
              {modalTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:text-cyan-400 text-white/50 hover:text-white/80 bg-transparent">
                  <tab.icon className="w-3.5 h-3.5" />{tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Overview */}
          <TabsContent value="overview" className="p-5 space-y-5 mt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: DollarSign, label: 'Prize Pool', val: t.prize_pool, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                { icon: Users,      label: 'Players',    val: `${t.current_players}/${t.max_players}`, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
                { icon: Clock,      label: 'Duration',   val: t.duration, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                { icon: Shield,     label: 'Entry Fee',  val: t.entry_fee ?? 'Free', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
              ].map(({ icon: Icon, label, val, color, bg }) => (
                <div key={label} className={`p-3.5 rounded-2xl border ${bg} flex flex-col gap-1`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                  <div className="font-bold text-sm truncate">{val}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tournament Date</p>
                  <p className="font-bold text-sm">{fmtDate(t.date)}</p>
                </div>
                {t.status === 'upcoming' && !isPast(new Date(t.date)) && (
                  <div><p className="text-xs text-muted-foreground mb-1">Starts In</p><Countdown to={t.date} /></div>
                )}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-muted-foreground">Registration</span>
                  <span>{pct}% ({t.current_players}/{t.max_players})</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
                </div>
              </div>
            </div>

            {t.description && (
              <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-cyan-400" />About</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
              </div>
            )}
            {t.winner && (
              <div className="p-4 rounded-2xl bg-yellow-500/8 border border-yellow-500/20 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-2xl flex-shrink-0">🏆</div>
                <div><p className="text-xs text-muted-foreground">Tournament Champion</p><p className="font-orbitron font-black text-yellow-400 text-lg">{t.winner}</p></div>
              </div>
            )}
            {t.status === 'upcoming' && (
              !isReg ? (
                <Button disabled={registering || isFull} onClick={onRegister}
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm gap-2">
                  {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isFull ? 'Tournament Full' : "Register Now — It's Free"}
                </Button>
              ) : (
                <Button variant="outline" onClick={onWithdraw} className="w-full h-12 border-red-500/25 text-red-400 hover:bg-red-500/8 font-bold text-sm">
                  Withdraw Registration
                </Button>
              )
            )}
          </TabsContent>

          {/* Prizes */}
          <TabsContent value="prizes" className="p-5 space-y-5 mt-0">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10 border border-yellow-500/20">
              <Trophy className="w-12 h-12 mx-auto text-yellow-400 mb-3" />
              <p className="text-muted-foreground text-sm mb-1">Total Prize Pool</p>
              <p className="font-orbitron font-black text-3xl sm:text-4xl text-yellow-400">{t.prize_pool}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {PRIZE_TIERS.map(tier => <PrizeTierCard key={tier.place} tier={tier} totalStr={t.prize_pool} />)}
            </div>
          </TabsContent>

          {/* Schedule */}
          <TabsContent value="schedule" className="p-5 mt-0"><ScheduleTimeline tournament={t} /></TabsContent>

          {/* Players */}
          <TabsContent value="players" className="p-5 space-y-4 mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search players…" value={searchP} onChange={e => setSearchP(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-cyan-500/40" />
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-10 h-10 mx-auto text-white/15 mb-3" />
                <p className="text-muted-foreground text-sm">{searchP ? 'No results.' : 'No participants yet.'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/6 transition-all">
                    <span className="w-7 text-center text-sm flex-shrink-0">
                      {i < 3 ? ['🥇','🥈','🥉'][i] : <span className="text-muted-foreground text-xs font-mono">{i+1}</span>}
                    </span>
                    <PAv username={p.profiles?.username ?? '?'} url={p.profiles?.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.profiles?.username ?? 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">Joined {formatDistanceToNow(new Date(p.registered_at), { addSuffix: true })}</p>
                    </div>
                    {p.checked_in && <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/20 shrink-0"><UserCheck className="w-2.5 h-2.5 mr-1" />In</Badge>}
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Stream */}
          <TabsContent value="stream" className="p-5 mt-0"><StreamSection /></TabsContent>

          {/* Rules */}
          <TabsContent value="rules" className="p-5 mt-0"><RulesSection rulesText={t.rules} /></TabsContent>

          {/* Live */}
          {t.status === 'ongoing' && (
            <TabsContent value="live" className="p-5 space-y-3 mt-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm font-bold text-red-400">Live Updates</span>
              </div>
              {liveUpdates.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">No live updates yet.</p>
              ) : liveUpdates.map(u => (
                <div key={u.id} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                  <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap mt-0.5">{format(new Date(u.created_at), 'HH:mm')}</span>
                  <p className="text-sm">{u.message}</p>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function Tournaments(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState('');
  const [activeFilter, setActiveFilter]   = useState<'all' | TStatus>('all');
  const [search, setSearch]               = useState('');
  const [detail, setDetail]               = useState<Tournament | null>(null);
  const [participants, setParticipants]   = useState<Participant[]>([]);
  const [liveUpdates, setLiveUpdates]     = useState<LiveUpdate[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [registering, setRegistering]     = useState(false);
  const [myRegs, setMyRegs]               = useState<Set<string>>(new Set());
  const [heroIdx, setHeroIdx]             = useState(0);
  const closingRef = useRef<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase
      .from('tournaments').select('*, games(name, icon, image_url)').order('date', { ascending: false });
    if (error) setFetchError(error.message);
    else setTournaments((data as Tournament[]) ?? []);
    setLoading(false);
  }, []);

  const loadMyRegs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('tournament_participants').select('tournament_id')
      .eq('user_id', user.id).neq('status', 'withdrawn');
    if (data) setMyRegs(new Set(data.map((r: { tournament_id: string }) => r.tournament_id)));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMyRegs(); }, [loadMyRegs]);
  useEffect(() => {
    const ch = supabase.channel('t_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // ── Hero rotation ─────────────────────────────────────────────────────────
  const heroTournaments = useMemo(() =>
    tournaments
      .filter(isVisibleOnPublic)
      .filter(t => t.status === 'ongoing' || t.status === 'upcoming')
      .sort((a, b) => (a.status === 'ongoing' ? -1 : 1) - (b.status === 'ongoing' ? -1 : 1))
      .slice(0, 5),
    [tournaments]);
  useEffect(() => {
    if (heroTournaments.length <= 1) return;
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroTournaments.length), 7000);
    return () => clearInterval(id);
  }, [heroTournaments.length]);

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const openDetail = useCallback(async (t: Tournament) => {
    closingRef.current = null;
    setDetail(t);
    const p = new URLSearchParams(searchParams);
    p.set('id', t.id);
    setSearchParams(p, { replace: true });
    setLoadingDetail(true);
    const [partRes, liveRes] = await Promise.all([
      supabase.from('tournament_participants').select('*, profiles(username, avatar_url)')
        .eq('tournament_id', t.id).neq('status', 'withdrawn').order('registered_at', { ascending: true }),
      supabase.from('live_updates').select('*').eq('tournament_id', t.id)
        .order('created_at', { ascending: false }).limit(20),
    ]);
    setParticipants((partRes.data as Participant[]) ?? []);
    setLiveUpdates((liveRes.data as LiveUpdate[]) ?? []);
    setLoadingDetail(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const closeDetail = useCallback(() => {
    if (detail) closingRef.current = detail.id;
    setDetail(null);
    setParticipants([]);
    const p = new URLSearchParams(searchParams);
    p.delete('id');
    setSearchParams(p, { replace: true });
  }, [detail, searchParams, setSearchParams]);

  // URL auto-open
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && tournaments.length > 0 && !detail && id !== closingRef.current) {
      const found = tournaments.find(t => t.id === id);
      if (found) openDetail(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tournaments]);

  // ── Registration ──────────────────────────────────────────────────────────
  const handleRegister = useCallback(async (t: Tournament) => {
    if (!isAuthenticated || !user) { toast.error('Sign in to register.'); return; }
    if (t.current_players >= t.max_players) { toast.error('Tournament is full.'); return; }
    if (myRegs.has(t.id)) { toast.info('Already registered!'); return; }
    setRegistering(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournament_participants') as any).insert({ tournament_id: t.id, user_id: user.id });
    if (error) {
      if (error.code === '23505') toast.info('Already registered!');
      else toast.error('Registration failed: ' + error.message);
    } else {
      setMyRegs(prev => new Set([...prev, t.id]));
      if (detail?.id === t.id) {
        const { data } = await supabase.from('tournament_participants').select('*, profiles(username, avatar_url)')
          .eq('tournament_id', t.id).neq('status', 'withdrawn').order('registered_at', { ascending: true });
        setParticipants((data as Participant[]) ?? []);
      }
      load();
      const isFirst = myRegs.size === 0;
      await awardXpAndNotify(user.id, isFirst ? 'first_tournament' : 'tournament_joined', { tournament: t.name });
    }
    setRegistering(false);
  }, [isAuthenticated, user, myRegs, detail, load]);

  const handleWithdraw = useCallback(async (t: Tournament) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournament_participants') as any)
      .update({ status: 'withdrawn' }).eq('tournament_id', t.id).eq('user_id', user.id);
    if (error) { toast.error('Withdrawal failed.'); return; }
    toast.success('Withdrawn from tournament.');
    setMyRegs(prev => { const s = new Set(prev); s.delete(t.id); return s; });
    if (detail?.id === t.id) closeDetail();
    load();
  }, [user, detail, closeDetail, load]);

  const handleShare = useCallback(async (t: Tournament, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/tournaments?id=${t.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: t.name, text: `Join ${t.name} — Prize: ${t.prize_pool}`, url }); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const visibleTournaments = useMemo(() => tournaments.filter(isVisibleOnPublic), [tournaments]);

  const counts = useMemo(() => ({
    all:       visibleTournaments.length,
    upcoming:  visibleTournaments.filter(t => t.status === 'upcoming').length,
    ongoing:   visibleTournaments.filter(t => t.status === 'ongoing').length,
    completed: visibleTournaments.filter(t => t.status === 'completed').length,
  }), [visibleTournaments]);

  const totalPlayers = useMemo(() => visibleTournaments.reduce((s, t) => s + t.current_players, 0), [visibleTournaments]);

  const totalPrize = useMemo(() => {
    const n = visibleTournaments.reduce((s, t) => s + prizeNumber(t.prize_pool), 0);
    const cur = visibleTournaments.find(t => t.prize_pool)?.prize_pool?.replace(/[0-9,.\s]/g, '').trim() || '₦';
    return n > 0 ? `${cur}${n.toLocaleString()}` : '—';
  }, [visibleTournaments]);

  const filtered = useMemo(() =>
    visibleTournaments.filter(t =>
      (activeFilter === 'all' || t.status === activeFilter) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.games?.name.toLowerCase().includes(search.toLowerCase()))
    ), [visibleTournaments, activeFilter, search]);

  const heroT = heroTournaments[heroIdx] ?? null;

  const FILTER_TABS = [
    { value: 'all' as const,       label: 'All',       icon: Hash },
    { value: 'upcoming' as const,  label: 'Upcoming',  icon: Calendar },
    { value: 'ongoing' as const,   label: 'Live',      icon: Flame },
    { value: 'completed' as const, label: 'Completed', icon: CheckCircle },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24">
      <TournamentsSEO />

      {/* ═══════════════════════ HERO SECTION ════════════════════════════════ */}
      <section className="relative min-h-[88vh] sm:min-h-[80vh] flex items-end overflow-hidden">
        {/* Background */}
        <AnimatePresence mode="sync">
          {heroT ? (
            <motion.div key={heroT.id} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.9 }} className="absolute inset-0">
              {resolveGameImage(heroT.games?.name ?? '', heroT.games?.image_url) ? (
                <img src={resolveGameImage(heroT.games?.name ?? '', heroT.games?.image_url)!} alt=""
                  className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gameGradient(heroT.games?.name)}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/55 to-[#0a0a14]/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a14]/85 via-transparent to-transparent" />
            </motion.div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-purple-950/40 to-[#0a0a14]" />
          )}
        </AnimatePresence>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(0,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,1) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />

        {/* Floating decorations */}
        <motion.div animate={{ y: [0,-14,0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-28 right-10 sm:right-20 w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 hidden sm:flex items-center justify-center backdrop-blur-sm">
          <Trophy className="w-7 h-7 text-cyan-400" />
        </motion.div>
        <motion.div animate={{ y: [0,10,0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
          className="absolute top-48 right-36 w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 hidden lg:flex items-center justify-center backdrop-blur-sm">
          <Zap className="w-5 h-5 text-purple-400" />
        </motion.div>
        <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          className="absolute top-36 right-60 w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 hidden xl:flex items-center justify-center backdrop-blur-sm">
          <Swords className="w-4 h-4 text-pink-400" />
        </motion.div>

        {/* Hero content */}
        <div className="relative z-10 w-full pt-24 sm:pt-28 pb-14 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {heroT ? (
              <motion.div key={heroT.id} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <StatusPill status={heroT.status} />
                  <span className="text-white/50 text-sm">{heroT.games?.icon} {heroT.games?.name}</span>
                  {heroT.entry_fee && heroT.entry_fee !== 'Free' && heroT.entry_fee !== '0' && (
                    <span className="px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs">{heroT.entry_fee} entry</span>
                  )}
                </div>

                <h1 className="font-orbitron font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-5 max-w-3xl">
                  {heroT.name}
                </h1>

                <div className="flex items-center flex-wrap gap-4 mb-6 text-sm">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Trophy className="w-4 h-4" />
                    <span className="font-bold">{heroT.prize_pool}</span>
                    <span className="text-white/40">prize pool</span>
                  </div>
                  <div className="w-px h-4 bg-white/20 hidden sm:block" />
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Users className="w-4 h-4" />
                    <span className="font-bold">{heroT.current_players}/{heroT.max_players}</span>
                    <span className="text-white/40">players</span>
                  </div>
                  <div className="w-px h-4 bg-white/20 hidden sm:block" />
                  <div className="flex items-center gap-2 text-purple-300">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(heroT.date), 'MMM d, yyyy')}</span>
                  </div>
                  {heroT.duration && (
                    <>
                      <div className="w-px h-4 bg-white/20 hidden sm:block" />
                      <div className="flex items-center gap-2 text-white/50">
                        <Clock className="w-4 h-4" />
                        <span>{heroT.duration}</span>
                      </div>
                    </>
                  )}
                </div>

                {heroT.status === 'upcoming' && !isPast(new Date(heroT.date)) && (
                  <div className="mb-7 inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm">
                    <Clock className="w-4 h-4 text-white/40" />
                    <span className="text-xs text-white/40 uppercase tracking-wider">Starts In</span>
                    <Countdown to={heroT.date} />
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {heroT.status === 'upcoming' && !myRegs.has(heroT.id) && (
                    <Button onClick={() => handleRegister(heroT)} disabled={registering || heroT.current_players >= heroT.max_players}
                      className="h-12 px-8 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold gap-2 rounded-2xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all btn-glow">
                      {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}Register Now
                    </Button>
                  )}
                  {heroT.status === 'upcoming' && myRegs.has(heroT.id) && (
                    <Button className="h-12 px-8 bg-green-500/20 border border-green-500/30 text-green-400 font-bold gap-2 rounded-2xl hover:bg-green-500/30">
                      <UserCheck className="w-4 h-4" />You're Registered
                    </Button>
                  )}
                  {heroT.status === 'ongoing' && (
                    <Button onClick={() => openDetail(heroT)}
                      className="h-12 px-8 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-bold gap-2 rounded-2xl">
                      <Flame className="w-4 h-4 animate-pulse" />Watch Live
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => openDetail(heroT)}
                    className="h-12 px-6 border-white/15 text-white hover:bg-white/8 rounded-2xl gap-2 font-bold">
                    <Info className="w-4 h-4" />Tournament Details
                  </Button>
                  <button onClick={() => handleShare(heroT)}
                    className="h-12 w-12 flex items-center justify-center rounded-2xl border border-white/15 text-white/60 hover:text-white hover:bg-white/8 transition-all">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : !loading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="font-orbitron font-black text-4xl sm:text-5xl md:text-6xl text-white mb-4">
                  Tournament <span className="gradient-text">Arena</span>
                </h1>
                <p className="text-white/50 text-lg max-w-xl mb-6">Africa's premier esports tournament platform.</p>
                {isAuthenticated && (
                  <Link to="/tournaments/create">
                    <Button className="h-12 px-8 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2 rounded-2xl">
                      <Zap className="w-4 h-4" />Create Tournament
                    </Button>
                  </Link>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Carousel dots */}
          {heroTournaments.length > 1 && (
            <div className="flex items-center gap-2 mt-8">
              {heroTournaments.map((_, i) => (
                <button key={i} onClick={() => setHeroIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === heroIdx ? 'w-8 bg-cyan-400' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Scroll cue */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2.2, repeat: Infinity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 text-white/25 pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </section>

      {/* ═══════════════════════ STATS BAR ═══════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="relative z-10 -mt-8 max-w-7xl mx-auto px-4 sm:px-6 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Trophy,     label: 'Tournaments',   val: counts.all,   suffix: '',  color: 'text-cyan-400',   border: 'border-cyan-500/20',   bg: 'from-cyan-500/15 to-cyan-600/5' },
            { icon: Flame,      label: 'Live Now',      val: counts.ongoing, suffix: '', color: 'text-red-400',   border: 'border-red-500/20',    bg: 'from-red-500/15 to-red-600/5' },
            { icon: Users,      label: 'Total Players', val: totalPlayers, suffix: '+', color: 'text-purple-400', border: 'border-purple-500/20', bg: 'from-purple-500/15 to-purple-600/5' },
            { icon: DollarSign, label: 'Prize Pools',   val: 0, rawVal: totalPrize, color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'from-yellow-500/15 to-yellow-600/5' },
          ].map(({ icon: Icon, label, val, suffix, rawVal, color, border, bg }) => (
            <motion.div key={label} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}
              className={`gaming-card p-5 text-center bg-gradient-to-br ${bg} border ${border}`}>
              <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
              <div className={`font-orbitron font-black text-2xl ${color} mb-0.5`}>
                {rawVal ? rawVal : loading ? '—' : <AnimatedNumber value={val} suffix={suffix} />}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══════════════════════ TOURNAMENT DISCOVERY ════════════════════════ */}
      <motion.section className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 content-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-orbitron font-bold text-2xl sm:text-3xl">All <span className="gradient-text">Tournaments</span></h2>
            <p className="text-muted-foreground text-sm mt-1">Find your next challenge</p>
          </div>
          <Link to="/tournaments/create">
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2 font-bold btn-glow">
              <Zap className="w-4 h-4" />Create Tournament
            </Button>
          </Link>
        </div>

        {/* Filters + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setActiveFilter(value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  activeFilter === value
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 shadow-lg shadow-cyan-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/8'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
                <span className="ml-1 text-xs opacity-50">({counts[value]})</span>
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 focus:border-cyan-500/40 h-9 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {fetchError ? (
          <div className="text-center py-20">
            <X className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <Button onClick={load} variant="outline" size="sm">Retry</Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1,2,3,4,5,6].map(i => <TSkel key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                <Trophy className="w-16 h-16 mx-auto text-white/10 mb-4" />
                <h3 className="font-orbitron text-xl text-white/40 mb-2">No tournaments found</h3>
                <p className="text-muted-foreground text-sm mb-6">{search ? `No results for "${search}"` : 'Try a different filter'}</p>
                <Button onClick={() => { setActiveFilter('all'); setSearch(''); }} variant="outline" size="sm">Clear Filters</Button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map(t => (
                  <TournamentCard key={t.id} t={t} isReg={myRegs.has(t.id)}
                    onOpen={() => openDetail(t)} onRegister={() => handleRegister(t)}
                    onWithdraw={() => handleWithdraw(t)} onShare={() => handleShare(t)}
                    registering={registering} />
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </motion.section>

      {/* ═══════════════════════ PRIZE SHOWCASE ══════════════════════════════ */}
      {visibleTournaments.some(t => t.status !== 'completed') && (
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 content-section">
          <div className="gaming-card p-6 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-amber-500/3 to-orange-500/5" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h2 className="font-orbitron font-bold text-xl sm:text-2xl">Prize Pool Breakdown</h2>
                  <p className="text-sm text-muted-foreground">Standard distribution across all tournaments</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {PRIZE_TIERS.map((tier, i) => (
                  <motion.div key={tier.place} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <PrizeTierCard tier={tier} totalStr={totalPrize === '—' ? '₦100,000' : totalPrize} />
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-yellow-500/8 border border-yellow-500/15">
                <div className="text-center sm:text-left">
                  <p className="text-muted-foreground text-sm">Combined Prize Pool</p>
                  <p className="font-orbitron font-black text-3xl text-yellow-400">{totalPrize}</p>
                </div>
                <Button onClick={() => { setActiveFilter('all'); window.scrollTo({ top: 600, behavior: 'smooth' }); }}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold gap-2">
                  <Trophy className="w-4 h-4" />View All Tournaments
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════ SPONSORS ════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 content-section">
        <div className="gaming-card p-6 sm:p-8">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-6">Powered By Our Partners</p>
          <div className="flex items-center justify-center flex-wrap gap-6 sm:gap-10">
            {SPONSORS.map(s => (
              <motion.div key={s.name} whileHover={{ scale: 1.12, y: -2 }} transition={{ duration: 0.2 }}
                className="flex items-center gap-2 opacity-35 hover:opacity-90 transition-opacity cursor-pointer">
                <span className="text-2xl">{s.logo}</span>
                <span className={`font-orbitron font-bold text-sm ${s.color}`}>{s.name}</span>
                {s.tier === 'title' && <Crown className="w-3 h-3 text-yellow-400" />}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════ HALL OF FAME ════════════════════════════════ */}
      <HallOfFame completed={visibleTournaments.filter(t => t.status === 'completed')} />

      {/* ═══════════════════════ CTA BANNER ══════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="max-w-7xl mx-auto px-4 sm:px-6 mt-20 mb-8 content-section">
        <div className="relative gaming-card p-8 sm:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-purple-500/6 to-pink-500/8" />
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/8 rounded-full -translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/8 rounded-full translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/30">
              <Swords className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-orbitron font-black text-2xl sm:text-3xl md:text-4xl text-white mb-3">
              Ready to <span className="gradient-text">Compete?</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Join Africa's most competitive esports platform. Prove your skills, climb the ranks, and claim your prize.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {isAuthenticated ? (
                <Link to="/tournaments/create">
                  <Button className="h-12 px-8 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2 rounded-2xl shadow-lg shadow-cyan-500/25 btn-glow">
                    <Zap className="w-4 h-4" />Create a Tournament
                  </Button>
                </Link>
              ) : (
                <Link to="/register">
                  <Button className="h-12 px-8 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2 rounded-2xl shadow-lg shadow-cyan-500/25 btn-glow">
                    <Zap className="w-4 h-4" />Join PulsePlay Free
                  </Button>
                </Link>
              )}
              <Link to="/community">
                <Button variant="outline" className="h-12 px-6 border-white/15 text-white hover:bg-white/8 rounded-2xl gap-2">
                  <Globe className="w-4 h-4" />Join Community
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════ DETAIL DIALOG ═══════════════════════════════ */}
      <Dialog open={!!detail} onOpenChange={v => { if (!v) closeDetail(); }}>
        <DialogContent className="max-w-2xl w-full p-0 glass border-border/30 overflow-hidden max-h-[92vh] flex flex-col [&>button]:hidden">
          {detail && (
            <DetailModal
              t={detail} isReg={myRegs.has(detail.id)}
              participants={participants} liveUpdates={liveUpdates} loading={loadingDetail}
              onClose={closeDetail} onRegister={() => handleRegister(detail)}
              onWithdraw={() => handleWithdraw(detail)} onShare={() => handleShare(detail)}
              registering={registering}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
