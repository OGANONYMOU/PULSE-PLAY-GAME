import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Repeat2, Bookmark, Share2, MoreHorizontal, Flag, EyeOff,
  ChevronDown, Send, Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useComments, type PostWithAuthor, type ReactionType } from '@/hooks/usePosts';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Tag styles ───────────────────────────────────────────────────────────────
const TAG_STYLE: Record<string, string> = {
  general    : 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  tournament : 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  tips       : 'bg-green-500/15 text-green-400 border-green-500/20',
  strategy   : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  clips      : 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  matchmaking: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
};
const TAG_LABELS: Record<string, string> = {
  general: '💬 General', tournament: '🏆 Tournament', tips: '💡 Tips',
  strategy: '♟️ Strategy', clips: '🎬 Clips', matchmaking: '🎯 Matchmaking',
};

// ── Reaction picker ──────────────────────────────────────────────────────────
const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '❤️', label: 'Like' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'trophy', emoji: '🏆', label: 'Trophy' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
  { type: 'mind_blown', emoji: '🤯', label: 'Wow' },
];

// ── Comment thread ────────────────────────────────────────────────────────────
function CommentThread({ postId }: { postId: string }) {
  const { user, isAuthenticated } = useAuth();
  const { comments, loading, addComment } = useComments(postId);
  const [reply, setReply] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reply.trim() || !user) return;
    setSubmitting(true);
    const { error } = await addComment(user.id, reply.trim(), parentId ?? undefined);
    if (error) toast.error('Failed to post comment');
    else { setReply(''); setParentId(null); }
    setSubmitting(false);
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/6 space-y-3">
      {loading ? (
        <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
      ) : comments.map(c => (
        <div key={c.id} className="space-y-2">
          <div className="flex gap-2.5">
            <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
              <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px] font-bold">
                {c.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="inline-block bg-white/5 border border-white/8 rounded-2xl px-3 py-2">
                <p className="text-[11px] font-semibold text-white/80 mb-0.5">{c.profiles?.username}</p>
                <p className="text-sm text-white/70 leading-relaxed">{c.content}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 ml-1">
                <button onClick={() => setParentId(c.id)} className="text-[10px] text-white/30 hover:text-cyan-400 transition-colors font-semibold">Reply</button>
                <span className="text-[10px] text-white/20">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          {/* Replies */}
          {c.replies && c.replies.length > 0 && (
            <div className="ml-9 space-y-2">
              {c.replies.map(r => (
                <div key={r.id} className="flex gap-2">
                  <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white text-[8px] font-bold">
                      {r.profiles?.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="inline-block bg-white/4 border border-white/6 rounded-xl px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold text-white/70 mb-0.5">{r.profiles?.username}</p>
                    <p className="text-xs text-white/60">{r.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {parentId === c.id && isAuthenticated && (
            <div className="ml-9 flex gap-2">
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder={`Reply to @${c.profiles?.username}…`}
                className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25" />
              <button onClick={submit} disabled={submitting} className="px-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all">
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      ))}

      {isAuthenticated && (
        <div className="flex gap-2 items-center">
          {user && (
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px] font-bold">
                {user.email?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <input value={parentId ? reply : reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Write a comment…"
            className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25" />
          <button onClick={submit} disabled={submitting || !reply.trim()}
            className="px-2.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-40">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quote Repost Modal ────────────────────────────────────────────────────────
function QuoteRepostModal(p: { post: PostWithAuthor; onClose: () => void; onReposted: () => void }) {
  const { user } = useAuth();
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);

  const repost = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from('post_reposts').insert({
      original_id: p.post.id, reposter_id: user.id, quote_text: quote.trim() || null,
    } as never);
    if (error?.code === '23505') toast.info("You've already reposted this.");
    else if (error) toast.error(error.message);
    else {
      await supabase.from('posts').update({ reposts_count: (p.post.reposts_count ?? 0) + 1 } as never).eq('id', p.post.id);
      toast.success('Reposted! 🔁');
      p.onReposted();
      p.onClose();
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) p.onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-[#0d0d1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white flex items-center gap-2"><Repeat2 className="w-4 h-4 text-cyan-400" />Quote Repost</h2>
          <button onClick={p.onClose} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white"><ChevronDown className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <textarea value={quote} onChange={e => setQuote(e.target.value)} rows={3}
            placeholder="Add your thoughts… (optional)"
            className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-cyan-500/40 placeholder:text-white/25" />
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs font-semibold text-white/70 mb-1">{p.post.profiles?.username}</p>
            <p className="text-xs text-white/50 line-clamp-2">{p.post.content}</p>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={p.onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={repost} disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat2 className="w-4 h-4" />}Repost
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main PostCard ─────────────────────────────────────────────────────────────
interface PostCardProps {
  post: PostWithAuthor;
  onReact: (postId: string, userId: string, reaction: ReactionType) => Promise<void>;
  onSave?: (postId: string, userId: string) => Promise<void>;
  onRefresh?: () => void;
  showComments?: boolean;
}

export function PostCard({ post, onReact, onSave, onRefresh, showComments = false }: PostCardProps) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [showReactions, setShowReactions] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(showComments);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [myReaction, setMyReaction] = useState<ReactionType | null>(post.my_reaction ?? null);
  const [likes, setLikes] = useState(post.likes);
  const [isSaved, setIsSaved] = useState(post.is_saved ?? false);

  const avatarSrc = `https://api.dicebear.com/7.x/initials/svg?seed=${post.profiles?.username ?? 'U'}&backgroundColor=0f172a`;
  const profileUrl = `/profile/${post.profiles?.username}`;
  const shareUrl = `${window.location.origin}/community#post-${post.id}`;

  const handleReact = async (r: ReactionType) => {
    if (!user || !isAuthenticated) { toast.error('Sign in to react'); return; }
    setShowReactions(false);
    const isUnlike = myReaction === r;
    setMyReaction(isUnlike ? null : r);
    setLikes(l => isUnlike ? Math.max(0, l - 1) : l + 1);
    await onReact(post.id, user.id, r);
  };

  const handleSave = async () => {
    if (!user) { toast.error('Sign in to save'); return; }
    if (isSaved) { toast.info('Already saved'); return; }
    setIsSaved(true);
    await onSave?.(post.id, user.id);
    toast.success('Saved to bookmarks');
  };

  const handleDelete = async () => {
    if (!isAdmin && user?.id !== post.author_id) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) toast.error(error.message);
    else { toast.success('Post deleted'); onRefresh?.(); }
    setMenuOpen(false);
  };

  const reactionEmoji = REACTIONS.find(r => r.type === myReaction)?.emoji;

  return (
    <>
      <motion.article id={`post-${post.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-2xl bg-white/3 border border-white/8 hover:border-white/12 transition-all relative">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <a href={profileUrl}>
              <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-white/8 hover:ring-cyan-500/40 transition-all">
                <AvatarImage src={post.profiles?.avatar_url ?? avatarSrc} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </a>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={profileUrl} className="font-semibold text-sm text-white hover:text-cyan-400 transition-colors">
                  {post.profiles?.username}
                </a>
                <span className={'text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ' +
                  (TAG_STYLE[post.tag] ?? TAG_STYLE.general)}>
                  {TAG_LABELS[post.tag] ?? post.tag}
                </span>
              </div>
              <p className="text-[11px] text-white/30 mt-0.5">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* More menu */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen(v => !v)}
              className="w-7 h-7 rounded-full hover:bg-white/8 flex items-center justify-center text-white/25 hover:text-white/60 transition-all">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-20 w-44 bg-[#0d0d1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <button onClick={handleSave}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-all">
                    <Bookmark className="w-3.5 h-3.5" />{isSaved ? 'Saved' : 'Save post'}
                  </button>
                  <button onClick={() => { setShowReport(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-all">
                    <Flag className="w-3.5 h-3.5" />Report
                  </button>
                  {(isAdmin || user?.id === post.author_id) && (
                    <button onClick={handleDelete}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-all">
                      <EyeOff className="w-3.5 h-3.5" />Delete
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        {post.title && <p className="font-semibold text-sm text-white mb-1.5 leading-snug">{post.title}</p>}
        {post.content && <p className="text-sm text-white/65 leading-relaxed mb-3 whitespace-pre-line">{post.content}</p>}

        {/* Actions bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-white/6">

          {/* Reaction button with picker */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}
              onClick={() => isAuthenticated ? handleReact('like') : toast.error('Sign in to react')}
              className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ' +
                (myReaction ? 'text-red-400 bg-red-500/10' : 'text-white/40 hover:text-white/70 hover:bg-white/5')}>
              <span className="text-sm">{reactionEmoji ?? '🤍'}</span>
              <span className="font-semibold">{likes > 0 ? likes : ''}</span>
            </button>
            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onMouseEnter={() => setShowReactions(true)} onMouseLeave={() => setShowReactions(false)}
                  className="absolute bottom-full left-0 mb-2 z-20 flex gap-1 p-2 bg-[#0d0d1e] border border-white/12 rounded-2xl shadow-2xl">
                  {REACTIONS.map(r => (
                    <button key={r.type} onClick={() => handleReact(r.type)} title={r.label}
                      className={'text-xl p-1.5 rounded-xl transition-all hover:scale-125 ' + (myReaction === r.type ? 'bg-white/15' : 'hover:bg-white/8')}>
                      {r.emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setCommentsOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{post.comments > 0 ? post.comments : 'Comment'}</span>
          </button>

          <button onClick={() => isAuthenticated ? setShowQuote(true) : toast.error('Sign in to repost')}
            className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ' +
              (post.is_repost ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/40 hover:text-cyan-400 hover:bg-white/5')}>
            <Repeat2 className="w-3.5 h-3.5" />
            <span>{(post.reposts_count ?? 0) > 0 ? post.reposts_count : 'Repost'}</span>
          </button>

          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white/40 hover:text-purple-400 hover:bg-white/5 transition-all">
            <Share2 className="w-3.5 h-3.5" /><span>Share</span>
          </button>

          <button onClick={handleSave}
            className={'ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ' +
              (isSaved ? 'text-yellow-400 bg-yellow-500/10' : 'text-white/30 hover:text-yellow-400 hover:bg-white/5')}>
            <Bookmark className={'w-3.5 h-3.5 ' + (isSaved ? 'fill-yellow-400' : '')} />
          </button>
        </div>

        {/* Comments */}
        <AnimatePresence>
          {commentsOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              <CommentThread postId={post.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>

      <AnimatePresence>
        {showShare && <ShareModal key="share" title={post.title || post.content.slice(0, 50)} url={shareUrl} authorUsername={post.profiles?.username ?? 'user'} type="post" onClose={() => setShowShare(false)} />}
        {showReport && <ReportModal key="report" contentType="post" contentId={post.id} onClose={() => setShowReport(false)} />}
        {showQuote && <QuoteRepostModal key="quote" post={post} onClose={() => setShowQuote(false)} onReposted={() => onRefresh?.()} />}
      </AnimatePresence>
    </>
  );
}
