import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGames } from '@/hooks/useGames';
import { useWallet } from '@/hooks/useWallet';
import { toast } from 'sonner';

const ENTRY_FEE_PRESETS = [0, 50, 100, 250, 500];
const QUICK_MAX_PLAYERS = 8;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org';
}

export function QuickTournamentModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { games } = useGames();
  const { balance } = useWallet(profile?.id);

  const [gameId, setGameId] = useState('');
  const [entryFee, setEntryFee] = useState(0);
  const [inGameId, setInGameId] = useState('');
  const [creating, setCreating] = useState(false);

  const winnerGets = entryFee * QUICK_MAX_PLAYERS;
  const insufficientBalance = balance < entryFee;
  const canCreate = !!gameId && inGameId.trim() !== '' && !insufficientBalance;

  const resolveOrganizerId = async (): Promise<string | null> => {
    if (!profile) return null;
    const { data: existing } = await (supabase as any)
      .from('organizers')
      .select('id')
      .eq('owner_id', profile.id)
      .limit(1)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;

    const baseName = `${profile.username}'s Tournaments`;
    const { data: created, error } = await (supabase as any)
      .from('organizers')
      .insert({
        name: baseName,
        slug: `${slugify(profile.username)}-${Date.now().toString(36)}`,
        owner_id: profile.id,
        visibility: 'unlisted',
      })
      .select('id')
      .single();
    if (error) return null;
    return (created as { id: string }).id;
  };

  const handleCreate = async () => {
    if (!user || !profile || !canCreate) return;
    setCreating(true);

    const organizerId = await resolveOrganizerId();
    if (!organizerId) {
      toast.error('Could not set up your organizer profile. Please try again.');
      setCreating(false);
      return;
    }

    const game = games.find(g => g.id === gameId);
    const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: tournament, error } = await supabase.from('tournaments').insert({
      organizer_id: organizerId,
      name: `${game?.name ?? 'Quick'} Pickup Tournament`,
      game_id: gameId,
      status: 'upcoming',
      tournament_family: 'esports',
      tournament_type: 'single_elimination',
      date: startDate,
      prize_pool: winnerGets > 0 ? `${winnerGets} PP` : '0',
      prize_amount: winnerGets,
      entry_fee: entryFee,
      currency: 'PulsePoints',
      max_players: QUICK_MAX_PLAYERS,
      team_size: 1,
      duration: '2h',
      format: 'best_of_1',
      is_public: true,
      requires_check_in: false,
      created_by: user.id,
    } as any).select('id').single();

    if (error || !tournament) {
      toast.error(error?.message ?? 'Failed to create tournament');
      setCreating(false);
      return;
    }

    const tournamentId = (tournament as { id: string }).id;

    await supabase.from('tournament_staff').insert({
      tournament_id: tournamentId,
      user_id: user.id,
      role: 'host',
      added_by: user.id,
    } as any);

    await supabase.from('tournament_participants').insert({
      tournament_id: tournamentId,
      user_id: user.id,
      in_game_username: inGameId.trim(),
    } as any);

    toast.success('Tournament created! 🎮');
    setCreating(false);
    onOpenChange(false);
    navigate(`/tournaments/${tournamentId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-[#0d0d1e] border-white/10">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />Quick Tournament
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Game</label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Entry Fee (PP)</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {ENTRY_FEE_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEntryFee(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    entryFee === preset
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {preset === 0 ? 'Free' : preset}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={0}
              value={entryFee}
              onChange={e => setEntryFee(Math.max(0, Number(e.target.value)))}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Your In-Game ID</label>
            <Input
              value={inGameId}
              onChange={e => setInGameId(e.target.value)}
              placeholder="e.g. Pulse_Killer99"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-sm">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Your Balance</p>
              <p className={`font-bold ${insufficientBalance ? 'text-red-400' : 'text-white'}`}>{balance.toLocaleString()} PP</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Winner Gets</p>
              <p className="font-bold text-yellow-400">{winnerGets.toLocaleString()} PP</p>
            </div>
          </div>

          {insufficientBalance && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              Insufficient balance. <Link to="/wallet" className="underline hover:text-red-300">Top up your wallet</Link>
            </p>
          )}

          <Button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="w-full h-11 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Tournament'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
