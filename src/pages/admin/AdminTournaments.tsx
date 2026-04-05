import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, AlertCircle, Loader2, Flame, Calendar, CheckCircle,
  Users, RefreshCw, Trophy, DollarSign, Clock, Shield,
  UserCheck, ChevronDown, ChevronRight, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

type TStatus = 'upcoming' | 'ongoing' | 'completed';

type Tournament = {
  id: string; name: string; status: TStatus; date: string;
  prize_pool: string; max_players: number; current_players: number;
  duration: string; winner: string | null; description: string | null;
  rules: string | null; entry_fee: string | null;
  games: { name: string; icon: string } | null;
};

type Game = { id: string; name: string; icon: string };

type Participant = {
  id: string; user_id: string; status: string; checked_in: boolean; registered_at: string; seed: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

const emptyForm = {
  name: '', game_id: '', status: 'upcoming' as TStatus, date: '', prize_pool: '',
  max_players: 64, duration: '1 Day', description: '', rules: '', entry_fee: '₦0', winner: '',
};

function StatusBadge({ status }: { status: TStatus }) {
  if (status === 'ongoing')   return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"><Flame className="w-3 h-3 mr-1"/>Live</Badge>;
  if (status === 'upcoming')  return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40"><Calendar className="w-3 h-3 mr-1"/>Upcoming</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/40"><CheckCircle className="w-3 h-3 mr-1"/>Completed</Badge>;
}

function AvatarSmall({ url, username }: { url: string | null; username: string }) {
  return (
    <Avatar className="w-7 h-7">
      {url && <AvatarImage src={url} />}
      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px] font-bold">
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Participant panel ─────────────────────────────────────────────────────────
function ParticipantsPanel({
  tournamentId, onClose,
}: {
  tournamentId: string;
  onClose: () => void;
}) {
  const [parts, setParts]     = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tournament_participants')
      .select('*, profiles(username, avatar_url)')
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true });
    setParts((data as Participant[]) ?? []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (partId: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tournament_participants') as any).update({ status }).eq('id', partId);
    setParts(prev => prev.map(p => p.id === partId ? { ...p, status } : p));
    toast.success('Status updated');
  };

  const checkIn = async (partId: string, current: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tournament_participants') as any).update({
      checked_in: !current,
      checked_in_at: !current ? new Date().toISOString() : null,
    }).eq('id', partId);
    setParts(prev => prev.map(p => p.id === partId ? { ...p, checked_in: !current } : p));
    toast.success(!current ? 'Checked in' : 'Check-in reversed');
  };

  const statusConfig: Record<string, string> = {
    registered: 'bg-cyan-500/15 text-cyan-400',
    checked_in: 'bg-green-500/15 text-green-400',
    eliminated: 'bg-red-500/15 text-red-400',
    winner:     'bg-yellow-500/15 text-yellow-400',
    withdrawn:  'bg-white/10 text-white/30',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-orbitron font-bold text-sm">
          Participants <span className="text-muted-foreground font-normal">({parts.length})</span>
        </h3>
        <Button size="sm" variant="ghost" onClick={load} className="h-7 gap-1.5 text-muted-foreground hover:text-white">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i)=><Skeleton key={i} className="h-12 rounded-xl"/>)}</div>
      ) : parts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No registrations yet.</div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {parts.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/30 group">
              <span className="text-xs text-muted-foreground w-5 text-right">{i+1}</span>
              <AvatarSmall url={p.profiles?.avatar_url ?? null} username={p.profiles?.username ?? '?'} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.profiles?.username ?? 'Unknown'}</div>
                <div className="text-[10px] text-muted-foreground">Registered {format(new Date(p.registered_at), 'MMM d')}</div>
              </div>

              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusConfig[p.status] ?? 'bg-white/10 text-white/40'}`}>
                {p.status}
              </span>

              {/* Check-in toggle */}
              <button onClick={() => checkIn(p.id, p.checked_in)}
                className={`p-1 rounded-lg transition-all text-xs ${p.checked_in ? 'text-green-400 bg-green-500/10 hover:bg-red-500/10 hover:text-red-400' : 'text-muted-foreground bg-white/5 hover:bg-green-500/10 hover:text-green-400'}`}
                title={p.checked_in ? 'Undo check-in' : 'Check in'}>
                <UserCheck className="w-3.5 h-3.5" />
              </button>

              {/* Status */}
              <Select value={p.status} onValueChange={v => setStatus(p.id, v)}>
                <SelectTrigger className="w-24 h-6 text-[10px] bg-muted/30 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="eliminated">Eliminated</SelectItem>
                  <SelectItem value="winner">Winner</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AdminTournaments(): React.ReactElement {
  const { profile } = useAuth();
  const [tournaments, setTournaments]   = useState<Tournament[]>([]);
  const [games, setGames]               = useState<Game[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isOpen, setIsOpen]             = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const isSuper = profile?.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [tRes, gRes] = await Promise.all([
      supabase.from('tournaments').select('*, games(name, icon)').order('created_at', { ascending: false }),
      supabase.from('games').select('id, name, icon').order('name'),
    ]);
    setTournaments((tRes.data as Tournament[]) ?? []);
    setGames(gRes.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const logAudit = async (action: string, targetId: string, meta?: object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('audit_logs') as any).insert({
      actor_id: profile?.id,
      action,
      target_type: 'tournament',
      target_id: targetId,
      meta: meta ?? null,
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.game_id || !form.date || !form.prize_pool) {
      toast.error('Fill in required fields.'); return;
    }
    setIsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tournaments') as any).insert({
      name: form.name, game_id: form.game_id, status: form.status,
      date: new Date(form.date).toISOString(), prize_pool: form.prize_pool,
      max_players: form.max_players, current_players: 0, duration: form.duration,
      winner: form.winner || null, description: form.description || null,
      rules: form.rules || null, entry_fee: form.entry_fee || '₦0',
    }).select().single();

    if (error) { toast.error('Failed: ' + error.message); }
    else {
      toast.success('Tournament created!');
      await logAudit('create_tournament', data.id, { name: form.name });
      setIsOpen(false); setForm(emptyForm); fetchData();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournaments') as any).delete().eq('id', id);
    if (error) { toast.error('Failed to delete.'); return; }
    await logAudit('delete_tournament', id);
    toast.success('Tournament deleted.');
    setTournaments(prev => prev.filter(t => t.id !== id));
    setDeleteId(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tournaments') as any).update({ status }).eq('id', id);
    setTournaments(prev => prev.map(t => t.id === id ? { ...t, status: status as TStatus } : t));
    await logAudit('change_tournament_status', id, { status });
    toast.success(`Status → ${status}`);
  };

  const handleSetWinner = async (id: string, winner: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tournaments') as any).update({ winner, status: 'completed' }).eq('id', id);
    setTournaments(prev => prev.map(t => t.id === id ? { ...t, winner, status: 'completed' } : t));
    await logAudit('set_winner', id, { winner });
    toast.success('Winner set and tournament marked completed.');
  };

  const totalPrize   = tournaments.reduce((s, t) => { const n = parseFloat(t.prize_pool.replace(/[^0-9.]/g,'')); return s + (isNaN(n)?0:n); }, 0);
  const liveCount    = tournaments.filter(t => t.status === 'ongoing').length;
  const upcomingCount = tournaments.filter(t => t.status === 'upcoming').length;

  const f = form;
  const setF = (k: keyof typeof emptyForm, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="p-5 sm:p-7 max-w-7xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Tournaments</h1>
          <p className="text-white/35 text-sm">{tournaments.length} total · {liveCount} live · {upcomingCount} upcoming</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={fetchData} disabled={isLoading}
            className="text-white/40 hover:text-white hover:bg-white/8 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => { setForm(emptyForm); setIsOpen(true); }}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2 font-bold text-sm">
            <Plus className="w-4 h-4" />Create Tournament
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total', val: tournaments.length, Icon: Trophy, cls:'text-cyan-400' },
          { label:'Live',  val: liveCount,           Icon: Flame,  cls:'text-red-400' },
          { label:'Upcoming', val: upcomingCount,    Icon: Calendar, cls:'text-purple-400' },
          { label:'Prize Pool', val: `₦${(totalPrize/1000).toFixed(0)}K`, Icon: DollarSign, cls:'text-yellow-400' },
        ].map(({ label, val, Icon, cls }) => (
          <div key={label} className="p-4 rounded-2xl bg-white/4 border border-white/8 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${cls} flex-shrink-0`} />
            <div>
              <div className="font-orbitron text-lg font-black text-white">{val}</div>
              <div className="text-[10px] text-white/35">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tournament list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-20 rounded-2xl"/>)}</div>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}
              transition={{ delay: i * 0.04 }}>
              <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-3 p-4 flex-wrap">
                  <span className="text-2xl flex-shrink-0">{t.games?.icon ?? '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron font-bold text-sm text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-white/35 flex items-center gap-3 mt-0.5 flex-wrap">
                      <span>{t.games?.name}</span>
                      <span className="flex items-center gap-0.5"><DollarSign className="w-2.5 h-2.5"/>{t.prize_pool}</span>
                      <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5"/>{t.current_players}/{t.max_players}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/>{t.duration}</span>
                      <span>{format(new Date(t.date), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <StatusBadge status={t.status} />

                  <Select value={t.status} onValueChange={v => handleStatusChange(t.id, v)}>
                    <SelectTrigger className="w-28 h-7 text-xs bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all" title="View participants">
                    {expandedId === t.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {isSuper && (
                    <button onClick={() => setDeleteId(t.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Expanded participants */}
                {expandedId === t.id && (
                  <div className="border-t border-white/8 p-4">
                    <ParticipantsPanel tournamentId={t.id} onClose={() => setExpandedId(null)} />

                    {/* Set winner */}
                    {t.status !== 'completed' && (
                      <div className="mt-4 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
                        <p className="text-xs text-yellow-400 mb-2 font-bold flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" />Set Winner &amp; Complete Tournament
                        </p>
                        <div className="flex gap-2">
                          <Input placeholder="Winner username or team name"
                            className="h-8 text-xs bg-white/5 border-white/10 text-white"
                            id={`winner-${t.id}`} />
                          <Button size="sm" className="h-8 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                            onClick={() => {
                              const el = document.getElementById(`winner-${t.id}`) as HTMLInputElement;
                              if (el?.value) handleSetWinner(t.id, el.value);
                            }}>
                            Confirm
                          </Button>
                        </div>
                      </div>
                    )}

                    {t.winner && (
                      <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-400 font-bold">Champion: {t.winner}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass border-border/50 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron">Create Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Name *</Label>
              <Input value={f.name} onChange={e=>setF('name',e.target.value)} className="mt-1" placeholder="eFootball Premier League" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Game *</Label>
                <Select value={f.game_id} onValueChange={v=>setF('game_id',v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…"/></SelectTrigger>
                  <SelectContent>{games.map(g=><SelectItem key={g.id} value={g.id}>{g.icon} {g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={f.status} onValueChange={v=>setF('status',v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date &amp; Time *</Label>
                <Input type="datetime-local" value={f.date} onChange={e=>setF('date',e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Prize Pool *</Label>
                <Input value={f.prize_pool} onChange={e=>setF('prize_pool',e.target.value)} className="mt-1" placeholder="₦500,000" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Max Players</Label>
                <Input type="number" value={f.max_players} onChange={e=>setF('max_players',Number(e.target.value))} className="mt-1" /></div>
              <div><Label className="text-xs">Duration</Label>
                <Input value={f.duration} onChange={e=>setF('duration',e.target.value)} className="mt-1" placeholder="3 Days" /></div>
              <div><Label className="text-xs">Entry Fee</Label>
                <Input value={f.entry_fee} onChange={e=>setF('entry_fee',e.target.value)} className="mt-1" placeholder="₦0" /></div>
            </div>
            <div><Label className="text-xs">Description</Label>
              <Textarea value={f.description} onChange={e=>setF('description',e.target.value)} className="mt-1 min-h-[70px]" placeholder="Tournament overview…" /></div>
            <div><Label className="text-xs">Rules</Label>
              <Textarea value={f.rules} onChange={e=>setF('rules',e.target.value)} className="mt-1 min-h-[70px]" placeholder="Match rules, format, etc." /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=>setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-cyan-500 to-purple-600 gap-1.5">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={()=>setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5"/>Delete Tournament
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently delete the tournament and all registered participants. Cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=>setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={()=>deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}