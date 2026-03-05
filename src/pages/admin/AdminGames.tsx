import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Plus, Pencil, Trash2, RefreshCw, Search,
  X, Save, Loader2, Star, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Game {
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
}

const BLANK: Omit<Game, 'id' | 'created_at'> = {
  name: '', description: '', icon: '🎮', badge: null,
  player_count: 0, tournament_count: 0, category: 'other', featured: false,
};

const CATEGORIES = ['fps','battle-royale','moba','sports','fighting','rpg','strategy','other'];

// ── Field row ──────────────────────────────────────────────────────────────
function Field(p: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/50 font-medium uppercase tracking-wider">{p.label}</label>
      {p.children}
    </div>
  );
}

// ── Game form modal ────────────────────────────────────────────────────────
function GameModal(p: {
  game: Omit<Game, 'id' | 'created_at'> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState(p.game);
  const [saving, setSaving] = useState(false);
  const isEdit = !!p.game.id;

  const set = (k: keyof typeof form, v: string | number | boolean | null) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || '🎮',
      badge: form.badge?.trim() || null,
      player_count: Number(form.player_count) || 0,
      tournament_count: Number(form.tournament_count) || 0,
      category: form.category,
      featured: form.featured,
    };
    const { error } = isEdit
      ? await supabase.from('games').update(payload as never).eq('id', p.game.id!)
      : await supabase.from('games').insert(payload as never);
    if (error) { toast.error(error.message); }
    else { toast.success(isEdit ? 'Game updated.' : 'Game added.'); p.onSaved(); p.onClose(); }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-lg">
              {form.icon}
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">{isEdit ? 'Edit Game' : 'Add New Game'}</h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Game Name">
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PUBG Mobile" className={inputCls} />
            </Field>
            <Field label="Icon (emoji)">
              <Input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎮" className={inputCls + ' text-2xl'} maxLength={4} />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Short description of the game…"
              rows={2}
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50"
              >
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
              </select>
            </Field>
            <Field label="Badge (optional)">
              <Input value={form.badge ?? ''} onChange={e => set('badge', e.target.value || null)} placeholder="e.g. Hot, New" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Player Count">
              <Input type="number" value={form.player_count} onChange={e => set('player_count', e.target.value)} className={inputCls} min={0} />
            </Field>
            <Field label="Tournament Count">
              <Input type="number" value={form.tournament_count} onChange={e => set('tournament_count', e.target.value)} className={inputCls} min={0} />
            </Field>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
            <button
              onClick={() => set('featured', !form.featured)}
              className={'w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 relative ' + (form.featured ? 'bg-cyan-500' : 'bg-white/15')}
            >
              <span className={'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ' + (form.featured ? 'left-5' : 'left-0.5')} />
            </button>
            <div>
              <p className="text-sm text-white font-medium">Featured Game</p>
              <p className="text-xs text-white/35">Shows in the featured banner on the Games page</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 hover:text-white hover:bg-white/8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Add Game'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm(p: { game: Game; onClose: () => void; onDeleted: () => void }): React.ReactElement {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('games').delete().eq('id', p.game.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Game deleted.'); p.onDeleted(); p.onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Game</h3>
            <p className="text-xs text-white/40">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">
          Are you sure you want to delete <span className="font-bold text-white">{p.game.name}</span>?
          All tournaments linked to this game will lose their game reference.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="flex-1 border border-white/10 text-white/50 hover:text-white hover:bg-white/8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={confirm} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Game row card ──────────────────────────────────────────────────────────
function GameRow(p: { game: Game; index: number; onEdit: () => void; onDelete: () => void }): React.ReactElement {
  const g = p.game;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.index * 0.04 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 hover:bg-white/6 transition-all group"
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/8 to-white/4 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
        {g.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-orbitron font-bold text-sm text-white">{g.name}</span>
          {g.featured ? (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">
              <Star className="w-2.5 h-2.5" />Featured
            </span>
          ) : null}
          {g.badge ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">{g.badge}</span>
          ) : null}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40 border border-white/10 capitalize">{g.category}</span>
        </div>
        <p className="text-xs text-white/35 truncate">{g.description || 'No description'}</p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-white/30">{g.player_count.toLocaleString()} players</span>
          <span className="text-xs text-white/30">{g.tournament_count} tournaments</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={p.onEdit}
          className="p-2 rounded-lg bg-white/8 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400 transition-all"
          title="Edit game"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={p.onDelete}
          className="p-2 rounded-lg bg-white/8 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
          title="Delete game"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminGames(): React.ReactElement {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'add' | Game>(null);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });
    if (error) setFetchError(error.message);
    else setGames((data as Game[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = games.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.category.toLowerCase().includes(search.toLowerCase())
  );

  const editForm = modal && modal !== 'add'
    ? { ...modal }
    : { ...BLANK };

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Games</h1>
          <p className="text-white/35 text-sm">{games.length} games in the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search games…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-48"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}
            className="text-white/40 hover:text-white hover:bg-white/8 h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setModal('add')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />Add Game
          </Button>
        </div>
      </motion.div>

      {/* Error */}
      {fetchError ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5 flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={load} className="text-red-400 hover:text-red-300 text-xs h-7">Retry</Button>
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Gamepad2 className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm">{search ? 'No games match your search.' : 'No games yet. Add one to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g, i) => (
            <GameRow
              key={g.id} game={g} index={i}
              onEdit={() => setModal(g)}
              onDelete={() => setDeleteTarget(g)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal ? (
          <GameModal
            key="game-modal"
            game={editForm}
            onClose={() => setModal(null)}
            onSaved={load}
          />
        ) : null}
        {deleteTarget ? (
          <DeleteConfirm
            key="delete-modal"
            game={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={load}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}