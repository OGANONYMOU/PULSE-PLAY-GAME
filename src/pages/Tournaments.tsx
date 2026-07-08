import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy, Calendar, Users, DollarSign, Clock,
  Flame, CheckCircle, Loader2, X, Info, UserCheck, Share2,
  Zap, Crown, Search,
  Swords, Globe, ChevronDown,
  BarChart2, Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isPast, differenceInSeconds } from 'date-fns';
import { TournamentsSEO } from '@/components/SEO';
import { resolveGameImage } from '@/lib/gameImages';
import { awardXpAndNotify } from '@/hooks/useLevelUp';

// ── Types ─────────────────────────────────────────────────────────────────────
type TStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

function isVisibleOnPublic(t: Tournament): boolean {
  return t.status !== 'cancelled';
}

function isExpired(t: Tournament): boolean {
  return t.end_date != null && new Date(t.end_date) < new Date();
}

type Tournament = {
  id: string; name: string; game_id: string; status: TStatus;
  date: string; end_date: string | null; prize_pool: string; max_players: number; current_players: number;
  duration: string; winner: string | null; description: string | null;
  rules: string | null; entry_fee: string | null; created_at: string;
  games: { name: string; icon: string; image_url: string | null } | null;
};


// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function Tournaments(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState('');
  const [activeFilter, setActiveFilter]   = useState<'all' | TStatus>('all');
  const [search, setSearch]               = useState('');
  const [registering, setRegistering]     = useState(false);
  const [myRegs, setMyRegs]               = useState<Set<string>>(new Set());
  const [heroIdx, setHeroIdx]             = useState(0);

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    // Auto-expire tournaments whose end_date has passed
    await (supabase as any).rpc('auto_expire_tournaments');
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
      .filter(t => (t.status === 'ongoing' || t.status === 'upcoming') && !isExpired(t))
      .sort((a, b) => (a.status === 'ongoing' ? -1 : 1) - (b.status === 'ongoing' ? -1 : 1))
      .slice(0, 5),
    [tournaments]);
  useEffect(() => {
    if (heroTournaments.length <= 1) return;
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroTournaments.length), 7000);
    return () => clearInterval(id);
  }, [heroTournaments.length]);

  // ── Registration ──────────────────────────────────────────────────────────
  const handleRegister = useCallback(async (t: Tournament) => {
    if (!isAuthenticated || !user) { toast.error('Sign in to register.'); return; }
    if (t.current_players >= t.max_players) { toast.error('Tournament is full.'); return; }
    if (isExpired(t)) { toast.error('This tournament has ended.'); return; }
    if (myRegs.has(t.id)) { toast.info('Already registered!'); return; }
    setRegistering(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournament_participants') as any).insert({ tournament_id: t.id, user_id: user.id });
    if (error) {
      if (error.code === '23505') {
        // Unique constraint — could be a re-registration after withdrawal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rejoinErr } = await (supabase as any).rpc('rejoin_tournament', {
          p_tournament_id: t.id,
          p_in_game_username: null,
        });
        if (!rejoinErr) {
          setMyRegs(prev => new Set([...prev, t.id]));
          load();
          toast.success('Registered! Check in before the tournament starts. 🎮');
        } else {
          toast.info('Already registered!');
        }
      } else {
        toast.error('Registration failed: ' + error.message);
      }
    } else {
      setMyRegs(prev => new Set([...prev, t.id]));
      load();
      const isFirst = myRegs.size === 0;
      await awardXpAndNotify(user.id, isFirst ? 'first_tournament' : 'tournament_joined', { tournament: t.name });
    }
    setRegistering(false);
  }, [isAuthenticated, user, myRegs, load]);

  const handleWithdraw = useCallback(async (t: Tournament) => {
    if (!user) { toast.error('Sign in to withdraw.'); return; }
    if (t.status !== 'upcoming') {
      toast.error(t.status === 'ongoing' ? 'Tournament has already started.' : 'Tournament is completed.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('withdraw_from_tournament', {
      p_tournament_id: t.id,
    });
    if (error) {
      const msg: string = error.message ?? '';
      if (msg.includes('already started'))      toast.error('Tournament has already started.');
      else if (msg.includes('not registered') || msg.includes('not found'))
                                                 toast.error('Registration not found.');
      else if (msg.includes('completed'))        toast.error('Tournament is already completed.');
      else if (msg.includes('already withdrawn'))toast.error('Already withdrawn from this tournament.');
      else                                       toast.error(msg || 'Withdrawal failed. Please try again.');
      return;
    }
    toast.success('Successfully withdrawn from tournament.');
    setMyRegs(prev => { const s = new Set(prev); s.delete(t.id); return s; });
    load();
  }, [user, load]);

  const handleShare = useCallback(async (t: Tournament, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/tournaments/${t.id}`;
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
                    <Button onClick={() => navigate(`/tournaments/${heroT.id}`)}
                      className="h-12 px-8 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-bold gap-2 rounded-2xl">
                      <Flame className="w-4 h-4 animate-pulse" />Watch Live
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate(`/tournaments/${heroT.id}`)}
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
                    onOpen={() => navigate(`/tournaments/${t.id}`)} onRegister={() => handleRegister(t)}
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
                    <PrizeTierCard tier={tier} totalStr={totalPrize} />
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
    </div>
  );
}
