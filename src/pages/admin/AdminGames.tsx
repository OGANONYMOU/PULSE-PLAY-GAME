import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Star, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Game = {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: string;
  featured: boolean;
  created_at: string;
};

const emptyForm = {
  name: '',
  description: '',
  icon: '🎮',
  badge: '',
  player_count: 0,
  tournament_count: 0,
  category: 'fps',
  featured: false,
};

export function AdminGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchGames = async () => {
    const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false });
    setGames(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.description) {
      toast.error('Name and description are required.');
      return;
    }
    setIsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('games') as any).insert({
      ...form,
      badge: form.badge || null,
    });
    if (error) {
      toast.error('Failed to add game: ' + error.message);
    } else {
      toast.success('Game added!');
      setIsOpen(false);
      setForm(emptyForm);
      fetchGames();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('games') as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete game.');
    } else {
      toast.success('Game deleted.');
      setGames((prev) => prev.filter((g) => g.id !== id));
    }
    setDeleteId(null);
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              Manage <span className="gradient-text">Games</span>
            </h1>
            <p className="text-muted-foreground">{games.length} games in the catalog</p>
          </div>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Game
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {games.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="gaming-card p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{game.icon}</span>
                    <div>
                      <div className="font-orbitron font-bold text-sm">{game.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{game.category}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => setDeleteId(game.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{game.description}</p>
                <div className="flex items-center gap-2">
                  {game.featured && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Star className="w-3 h-3 mr-1" /> Featured
                    </Badge>
                  )}
                  {game.badge && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {game.badge}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add Game Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-orbitron">Add New Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Icon</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Game name" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 resize-none" rows={3} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fps">FPS</SelectItem>
                    <SelectItem value="battle-royale">Battle Royale</SelectItem>
                    <SelectItem value="moba">MOBA</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Badge (optional)</Label>
                <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="mt-1" placeholder="e.g. Hot, New" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Player Count</Label>
                <Input type="number" value={form.player_count} onChange={(e) => setForm({ ...form, player_count: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tournament Count</Label>
                <Input type="number" value={form.tournament_count} onChange={(e) => setForm({ ...form, tournament_count: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} id="featured" />
              <Label htmlFor="featured" className="text-sm cursor-pointer">Featured game of the month</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Delete Game
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This will permanently delete the game and all associated tournaments. This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}