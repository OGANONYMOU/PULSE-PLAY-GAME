import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Calendar, Users, DollarSign, Clock, ArrowRight,
  Filter, Flame, CheckCircle, RefreshCw, Loader2, X, Info,
  UserCheck, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

type TStatus = 'upcoming' | 'ongoing' | 'completed';

type GameRef = { name: string; icon: string } | null;

type Tournament = {
  id: string; name: string; game_id: string; status: TStatus;
  date: string; prize_pool: string; max_players: number; current_players: number;
  duration: string; winner: string | null; description: string | null;
  rules: string | null; entry_fee: string | null; created_at: string;
  games: GameRef;
};

type Participant = {
  id: string; status: string; checked_in: boolean; registered_at: string;
  seed: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

type LiveUpdate = { id: string; message: string; created_at: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try { return format(new Date(iso), 'MMM d, yyyy · h:mm a'); }
  catch { return iso; }
}
function gameColor(name = '') {
  const m: Record<string, string> = {
    efootball: 'from-green-500 to-emerald-600', fifa: 'from-green-500 to-emerald-600',
    pubg: 'from-amber-500 to-yellow-600', 'free fire': 'from-red-500 to-orange-600',
    cod: 'from-cyan-500 to-blue-600', 'mobile legends': 'from-yellow-500 to-orange-600',
    fortnite: 'from-purple-500 to-pink-600',
  };
  const lc = name.toLowerCase();
  for (const [k, v] of Object.entries(m)) if (lc.includes(k)) return v;
  return 'from-cyan-500 to-purple-600';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TStatus }) {
  if (status === 'ongoing')   return <Badge className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"><Flame className="w-3 h-3 mr-1" />Live Now</Badge>;
  if (status === 'upcoming')  return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50"><Calendar className="w-3 h-3 mr-1" />Upcoming</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/50"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
}

function AvatarOrInitial({ url, username }: { url: string | null; username: string }) {
  return (
    <Avatar className="w-8 h-8">
      {url && <AvatarImage src={url} alt={username} />}
      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function TournamentSkeleton() {
  return (
    <div className="gaming-card overflow-hidden">
      <div className="h-28 bg-white/5 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-white/10 rounded w-2/3 animate-pulse" />
        <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i=><div key={i} className="h-3 bg-white/10 rounded animate-pulse"/>)}</div>
        <div className="h-2 bg-white/10 rounded animate-pulse" />
        <div className="h-9 bg-white/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Tournaments(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState('');
  const [activeFilter, setActiveFilter]   = useState<'all' | TStatus>('all');
  const [detail, setDetail]               = useState<Tournament | null>(null);
  const [participants, setParticipants]   = useState<Participant[]>([]);
  const [liveUpdates, setLiveUpdates]     = useState<LiveUpdate[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [registering, setRegistering]     = useState(false);
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, games(name, icon)')
      .order('date', { ascending: false });
    if (error) { setFetchError(error.message); }
    else { setTournaments((data as Tournament[]) ?? []); }
    setLoading(false);
  }, []);

  const loadMyRegistrations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)
      .neq('status', 'withdrawn');
    if (data) setMyRegistrations(new Set(data.map((r: { tournament_id: string }) => r.tournament_id)));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMyRegistrations(); }, [loadMyRegistrations]);

  // Real-time participant count updates
  useEffect(() => {
    const channel = supabase.channel('tournament_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const openDetail = async (t: Tournament) => {
    setDetail(t);
    setLoadingDetail(true);
    const [partRes, liveRes] = await Promise.all([
      supabase
        .from('tournament_participants')
        .select('*, profiles(username, avatar_url)')
        .eq('tournament_id', t.id)
        .neq('status', 'withdrawn')
        .order('registered_at', { ascending: true }),
      supabase
        .from('live_updates')
        .select('*')
        .eq('tournament_id', t.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setParticipants((partRes.data as Participant[]) ?? []);
    setLiveUpdates((liveRes.data as LiveUpdate[]) ?? []);
    setLoadingDetail(false);
  };

  const handleRegister = async (t: Tournament) => {
    if (!isAuthenticated || !user) { toast.error('Please sign in to register.'); return; }
    if (t.current_players >= t.max_players) { toast.error('Tournament is full.'); return; }
    if (myRegistrations.has(t.id)) { toast.info('You are already registered.'); return; }

    setRegistering(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournament_participants') as any)
      .insert({ tournament_id: t.id, user_id: user.id });

    if (error) {
      if (error.code === '23505') { toast.info('Already registered.'); }
      else { toast.error('Registration failed: ' + error.message); }
    } else {
      toast.success(`Registered for ${t.name}! 🎮`);
      setMyRegistrations(prev => new Set([...prev, t.id]));
      if (detail?.id === t.id) {
        // Reload participants in detail dialog
        const { data } = await supabase
          .from('tournament_participants')
          .select('*, profiles(username, avatar_url)')
          .eq('tournament_id', t.id)
          .neq('status', 'withdrawn')
          .order('registered_at', { ascending: true });
        setParticipants((data as Participant[]) ?? []);
      }
      load();
    }
    setRegistering(false);
  };

  const handleWithdraw = async (t: Tournament) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournament_participants') as any)
      .update({ status: 'withdrawn' })
      .eq('tournament_id', t.id)
      .eq('user_id', user.id);
    if (error) { toast.error('Withdrawal failed.'); return; }
    toast.success('Withdrawn from tournament.');
    setMyRegistrations(prev => { const s = new Set(prev); s.delete(t.id); return s; });
    load();
  };

  const filtered = tournaments.filter(t => activeFilter === 'all' || t.status === activeFilter);
  const counts = {
    all: tournaments.length,
    upcoming: tournaments.filter(t => t.status === 'upcoming').length,
    ongoing:  tournaments.filter(t => t.status === 'ongoing').length,
    completed: tournaments.filter(t => t.status === 'completed').length,
  };

  const FILTERS = [
    { value: 'all' as const,       label: 'All' },
    { value: 'upcoming' as const,  label: 'Upcoming' },
    { value: 'ongoing' as const,   label: 'Live' },
    { value: 'completed' as const, label: 'Completed' },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      {/* Hero */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="max-w-7xl mx-auto text-center mb-10">
        <h1 className="font-orbitron text-3xl xs:text-4xl md:text-5xl font-bold mb-3">
          Tournament <span className="gradient-text">Arena</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Compete in live and upcoming tournaments. Real registrations, real brackets.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto">
          {[
            { label:'Total', val: loading ? '—' : counts.all, Icon: Trophy, color:'text-cyan-400' },
            { label:'Live',  val: loading ? '—' : counts.ongoing, Icon: Flame, color:'text-red-400' },
            { label:'Players', val: loading ? '—' : tournaments.reduce((s,t)=>s+t.current_players,0), Icon: Users, color:'text-purple-400' },
          ].map(({ label, val, Icon, color }) => (
            <div key={label} className="gaming-card p-4 text-center">
              <Icon className={`w-6 h-6 mx-auto mb-1 ${color}`} />
              <div className="font-orbitron text-xl font-bold">{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Filter bar */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        className="max-w-7xl mx-auto mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" /><span>Filter by status</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <Button key={f.value} size="sm" onClick={() => setActiveFilter(f.value)}
              className={`rounded-full text-xs h-8 ${
                activeFilter === f.value
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
              {f.label} <span className="ml-1 opacity-50">({counts[f.value]})</span>
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} className="h-8 text-white/40 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>

      {/* Error */}
      {fetchError ? (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
            <X className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <Button onClick={load} size="sm" variant="outline">Retry</Button>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {loading ? (
              [1,2,3,4].map(i => <TournamentSkeleton key={i} />)
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div key="empty" className="col-span-2 text-center py-20">
                    <Trophy className="w-14 h-14 mx-auto text-white/20 mb-4" />
                    <h3 className="font-orbitron text-lg text-white mb-2">No tournaments here</h3>
                    <Button onClick={() => setActiveFilter('all')} variant="outline" size="sm">Show All</Button>
                  </motion.div>
                ) : filtered.map((t, i) => {
                  const gameName  = t.games?.name ?? 'Unknown';
                  const gameIcon  = t.games?.icon ?? '🎮';
                  const pct       = Math.round((t.current_players / t.max_players) * 100);
                  const isFull    = t.current_players >= t.max_players;
                  const isReg     = myRegistrations.has(t.id);

                  return (
                    <motion.div key={t.id} layout initial={{ opacity:0, scale:0.97 }}
                      animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.97 }}
                      transition={{ duration:0.22, delay: i * 0.04 }}>
                      <div className="gaming-card overflow-hidden h-full flex flex-col">
                        {/* Banner */}
                        <div className={`relative h-28 bg-gradient-to-br ${gameColor(gameName)} cursor-pointer`}
                          onClick={() => openDetail(t)}>
                          <div className="absolute inset-0 bg-black/20" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-5xl">{gameIcon}</span>
                          </div>
                          <div className="absolute top-3 left-3"><StatusBadge status={t.status} /></div>
                          {isReg && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[10px]">
                                <UserCheck className="w-2.5 h-2.5 mr-1" />Registered
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Body */}
                        <div className="p-5 flex-1 flex flex-col">
                          <button className="text-left mb-3" onClick={() => openDetail(t)}>
                            <h3 className="font-orbitron text-base font-bold mb-1 hover:text-cyan-400 transition-colors">
                              {t.name}
                            </h3>
                            <Badge variant="outline" className="text-[10px]">{gameName}</Badge>
                          </button>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 flex-shrink-0" />{format(new Date(t.date), 'MMM d, yyyy')}</div>
                            <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 flex-shrink-0" />{t.prize_pool}</div>
                            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 flex-shrink-0" />{t.current_players}/{t.max_players}</div>
                            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 flex-shrink-0" />{t.duration}</div>
                          </div>

                          {/* Fill bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-muted-foreground">Registration</span>
                              <span className={isFull ? 'text-red-400 font-bold' : 'text-white/60'}>{isFull ? 'Full' : `${pct}%`}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>

                          {t.winner && (
                            <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2 text-xs">
                              <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                              <span className="text-yellow-400 font-bold">🏆 {t.winner}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-auto">
                            <Button size="sm" variant="outline"
                              className="flex-1 border-white/15 text-white/60 hover:bg-white/8 text-xs h-8"
                              onClick={() => openDetail(t)}>
                              <Info className="w-3.5 h-3.5 mr-1" />Details
                            </Button>

                            {t.status === 'upcoming' && !isReg && (
                              <Button size="sm" disabled={registering || isFull}
                                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs h-8"
                                onClick={() => handleRegister(t)}>
                                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowRight className="w-3.5 h-3.5 mr-1" />}
                                {isFull ? 'Full' : 'Register'}
                              </Button>
                            )}

                            {t.status === 'upcoming' && isReg && (
                              <Button size="sm" variant="outline"
                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
                                onClick={() => handleWithdraw(t)}>
                                Withdraw
                              </Button>
                            )}

                            {t.status === 'ongoing' && (
                              <Button size="sm"
                                className="flex-1 border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs h-8"
                                onClick={() => openDetail(t)}>
                                <Flame className="w-3.5 h-3.5 mr-1 animate-pulse" />View Live
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}>
        <DialogContent className="max-w-2xl glass border-border/40 max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-orbitron flex items-center gap-2">
                  <span className="text-2xl">{detail.games?.icon ?? '🎮'}</span>
                  <div>
                    <div className="text-base">{detail.name}</div>
                    <div className="text-xs text-muted-foreground font-normal mt-0.5">
                      {detail.games?.name} · {fmtDate(detail.date)}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-2 my-1">
                <StatusBadge status={detail.status} />
                {myRegistrations.has(detail.id) && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                    <UserCheck className="w-2.5 h-2.5 mr-1" />You are registered
                  </Badge>
                )}
              </div>

              <Tabs defaultValue="info">
                <TabsList className="mb-4">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="participants">Participants ({detail.current_players})</TabsTrigger>
                  {detail.status === 'ongoing' && <TabsTrigger value="live">Live Updates</TabsTrigger>}
                </TabsList>

                {/* Info */}
                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: DollarSign, label: 'Prize Pool', val: detail.prize_pool, cls: 'text-yellow-400' },
                      { icon: Users,      label: 'Players',    val: `${detail.current_players}/${detail.max_players}`, cls: 'text-cyan-400' },
                      { icon: Clock,      label: 'Duration',   val: detail.duration, cls: 'text-purple-400' },
                      { icon: Shield,     label: 'Entry Fee',  val: detail.entry_fee ?? 'Free', cls: 'text-green-400' },
                    ].map(({ icon: Icon, label, val, cls }) => (
                      <div key={label} className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${cls} flex-shrink-0`} />
                        <div>
                          <div className="text-[10px] text-muted-foreground">{label}</div>
                          <div className="text-sm font-bold">{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {detail.description && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">About</div>
                      <p className="text-sm leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {detail.rules && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Rules</div>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{detail.rules}</p>
                    </div>
                  )}

                  {detail.winner && (
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Champion</div>
                        <div className="font-bold text-yellow-400">{detail.winner}</div>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {detail.status === 'upcoming' && !myRegistrations.has(detail.id) && (
                    <Button disabled={registering || detail.current_players >= detail.max_players}
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                      onClick={() => handleRegister(detail)}>
                      {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {detail.current_players >= detail.max_players ? 'Tournament Full' : 'Register Now'}
                    </Button>
                  )}
                  {detail.status === 'upcoming' && myRegistrations.has(detail.id) && (
                    <Button variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleWithdraw(detail)}>
                      Withdraw Registration
                    </Button>
                  )}
                </TabsContent>

                {/* Participants */}
                <TabsContent value="participants">
                  {loadingDetail ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : participants.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No participants yet. Be the first to register!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {participants.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                          <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i+1}.</span>
                          <AvatarOrInitial url={p.profiles?.avatar_url ?? null} username={p.profiles?.username ?? '?'} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.profiles?.username ?? 'Unknown'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Joined {formatDistanceToNow(new Date(p.registered_at), { addSuffix: true })}
                            </div>
                          </div>
                          {p.checked_in && (
                            <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30">
                              <UserCheck className="w-2.5 h-2.5 mr-1" />Checked In
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Live */}
                {detail.status === 'ongoing' && (
                  <TabsContent value="live">
                    {liveUpdates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">No live updates yet.</div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {liveUpdates.map(u => (
                          <div key={u.id} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 font-mono">
                              {format(new Date(u.created_at), 'HH:mm')}
                            </span>
                            <p className="text-sm">{u.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}