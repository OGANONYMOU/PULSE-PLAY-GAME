import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, AlertCircle, Loader2, Megaphone,
  Eye, EyeOff, Pin, PinOff, X, Save, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { AnnouncementRow } from '@/types/database';

type AnnType = 'info' | 'warning' | 'success' | 'event';

const TYPE_META: Record<AnnType, { label: string; dot: string; ring: string; bg: string }> = {
  info:    { label: 'Info',    dot: 'bg-blue-400',   ring: 'border-blue-500/30',   bg: 'bg-blue-500/10 text-blue-400'   },
  warning: { label: 'Warning', dot: 'bg-yellow-400', ring: 'border-yellow-500/30', bg: 'bg-yellow-500/10 text-yellow-400' },
  success: { label: 'Success', dot: 'bg-green-400',  ring: 'border-green-500/30',  bg: 'bg-green-500/10 text-green-400'  },
  event:   { label: 'Event',   dot: 'bg-purple-400', ring: 'border-purple-500/30', bg: 'bg-purple-500/10 text-purple-400' },
};

const BLANK = { title: '', content: '', type: 'info' as AnnType };

// ── Create / Edit modal ────────────────────────────────────────────────────
function AnnModal(p: {
  initial?: AnnouncementRow;
  createdBy: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState(
    p.initial
      ? { title: p.initial.title, content: p.initial.content, type: p.initial.type as AnnType }
      : { ...BLANK }
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!p.initial;

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }
    setSaving(true);
    let error: { message: string } | null = null;

    if (isEdit && p.initial) {
      const res = await supabase.from('announcements').update({
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        updated_at: new Date().toISOString(),
      } as never).eq('id', p.initial.id);
      error = res.error;
    } else {
      const res = await supabase.from('announcements').insert({
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        created_by: p.createdBy ?? null,
        pinned: false,
        is_active: true,
      } as never);
      error = res.error;
    }

    if (error) {
      const msg = error.message.includes('row-level security') || error.message.includes('permission')
        ? 'Permission denied — check Supabase RLS policies for announcements table.'
        : error.message;
      toast.error(msg);
    } else {
      toast.success(isEdit ? 'Announcement updated.' : 'Announcement created.');
      p.onSaved();
      p.onClose();
    }
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">
              {isEdit ? 'Edit Announcement' : 'New Announcement'}
            </h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Title</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Announcement title…" className={inputCls} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Content</label>
            <Textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Write your announcement…"
              rows={4}
              className={inputCls + ' resize-none'}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(TYPE_META) as AnnType[]).map(t => {
                const m = TYPE_META[t];
                const active = form.type === t;
                return (
                  <button
                    key={t}
                    onClick={() => set('type', t)}
                    className={'px-3 py-2 rounded-lg border text-xs font-bold transition-all ' +
                      (active ? m.bg + ' ' + m.ring : 'bg-white/4 border-white/10 text-white/40 hover:text-white hover:bg-white/8')}
                  >
                    <span className={'w-2 h-2 rounded-full inline-block mr-1.5 ' + m.dot} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 hover:text-white text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Publish'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm(p: { ann: AnnouncementRow; onClose: () => void; onDeleted: () => void }): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('announcements').delete().eq('id', p.ann.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Announcement deleted.'); p.onDeleted(); p.onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Announcement</h3>
            <p className="text-xs text-white/40">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">"{p.ann.title}"</span>?</p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="flex-1 border border-white/10 text-white/50 hover:text-white text-xs">Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Announcement card ──────────────────────────────────────────────────────
function AnnCard(p: {
  ann: AnnouncementRow;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (field: 'pinned' | 'is_active') => void;
}): React.ReactElement {
  const a = p.ann;
  const meta = TYPE_META[a.type as AnnType] ?? TYPE_META.info;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.index * 0.04 }}
      className={'flex flex-col gap-3 p-4 rounded-xl border transition-all group ' +
        (a.is_active ? 'bg-white/4 border-white/8 hover:border-white/15' : 'bg-white/2 border-white/5 opacity-60')}
    >
      <div className="flex items-start gap-3">
        <span className={'text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0 border ' + meta.bg + ' ' + meta.ring}>
          <span className={'w-1.5 h-1.5 rounded-full inline-block mr-1 ' + meta.dot} />{meta.label}
        </span>
        {a.pinned ? <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 flex-shrink-0">📌 Pinned</span> : null}
        {!a.is_active ? <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-white/8 text-white/30 border border-white/10 flex-shrink-0">Hidden</span> : null}
        <div className="flex items-center gap-1.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => p.onToggle('pinned')} title={a.pinned ? 'Unpin' : 'Pin'}
            className="p-1.5 rounded-lg hover:bg-orange-500/15 text-white/30 hover:text-orange-400 transition-all">
            {a.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => p.onToggle('is_active')} title={a.is_active ? 'Hide' : 'Show'}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
            {a.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={p.onEdit} className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 transition-all">
            <Save className="w-3.5 h-3.5" />
          </button>
          <button onClick={p.onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div>
        <h3 className="font-orbitron font-bold text-sm text-white mb-1">{a.title}</h3>
        <p className="text-xs text-white/45 line-clamp-2 leading-relaxed">{a.content}</p>
      </div>
      <p className="text-[10px] text-white/25">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminAnnouncements(): React.ReactElement {
  const { user } = useAuth();
  const [anns, setAnns] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [modal, setModal] = useState<null | 'new' | AnnouncementRow>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRow | null>(null);

  const load = async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) setFetchError(error.message);
    else setAnns((data as AnnouncementRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleField = async (ann: AnnouncementRow, field: 'pinned' | 'is_active') => {
    const { error } = await supabase.from('announcements')
      .update({ [field]: !ann[field], updated_at: new Date().toISOString() } as never)
      .eq('id', ann.id);
    if (error) toast.error(error.message);
    else { toast.success('Updated.'); load(); }
  };

  const active = anns.filter(a => a.is_active).length;

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Announcements</h1>
          <p className="text-white/35 text-sm">{active} active · {anns.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white hover:bg-white/8 h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setModal('new')} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />New Announcement
          </Button>
        </div>
      </motion.div>

      {fetchError ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5 flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="ghost" size="sm" onClick={load} className="text-red-400 text-xs h-7">Retry</Button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : anns.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm mb-4">No announcements yet.</p>
          <Button size="sm" onClick={() => setModal('new')} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            <Plus className="w-3.5 h-3.5" />Create First Announcement
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {anns.map((a, i) => (
            <AnnCard
              key={a.id} ann={a} index={i}
              onEdit={() => setModal(a)}
              onDelete={() => setDeleteTarget(a)}
              onToggle={(field) => toggleField(a, field)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal ? (
          <AnnModal
            key="ann-modal"
            initial={modal !== 'new' ? modal : undefined}
            createdBy={user?.id}
            onClose={() => setModal(null)}
            onSaved={load}
          />
        ) : null}
        {deleteTarget ? (
          <DeleteConfirm
            key="del-modal"
            ann={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={load}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}