// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Game Management Module
// Comprehensive game catalog management with analytics
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Gamepad2, Plus, Pencil, Trash2, RefreshCw, Search, Save, Loader2,
  Star, AlertTriangle, Trophy, Users, TrendingUp, LayoutGrid,
  Filter, EyeOff,
  Crown, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Game = {
  id: string;
  name: string;
  description: string;
  icon: string;
  image_url: string | null;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: GameCategory;
  featured: boolean;
  status: 'active' | 'inactive' | 'coming_soon';
  popularity_score: number;
  created_at: string;
  updated_at?: string;
};

type GameCategory = 'fps' | 'battle-royale' | 'moba' | 'sports' | 'fighting' | 'rpg' | 'strategy' | 'racing' | 'other';

type GameStats = {
  totalGames: number;
  activeGames: number;
  featuredGames: number;
  totalPlayers: number;
  totalTournaments: number;
  categoryDistribution: Record<GameCategory, number>;
  topGames: Game[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES: { id: GameCategory; label: string; icon: string; color: string }[] = [
  { id: 'fps', label: 'First-Person Shooter', icon: '🔫', color: 'text-red-400' },
  { id: 'battle-royale', label: 'Battle Royale', icon: '🏆', color: 'text-orange-400' },
  { id: 'moba', label: 'MOBA', icon: '⚔️', color: 'text-blue-400' },
  { id: 'sports', label: 'Sports', icon: '⚽', color: 'text-green-400' },
  { id: 'fighting', label: 'Fighting', icon: '👊', color: 'text-yellow-400' },
  { id: 'rpg', label: 'RPG', icon: '🎭', color: 'text-purple-400' },
  { id: 'strategy', label: 'Strategy', icon: '♟️', color: 'text-cyan-400' },
  { id: 'racing', label: 'Racing', icon: '🏎️', color: 'text-pink-400' },
  { id: 'other', label: 'Other', icon: '🎮', color: 'text-slate-400' },
];

const STATUS_CONFIG = {
  active: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  inactive: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Inactive' },
  coming_soon: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Coming Soon' },
};

const BLANK_GAME: Omit<Game, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  icon: '🎮',
  image_url: null,
  badge: null,
  player_count: 0,
  tournament_count: 0,
  category: 'other',
  featured: false,
  status: 'active',
  popularity_score: 0,
};


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ title, value, change, icon: Icon, color }: {
  title: string;
  value: number;
  change?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
            {change && <p className="text-xs text-green-400 mt-1">{change}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCard({ game, onEdit, onDelete, index }: {
  game: Game;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const category = CATEGORIES.find(c => c.id === game.category);
  const statusConfig = STATUS_CONFIG[game.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all"
    >
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
          {game.image_url ? (
            <img src={game.image_url} alt={game.name} className="w-full h-full object-cover" />
          ) : (
            game.icon
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-orbitron font-bold text-sm text-white">{game.name}</span>
            {game.featured && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
            {game.badge && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">{game.badge}</Badge>
            )}
            <Badge className={cn('border', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </div>

          <p className="text-xs text-slate-500 truncate">{game.description || 'No description'}</p>

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              {category?.icon} {category?.label}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {game.player_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {game.tournament_count}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar for popularity */}
      {game.popularity_score > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Popularity</span>
            <span>{game.popularity_score}%</span>
          </div>
          <Progress value={game.popularity_score} className="h-1.5 bg-slate-800" />
        </div>
      )}
    </motion.div>
  );
}

function GameModal({ game, onClose, onSaved }: {
  game: Partial<Game>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK_GAME, ...game });
  const [saving, setSaving] = useState(false);
  const isEdit = !!game.id;

  const updateField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Game name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim() || '🎮',
        image_url: form.image_url || null,
        badge: form.badge?.trim() || null,
        player_count: Number(form.player_count) || 0,
        tournament_count: Number(form.tournament_count) || 0,
        category: form.category,
        featured: form.featured,
        status: form.status,
        popularity_score: Number(form.popularity_score) || 0,
      };

      const { error } = isEdit
        ? await supabase.from('games').update(payload as never).eq('id', game.id!)
        : await supabase.from('games').insert(payload as never);

      if (error) throw error;

      await writeAudit(
        { actor_id: 'system', actor_email: 'system@pulseplay.gg', actor_role: 'system' },
        { action: isEdit ? 'game_update' : 'game_create', category: 'game', target_id: game.id || 'new', target_type: 'game', metadata: { name: form.name } }
      );

      toast.success(isEdit ? 'Game updated' : 'Game added');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-slate-700 flex items-center justify-center text-lg">
              {form.icon}
            </div>
            {isEdit ? 'Edit Game' : 'Add New Game'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEdit ? 'Update game details' : 'Create a new game entry'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Game Name</label>
              <Input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. PUBG Mobile"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Icon</label>
              <Input
                value={form.icon}
                onChange={(e) => updateField('icon', e.target.value)}
                placeholder="🎮"
                maxLength={4}
                className="bg-slate-900 border-slate-800 text-2xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500">Logo URL</label>
            <Input
              value={form.image_url || ''}
              onChange={(e) => updateField('image_url', e.target.value || null)}
              placeholder="https://..."
              className="bg-slate-900 border-slate-800"
            />
            {form.image_url && (
              <img src={form.image_url} alt="preview" className="mt-2 w-16 h-16 rounded-xl object-cover border border-slate-800" />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Short description..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Category</label>
              <Select value={form.category} onValueChange={(v) => updateField('category', v as GameCategory)}>
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="mr-2">{c.icon}</span>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Status</label>
              <Select value={form.status} onValueChange={(v) => updateField('status', v as Game['status'])}>
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="coming_soon">Coming Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Players</label>
              <Input
                type="number"
                value={form.player_count}
                onChange={(e) => updateField('player_count', parseInt(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Tournaments</label>
              <Input
                type="number"
                value={form.tournament_count}
                onChange={(e) => updateField('tournament_count', parseInt(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Popularity %</label>
              <Input
                type="number"
                value={form.popularity_score}
                onChange={(e) => updateField('popularity_score', parseInt(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800"
                min={0}
                max={100}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Badge</label>
              <Input
                value={form.badge || ''}
                onChange={(e) => updateField('badge', e.target.value || null)}
                placeholder="e.g. Hot, New"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => updateField('featured', v)}
              />
              <div>
                <p className="text-sm font-medium text-white">Featured</p>
                <p className="text-xs text-slate-500">Show in featured banner</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {isEdit ? 'Save Changes' : 'Add Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({ game, onClose, onDeleted }: {
  game: Game;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('games').delete().eq('id', game.id);
      if (error) throw error;

      await writeAudit(
        { actor_id: 'system', actor_email: 'system@pulseplay.gg', actor_role: 'system' },
        { action: 'game_delete', category: 'game', target_id: game.id, target_type: 'game', metadata: { name: game.name } }
      );

      toast.success('Game deleted');
      onDeleted();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete game');
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="font-orbitron text-white">Delete Game</DialogTitle>
              <DialogDescription className="text-slate-400">This cannot be undone</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-slate-400 mb-4">
          Are you sure you want to delete <span className="font-bold text-white">{game.name}</span>?
          All tournaments linked to this game will lose their game reference.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminGames(): React.ReactElement {
  const { hasPermission } = useAdmin();

  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<GameStats>({
    totalGames: 0, activeGames: 0, featuredGames: 0,
    totalPlayers: 0, totalTournaments: 0,
    categoryDistribution: {} as Record<GameCategory, number>,
    topGames: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GameCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  const canManageGames = hasPermission('games.manage' as never) || hasPermission('system.admin_access' as never);

  // Mock data for demonstration
  useEffect(() => {
    const mockGames: Game[] = [
      {
        id: '1',
        name: 'PUBG Mobile',
        description: 'Battle royale mobile game with intense multiplayer action',
        icon: '🏆',
        image_url: null,
        badge: 'Hot',
        player_count: 15234,
        tournament_count: 89,
        category: 'battle-royale',
        featured: true,
        status: 'active',
        popularity_score: 95,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Free Fire MAX',
        description: 'Enhanced battle royale experience with upgraded graphics',
        icon: '🔥',
        image_url: null,
        badge: 'New',
        player_count: 8934,
        tournament_count: 56,
        category: 'battle-royale',
        featured: true,
        status: 'active',
        popularity_score: 88,
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'Mobile Legends',
        description: '5v5 MOBA action with iconic heroes',
        icon: '⚔️',
        image_url: null,
        badge: null,
        player_count: 12345,
        tournament_count: 67,
        category: 'moba',
        featured: false,
        status: 'active',
        popularity_score: 82,
        created_at: new Date().toISOString(),
      },
      {
        id: '4',
        name: 'FIFA Mobile',
        description: 'Ultimate football gaming experience',
        icon: '⚽',
        image_url: null,
        badge: null,
        player_count: 4567,
        tournament_count: 23,
        category: 'sports',
        featured: false,
        status: 'active',
        popularity_score: 65,
        created_at: new Date().toISOString(),
      },
      {
        id: '5',
        name: 'Apex Legends Mobile',
        description: 'Legendary battle royale with unique characters',
        icon: '🦸',
        image_url: null,
        badge: 'Coming Soon',
        player_count: 0,
        tournament_count: 0,
        category: 'battle-royale',
        featured: false,
        status: 'coming_soon',
        popularity_score: 0,
        created_at: new Date().toISOString(),
      },
    ];

    setGames(mockGames);
    calculateStats(mockGames);
    setIsLoading(false);
  }, []);

  const calculateStats = (data: Game[]) => {
    const activeGames = data.filter(g => g.status === 'active').length;
    const featuredGames = data.filter(g => g.featured).length;
    const totalPlayers = data.reduce((sum, g) => sum + g.player_count, 0);
    const totalTournaments = data.reduce((sum, g) => sum + g.tournament_count, 0);

    const categoryDistribution = data.reduce((acc, g) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {} as Record<GameCategory, number>);

    const topGames = [...data].sort((a, b) => b.popularity_score - a.popularity_score).slice(0, 3);

    setStats({
      totalGames: data.length,
      activeGames,
      featuredGames,
      totalPlayers,
      totalTournaments,
      categoryDistribution,
      topGames,
    });
  };

  const filteredGames = useMemo(() => {
    const filtered = [...games];

    if (activeTab === 'featured') {
      filtered = filtered.filter(g => g.featured);
    } else if (activeTab === 'active') {
      filtered = filtered.filter(g => g.status === 'active');
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter(g => g.status === 'inactive');
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(g => g.category === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query) ||
        g.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [games, activeTab, categoryFilter, searchQuery]);

  const handleAddGame = () => {
    setEditingGame(null);
    setIsModalOpen(true);
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // Would refresh data from server
    setIsModalOpen(false);
    setEditingGame(null);
  };

  const handleDelete = () => {
    // Would refresh data from server
    setDeleteTarget(null);
  };

  return (
    <div className="p-5 sm:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1 flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-cyan-400" />
            Games
          </h1>
          <p className="text-slate-400 text-sm">
            {stats.totalGames} games • {stats.activeGames} active • {stats.featuredGames} featured
          </p>
        </div>
        <div className="flex gap-2">
          {canManageGames && (
            <Button
              onClick={handleAddGame}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Game
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Games"
          value={stats.totalGames}
          icon={LayoutGrid}
          color="bg-blue-500/20"
        />
        <StatCard
          title="Active Players"
          value={stats.totalPlayers}
          change="+12% this month"
          icon={Users}
          color="bg-green-500/20"
        />
        <StatCard
          title="Tournaments"
          value={stats.totalTournaments}
          icon={Trophy}
          color="bg-yellow-500/20"
        />
        <StatCard
          title="Avg Popularity"
          value={Math.round(games.reduce((s, g) => s + g.popularity_score, 0) / (games.length || 1))}
          icon={TrendingUp}
          color="bg-purple-500/20"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search games by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as GameCategory | 'all')}>
          <SelectTrigger className="w-48 bg-slate-900/50 border-slate-800">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="mr-2">{c.icon}</span>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-800">
            All Games
          </TabsTrigger>
          <TabsTrigger value="featured" className="data-[state=active]:bg-slate-800">
            <Star className="w-3 h-3 mr-1" />
            Featured
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-slate-800">
            <Zap className="w-3 h-3 mr-1" />
            Active
          </TabsTrigger>
          <TabsTrigger value="inactive" className="data-[state=active]:bg-slate-800">
            <EyeOff className="w-3 h-3 mr-1" />
            Inactive
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <h3 className="text-lg font-medium text-white mb-2">No games found</h3>
              <p className="text-slate-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredGames.map((game: Game, index: number) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    index={index}
                    onEdit={() => handleEditGame(game)}
                    onDelete={() => setDeleteTarget(game)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Top Games Sidebar */}
      {stats.topGames.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              Top Games by Popularity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topGames.map((game, i) => (
                <div key={game.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-950/50">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
                    {game.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{game.name}</p>
                    <p className="text-xs text-slate-500">{game.player_count.toLocaleString()} players</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-cyan-400">{game.popularity_score}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {isModalOpen && (
        <GameModal
          game={editingGame || {}}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleSave}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          game={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDelete}
        />
      )}
    </div>
  );
}