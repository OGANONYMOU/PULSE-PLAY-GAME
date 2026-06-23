// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay — Room Code Panel
// Organizers publish room ID + password per session/game.
// Participants see their room codes (with countdown if not yet open).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Copy, Eye, EyeOff, Plus, Loader2, Clock, Lock, Unlock, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface RoomCode {
  id: string;
  tournament_id: string;
  session_number: number;
  game_number: number;
  room_id: string;
  room_password: string;
  opens_at: string | null;
  note: string | null;
  created_at: string;
}

interface RoomCodePanelProps {
  tournamentId: string;
  canManage: boolean;
  gamesPerSession?: number;
  maxSessions?: number;
}

function CountdownPill({ opensAt }: { opensAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOpen, setIsOpen] = useState(isPast(new Date(opensAt)));

  useEffect(() => {
    const update = () => {
      const open = isPast(new Date(opensAt));
      setIsOpen(open);
      if (!open) setTimeLeft(formatDistanceToNow(new Date(opensAt), { addSuffix: true }));
    };
    update();
    const t = setInterval(update, 10_000);
    return () => clearInterval(t);
  }, [opensAt]);

  if (isOpen) return (
    <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/12 border border-green-500/25 px-2 py-0.5 rounded-full font-bold">
      <Unlock className="w-2.5 h-2.5" />Open
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/12 border border-yellow-500/25 px-2 py-0.5 rounded-full font-bold">
      <Clock className="w-2.5 h-2.5" />Opens {timeLeft}
    </span>
  );
}

function RoomCodeCard({ code }: { code: RoomCode }) {
  const [showPass, setShowPass] = useState(false);
  const isLocked = code.opens_at && !isPast(new Date(code.opens_at));

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-2xl border space-y-3',
        isLocked ? 'bg-white/3 border-white/8 opacity-60' : 'bg-white/4 border-white/10'
      )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Key className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              Session {code.session_number} · Game {code.game_number}
            </p>
            {code.note && <p className="text-[10px] text-white/35">{code.note}</p>}
          </div>
        </div>
        {code.opens_at
          ? <CountdownPill opensAt={code.opens_at} />
          : <span className="text-[10px] text-green-400 bg-green-500/12 border border-green-500/25 px-2 py-0.5 rounded-full font-bold">Available</span>
        }
      </div>

      {!isLocked && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/8 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Room ID</p>
              <p className="font-mono text-sm text-white font-bold truncate">{code.room_id}</p>
            </div>
            <button onClick={() => copy(code.room_id, 'Room ID')}
              className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors flex-shrink-0">
              <Copy className="w-3 h-3 text-white/50" />
            </button>
          </div>
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/8 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Password</p>
              <p className="font-mono text-sm text-white font-bold truncate">
                {showPass ? code.room_password : '••••••'}
              </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => setShowPass(v => !v)}
                className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                {showPass ? <EyeOff className="w-3 h-3 text-white/50" /> : <Eye className="w-3 h-3 text-white/50" />}
              </button>
              <button onClick={() => copy(code.room_password, 'Password')}
                className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                <Copy className="w-3 h-3 text-white/50" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
          <Lock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <p className="text-[10px] text-yellow-400/80">
            Room code will be revealed {code.opens_at ? formatDistanceToNow(new Date(code.opens_at), { addSuffix: true }) : 'soon'}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export function RoomCodePanel({ tournamentId, canManage, gamesPerSession = 4, maxSessions = 6 }: RoomCodePanelProps) {
  const [codes, setCodes] = useState<RoomCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    session: 1,
    game: 1,
    room_id: '',
    room_password: '',
    opens_at: '',
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('tournament_room_codes')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('session_number')
      .order('game_number');
    setCodes((data ?? []) as RoomCode[]);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.room_id.trim() || !form.room_password.trim()) {
      toast.error('Room ID and Password are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('upsert_room_code', {
        p_tournament_id: tournamentId,
        p_session: form.session,
        p_game: form.game,
        p_room_id: form.room_id.trim(),
        p_room_password: form.room_password.trim(),
        p_opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        p_note: form.note.trim() || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success(`Room code for S${form.session}G${form.game} saved!`);
      setShowForm(false);
      setForm({ session: 1, game: 1, room_id: '', room_password: '', opens_at: '', note: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const selectCls = 'w-full h-9 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm appearance-none outline-none focus:border-cyan-500/50';
  const inputCls = 'w-full h-9 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm outline-none focus:border-cyan-500/50 placeholder:text-white/20';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-orbitron font-bold text-sm text-white">Room Codes</h3>
          <p className="text-[10px] text-white/35 mt-0.5">
            {canManage ? 'Publish room ID + password per game. Participants see them automatically.' : 'Room IDs and passwords for each game session.'}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-bold hover:bg-orange-500/25 transition-all">
            <Plus className="w-3.5 h-3.5" />
            {showForm ? 'Cancel' : 'Add Code'}
          </button>
        )}
      </div>

      {/* Organizer form */}
      <AnimatePresence>
        {canManage && showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 space-y-3">
            <p className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">Publish Room Code</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Session #</label>
                <div className="relative">
                  <select value={form.session} onChange={e => setForm(p => ({ ...p, session: parseInt(e.target.value) }))} className={selectCls}>
                    {Array.from({ length: maxSessions }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Session {n}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Game #</label>
                <div className="relative">
                  <select value={form.game} onChange={e => setForm(p => ({ ...p, game: parseInt(e.target.value) }))} className={selectCls}>
                    {Array.from({ length: gamesPerSession }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Game {n}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Room ID *</label>
                <input value={form.room_id} onChange={e => setForm(p => ({ ...p, room_id: e.target.value }))}
                  placeholder="e.g. PULSE2024" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Password *</label>
                <input value={form.room_password} onChange={e => setForm(p => ({ ...p, room_password: e.target.value }))}
                  placeholder="e.g. abc123" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Opens At (optional)</label>
                <input type="datetime-local" value={form.opens_at} onChange={e => setForm(p => ({ ...p, opens_at: e.target.value }))}
                  className={inputCls + ' text-white/70'} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Note (optional)</label>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. TPP Lobby" className={inputCls} />
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !form.room_id || !form.room_password}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Save Room Code
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room codes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : codes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-white/20">
          <Key className="w-10 h-10" />
          <p className="text-xs text-center">
            {canManage
              ? 'No room codes yet. Add one above before each game starts.'
              : 'Room codes will appear here before each game. Check back closer to match time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(code => <RoomCodeCard key={code.id} code={code} />)}
        </div>
      )}
    </div>
  );
}
