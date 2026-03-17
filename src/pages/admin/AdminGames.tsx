import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Plus, Pencil, Trash2, RefreshCw, Search,
  X, Save, Loader2, AlertTriangle, Sparkles, Database,
  Upload, Image as ImageIcon, Link as LinkIcon, Copy, CheckCheck,
  Camera, ChevronDown, ChevronUp,
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
const BADGE_OPTIONS = ['', 'Hot', 'New', 'Trending', 'Popular', 'Most Popular', 'Featured'];

const DEFAULT_GAMES: GamePayload[] = [
  { name: 'eFootball', description: 'The ultimate mobile football experience with real-time matchmaking and seasonal competitions.', icon: '⚽', logo_url: '/games/efootball.webp', badge: 'Popular', player_count: 12500, tournament_count: 18, category: 'sports', featured: false },
  { name: 'EA FC Mobile', description: "EA Sports FC Mobile brings the world's most popular sport to your fingertips with stunning graphics and real player likenesses.", icon: '⚽', logo_url: '/games/fifa-mobile.webp', badge: 'Hot', player_count: 18200, tournament_count: 22, category: 'sports', featured: false },
  { name: 'Call of Duty Mobile', description: 'Iconic FPS combat brought to mobile — battle royale, multiplayer, and ranked modes.', icon: '🔫', logo_url: '/games/cod-mobile.webp', badge: 'Trending', player_count: 28400, tournament_count: 32, category: 'fps', featured: true },
  { name: 'PUBG Mobile', description: 'Drop in, loot up, and outlast 99 rivals in the original mobile battle royale.', icon: '🪖', logo_url: '/games/pubg.webp', badge: 'Popular', player_count: 19800, tournament_count: 25, category: 'battle-royale', featured: false },
  { name: 'Free Fire', description: 'Fast-paced 10-minute battle royale built for mobile — quick games, big wins.', icon: '🔥', logo_url: '/games/free-fire.webp', badge: 'New', player_count: 22100, tournament_count: 21, category: 'battle-royale', featured: false },
];

// ── Migration SQL banner ───────────────────────────────────────────────────
const MIGRATION_SQL = `ALTER TABLE public.games ADD COLUMN IF NOT EXISTS logo_url TEXT;`;

function MigrationBanner(): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };
  return (
    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-yellow-400 mb-1">Logo column missing — run this SQL once in Supabase</p>
          <p className="text-[11px] text-white/50">Supabase Dashboard → SQL Editor → paste and run:</p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 border border-white/10">
        <code className="text-[11px] text-cyan-400 flex-1 font-mono truncate">{MIGRATION_SQL}</code>
        <button onClick={copy} className="flex-shrink-0 p-1.5 rounded-lg bg-white/8 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400 transition-all">
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-[10px] text-white/30 mt-2">After running SQL, click "Fix Logos" to apply images.</p>
    </div>
  );
}

// ── Logo image with error fallback ─────────────────────────────────────────
function LogoImg({ url, icon, className }: { url: string | null; icon: string; className?: string }): React.ReactElement {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  return url && !err
    ? <img src={url} alt="" className={'w-full h-full object-cover ' + (className ?? '')} onError={() => setErr(true)} />
    : <span className="text-2xl leading-none select-none">{icon}</span>;
}

// ── Field wrapper ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const iCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm rounded-lg';

// ── Logo upload widget (inside GameModal) ──────────────────────────────────
function LogoUpload({ gameId, logoUrl, icon, onChange }: {
  gameId?: string; logoUrl: string | null; icon: string; onChange: (url: string | null) => void;
}): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [urlInput, setUrlInput] = useState(logoUrl ?? '');
  useEffect(() => { setUrlInput(logoUrl ?? ''); }, [logoUrl]);

  const handleFile = async (file: File) => {
    if (!gameId) { toast.error('Save the game first to enable file upload. Use URL mode for now.'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `games/${gameId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    onChange(data.publicUrl);
    setUrlInput(data.publicUrl);
    toast.success('Logo uploaded!');
    setUploading(false);
  };

  return (
    <Field label="Game Logo">
      <div className="flex items-center gap-3 mb-2">
        {/* Live logo preview — tappable to upload */}
        <div
          className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0 relative group cursor-pointer hover:border-cyan-500/40 transition-colors"
          onClick={() => mode === 'file' && fileRef.current?.click()}
          title={mode === 'file' ? 'Tap to choose image' : 'Switch to File tab to upload'}
        >
          <LogoImg url={logoUrl} icon={icon} />
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            {(['url', 'file'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={'text-[10px] px-2.5 py-1 rounded-lg border font-bold transition-all ' +
                  (mode === m ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-white/35 border-white/10 hover:text-white')}>
                {m === 'url' ? <><LinkIcon className="w-2.5 h-2.5 inline mr-1" />URL</> : <><Upload className="w-2.5 h-2.5 inline mr-1" />Device</>}
              </button>
            ))}
            {logoUrl ? (
              <button type="button" onClick={() => { onChange(null); setUrlInput(''); }}
                className="text-[10px] px-2.5 py-1 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20 font-bold hover:bg-red-500/20 transition-all">
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-[10px] text-white/25">{logoUrl ? '✓ Logo set — preview above' : 'No logo yet — emoji shown'}</p>
        </div>
      </div>

      {mode === 'url' ? (
        <Input
          value={urlInput}
          onChange={e => { setUrlInput(e.target.value); onChange(e.target.value || null); }}
          placeholder="https://… or /games/pubg.webp"
          className={iCls}
        />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-white/40 hover:text-cyan-400 transition-all text-sm font-medium">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : <><ImageIcon className="w-4 h-4" />Tap to pick from gallery or camera</>}
          </button>
          {!gameId ? <p className="text-[10px] text-yellow-400/70 mt-1.5">⚠ Save the game first to enable device uploads.</p> : null}
        </div>
      )}
    </Field>
  );
}

// ── Full-screen GameModal (add + edit) ─────────────────────────────────────
function GameModal({ game, onClose, onSaved }: {
  game: Omit<Game, 'id' | 'created_at'> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState({ ...game });
  const [saving, setSaving] = useState(false);
  const isEdit = !!game.id;
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Game name is required'); return; }
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
      const res = await supabase.from('games').update(payload as never).eq('id', game.id!);
      error = res.error;
    } else {
      const res = await supabase.from('games').insert(payload as never);
      error = res.error;
    }
    if (error) {
      const msg = error.message.includes('row-level') || error.message.includes('permission')
        ? 'Permission denied — check your Supabase RLS policies.' : error.message;
      toast.error(msg);
    } else {
      toast.success(isEdit ? 'Game updated!' : 'Game added!');
      onSaved(); onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="w-full sm:max-w-lg bg-[#0d0d1a] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh]"
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
            <LogoImg url={form.logo_url} icon={form.icon || '🎮'} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-orbitron font-bold text-sm text-white">{isEdit ? 'Edit Game' : 'Add New Game'}</h2>
            {form.name ? <p className="text-[10px] text-white/30 truncate">{form.name}</p> : <p className="text-[10px] text-white/20">Fill in the details below</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Name + Icon */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Game Name *">
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. PUBG Mobile" className={iCls} autoFocus />
              </Field>
            </div>
            <Field label="Emoji">
              <Input value={form.icon} onChange={e => set('icon', e.target.value)}
                placeholder="🎮" className={iCls + ' text-center text-xl'} maxLength={4} />
            </Field>
          </div>

          {/* Logo upload */}
          <LogoUpload gameId={game.id} logoUrl={form.logo_url} icon={form.icon || '🎮'} onChange={url => set('logo_url', url)} />

          {/* Description */}
          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Short description shown on the games page…" rows={3}
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
          </Field>

          {/* Category + Badge */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50 w-full">
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0d0d1a] capitalize">{c}</option>)}
              </select>
            </Field>
            <Field label="Badge">
              <select value={form.badge ?? ''} onChange={e => set('badge', e.target.value || null)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50 w-full">
                {BADGE_OPTIONS.map(b => <option key={b} value={b} className="bg-[#0d0d1a]">{b || '— No Badge —'}</option>)}
              </select>
            </Field>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Player Count">
              <Input type="number" value={form.player_count} onChange={e => set('player_count', Number(e.target.value))} className={iCls} min={0} />
            </Field>
            <Field label="Tournament Count">
              <Input type="number" value={form.tournament_count} onChange={e => set('tournament_count', Number(e.target.value))} className={iCls} min={0} />
            </Field>
          </div>

          {/* Featured toggle */}
          <button type="button" onClick={() => set('featured', !form.featured)}
            className={'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ' +
              (form.featured ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/4 border-white/8 hover:border-white/15')}>
            <div className={'w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ' + (form.featured ? 'bg-yellow-500' : 'bg-white/15')}>
              <span className={'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ' + (form.featured ? 'left-6' : 'left-1')} />
            </div>
            <div>
              <p className={'text-sm font-bold ' + (form.featured ? 'text-yellow-400' : 'text-white/60')}>
                {form.featured ? '⭐ Featured Game' : 'Mark as Featured'}
              </p>
              <p className="text-[10px] text-white/30">Featured games appear in the hero banner on the Games page</p>
            </div>
          </button>

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/8 flex-shrink-0 bg-black/30">
          <Button variant="ghost" size="sm" onClick={onClose}
            className="flex-1 border border-white/10 text-white/50 hover:text-white text-sm h-11">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm h-11 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Game'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────
function DeleteConfirm({ game, onClose, onDeleted }: {
  game: Game; onClose: () => void; onDeleted: () => void;
}): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('games').delete().eq('id', game.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success(`"${game.name}" deleted.`); onDeleted(); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
            <LogoImg url={game.logo_url} icon={game.icon} />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white">{game.name}</h3>
            <p className="text-xs text-white/40 capitalize">{game.category} · {game.player_count.toLocaleString()} players</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-5">
          <p className="text-sm text-red-400 font-bold mb-1">Permanently delete this game?</p>
          <p className="text-xs text-white/40 leading-relaxed">This cannot be undone. Any tournaments linked to this game will have their game reference cleared.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}
            className="flex-1 border border-white/10 text-white/50 text-sm h-11">Keep it</Button>
          <Button size="sm" onClick={confirm} disabled={deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold h-11 gap-2">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Quick logo replace (tap logo on row card) ──────────────────────────────
function QuickLogoReplace({ game, onUpdated }: {
  game: Game; onUpdated: (url: string | null) => void;
}): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `games/${game.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('games').update({ logo_url: data.publicUrl } as never).eq('id', game.id);
    if (dbErr) toast.error('File saved but DB update failed: ' + dbErr.message);
    else { onUpdated(data.publicUrl); toast.success('Logo updated!'); }
    setUploading(false);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <div
        className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0 cursor-pointer relative group"
        onClick={() => fileRef.current?.click()}
        title="Tap to replace logo instantly"
      >
        {uploading
          ? <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          : <>
              <LogoImg url={game.logo_url} icon={game.icon} />
              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl gap-0.5">
                <Camera className="w-4 h-4 text-white" />
                <span className="text-[8px] text-white/80 font-bold">REPLACE</span>
              </div>
            </>
        }
      </div>
    </>
  );
}

// ── Game row card ──────────────────────────────────────────────────────────
function GameRow({ game: initialGame, index, onEdit, onDelete }: {
  game: Game; index: number; onEdit: () => void; onDelete: () => void;
}): React.ReactElement {
  const [game, setGame] = useState(initialGame);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setGame(initialGame), [initialGame]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-white/8 bg-white/3 overflow-hidden hover:border-white/12 transition-colors"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3.5">

        {/* Tappable logo — instant upload */}
        <QuickLogoReplace game={game} onUpdated={url => setGame(g => ({ ...g, logo_url: url }))} />

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-orbitron font-bold text-sm text-white leading-snug">{game.name}</span>
            {game.featured ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">⭐ Featured</span> : null}
            {game.badge ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">{game.badge}</span> : null}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/30 flex-wrap">
            <span className="capitalize">{game.category}</span>
            <span>·</span>
            <span>{game.player_count.toLocaleString()} players</span>
            <span>·</span>
            {game.logo_url ? <span className="text-green-400/80">✓ logo</span> : <span className="text-white/20">emoji only</span>}
          </div>
        </div>

        {/* Always-visible action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-bold transition-all border border-cyan-500/20 active:scale-95">
            <Pencil className="w-3 h-3" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold transition-all border border-red-500/20 active:scale-95">
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all border border-white/8">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-t border-white/8 px-4 py-4 bg-black/20 overflow-hidden"
          >
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Category', value: game.category },
                { label: 'Players', value: game.player_count.toLocaleString() },
                { label: 'Tournaments', value: String(game.tournament_count) },
                { label: 'Badge', value: game.badge || '—' },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-lg bg-white/4 border border-white/8">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{s.label}</p>
                  <p className="text-xs text-white font-semibold capitalize truncate">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {game.description ? (
              <p className="text-xs text-white/40 leading-relaxed mb-3">{game.description}</p>
            ) : (
              <p className="text-xs text-white/20 italic mb-3">No description</p>
            )}

            {/* Logo URL */}
            {game.logo_url ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/4 border border-white/8 mb-3">
                <LinkIcon className="w-3 h-3 text-white/30 flex-shrink-0" />
                <p className="text-[10px] text-cyan-400/70 truncate font-mono">{game.logo_url}</p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" onClick={onEdit}
                className="flex-1 h-9 text-xs bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-1.5">
                <Pencil className="w-3.5 h-3.5" />Edit All Details
              </Button>
              <Button size="sm" onClick={onDelete} variant="ghost"
                className="h-9 text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 px-3 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Seed modal ─────────────────────────────────────────────────────────────
function SeedModal({ onClose, onSeeded }: { onClose: () => void; onSeeded: () => void }): React.ReactElement {
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);

  const isSchemaErr = (msg: string) =>
    msg.includes('logo_url') || msg.includes('schema cache') || msg.includes('column');

  const runSeed = async () => {
    setSeeding(true); setNeedsMigration(false);
    const msgs: string[] = [];
    let schemaErr = false;

    for (const game of DEFAULT_GAMES) {
      const { error: insertErr } = await supabase.from('games').insert(game as never);
      if (!insertErr) { msgs.push(`✓ ${game.name} added`); continue; }

      if (insertErr.message.includes('row-level') || insertErr.message.includes('permission')) {
        msgs.push(`✗ ${game.name}: RLS denied — check policies`); continue;
      }

      if (isSchemaErr(insertErr.message)) {
        schemaErr = true;
        const { name, description, icon, badge, player_count, tournament_count, category, featured } = game;
        const { error: r } = await supabase.from('games')
          .insert({ name, description, icon, badge, player_count, tournament_count, category, featured } as never);
        msgs.push(!r ? `✓ ${game.name} added (logo pending SQL migration)` :
          (r.message.includes('duplicate') || r.message.includes('unique')) ? `↺ ${game.name} already exists` :
          `✗ ${game.name}: ${r.message}`);
        continue;
      }

      if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique') || insertErr.message.includes('already exists')) {
        const { error: updErr } = await supabase.from('games')
          .update({ logo_url: game.logo_url, badge: game.badge, featured: game.featured } as never)
          .eq('name', game.name);
        if (!updErr) { msgs.push(`↺ ${game.name} logo updated`); }
        else if (isSchemaErr(updErr.message)) { schemaErr = true; msgs.push(`↺ ${game.name} exists (logo pending SQL migration)`); }
        else { msgs.push(`✗ ${game.name}: ${updErr.message}`); }
        continue;
      }

      msgs.push(`✗ ${game.name}: ${insertErr.message}`);
    }

    if (schemaErr) setNeedsMigration(true);
    setResults(msgs); setDone(true); setSeeding(false); onSeeded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-md bg-[#0d0d1a] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Seed Default Games</h3>
            <p className="text-xs text-white/40">Adds games or updates logos if they already exist</p>
          </div>
        </div>

        {!done ? (
          <>
            <div className="space-y-2 mb-5">
              {DEFAULT_GAMES.map(g => (
                <div key={g.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/4 border border-white/8">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/8 flex items-center justify-center flex-shrink-0 text-xl">
                    {g.logo_url ? <img src={g.logo_url} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-bold truncate">{g.name}</p>
                    <p className="text-xs text-white/40 capitalize">{g.category} · {g.player_count?.toLocaleString()} players</p>
                  </div>
                  {g.featured ? <span className="text-[10px] text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full flex-shrink-0">⭐</span> : null}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 border border-white/10 text-white/50 text-sm h-11">Cancel</Button>
              <Button size="sm" onClick={runSeed} disabled={seeding}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold h-11 gap-2">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {seeding ? 'Seeding…' : 'Seed All Games'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5 mb-4">
              {results.map((r, i) => (
                <p key={i} className={'text-xs font-mono px-3 py-2 rounded-lg ' +
                  (r.startsWith('✓') ? 'bg-green-500/10 text-green-400' :
                   r.startsWith('↺') ? 'bg-blue-500/10 text-blue-400' :
                   'bg-red-500/10 text-red-400')}>{r}</p>
              ))}
            </div>
            {needsMigration ? <MigrationBanner /> : null}
            <Button size="sm" onClick={onClose} className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold h-11">Done</Button>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Main AdminGames page ───────────────────────────────────────────────────
export function AdminGames(): React.ReactElement {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [schemaError, setSchemaError] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'add' | Game>(null);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [showSeed, setShowSeed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(''); setSchemaError(false);
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });
    if (error) {
      if (error.message.includes('logo_url') || error.message.includes('schema cache')) {
        setSchemaError(true);
        const { data: d2, error: e2 } = await supabase
          .from('games')
          .select('id,name,description,icon,badge,player_count,tournament_count,category,featured,created_at')
          .order('created_at', { ascending: false });
        if (!e2) setGames((d2 as Game[]).map(g => ({ ...g, logo_url: null })) ?? []);
        else setFetchError(e2.message);
      } else {
        setFetchError(error.message);
      }
    } else {
      setGames((data as Game[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = games.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.category.toLowerCase().includes(search.toLowerCase())
  );

  const withLogos = games.filter(g => g.logo_url).length;
  const editForm = modal && modal !== 'add' ? { ...modal } : { ...BLANK };

  return (
    <div className="p-4 sm:p-7 max-w-4xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-0.5">Games</h1>
          <p className="text-white/35 text-sm">{games.length} games · {withLogos} with logos · tap logo to swap image</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games…"
              className="pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-full sm:w-40" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}
            className="text-white/40 hover:text-white hover:bg-white/8 h-9 w-9 p-0 flex-shrink-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          {games.length === 0 || games.some(g => !g.logo_url) ? (
            <Button size="sm" onClick={() => setShowSeed(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-bold h-9 gap-1.5 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5" />{games.length === 0 ? 'Seed Games' : 'Fix Logos'}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setModal('add')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-1.5 flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />Add Game
          </Button>
        </div>
      </motion.div>

      {/* Migration warning banner */}
      {schemaError ? <div className="mb-5"><MigrationBanner /></div> : null}

      {/* Fetch error */}
      {fetchError ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5 flex items-center justify-between gap-3">
          <span className="flex-1">{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={load} className="text-red-400 text-xs h-7 flex-shrink-0">Retry</Button>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && games.length === 0 && !fetchError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-10 rounded-2xl border border-dashed border-white/15 text-center mb-5">
          <Gamepad2 className="w-16 h-16 mx-auto text-white/10 mb-4" />
          <p className="text-white font-orbitron font-bold text-lg mb-1">No games yet</p>
          <p className="text-white/40 text-sm mb-6 max-w-xs mx-auto">Seed the 5 default games with real logos, or add your own.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button size="sm" onClick={() => setShowSeed(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-bold gap-2 h-10 px-5">
              <Sparkles className="w-3.5 h-3.5" />Seed Default Games
            </Button>
            <Button size="sm" onClick={() => setModal('add')} variant="ghost"
              className="border border-white/15 text-white/60 text-xs gap-2 h-10 px-5">
              <Plus className="w-3.5 h-3.5" />Add Manually
            </Button>
          </div>
        </motion.div>
      ) : null}

      {/* Game list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => (
          <div key={i} className="h-[72px] rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g, i) => (
            <GameRow key={g.id} game={g} index={i}
              onEdit={() => setModal(g)}
              onDelete={() => setDeleteTarget(g)} />
          ))}
          {filtered.length === 0 && games.length > 0 ? (
            <div className="text-center py-12">
              <p className="text-white/35 text-sm">No games match "{search}"</p>
            </div>
          ) : null}
        </div>
      )}

      <AnimatePresence>
        {modal ? <GameModal key="game-modal" game={editForm} onClose={() => setModal(null)} onSaved={load} /> : null}
        {deleteTarget ? <DeleteConfirm key="del-confirm" game={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} /> : null}
        {showSeed ? <SeedModal key="seed-modal" onClose={() => setShowSeed(false)} onSeeded={load} /> : null}
      </AnimatePresence>
    </div>
  );
}
