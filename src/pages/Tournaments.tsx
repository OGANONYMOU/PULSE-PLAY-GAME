import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Calendar, Users, DollarSign, Clock, ArrowRight,
  Filter, Flame, CheckCircle, RefreshCw, Loader2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

type TStatus = 'upcoming' | 'ongoing' | 'completed';

type GameRef = { name: string; icon: string } | null;

type Tournament = {
  id: string;
  name: string;
  game_id: string;
  status: TStatus;
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
  duration: string;
  winner: string | null;
  created_at: string;
  games: GameRef;
};

type LiveUpdate = {
  id: string;
  tournament_id: string;
  message: string;
  created_at: string;
};

type RegisteringId = string | null;

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return format(new Date(iso), 'MMM d, yyyy'); }
  catch { return iso; }
}

function gameColor(name: string): string {
  const map: Record<string, string> = {
    'Call of Duty': 'from-cyan-500 to-blue-600',
    'FIFA':         'from-green-500 to-emerald-600',
    'eFootball':    'from-green-500 to-emerald-600',
    'Fortnite':     'from-purple-500 to-pink-600',
    'PUBG':         'from-amber-500 to-yellow-600',
    'Mobile Legends': 'from-yellow-500 to-orange-600',
    'Free Fire':    'from-red-500 to-orange-600',
    'Mortal Kombat':'from-red-500 to-orange-600',
  };
  for (const [key, val] of Object.entries(map)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'from-cyan-500 to-purple-600';
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge(p: { status: TStatus }): React.ReactElement {
  if (p.status === 'ongoing') {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse">
        <Flame className="w-3 h-3 mr-1" />Live Now
      </Badge>
    );
  }
  if (p.status === 'upcoming') {
    return (
      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
        <Calendar className="w-3 h-3 mr-1" />Upcoming
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
      <CheckCircle className="w-3 h-3 mr-1" />Completed
    </Badge>
  );
}

function WinnerBanner(p: { winner: string | null }): React.ReactElement {
  return p.winner ? (
    <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
      <div className="flex items-center gap-2 text-sm">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <span className="text-yellow-400 font-bold">Champion: {p.winner}</span>
      </div>
    </div>
  ) : <span />;
}

function TournamentSkeleton(): React.ReactElement {
  return (
    <div className="gaming-card overflow-hidden">
      <div className="h-32 bg-white/5 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-5 bg-white/10 rounded w-2/3 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-white/10 rounded animate-pulse" />)}
        </div>
        <div className="h-2 bg-white/10 rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="flex-1 h-9 bg-white/10 rounded-xl animate-pulse" />
          <div className="flex-1 h-9 bg-white/10 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EmptyTournaments(p: { filter: string; onClear: () => void }): React.ReactElement {
  return (
    <div className="col-span-2 text-center py-20">
      <Trophy className="w-16 h-16 mx-auto text-white/20 mb-4" />
      <h3 className="font-orbitron text-xl font-bold text-white mb-2">No tournaments found</h3>
      <p className="text-white/40 text-sm mb-6">
        {p.filter !== 'all' ? 'No tournaments in this category.' : 'No tournaments available yet.'}
      </p>
      {p.filter !== 'all' ? (
        <Button onClick={p.onClear} variant="outline" className="border-white/20 text-white hover:bg-white/10">Show All</Button>
      ) : null}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function Tournaments(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | TStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [registeringId, setRegisteringId] = useState<RegisteringId>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, games(name, icon)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Tournaments] fetch error:', error.message);
      setFetchError(error.message);
    } else {
      setTournaments((data as Tournament[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLive = async (id: string) => {
    setSelectedId(id);
    setLoadingUpdates(true);
    const { data } = await supabase
      .from('live_updates')
      .select('*')
      .eq('tournament_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLiveUpdates((data as LiveUpdate[]) ?? []);
    setLoadingUpdates(false);
  };

  const handleRegister = async (t: Tournament) => {
    if (!isAuthenticated || !user) { toast.error('Please sign in to register.'); return; }
    if (t.current_players >= t.max_players) { toast.error('Tournament is full.'); return; }
    setRegisteringId(t.id);
    const { error } = await supabase
      .from('tournaments')
      .update({ current_players: t.current_players + 1 } as never)
      .eq('id', t.id);
    if (error) {
      toast.error('Registration failed: ' + error.message);
    } else {
      toast.success('Registered for ' + t.name + '!');
      load();
    }
    setRegisteringId(null);
  };

  const filtered = tournaments.filter((t) => activeFilter === 'all' || t.status === activeFilter);
  const counts = {
    all: tournaments.length,
    upcoming: tournaments.filter((t) => t.status === 'upcoming').length,
    ongoing:  tournaments.filter((t) => t.status === 'ongoing').length,
    completed: tournaments.filter((t) => t.status === 'completed').length,
  };
  const totalPrize = tournaments.reduce((sum, t) => {
    const n = parseFloat(t.prize_pool.replace(/[^0-9.]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const selectedTournament = tournaments.find((t) => t.id === selectedId) ?? null;

  const FILTERS: { value: 'all' | TStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ongoing', label: 'Live' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen pt-24 px-4 sm:px-6 pb-16">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto text-center mb-12">
        <h1 className="font-orbitron text-4xl md:text-5xl font-bold mb-4">
          Tournament <span className="gradient-text">Arena</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Browse live, upcoming, and completed tournaments across the PulsePay community
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="gaming-card p-6">
            <Trophy className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold">{loading ? '—' : counts.all}</div>
            <div className="text-sm text-muted-foreground">Total Tournaments</div>
          </div>
          <div className="gaming-card p-6">
            <DollarSign className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold">
              {loading ? '—' : '&#x20A6;' + (totalPrize >= 1000000 ? (totalPrize / 1000000).toFixed(1) + 'M' : (totalPrize / 1000).toFixed(0) + 'K')}
            </div>
            <div className="text-sm text-muted-foreground">Total Prize Pool</div>
          </div>
          <div className="gaming-card p-6">
            <Users className="w-8 h-8 text-pink-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold">
              {loading ? '—' : tournaments.reduce((s, t) => s + t.current_players, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Players</div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-sm">Filter Tournaments</span>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                onClick={() => setActiveFilter(f.value)}
                className={
                  'rounded-full text-xs h-9 ' +
                  (activeFilter === f.value
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white')
                }
              >
                {f.label}
                <span className="ml-1.5 opacity-60">({counts[f.value]})</span>
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {fetchError ? (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
            <X className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <Button onClick={load} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loading ? (
              [1, 2, 3, 4].map((i) => <TournamentSkeleton key={i} />)
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <EmptyTournaments key="empty" filter={activeFilter} onClear={() => setActiveFilter('all')} />
                ) : (
                  filtered.map((t, i) => {
                    const gameName = t.games?.name ?? 'Unknown Game';
                    const gameIcon = t.games?.icon ?? '🎮';
                    const pct = Math.round((t.current_players / t.max_players) * 100);
                    const isFull = t.current_players >= t.max_players;
                    const isRegistering = registeringId === t.id;
                    return (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25, delay: i * 0.05 }}
                      >
                        <div className="gaming-card overflow-hidden h-full flex flex-col">
                          <div className={'relative h-32 bg-gradient-to-br ' + gameColor(gameName)}>
                            <div className="absolute inset-0 opacity-20 bg-black" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-6xl">{gameIcon}</span>
                            </div>
                            <div className="absolute top-4 left-4">
                              <StatusBadge status={t.status} />
                            </div>
                          </div>
                          <div className="p-6 flex-1 flex flex-col">
                            <div className="mb-4">
                              <h3 className="font-orbitron text-xl font-bold mb-1">{t.name}</h3>
                              <Badge variant="outline" className="text-xs">{gameName}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 flex-shrink-0" />{fmtDate(t.date)}</div>
                              <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 flex-shrink-0" />{t.prize_pool}</div>
                              <div className="flex items-center gap-2"><Users className="w-4 h-4 flex-shrink-0" />{t.current_players}/{t.max_players}</div>
                              <div className="flex items-center gap-2"><Clock className="w-4 h-4 flex-shrink-0" />{t.duration}</div>
                            </div>
                            <div className="mb-4">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Registration</span>
                                <span className={isFull ? 'text-red-400 font-medium' : 'font-medium'}>{isFull ? 'Full' : pct + '%'}</span>
                              </div>
                              <Progress value={pct} className="h-2" />
                            </div>
                            <WinnerBanner winner={t.winner} />
                            <div className="flex gap-3 mt-auto">
                              {t.status === 'ongoing' ? (
                                <Button
                                  variant="outline"
                                  className="flex-1 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                                  onClick={() => openLive(t.id)}
                                >
                                  <Flame className="mr-2 w-4 h-4 animate-pulse" />View Live
                                </Button>
                              ) : null}
                              {t.status === 'upcoming' ? (
                                <Button
                                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                                  onClick={() => handleRegister(t)}
                                  disabled={isRegistering || isFull}
                                >
                                  {isRegistering ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <ArrowRight className="mr-2 w-4 h-4" />}
                                  {isRegistering ? 'Registering...' : isFull ? 'Full' : 'Register Now'}
                                </Button>
                              ) : null}
                              {t.status === 'completed' ? (
                                <Button className="flex-1 bg-muted hover:bg-muted/80" disabled>
                                  <CheckCircle className="mr-2 w-4 h-4" />Completed
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* Live Dialog */}
      <Dialog open={!!selectedId} onOpenChange={() => { setSelectedId(null); setLiveUpdates([]); }}>
        <DialogContent className="max-w-lg glass">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400 animate-pulse" />
              {selectedTournament?.name ?? 'Live Updates'}
            </DialogTitle>
          </DialogHeader>
          {loadingUpdates ? (
            <div className="flex items-center justify-center py-8 gap-3 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading updates...</span>
            </div>
          ) : liveUpdates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No live updates yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {liveUpdates.map((u) => (
                <div key={u.id} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-white/30 whitespace-nowrap mt-0.5">
                    {format(new Date(u.created_at), 'HH:mm')}
                  </span>
                  <p className="text-sm text-white/80">{u.message}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}