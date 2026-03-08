import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Plus, Pencil, Trash2, RefreshCw, Search,
  X, Save, Loader2, Star, AlertTriangle, Sparkles, Database,
  Upload, Image as ImageIcon, Link as LinkIcon,
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
  logo_url: string | null;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: string;
  featured: boolean;
  created_at: string;
}

type GamePayload = {
  name: string; description: string; icon: string; logo_url?: string | null;
  badge?: string | null; player_count?: number; tournament_count?: number;
  category: string; featured?: boolean;
};

const BLANK: Omit<Game, 'id' | 'created_at'> = {
  name: '', description: '', icon: '🎮', logo_url: null, badge: null,
  player_count: 0, tournament_count: 0, category: 'other', featured: false,
};

const CATEGORIES = ['fps','battle-royale','moba','sports','fighting','rpg','strategy','other'];

const DEFAULT_GAMES: GamePayload[] = [
  {
    name: 'eFootball',
    description: 'The ultimate mobile football experience with real-time matchmaking and seasonal competitions.',
    icon: '⚽', logo_url: '/games/efootball.webp', badge: 'Popular',
    player_count: 12500, tournament_count: 18, category: 'sports', featured: false,
  },
  {
    name: 'EA FC Mobile',
    description: 'EA Sports FC Mobile brings the world\'s most popular sport to your fingertips with stunning graphics and real player likenesses.',
    icon: '⚽', logo_url: '/games/fifa-mobile.webp', badge: 'Hot',
    player_count: 18200, tournament_count: 22, category: 'sports', featured: false,
  },
  {
    name: 'Call of Duty Mobile',
    description: 'Iconic FPS combat brought to mobile — battle royale, multiplayer, and ranked modes.',
    icon: '🔫', logo_url: '/games/cod-mobile.webp', badge: 'Trending',
    player_count: 28400, tournament_count: 32, category: 'fps', featured: true,
  },
  {
    name: 'PUBG Mobile',
    description: 'Drop in, loot up, and outlast 99 rivals in the original mobile battle royale.',
    icon: '🪖', logo_url: '/games/pubg.webp', badge: 'Popular',
    player_count: 19800, tournament_count: 25, category: 'battle-royale', featured: false,
  },
  {
    name: 'Free Fire',
    description: 'Fast-paced 10-minute battle royale built for mobile — quick games, big wins.',
    icon: '🔥', logo_url: '/games/free-fire.webp', badge: 'New',
    player_count: 22100, tournament_count: 21, category: 'battle-royale', featured: false,
  },
];

// ── Logo preview component ─────────────────────────────────────────────────
function LogoPreview(p: { logoUrl: string | null; icon: string; size?: string }): React.ReactElement {
  const [err, setErr] = useState(false);
  const sz = p.size ?? 'w-12 h-12';
  const hasImg = p.logoUrl && !err;
  return (
    <div className={sz + ' rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/8 to-white/4 flex items-center justify-center text-xl flex-shrink-0'}>
      {hasImg
        ? <img src={p.logoUrl!} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <span>{p.icon}</span>
      }
    </div>
  );
}

// ── Field row ──────────────────────────────────────────────────────────────
function Field(p: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/50 font-medium uppercase tracking-wider">{p.label}</label>
      {p.children}
    </div>
  );
}

// ── Logo upload section ────────────────────────────────────────────────────
function LogoUpload(p: {
  gameId?: string;
  logoUrl: string | null;
  icon: string;
  onChange: (url: string | null) => void;
}): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(!p.gameId || !!p.logoUrl?.startsWith('/'));

  const handleFile = async (file: File) => {
    if (!p.gameId) {
      toast.error('Save the game first before uploading an image, or use a URL instead.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = 'games/' + p.gameId + '-' + Date.now() + '.' + ext;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Upload failed: ' + error.message + '. Use URL mode instead.');
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      p.onChange(data.publicUrl);
      toast.success('Logo uploaded!');
    }
    setUploading(false);
  };

  return (
    <Field label="Game Logo">
      <div className="flex items-center gap-3 mb-2">
        <LogoPreview logoUrl={p.logoUrl} icon={p.icon} size="w-14 h-14" />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setUrlMode(false)}
            className={'text-[10px] px-2.5 py-1.5 rounded-lg border font-bold transition-all ' +
              (!urlMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white')}
          >
            <Upload className="w-3 h-3 inline mr-1" />File Upload
          </button>
          <button
            onClick={() => setUrlMode(true)}
            className={'text-[10px] px-2.5 py-1.5 rounded-lg border font-bold transition-all ' +
              (urlMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white')}
          >
            <LinkIcon className="w-3 h-3 inline mr-1" />Image URL
          </button>
          {p.logoUrl ? (
            <button onClick={() => p.onChange(null)}
              className="text-[10px] px-2.5 py-1.5 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20 font-bold">
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {urlMode ? (
        <Input
          value={p.logoUrl ?? ''}
          onChange={e => p.onChange(e.target.value || null)}
          placeholder="https://… or /games/pubg.webp"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm"
        />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-white/40 hover:text-cyan-400 transition-all text-sm"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
              : <><ImageIcon className="w-4 h-4" />Click to select image</>}
          </button>
          <p className="text-[10px] text-white/25 mt-1.5">Uploads to Supabase Storage. Requires the avatars bucket to be public.</p>
        </div>
      )}
    </Field>
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

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload: GamePayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || '🎮',
      logo_url: form.logo_url || null,
      badge: form.badge?.trim() || null,
      player_count: Number(form.player_count) || 0,
      tournament_count: Number(form.tournament_count) || 0,
      category: form.category,
      featured: form.featured,
    };

    let error: { message: string } | null = null;
    if (isEdit) {
      const res = await supabase.from('games').update(payload as never).eq('id', p.game.id!);
      error = res.error;
    } else {
      const res = await supabase.from('games').insert(payload as never);
      error = res.error;
    }

    if (error) {
      const msg = error.message.includes('row-level security') || error.message.includes('permission')
        ? 'Permission denied — run the SQL migration to set up RLS policies.'
        : error.message;
      toast.error(msg);
    } else {
      toast.success(isEdit ? 'Game updated.' : 'Game added.');
      p.onSaved(); p.onClose();
    }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <LogoPreview logoUrl={form.logo_url} icon={form.icon} />
            <h2 className="font-orbitron font-bold text-sm text-white">{isEdit ? 'Edit Game' : 'Add New Game'}</h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Game Name">
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PUBG Mobile" className={inputCls} />
            </Field>
            <Field label="Fallback Icon">
              <Input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎮" className={inputCls + ' text-2xl'} maxLength={4} />
            </Field>
          </div>

          <LogoUpload
            gameId={p.game.id}
            logoUrl={form.logo_url}
            icon={form.icon}
            onChange={url => set('logo_url', url)}
          />

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Short description…"
              rows={2}
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50">
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
              </select>
            </Field>
            <Field label="Badge (optional)">
              <Input value={form.badge ?? ''} onChange={e => set('badge', e.target.value || null)} placeholder="Hot, New, Trending…" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Player Count">
              <Input type="number" value={form.player_count} onChange={e => set('player_count', Number(e.target.value))} className={inputCls} min={0} />
            </Field>
            <Field label="Tournament Count">
              <Input type="number" value={form.tournament_count} onChange={e => set('tournament_count', Number(e.target.value))} className={inputCls} min={0} />
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 hover:text-white text-xs">Cancel</Button>
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Game</h3>
            <p className="text-xs text-white/40">Cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">{p.game.name}</span>?</p>
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

// ── Seed modal ─────────────────────────────────────────────────────────────
function SeedModal(p: { onClose: () => void; onSeeded: () => void }): React.ReactElement {
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const runSeed = async () => {
    setSeeding(true);
    const msgs: string[] = [];
    for (const game of DEFAULT_GAMES) {
      const { error } = await supabase.from('games').insert(game as never);
      msgs.push(error
        ? `✗ ${game.name}: ${error.message.includes('row-level') ? 'RLS denied — run migration SQL' : error.message}`
        : `✓ ${game.name} added`
      );
    }
    setResults(msgs);
    setDone(true);
    setSeeding(false);
    p.onSeeded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Seed Default Games</h3>
            <p className="text-xs text-white/40">Adds 5 games with official logos</p>
          </div>
        </div>

        {!done ? (
          <>
            <div className="space-y-2 mb-5">
              {DEFAULT_GAMES.map(g => (
                <div key={g.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/4 border border-white/8">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/8 flex items-center justify-center text-xl flex-shrink-0">
                    {g.logo_url ? <img src={g.logo_url} alt={g.name} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} /> : null}
                    <span className={g.logo_url ? 'hidden' : ''}>{g.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{g.name}</p>
                    <p className="text-xs text-white/40 capitalize">{g.category} · {g.player_count?.toLocaleString()} players</p>
                  </div>
                  {g.featured ? <span className="ml-auto text-[10px] text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">Featured</span> : null}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={p.onClose} className="flex-1 border border-white/10 text-white/50 text-xs">Cancel</Button>
              <Button size="sm" onClick={runSeed} disabled={seeding} className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {seeding ? 'Seeding…' : 'Seed All Games'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5 mb-5">
              {results.map((r, i) => (
                <p key={i} className={'text-xs font-mono px-3 py-1.5 rounded-lg ' + (r.startsWith('✓') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>{r}</p>
              ))}
            </div>
            <Button size="sm" onClick={p.onClose} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold">Done</Button>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Game row card ──────────────────────────────────────────────────────────
function GameRow(p: { game: Game; index: number; onEdit: () => void; onDelete: () => void }): React.ReactElement {
  const g = p.game;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.index * 0.04 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 hover:bg-white/6 transition-all group"
    >
      <LogoPreview logoUrl={g.logo_url} icon={g.icon} size="w-12 h-12" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-orbitron font-bold text-sm text-white">{g.name}</span>
          {g.featured ? (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">
              <Star className="w-2.5 h-2.5" />Featured
            </span>
          ) : null}
          {g.badge ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">{g.badge}</span> : null}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40 border border-white/10 capitalize">{g.category}</span>
        </div>
        <p className="text-xs text-white/35 truncate">{g.description || 'No description'}</p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-white/30">{g.player_count.toLocaleString()} players</span>
          <span className="text-xs text-white/30">{g.tournament_count} tournaments</span>
          {g.logo_url ? <span className="text-xs text-green-400/60">✓ has logo</span> : <span className="text-xs text-white/20">emoji only</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={p.onEdit} className="p-2 rounded-lg bg-white/8 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400 transition-all" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={p.onDelete} className="p-2 rounded-lg bg-white/8 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all" title="Delete">
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
  const [showSeed, setShowSeed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
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

  const editForm = modal && modal !== 'add' ? { ...modal } : { ...BLANK };
  const withLogos = games.filter(g => g.logo_url).length;

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Games</h1>
          <p className="text-white/35 text-sm">{games.length} games · {withLogos} with logos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-40" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white hover:bg-white/8 h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          {games.length === 0 ? (
            <Button size="sm" onClick={() => setShowSeed(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-bold h-9 gap-2">
              <Sparkles className="w-3.5 h-3.5" />Seed Defaults
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setModal('add')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />Add Game
          </Button>
        </div>
      </motion.div>

      {fetchError ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5 flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={load} className="text-red-400 text-xs h-7">Retry</Button>
        </div>
      ) : null}

      {!loading && games.length === 0 && !fetchError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-8 rounded-2xl border border-dashed border-white/15 text-center mb-5">
          <Gamepad2 className="w-12 h-12 mx-auto text-white/15 mb-3" />
          <p className="text-white/40 text-sm mb-5">No games yet. Seed the 5 default games (with logos!) or add manually.</p>
          <Button size="sm" onClick={() => setShowSeed(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-bold gap-2">
            <Sparkles className="w-3.5 h-3.5" />Seed Default Games
          </Button>
        </motion.div>
      ) : null}

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g, i) => (
            <GameRow key={g.id} game={g} index={i} onEdit={() => setModal(g)} onDelete={() => setDeleteTarget(g)} />
          ))}
          {filtered.length === 0 && games.length > 0 ? (
            <div className="text-center py-12"><p className="text-white/35 text-sm">No games match your search.</p></div>
          ) : null}
        </div>
      )}

      <AnimatePresence>
        {modal ? <GameModal key="game-modal" game={editForm} onClose={() => setModal(null)} onSaved={load} /> : null}
        {deleteTarget ? <DeleteConfirm key="del-modal" game={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} /> : null}
        {showSeed ? <SeedModal key="seed-modal" onClose={() => setShowSeed(false)} onSeeded={load} /> : null}
      </AnimatePresence>
    </div>
  );
}
