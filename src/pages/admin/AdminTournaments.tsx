import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, AlertCircle, Loader2, Trophy, Calendar,
  CheckCircle, Clock, Play, X, Save, RefreshCw, Search, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

type Status = 'upcoming' | 'ongoing' | 'completed';

type Tournament = {
  id: string;
  name: string;
  status: Status;
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
  duration: string;
  winner: string | null;
  game_id: string;
  created_at: string;
  games: { name: string; icon: string } | null;
};

type Game = { id: string; name: string; icon: string };

type TournamentInsert = {
  name: string; game_id: string; status: Status; date: string;
  prize_pool: string; max_players: number; current_players?: number;
  duration: string; winner?: string | null;
};

const BLANK = {
  name: '', game_id: '', status: 'upcoming' as Status,
  date: '', prize_pool: '0', max_players: 64,
  current_players: 0, duration: '2h', winner: '',
};

const STATUS_META: Record<Status, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  upcoming:  { label: 'Upcoming',  icon: Clock,         color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30'   },
  ongoing:   { label: 'Live',      icon: Play,          color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30'  },
  completed: { label: 'Completed', icon: CheckCircle,   color: 'text-white/40',   bg: 'bg-white/8 border-white/10'           },
};

function Field(p: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/50 uppercase tracking-wider font-medium">{p.label}</label>
      {p.children}
    </div>
  );
}

// ── Tournament form modal ─────────────────────────────────────────────────
function TournModal(p: {
  tournament?: Tournament;
  games: Game[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState(
    p.tournament
      ? { name: p.tournament.name, game_id: p.tournament.game_id, status: p.tournament.status, date: p.tournament.date.slice(0,16), prize_pool: p.tournament.prize_pool, max_players: p.tournament.max_players, current_players: p.tournament.current_players, duration: p.tournament.duration, winner: p.tournament.winner ?? '' }
      : { ...BLANK }
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!p.tournament;

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Tournament name is required.'); return; }
    if (!form.game_id)     { toast.error('Please select a game.'); return; }
    if (!form.date)        { toast.error('Please set a date.'); return; }
    setSaving(true);

    const payload: TournamentInsert = {
      name: form.name.trim(),
      game_id: form.game_id,
      status: form.status,
      date: form.date,
      prize_pool: form.prize_pool || '0',
      max_players: Number(form.max_players) || 64,
      current_players: Number(form.current_players) || 0,
      duration: form.duration || '2h',
      winner: form.winner.trim() || null,
    };

    let error: { message: string } | null = null;
    if (isEdit && p.tournament) {
      const res = await supabase.from('tournaments').update(payload as never).eq('id', p.tournament.id);
      error = res.error;
    } else {
      const res = await supabase.from('tournaments').insert(payload as never);
      error = res.error;
    }

    if (error) {
      const msg = error.message.includes('row-level security') || error.message.includes('permission')
        ? 'Permission denied — check Supabase RLS policies for tournaments table.'
        : error.message;
      toast.error(msg);
    } else {
      toast.success(isEdit ? 'Tournament updated.' : 'Tournament created.');
      p.onSaved();
      p.onClose();
    }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">{isEdit ? 'Edit Tournament' : 'New Tournament'}</h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Tournament Name">
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PUBG Open Cup #3" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Game">
              <select value={form.game_id} onChange={e => set('game_id', e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50">
                <option value="" className="bg-card text-white/40">Select game…</option>
                {p.games.map(g => <option key={g.id} value={g.id} className="bg-card">{g.icon} {g.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value as Status)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50">
                <option value="upcoming" className="bg-card">Upcoming</option>
                <option value="ongoing" className="bg-card">Ongoing / Live</option>
                <option value="completed" className="bg-card">Completed</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & Time">
              <Input type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Duration">
              <Input value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 2h" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Players">
              <Input type="number" value={form.max_players} onChange={e => set('max_players', Number(e.target.value))} className={inputCls} min={2} />
            </Field>
            <Field label="Prize Pool">
              <Input value={form.prize_pool} onChange={e => set('prize_pool', e.target.value)} placeholder="0" className={inputCls} />
            </Field>
          </div>

          {form.status === 'completed' ? (
            <Field label="Winner (username or team)">
              <Input value={form.winner} onChange={e => set('winner', e.target.value)} placeholder="Enter winner…" className={inputCls} />
            </Field>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 hover:text-white text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Create Tournament'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm(p: { tourn: Tournament; onClose: () => void; onDeleted: () => void }): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('tournaments').delete().eq('id', p.tourn.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Tournament deleted.'); p.onDeleted(); p.onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Tournament</h3>
            <p className="text-xs text-white/40">Cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">"{p.tourn.name}"</span>?</p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="flex-1 border border-white/10 text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Tournament row card ────────────────────────────────────────────────────
function TournRow(p: { t: Tournament; index: number; symbol: string; onEdit: () => void; onDelete: () => void; onStatus: (s: Status) => void }): React.ReactElement {
  const meta = STATUS_META[p.t.status];
  const StatusIcon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.index * 0.04 }}
      className="p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
          {p.t.games?.icon ?? '🏆'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-orbitron font-bold text-sm text-white truncate">{p.t.name}</span>
            <span className={'text-[10px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ' + meta.bg + ' ' + meta.color}>
              <StatusIcon className="w-2.5 h-2.5" />{meta.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/35 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(p.t.date).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.t.current_players}/{p.t.max_players}</span>
            <span className="font-mono">{p.symbol}{p.t.prize_pool}</span>
            {p.t.games?.name ? <span>{p.t.games.name}</span> : null}
          </div>
          {p.t.winner ? <p className="text-xs text-yellow-400 mt-1">🏆 Winner: {p.t.winner}</p> : null}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {p.t.status !== 'ongoing' ? (
            <button onClick={() => p.onStatus('ongoing')} title="Mark Live"
              className="p-1.5 rounded-lg hover:bg-green-500/20 text-white/30 hover:text-green-400 transition-all text-[10px]">▶</button>
          ) : null}
          {p.t.status !== 'completed' ? (
            <button onClick={() => p.onStatus('completed')} title="Mark Done"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all text-[10px]">✓</button>
          ) : null}
          <button onClick={p.onEdit} className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 transition-all">
            <Save className="w-3.5 h-3.5" />
          </button>
          <button onClick={p.onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminTournaments(): React.ReactElement {
  const { symbol } = useCurrency();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'new' | Tournament>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const [tRes, gRes] = await Promise.all([
      supabase.from('tournaments').select('*, games(name, icon)').order('date', { ascending: false }),
      supabase.from('games').select('id, name, icon').order('name'),
    ]);
    if (tRes.error) setFetchError(tRes.error.message);
    else setTournaments((tRes.data as Tournament[]) ?? []);
    if (!gRes.error) setGames((gRes.data as Game[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (t: Tournament, status: Status) => {
    const { error } = await supabase.from('tournaments').update({ status } as never).eq('id', t.id);
    if (error) toast.error(error.message);
    else { toast.success('Status updated.'); load(); }
  };

  const filtered = tournaments.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.games?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const counts = { upcoming: tournaments.filter(t => t.status === 'upcoming').length, ongoing: tournaments.filter(t => t.status === 'ongoing').length, completed: tournaments.filter(t => t.status === 'completed').length };

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Tournaments</h1>
          <p className="text-white/35 text-sm">{counts.upcoming} upcoming · {counts.ongoing} live · {counts.completed} completed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-40" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setModal('new')} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />New Tournament
          </Button>
        </div>
      </motion.div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {([['upcoming','blue'],['ongoing','green'],['completed','white/30']] as const).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            <span className={'w-2 h-2 rounded-full bg-' + c + '-400'} />
            <span className="capitalize">{s}</span>
            <span className="font-bold text-white ml-1">{counts[s]}</span>
          </div>
        ))}
      </div>

      {fetchError ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5 flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={load} className="text-red-400 text-xs h-7">Retry</Button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm mb-4">{search ? 'No tournaments match your search.' : 'No tournaments yet. Create the first one!'}</p>
          {!search ? (
            <Button size="sm" onClick={() => setModal('new')} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
              <Plus className="w-3.5 h-3.5" />Create Tournament
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => (
            <TournRow
              key={t.id} t={t} index={i} symbol={symbol}
              onEdit={() => setModal(t)}
              onDelete={() => setDeleteTarget(t)}
              onStatus={(s) => updateStatus(t, s)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal ? (
          <TournModal key="t-modal" tournament={modal !== 'new' ? modal : undefined} games={games} onClose={() => setModal(null)} onSaved={load} />
        ) : null}
        {deleteTarget ? (
          <DeleteConfirm key="d-modal" tourn={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
