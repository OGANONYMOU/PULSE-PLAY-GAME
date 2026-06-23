import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Crosshair, Target, Loader2, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface BRScoringConfig {
  kill_points: number;
  placement_points: number[];
  preset_name: string | null;
  game_mode: string | null;
  games_per_session: number;
}

interface BRGameResultModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  tournamentId: string;
  participantId: string;
  myUserId: string;
  config: BRScoringConfig | null;
  currentSession?: number;
  gameLabel?: string; // e.g. "Booyah" | "Chicken Dinner" | "Victory Royale"
}

const DEFAULT_CONFIG: BRScoringConfig = {
  kill_points: 1,
  placement_points: [10, 6, 5, 4, 3, 2, 2, 2, 1, 1, 1, 1, 0],
  preset_name: 'pubg',
  game_mode: null,
  games_per_session: 4,
};

function calcPoints(config: BRScoringConfig, placement: number, kills: number) {
  const pp = config.placement_points[placement - 1] ?? 0;
  const kp = kills * config.kill_points;
  return { pp, kp, total: pp + kp };
}

export function BRGameResultModal({
  open, onClose, onSubmitted,
  tournamentId, participantId, myUserId,
  config: configProp,
  currentSession = 1,
  gameLabel,
}: BRGameResultModalProps) {
  const config = configProp ?? DEFAULT_CONFIG;
  const [session, setSession] = useState(currentSession);
  const [gameNum, setGameNum] = useState(1);
  const [kills, setKills] = useState('');
  const [placement, setPlacement] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<{ pp: number; kp: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing game numbers submitted in this session
  const [usedGames, setUsedGames] = useState<number[]>([]);
  useEffect(() => {
    if (!open) return;
    (supabase as any)
      .from('br_game_results')
      .select('game_number')
      .eq('tournament_id', tournamentId)
      .eq('participant_id', participantId)
      .eq('session_number', session)
      .then(({ data }: { data: Array<{ game_number: number }> | null }) => {
        setUsedGames((data ?? []).map(r => r.game_number));
      });
  }, [open, tournamentId, participantId, session]);

  const preview = kills !== '' && placement !== ''
    ? calcPoints(config, parseInt(placement) || 1, parseInt(kills) || 0)
    : null;

  const victoryLabel = config.preset_name === 'free_fire' ? 'Booyah! 🐔'
    : config.preset_name === 'codm_br' ? 'Victory! 🏆'
    : 'Chicken Dinner! 🍗';

  const handleSubmit = async () => {
    const k = parseInt(kills);
    const p = parseInt(placement);
    if (isNaN(k) || k < 0) { toast.error('Enter a valid kill count'); return; }
    if (isNaN(p) || p < 1) { toast.error('Enter your placement (1 = 1st place)'); return; }
    if (gameNum < 1) { toast.error('Enter the game number'); return; }

    setUploading(true);
    let proofUrl: string | null = null;

    try {
      if (proofFile) {
        const path = `br-proofs/${tournamentId}/${myUserId}-s${session}g${gameNum}-${Date.now()}.${proofFile.name.split('.').pop()}`;
        const { error: upErr } = await supabase.storage.from('match-proofs').upload(path, proofFile, { upsert: false });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('match-proofs').getPublicUrl(path);
          proofUrl = urlData?.publicUrl ?? null;
        } else {
          // Fallback bucket
          await supabase.storage.from('avatars').upload(`br-proofs/${path}`, proofFile, { upsert: false });
          proofUrl = null;
        }
      }

      const { data, error } = await (supabase as any).rpc('submit_br_game_result', {
        p_tournament_id: tournamentId,
        p_session_number: session,
        p_game_number: gameNum,
        p_participant_id: participantId,
        p_kills: k,
        p_placement: p,
        p_proof_url: proofUrl,
      });

      if (error || data?.success === false) {
        toast.error(error?.message ?? data?.error ?? 'Submission failed');
        return;
      }

      const pts = { pp: data.placement_points, kp: Number(data.kill_points), total: Number(data.total_points) };
      setLastResult(pts);
      setSubmitted(true);
      setUsedGames(prev => [...prev.filter(n => n !== gameNum), gameNum]);
      toast.success(`Game ${gameNum} submitted! +${pts.total} points`);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    }
    setUploading(false);
  };

  const resetForm = () => {
    setKills(''); setPlacement(''); setProofFile(null);
    setGameNum(prev => prev + 1);
    setSubmitted(false); setLastResult(null);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full sm:max-w-md bg-[#0b0b18] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="font-orbitron font-bold text-sm text-white">Submit Game Result</p>
                <p className="text-[10px] text-white/35">
                  {config.preset_name ? config.preset_name.toUpperCase().replace('_', ' ') : 'Battle Royale'} ·
                  {config.game_mode ? ` ${config.game_mode.toUpperCase()}` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-white/8 flex items-center justify-center text-white/35 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {submitted && lastResult ? (
              /* Success state */
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                  <p className="font-orbitron font-bold text-white">Game {gameNum - 1} Recorded!</p>
                  {parseInt(placement) === 1 && (
                    <p className="text-yellow-400 font-bold text-sm">{gameLabel ?? victoryLabel}</p>
                  )}
                  <div className="flex gap-4 text-center">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Placement</p>
                      <p className="font-orbitron font-black text-lg text-blue-400">+{lastResult.pp}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Kills</p>
                      <p className="font-orbitron font-black text-lg text-red-400">+{lastResult.kp}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Total</p>
                      <p className="font-orbitron font-black text-lg text-cyan-400">+{lastResult.total}</p>
                    </div>
                  </div>
                </div>
                {gameNum <= config.games_per_session && (
                  <button onClick={resetForm}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm">
                    Submit Game {gameNum}
                  </button>
                )}
                <button onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-white/12 text-white/50 text-sm hover:bg-white/5 transition-all">
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Session + Game selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Session #</label>
                    <div className="relative">
                      <select value={session} onChange={e => setSession(parseInt(e.target.value))}
                        className="w-full h-10 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm appearance-none outline-none focus:border-cyan-500/50">
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Session {n}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">
                      Game # <span className="text-white/20">(of {config.games_per_session})</span>
                    </label>
                    <div className="relative">
                      <select value={gameNum} onChange={e => setGameNum(parseInt(e.target.value))}
                        className="w-full h-10 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm appearance-none outline-none focus:border-cyan-500/50">
                        {Array.from({ length: config.games_per_session }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>
                            Game {n}{usedGames.includes(n) ? ' ✓' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Kills + Placement */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">
                      <Crosshair className="w-3 h-3 inline mr-1 text-red-400" />Kills
                    </label>
                    <input
                      type="number" min="0" max="99" value={kills}
                      onChange={e => setKills(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm focus:outline-none focus:border-red-500/40 placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">
                      <Target className="w-3 h-3 inline mr-1 text-blue-400" />Placement
                    </label>
                    <input
                      type="number" min="1" max="100" value={placement}
                      onChange={e => setPlacement(e.target.value)}
                      placeholder="#"
                      className="w-full h-10 bg-white/5 border border-white/10 text-white rounded-xl px-3 text-sm focus:outline-none focus:border-blue-500/40 placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Points preview */}
                {preview && (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      parseInt(placement) === 1 ? 'bg-yellow-500/8 border-yellow-500/25' : 'bg-white/4 border-white/10'
                    }`}>
                    {parseInt(placement) === 1 && <span className="text-yellow-400 font-bold text-sm">{victoryLabel}</span>}
                    {parseInt(placement) !== 1 && <span className="text-[10px] text-white/40">#{placement} · {kills} kills</span>}
                    <div className="flex gap-3 text-right">
                      <div>
                        <p className="text-[9px] text-white/30">Placement</p>
                        <p className="font-orbitron font-black text-blue-400">+{preview.pp}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/30">Kills</p>
                        <p className="font-orbitron font-black text-red-400">+{preview.kp}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/30">Total</p>
                        <p className="font-orbitron font-black text-cyan-400">+{preview.total}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Proof upload */}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Screenshot Proof</label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()}
                    className={`w-full h-10 rounded-xl border text-sm flex items-center justify-center gap-2 transition-all ${
                      proofFile ? 'border-green-500/40 bg-green-500/8 text-green-400' : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                    }`}>
                    <Upload className="w-3.5 h-3.5" />
                    {proofFile ? proofFile.name.slice(0, 28) + (proofFile.name.length > 28 ? '…' : '') : 'Upload screenshot'}
                  </button>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !kills || !placement}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:opacity-90"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  {uploading ? 'Submitting…' : `Submit Game ${gameNum}`}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
