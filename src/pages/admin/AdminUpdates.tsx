import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, AlertCircle, Loader2, Activity, Newspaper,
  X, Save, RefreshCw, Eye, EyeOff, Pencil, ChevronRight,
  Gamepad2, Clock, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────
type EntryType = 'update' | 'news';

interface GameUpdate {
  id: string;
  game_id: string | null;
  type: EntryType;
  title: string;
  content: string;
  tag: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  games?: { name: string; icon: string } | null;
}

interface Game {
  id: string;
  name: string;
  icon: string;
}

// ── Tag presets ────────────────────────────────────────────────────────────
const UPDATE_TAGS = ['Patch', 'Hotfix', 'Content', 'Balance', 'Event', 'Season', 'Feature', 'Bug Fix'];
const NEWS_TAGS   = ['Esports', 'Partnership', 'Community', 'Announcement', 'Promotion', 'Award', 'Collaboration'];

const TYPE_STYLE: Record<EntryType, { label: string; icon: React.ComponentType<{ className?: string }>; accent: string; bg: string; border: string; tag: string; tagBorder: string }> = {
  update: {
    label: 'Update', icon: Activity,
    accent: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20',
    tag: 'bg-cyan-500/15 text-cyan-400', tagBorder: 'border-cyan-500/25',
  },
  news: {
    label: 'News', icon: Newspaper,
    accent: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/20',
    tag: 'bg-purple-500/15 text-purple-400', tagBorder: 'border-purple-500/25',
  },
};

const BLANK = { game_id: '', type: 'update' as EntryType, title: '', content: '', tag: 'Patch', is_published: true };

// ── SQL Migration Banner ───────────────────────────────────────────────────
const MIGRATION_SQL = `-- Run this in your Supabase SQL editor:
CREATE TABLE IF NOT EXISTS public.game_updates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     uuid REFERENCES public.games(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('update', 'news')),
  title       text NOT NULL,
  content     text NOT NULL,
  tag         text DEFAULT 'General',
  is_published boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);
ALTER TABLE public.game_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published" ON public.game_updates
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access" ON public.game_updates
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','MODERATOR')));`;

function MigrationBanner({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-yellow-400 mb-1">Table not found — run migration first</p>
          <p className="text-xs text-white/50">The <code className="text-yellow-300">game_updates</code> table doesn't exist yet. Copy the SQL below and run it in your Supabase SQL editor.</p>
        </div>
      </div>
      <pre className="text-[10px] text-white/40 bg-black/30 rounded-lg p-3 overflow-x-auto mb-3 leading-relaxed">{MIGRATION_SQL}</pre>
      <Button size="sm" onClick={onCopy} className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 text-xs gap-2">
        <Save className="w-3 h-3" />Copy SQL to Clipboard
      </Button>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────
function DetailDrawer({ entry, onClose, onEdit, onDelete }: {
  entry: GameUpdate; onClose: () => void;
  onEdit: () => void; onDelete: () => void;
}): React.ReactElement {
  const s = TYPE_STYLE[entry.type];
  const Icon = s.icon;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-xl bg-card border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {/* Header */}
        <div className={'flex items-start gap-4 p-5 border-b border-white/8 flex-shrink-0 ' + s.bg}>
          <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + s.bg + ' border ' + s.border}>
            <Icon className={'w-5 h-5 ' + s.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={'text-[10px] px-2 py-0.5 rounded-full font-bold border ' + s.tag + ' ' + s.tagBorder}>{s.label}</span>
              <span className={'text-[10px] px-2 py-0.5 rounded-full font-bold border ' + s.tag + ' ' + s.tagBorder}>{entry.tag}</span>
              {!entry.is_published && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/8 text-white/35 border border-white/10">Draft</span>}
            </div>
            <h2 className="font-orbitron font-black text-base text-white leading-snug">{entry.title}</h2>
            {entry.games && <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1"><Gamepad2 className="w-3 h-3" />{entry.games.icon} {entry.games.name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-2 text-[11px] text-white/35">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
            {entry.updated_at !== entry.created_at && <span className="text-white/20">· edited {formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true })}</span>}
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          </div>
        </div>
        {/* Footer actions */}
        <div className="flex items-center gap-2 p-4 border-t border-white/8 flex-shrink-0">
          <Button size="sm" onClick={onEdit} className="flex-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/25 gap-1.5 text-xs">
            <Pencil className="w-3.5 h-3.5" />Edit
          </Button>
          <Button size="sm" onClick={onDelete} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />Delete
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Entry Modal (Add / Edit) ────────────────────────────────────────────────
function EntryModal({ initial, games, createdBy, defaultType, onClose, onSaved }: {
  initial?: GameUpdate; games: Game[]; createdBy: string | undefined;
  defaultType: EntryType; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const isEdit = !!initial;
  const [form, setForm] = useState(
    initial
      ? { game_id: initial.game_id ?? '', type: initial.type, title: initial.title, content: initial.content, tag: initial.tag, is_published: initial.is_published }
      : { ...BLANK, type: defaultType }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));
  const tagPresets = form.type === 'update' ? UPDATE_TAGS : NEWS_TAGS;
  const s = TYPE_STYLE[form.type];

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required.'); return; }
    if (!form.content.trim()) { toast.error('Content is required.'); return; }
    setSaving(true);
    const payload = {
      game_id: form.game_id || null,
      type: form.type,
      title: form.title.trim(),
      content: form.content.trim(),
      tag: form.tag,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };
    let error: { message: string } | null = null;
    if (isEdit && initial) {
      const r = await supabase.from('game_updates').update(payload as never).eq('id', initial.id);
      error = r.error;
    } else {
      const r = await supabase.from('game_updates').insert({ ...payload, created_by: createdBy ?? null } as never);
      error = r.error;
    }
    if (error) {
      toast.error(error.message.includes('relation') ? 'Table not found — run the migration SQL first.' : error.message);
    } else {
      toast.success(isEdit ? 'Saved.' : form.type === 'update' ? 'Update published.' : 'News published.');
      onSaved(); onClose();
    }
    setSaving(false);
  };

  const inp = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
        className="w-full sm:max-w-xl bg-card border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[96vh] flex flex-col">
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + s.bg + ' border ' + s.border}>
              <s.icon className={'w-4 h-4 ' + s.accent} />
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">
              {isEdit ? `Edit ${s.label}` : `New ${s.label}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['update', 'news'] as EntryType[]).map(t => {
                const ts = TYPE_STYLE[t];
                return (
                  <button key={t} onClick={() => { set('type', t); set('tag', t === 'update' ? 'Patch' : 'Announcement'); }}
                    className={'flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs transition-all ' +
                      (form.type === t ? ts.bg + ' ' + ts.border + ' ' + ts.accent : 'bg-white/4 border-white/10 text-white/40 hover:bg-white/8 hover:text-white')}>
                    <ts.icon className="w-3.5 h-3.5" />{ts.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Game (optional)</label>
            <select value={form.game_id} onChange={e => set('game_id', e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50">
              <option value="">— All games / General —</option>
              {games.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Title</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.type === 'update' ? 'e.g. Season 6 Patch Notes' : 'e.g. World Championship 2026 Announced'}
              className={inp} />
          </div>

          {/* Tag */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Tag</label>
            <div className="flex flex-wrap gap-1.5">
              {tagPresets.map(t => (
                <button key={t} onClick={() => set('tag', t)}
                  className={'text-[11px] px-2.5 py-1 rounded-full border font-bold transition-all ' +
                    (form.tag === t ? s.tag + ' ' + s.tagBorder : 'bg-white/4 border-white/10 text-white/35 hover:text-white hover:bg-white/8')}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Content</label>
            <Textarea value={form.content} onChange={e => set('content', e.target.value)}
              placeholder="Write the full content here…" rows={6}
              className={inp + ' resize-none'} />
          </div>

          {/* Published toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
            <div>
              <p className="text-xs font-semibold text-white">Published</p>
              <p className="text-[10px] text-white/35">Visible to all users on the Games page</p>
            </div>
            <button onClick={() => set('is_published', !form.is_published)}
              className={'relative w-10 h-6 rounded-full transition-all duration-200 ' + (form.is_published ? 'bg-cyan-500' : 'bg-white/15')}>
              <span className={'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ' + (form.is_published ? 'left-5' : 'left-1')} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/8 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Publish'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────
function DeleteConfirm({ entry, onClose, onDeleted }: { entry: GameUpdate; onClose: () => void; onDeleted: () => void }): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('game_updates').delete().eq('id', entry.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Deleted.'); onDeleted(); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Entry</h3>
            <p className="text-xs text-white/40">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">"{entry.title}"</span>?</p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 border border-white/10 text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Entry Row Card ─────────────────────────────────────────────────────────
function EntryRow({ entry, index, onClick, onEdit, onDelete, onTogglePublish }: {
  entry: GameUpdate; index: number;
  onClick: () => void; onEdit: () => void;
  onDelete: () => void; onTogglePublish: () => void;
}): React.ReactElement {
  const s = TYPE_STYLE[entry.type];
  const Icon = s.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}
      className={'group flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ' +
        (entry.is_published ? 'bg-white/3 border-white/8 hover:border-white/18 hover:bg-white/5' : 'bg-white/[0.015] border-white/5 opacity-55 hover:opacity-80')}
      onClick={onClick}>
      {/* Type dot */}
      <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ' + s.bg + ' border ' + s.border}>
        <Icon className={'w-3.5 h-3.5 ' + s.accent} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-bold border ' + s.tag + ' ' + s.tagBorder}>{entry.tag}</span>
          {entry.games && <span className="text-[10px] text-white/30">{entry.games.icon} {entry.games.name}</span>}
          {!entry.is_published && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/30 border border-white/10 font-bold">Draft</span>}
        </div>
        <h3 className="font-semibold text-sm text-white truncate leading-snug group-hover:text-white/90">{entry.title}</h3>
        <p className="text-[11px] text-white/35 line-clamp-1 mt-0.5 leading-relaxed">{entry.content}</p>
        <p className="text-[10px] text-white/20 mt-1.5">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</p>
      </div>

      {/* Actions (always visible on hover, accessible via detail) */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={onTogglePublish} title={entry.is_published ? 'Unpublish' : 'Publish'}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
          {entry.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <ChevronRight className="w-4 h-4 text-white/15 flex-shrink-0 self-center" />
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function AdminUpdates(): React.ReactElement {
  const { user } = useAuth();
  const [entries, setEntries] = useState<GameUpdate[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);
  const [tab, setTab] = useState<EntryType>('update');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'new-update' | 'new-news' | GameUpdate>(null);
  const [detailEntry, setDetailEntry] = useState<GameUpdate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GameUpdate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, eRes] = await Promise.all([
      supabase.from('games').select('id,name,icon').order('name'),
      supabase.from('game_updates').select('*,games(name,icon)').order('created_at', { ascending: false }),
    ]);
    if (gRes.data) setGames(gRes.data as Game[]);
    if (eRes.error) {
      if (eRes.error.message.includes('relation') || eRes.error.message.includes('does not exist')) {
        setSchemaError(true);
      } else {
        toast.error(eRes.error.message);
      }
    } else {
      setSchemaError(false);
      setEntries((eRes.data as GameUpdate[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePublish = async (entry: GameUpdate) => {
    const { error } = await supabase.from('game_updates')
      .update({ is_published: !entry.is_published, updated_at: new Date().toISOString() } as never)
      .eq('id', entry.id);
    if (error) toast.error(error.message);
    else { toast.success(entry.is_published ? 'Unpublished.' : 'Published.'); load(); }
  };

  const copySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => toast.success('SQL copied to clipboard!'));
  };

  const filtered = entries.filter(e => {
    if (e.type !== tab) return false;
    const q = search.toLowerCase();
    return !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || (e.games?.name ?? '').toLowerCase().includes(q);
  });

  const counts = { update: entries.filter(e => e.type === 'update').length, news: entries.filter(e => e.type === 'news').length };
  const defaultType: EntryType = modal === 'new-news' ? 'news' : 'update';

  return (
    <div className="p-5 sm:p-7 max-w-4xl">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Updates & News</h1>
          <p className="text-white/35 text-sm">
            {counts.update} update{counts.update !== 1 ? 's' : ''} · {counts.news} news {counts.news !== 1 ? 'stories' : 'story'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}
            className="text-white/40 hover:text-white hover:bg-white/8 h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setModal('new-news')}
            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/25 text-xs font-bold h-9 gap-1.5">
            <Newspaper className="w-3.5 h-3.5" />Add News
          </Button>
          <Button size="sm" onClick={() => setModal('new-update')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-1.5">
            <Plus className="w-3.5 h-3.5" />Add Update
          </Button>
        </div>
      </motion.div>

      {/* Migration banner */}
      {schemaError && <MigrationBanner onCopy={copySql} />}

      {/* Tab bar + search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex rounded-xl border border-white/8 overflow-hidden flex-shrink-0">
          {(['update', 'news'] as EntryType[]).map(t => {
            const ts = TYPE_STYLE[t];
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={'flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-all ' +
                  (active ? ts.bg + ' ' + ts.accent : 'text-white/35 hover:text-white/65 hover:bg-white/4')}>
                <ts.icon className="w-3.5 h-3.5" />
                <span>{ts.label}s</span>
                <span className={'ml-0.5 text-[9px] px-1 rounded-full ' + (active ? ts.tag : 'bg-white/8 text-white/25')}>
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}s…`}
            className="pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-white/4 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          {tab === 'update'
            ? <Activity className="w-12 h-12 mx-auto text-white/15 mb-4" />
            : <Newspaper className="w-12 h-12 mx-auto text-white/15 mb-4" />}
          <p className="text-white/35 text-sm mb-4">
            {search ? `No ${tab}s match your search.` : `No ${tab}s yet.`}
          </p>
          <Button size="sm" onClick={() => setModal(tab === 'update' ? 'new-update' : 'new-news')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            <Plus className="w-3.5 h-3.5" />Add First {TYPE_STYLE[tab].label}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((entry, i) => (
            <EntryRow
              key={entry.id} entry={entry} index={i}
              onClick={() => setDetailEntry(entry)}
              onEdit={() => { setDetailEntry(null); setModal(entry); }}
              onDelete={() => { setDetailEntry(null); setDeleteTarget(entry); }}
              onTogglePublish={() => togglePublish(entry)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(modal === 'new-update' || modal === 'new-news' || (modal && typeof modal === 'object')) && (
          <EntryModal
            key="entry-modal"
            initial={typeof modal === 'object' ? modal : undefined}
            games={games}
            createdBy={user?.id}
            defaultType={defaultType}
            onClose={() => setModal(null)}
            onSaved={load}
          />
        )}
        {detailEntry && !deleteTarget && (
          <DetailDrawer
            key="detail"
            entry={detailEntry}
            onClose={() => setDetailEntry(null)}
            onEdit={() => { setModal(detailEntry); setDetailEntry(null); }}
            onDelete={() => { setDeleteTarget(detailEntry); setDetailEntry(null); }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            key="delete"
            entry={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
