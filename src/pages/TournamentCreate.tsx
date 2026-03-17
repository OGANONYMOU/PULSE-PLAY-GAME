import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Users, Calendar, Zap, Shield, ChevronRight, ArrowLeft,
  Loader2, Plus, X, Lock, Globe, Info, Sparkles, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';

type Game = { id: string; name: string; icon: string; logo_url: string | null };

// ── Easy Mode config for eFootball ────────────────────────────────────────
const EFOOTBALL_EASY_MODE = {
  rules: `🎮 eFootball Tournament Rules

• Match Format: Best of 1 (single match per round)
• Time Limit: Standard match settings
• Score Submission: Both players submit scoreline with screenshot proof
• Opponent must confirm result within 24 hours
• Disputes resolved by admin within 48 hours
• No custom formations from opponent — use default settings
• Lag/disconnect: Reconnect within 5 minutes or forfeit
• Fair play expected — toxicity = GamerCred penalty`,
  format: 'best_of_1' as const,
  duration: '2h',
  maxPlayers: 32,
};

// ── Step components ────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-orbitron font-black transition-all ${
            i < current ? 'bg-green-500/20 border border-green-500/40 text-green-400' :
            i === current ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20' :
            'bg-white/8 border border-white/12 text-white/30'
          }`}>
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && <div className={`w-8 h-0.5 rounded-full ${i < current ? 'bg-green-500/40' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-xs text-white/55 uppercase tracking-wider font-medium">{label}</label>
      {required && <span className="text-red-400 text-xs">*</span>}
      {hint && (
        <div className="group relative">
          <Info className="w-3 h-3 text-white/25 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0d0d1e] border border-white/10 rounded-lg text-[10px] text-white/55 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
            {hint}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-10 text-sm rounded-xl';

// ── Main ───────────────────────────────────────────────────────────────────
export function TournamentCreate() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    game_id: '',
    easy_mode: false,
    format: 'best_of_1' as 'best_of_1' | 'best_of_3' | 'best_of_5',
    max_players: 16,
    entry_fee: 0,
    prize_amount: 0,
    date: '',
    registration_closes: '',
    check_in_open: '',
    check_in_close: '',
    rules: '',
    is_public: true,
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    supabase.from('games').select('id, name, icon, logo_url').order('name')
      .then(({ data }) => setGames((data as Game[]) ?? []));
  }, []);

  // Auto-fill eFootball easy mode
  useEffect(() => {
    const game = games.find(g => g.id === form.game_id);
    if (game && game.name.toLowerCase().includes('efootball') && form.easy_mode) {
      set('rules', EFOOTBALL_EASY_MODE.rules);
      set('format', EFOOTBALL_EASY_MODE.format);
      set('max_players', EFOOTBALL_EASY_MODE.maxPlayers);
    }
  }, [form.game_id, form.easy_mode, games]);

  const selectedGame = games.find(g => g.id === form.game_id);
  const isEFootball = selectedGame?.name.toLowerCase().includes('efootball');

  const STEPS = ['Game', 'Format', 'Schedule', 'Prize', 'Review'] as const;
  const PLAYER_OPTIONS = [8, 16, 32, 64, 128];

  const validate = (): string | null => {
    if (step === 0 && !form.game_id) return 'Select a game';
    if (step === 1 && !form.name.trim()) return 'Tournament name is required';
    if (step === 2 && !form.date) return 'Set a start date';
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const create = async () => {
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase.from('tournaments').insert({
      name              : form.name.trim(),
      game_id           : form.game_id,
      status            : 'upcoming',
      date              : form.date,
      prize_pool        : form.prize_amount > 0 ? `${form.prize_amount} PP` : '0',
      prize_amount      : form.prize_amount,
      entry_fee         : form.entry_fee,
      currency          : 'PulsePoints',
      max_players       : form.max_players,
      duration          : form.format === 'best_of_1' ? '2h' : form.format === 'best_of_3' ? '4h' : '6h',
      format            : form.format,
      rules             : form.rules.trim() || null,
      easy_mode         : form.easy_mode,
      is_public         : form.is_public,
      registration_closes: form.registration_closes || null,
      check_in_open     : form.check_in_open || null,
      check_in_close    : form.check_in_close || null,
      created_by        : user.id,
    } as never).select('id').single();

    if (error) { toast.error(error.message); setSaving(false); return; }
    const tId = (data as { id: string }).id;

    // Auto-add creator as tournament admin
    await supabase.from('tournament_admins').insert({ tournament_id: tId, user_id: user.id, role: 'host' } as never);

    // Audit
    await writeAuditLog({ actor_id: user.id, action: 'tournament.create', entity_type: 'tournament', entity_id: tId, data: { name: form.name } });

    toast.success('Tournament created! 🏆');
    navigate(`/tournaments/${tId}`);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen pt-24 flex items-center justify-center px-6 text-center">
      <div>
        <Shield className="w-14 h-14 mx-auto text-white/20 mb-4" />
        <p className="text-white/50 text-lg mb-4">Sign in to create tournaments</p>
        <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
          <Link to="/signin">Sign In</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tournaments" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />Back
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-orbitron text-3xl font-black text-white mb-2">Create Tournament</h1>
          <p className="text-white/40 text-sm">Set up a competition for your community</p>
        </div>

        <StepIndicator current={step} total={STEPS.length} />

        <AnimatePresence mode="wait">
          {/* ── Step 0: Game ── */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <h2 className="font-orbitron font-bold text-lg text-white">Select Game</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {games.map(g => (
                  <button key={g.id} onClick={() => set('game_id', g.id)}
                    className={`relative p-4 rounded-2xl border text-left transition-all ${
                      form.game_id === g.id
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                    }`}>
                    {form.game_id === g.id && <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-cyan-400" />}
                    <div className="w-10 h-10 rounded-xl overflow-hidden mb-3 bg-white/8">
                      {g.logo_url
                        ? <img src={g.logo_url} alt={g.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">{g.icon}</div>}
                    </div>
                    <p className="font-semibold text-sm text-white">{g.name}</p>
                  </button>
                ))}
              </div>

              {/* eFootball Easy Mode CTA */}
              {isEFootball && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    form.easy_mode ? 'border-yellow-500/40 bg-yellow-500/8' : 'border-white/10 bg-white/3 hover:border-yellow-500/30'
                  }`}
                  onClick={() => set('easy_mode', !form.easy_mode)}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-orbitron font-bold text-sm text-white">⚡ Easy Tournament Mode</p>
                        <div className={`w-10 h-5 rounded-full transition-all relative ${form.easy_mode ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-white/15'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${form.easy_mode ? 'left-5' : 'left-0.5'}`} />
                        </div>
                      </div>
                      <p className="text-xs text-white/45 mt-1">Pre-configured rules, format, and settings for eFootball. Perfect for quick community tournaments.</p>
                      {form.easy_mode && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[['Format', 'Best of 1'], ['Players', '32'], ['Duration', '~2h']].map(([k, v]) => (
                            <div key={k} className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/15">
                              <p className="text-[10px] text-yellow-400/60">{k}</p>
                              <p className="text-xs font-bold text-yellow-400">{v}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Step 1: Format ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <h2 className="font-orbitron font-bold text-lg text-white">Tournament Details</h2>
              <div>
                <FieldLabel label="Tournament Name" required />
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Lagos eFootball Cup #3" className={inputCls} />
              </div>

              <div>
                <FieldLabel label="Match Format" hint="Best of 1 is fastest, Best of 3/5 for serious events" />
                <div className="grid grid-cols-3 gap-2">
                  {(['best_of_1','best_of_3','best_of_5'] as const).map(f => (
                    <button key={f} onClick={() => set('format', f)}
                      disabled={form.easy_mode}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        form.format === f ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400' : 'border-white/10 text-white/45 hover:border-white/20'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {f.replace('_', ' ').replace('best of', 'BO')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel label="Max Players" hint="Must be a power of 2. BYEs auto-handled for other counts." />
                <div className="grid grid-cols-5 gap-2">
                  {PLAYER_OPTIONS.map(n => (
                    <button key={n} onClick={() => set('max_players', n)}
                      disabled={form.easy_mode}
                      className={`py-3 rounded-xl border text-sm font-orbitron font-black transition-all ${
                        form.max_players === n ? 'bg-purple-500/15 border-purple-500/35 text-purple-400' : 'border-white/10 text-white/45 hover:border-white/20'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel label="Visibility" />
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: true, icon: Globe, label: 'Public', desc: 'Anyone can join' }, { val: false, icon: Lock, label: 'Private', desc: 'Invite only' }].map(o => (
                    <button key={String(o.val)} onClick={() => set('is_public', o.val)}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                        form.is_public === o.val ? 'bg-white/8 border-white/20' : 'border-white/8 hover:border-white/15'
                      }`}>
                      <o.icon className="w-4 h-4 text-white/50 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-white">{o.label}</p>
                        <p className="text-[10px] text-white/35">{o.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel label="Rules" hint="Rules shown to all participants on the tournament page" />
                <textarea value={form.rules} onChange={e => set('rules', e.target.value)} rows={6}
                  placeholder="Match rules, format details, code of conduct…"
                  disabled={form.easy_mode && isEFootball}
                  className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25 disabled:opacity-50" />
                {form.easy_mode && isEFootball && <p className="text-[10px] text-yellow-400/60 mt-1">⚡ Using eFootball Easy Mode rules</p>}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Schedule ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <h2 className="font-orbitron font-bold text-lg text-white">Schedule</h2>
              <div>
                <FieldLabel label="Tournament Start" required />
                <input type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <FieldLabel label="Registration Closes" hint="Players can't join after this time" />
                <input type="datetime-local" value={form.registration_closes} onChange={e => set('registration_closes', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Check-in Opens" />
                  <input type="datetime-local" value={form.check_in_open} onChange={e => set('check_in_open', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <FieldLabel label="Check-in Closes" />
                  <input type="datetime-local" value={form.check_in_close} onChange={e => set('check_in_close', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 h-10 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/8 border border-blue-500/15">
                <p className="text-xs text-blue-400">💡 Tip: Set check-in 30–60 minutes before start. Players who don't check in won't be placed in bracket.</p>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Prize ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <h2 className="font-orbitron font-bold text-lg text-white">Prize & Entry</h2>
              <div>
                <FieldLabel label="Entry Fee (PulsePoints)" hint="0 = free to enter" />
                <Input type="number" min="0" value={form.entry_fee === 0 ? '' : form.entry_fee}
                  onChange={e => set('entry_fee', parseInt(e.target.value) || 0)}
                  placeholder="0 (free)" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Prize Pool (PulsePoints)" hint="Winner receives this many PulsePoints" />
                <Input type="number" min="0" value={form.prize_amount === 0 ? '' : form.prize_amount}
                  onChange={e => set('prize_amount', parseInt(e.target.value) || 0)}
                  placeholder="0" className={inputCls} />
              </div>
              {form.entry_fee > 0 && form.prize_amount > 0 && (
                <div className="p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/15 space-y-1">
                  <p className="text-xs text-cyan-400 font-semibold">Prize breakdown</p>
                  <p className="text-xs text-white/50">🥇 Winner: {form.prize_amount} PP + 150 GamerCred</p>
                  <p className="text-xs text-white/35">🥈 Runner-up: 200 PP + 75 GamerCred</p>
                  <p className="text-xs text-white/25">All participants: +20 PP for completing the tournament</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <h2 className="font-orbitron font-bold text-lg text-white">Review & Create</h2>
              <div className="p-5 rounded-2xl bg-white/4 border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/8 flex-shrink-0">
                    {selectedGame?.logo_url
                      ? <img src={selectedGame.logo_url} alt={selectedGame.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">{selectedGame?.icon}</div>}
                  </div>
                  <div>
                    <p className="font-orbitron font-bold text-base text-white">{form.name}</p>
                    <p className="text-xs text-white/40">{selectedGame?.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {[
                    ['Format', form.format.replace(/_/g, ' ')],
                    ['Players', `up to ${form.max_players}`],
                    ['Entry', form.entry_fee > 0 ? `${form.entry_fee} PP` : 'Free'],
                    ['Prize', form.prize_amount > 0 ? `${form.prize_amount} PP` : form.prize_pool || 'None'],
                    ['Start', form.date ? new Date(form.date).toLocaleString() : 'TBD'],
                    ['Mode', form.easy_mode ? '⚡ Easy Mode' : 'Standard'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-white/6 pb-2">
                      <span className="text-white/40 text-xs">{k}</span>
                      <span className="text-white text-xs font-semibold capitalize">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                <p className="text-xs text-yellow-400">⚠ Once created, use the tournament page to generate the bracket after check-in closes. The bracket is final once generated.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-white/12 text-white/55 text-sm hover:bg-white/5 transition-all">
              <ArrowLeft className="w-4 h-4" />Back
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button onClick={next}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-all">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={create} disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Create Tournament
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
