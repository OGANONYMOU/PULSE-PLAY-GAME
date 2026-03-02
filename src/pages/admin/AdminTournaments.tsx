import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, AlertCircle, Loader2, Flame, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Tournament = {
  id: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
  duration: string;
  winner: string | null;
  games: { name: string; icon: string } | null;
};

type Game = { id: string; name: string; icon: string };

const emptyForm = {
  name: '',
  game_id: '',
  status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed',
  date: '',
  prize_pool: '',
  max_players: 64,
  current_players: 0,
  duration: '1 Day',
  winner: '',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'ongoing') return <Badge className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"><Flame className="w-3 h-3 mr-1" />Live</Badge>;
  if (status === 'upcoming') return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50"><Calendar className="w-3 h-3 mr-1" />Upcoming</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/50"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
}

export function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    const [tResult, gResult] = await Promise.all([
      supabase.from('tournaments').select('*, games(name, icon)').order('created_at', { ascending: false }),
      supabase.from('games').select('id, name, icon').order('name'),
    ]);
    setTournaments((tResult.data as Tournament[]) ?? []);
    setGames(gResult.data ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.game_id || !form.date || !form.prize_pool) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setIsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournaments') as any).insert({
      name: form.name,
      game_id: form.game_id,
      status: form.status,
      date: new Date(form.date).toISOString(),
      prize_pool: form.prize_pool,
      max_players: form.max_players,
      current_players: form.current_players,
      duration: form.duration,
      winner: form.winner || null,
    });
    if (error) {
      toast.error('Failed to add tournament: ' + error.message);
    } else {
      toast.success('Tournament added!');
      setIsOpen(false);
      setForm(emptyForm);
      fetchData();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tournaments') as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete.');
    } else {
      toast.success('Tournament deleted.');
      setTournaments((prev) => prev.filter((t) => t.id !== id));
    }
    setDeleteId(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tournaments') as any).update({ status }).eq('id', id);
    setTournaments((prev) => prev.map((t) => t.id === id ? { ...t, status: status as Tournament['status'] } : t));
    toast.success('Status updated.');
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              Manage <span className="gradient-text">Tournaments</span>
            </h1>
            <p className="text-muted-foreground">{tournaments.length} tournaments total</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> Add Tournament
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="gaming-card p-5 flex items-center gap-4"
              >
                <span className="text-2xl">{t.games?.icon ?? '🎮'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-orbitron font-bold text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.games?.name} · {t.prize_pool} · {t.current_players}/{t.max_players} players</div>
                </div>
                <StatusBadge status={t.status} />
                <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, v)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => setDeleteId(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-orbitron">Add Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tournament Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. CODM Grand Finals" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Game *</Label>
                <Select value={form.game_id} onValueChange={(v) => setForm({ ...form, game_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.icon} {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Prize Pool *</Label>
                <Input value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} className="mt-1" placeholder="₦500,000" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Max Players</Label>
                <Input type="number" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Current Players</Label>
                <Input type="number" value={form.current_players} onChange={(e) => setForm({ ...form, current_players: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Duration</Label>
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="mt-1" placeholder="3 Days" />
              </div>
            </div>
            {form.status === 'completed' && (
              <div>
                <Label className="text-xs">Winner</Label>
                <Input value={form.winner} onChange={(e) => setForm({ ...form, winner: e.target.value })} className="mt-1" placeholder="Team or player name" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Tournament
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Delete Tournament
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This will permanently delete the tournament. This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}