import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, AlertCircle, MessageSquare, Flame, Search,
  Plus, X, Save, Loader2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type Tag = 'general' | 'tournament' | 'tips' | 'clips';

type Post = {
  id: string;
  title: string;
  content: string;
  tag: Tag;
  likes: number;
  comments: number;
  created_at: string;
  profiles: { username: string } | null;
};

const TAG_COLORS: Record<Tag, string> = {
  general:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tournament: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tips:       'bg-green-500/20 text-green-400 border-green-500/30',
  clips:      'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const BLANK = { title: '', content: '', tag: 'general' as Tag };

// ── Create post modal ──────────────────────────────────────────────────────
function CreatePostModal(p: { authorId: string; onClose: () => void; onSaved: () => void }): React.ReactElement {
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required.'); return; }
    if (!form.content.trim()) { toast.error('Content is required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('posts').insert({
      title: form.title.trim(),
      content: form.content.trim(),
      tag: form.tag,
      author_id: p.authorId,
      likes: 0,
      comments: 0,
    } as never);
    if (error) {
      const msg = error.message.includes('row-level security') || error.message.includes('permission')
        ? 'Permission denied — check Supabase RLS policies for posts table.'
        : error.message;
      toast.error(msg);
    } else {
      toast.success('Post created.');
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
              <MessageSquare className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">Create Post</h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Title</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Post title…" className={inputCls + ' h-9'} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Content</label>
            <textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Write your post…"
              rows={4}
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Tag</label>
            <div className="flex gap-2 flex-wrap">
              {(['general','tournament','tips','clips'] as Tag[]).map(t => (
                <button
                  key={t}
                  onClick={() => set('tag', t)}
                  className={'text-xs px-3 py-1.5 rounded-full border font-bold capitalize transition-all ' +
                    (form.tag === t ? TAG_COLORS[t] : 'bg-white/4 border-white/10 text-white/40 hover:text-white hover:bg-white/8')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 hover:text-white text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Publish Post
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm(p: { post: Post; onClose: () => void; onDeleted: () => void }): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('posts').delete().eq('id', p.post.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Post deleted.'); p.onDeleted(); p.onClose(); }
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
            <h3 className="font-orbitron font-bold text-sm text-white">Delete Post</h3>
            <p className="text-xs text-white/40">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">"{p.post.title}"</span>?</p>
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

// ── Main ───────────────────────────────────────────────────────────────────
export function AdminPosts(): React.ReactElement {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const load = async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });
    if (error) setFetchError(error.message);
    else setPosts((data as Post[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = posts.filter(p => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      (p.profiles?.username ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Community Posts</h1>
          <p className="text-white/35 text-sm">{posts.length} posts · moderation panel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-48" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-2">
            <Plus className="w-3.5 h-3.5" />Create Post
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
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm">{search ? 'No posts match your search.' : 'No posts yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-start gap-4 p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-cyan-400">{post.profiles?.username ?? 'Unknown'}</span>
                  <span className={'text-[10px] px-2 py-0.5 rounded-full border font-bold capitalize ' + (TAG_COLORS[post.tag] ?? 'bg-white/8 text-white/40 border-white/10')}>
                    {post.tag}
                  </span>
                  <span className="text-xs text-white/25 ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
                <h3 className="font-orbitron font-bold text-sm text-white mb-1 truncate">{post.title}</h3>
                <p className="text-xs text-white/40 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{post.likes}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comments}</span>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(post)}
                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && user ? (
          <CreatePostModal key="create" authorId={user.id} onClose={() => setShowCreate(false)} onSaved={load} />
        ) : null}
        {deleteTarget ? (
          <DeleteConfirm key="delete" post={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}