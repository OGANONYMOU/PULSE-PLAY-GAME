import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Flame, MessageSquare, Heart, TrendingUp,
  Trophy, X, Hash, Lock, ChevronDown, ChevronUp, Loader2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePosts, type PostTag, type PostCommentWithAuthor } from '@/hooks/usePosts';
import { useTournaments } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const tags: { value: PostTag; label: string; color: string }[] = [
  { value: 'general',    label: '💬 General',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'tournament', label: '🏆 Tournament', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'tips',       label: '💡 Tips',       color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'clips',      label: '🎬 Clips',      color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
];

function tagClass(tag: PostTag): string {
  return tags.find(t => t.value === tag)?.color ?? 'bg-white/10 text-white/60';
}

function AvatarBlock({ url, username }: { url: string | null; username: string }) {
  return (
    <Avatar className="w-9 h-9 flex-shrink-0">
      {url && <AvatarImage src={url} />}
      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Comments section for a single post ───────────────────────────────────────
function CommentsSection({
  postId, commentCount,
  fetchComments, addComment, deleteComment,
}: {
  postId: string;
  commentCount: number;
  fetchComments: (id: string) => Promise<PostCommentWithAuthor[]>;
  addComment: (postId: string, authorId: string, content: string) => Promise<{ error: Error | null }>;
  deleteComment: (commentId: string, postId: string) => Promise<{ error: Error | null }>;
}) {
  const { user, profile } = useAuth();
  const [open, setOpen]         = useState(false);
  const [comments, setComments] = useState<PostCommentWithAuthor[]>([]);
  const [loading, setLoading]   = useState(false);
  const [text, setText]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchComments(postId);
    setComments(data);
    setLoading(false);
  };

  const toggle = () => {
    if (!open) load();
    setOpen(p => !p);
  };

  const submit = async () => {
    if (!text.trim() || !user) return;
    setSubmitting(true);
    const { error } = await addComment(postId, user.id, text.trim());
    if (error) { toast.error('Failed to post comment.'); }
    else {
      setText('');
      load();
    }
    setSubmitting(false);
  };

  const remove = async (commentId: string) => {
    const { error } = await deleteComment(commentId, postId);
    if (error) { toast.error('Failed to delete comment.'); }
    else { setComments(prev => prev.filter(c => c.id !== commentId)); }
  };

  return (
    <div className="border-t border-border/30 mt-3 pt-3">
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        onClick={toggle}>
        <MessageSquare className="w-3.5 h-3.5" />
        {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="overflow-hidden">
            <div className="mt-3 space-y-2">
              {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
              {!loading && comments.length === 0 && (
                <div className="text-xs text-muted-foreground">No comments yet. Be the first!</div>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 group">
                  <AvatarBlock url={c.profiles?.avatar_url ?? null} username={c.profiles?.username ?? '?'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold">{c.profiles?.username ?? 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed break-words">{c.content}</p>
                  </div>
                  {(c.author_id === user?.id) && (
                    <button onClick={() => remove(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {user && (
                <div className="flex gap-2 mt-2">
                  <AvatarBlock url={profile?.avatar_url ?? null} username={profile?.username ?? '?'} />
                  <div className="flex-1">
                    <Textarea
                      ref={inputRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="Write a comment…"
                      className="text-sm min-h-[60px] resize-none bg-muted/50 border-border/40"
                      maxLength={500}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    />
                    <div className="flex justify-end mt-1.5">
                      <Button size="sm" disabled={!text.trim() || submitting}
                        className="h-7 text-xs bg-gradient-to-r from-cyan-500 to-purple-600"
                        onClick={submit}>
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Community() {
  const { user, profile, isAuthenticated } = useAuth();
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedTag, setSelectedTag]       = useState<PostTag>('general');
  const [activeFilter, setActiveFilter]     = useState<PostTag | 'all'>('all');
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const {
    posts, isLoading: postsLoading, error: postsError,
    createPost, likePost, fetchComments, addComment, deleteComment,
  } = usePosts(activeFilter === 'all' ? undefined : activeFilter);

  const { tournaments } = useTournaments();
  const live = tournaments.filter(t => t.status === 'ongoing');

  const handleSubmitPost = async () => {
    if (!newPostContent.trim() || !user) return;
    setIsSubmitting(true);
    const title = newPostContent.split('\n')[0].slice(0, 80);
    const { error } = await createPost(user.id, title, newPostContent, selectedTag);
    if (error) { toast.error('Failed to post. Please try again.'); }
    else { setNewPostContent(''); toast.success('Post published!'); }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) { toast.error('Sign in to like posts.'); return; }
    await likePost(postId);
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="page-shell mb-10">
        <div className="gaming-card p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <h1 className="font-orbitron text-3xl md:text-4xl font-bold mb-3">
              The <span className="gradient-text">PulsePlay</span> Community
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-5">
              Share updates, discuss tactics, celebrate victories.
            </p>
            {live.length > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Flame className="w-4 h-4 text-red-400" />
                <span className="text-green-400 font-bold">{live.length}</span>
                <span className="text-muted-foreground text-sm">live tournaments right now</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="page-shell">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
          {/* Main feed */}
          <div className="xl:col-span-2 space-y-5">
            {/* Composer */}
            <div className="gaming-card p-5">
              {isAuthenticated ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <AvatarBlock url={profile?.avatar_url ?? null} username={profile?.username ?? '?'} />
                  <div className="flex-1">
                    <Textarea
                      placeholder="Share a clip, ask for tips, or hype up a tournament…"
                      value={newPostContent}
                      onChange={e => setNewPostContent(e.target.value)}
                      className="min-h-[90px] bg-muted/50 border-border/40 resize-none mb-3 text-sm"
                      maxLength={1000}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Tag picker */}
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                          <button key={tag.value}
                            onClick={() => setSelectedTag(tag.value)}
                            className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-all ${
                              selectedTag === tag.value ? tag.color + ' ring-1 ring-current' : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-white/20'
                            }`}>
                            {tag.label}
                          </button>
                        ))}
                      </div>
                      <Button
                        disabled={!newPostContent.trim() || isSubmitting}
                        className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2 text-xs h-10 sm:h-8 flex-shrink-0"
                        onClick={handleSubmitPost}>
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {isSubmitting ? 'Posting…' : 'Post'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />Sign in to join the conversation
                  </div>
                  <Link to="/signin">
                    <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs sm:w-auto">Sign In</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Filter */}
            <div className="pill-scroll">
              <button onClick={() => setActiveFilter('all')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeFilter === 'all' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                All Posts
              </button>
              {tags.map(tag => (
                <button key={tag.value} onClick={() => setActiveFilter(tag.value)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeFilter === tag.value ? tag.color + ' ring-1 ring-current' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            {postsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="gaming-card p-5 space-y-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              ))
            ) : postsError ? (
              <div className="gaming-card p-6 text-center">
                <X className="w-8 h-8 mx-auto text-red-400 mb-2" />
                <p className="text-red-400 text-sm">{postsError}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="gaming-card p-10 text-center">
                <MessageSquare className="w-10 h-10 mx-auto text-white/20 mb-3" />
                <h3 className="font-orbitron text-base mb-1">No posts yet</h3>
                <p className="text-muted-foreground text-sm">Be the first to share something!</p>
              </div>
            ) : (
              <AnimatePresence>
                {posts.map((post, i) => (
                  <motion.div key={post.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay: i * 0.04 }} layout>
                    <div className="gaming-card p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <AvatarBlock url={post.profiles?.avatar_url ?? null} username={post.profiles?.username ?? '?'} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-bold text-sm">{post.profiles?.username ?? 'Unknown'}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tagClass(post.tag)}`}>
                              {tags.find(t => t.value === post.tag)?.label ?? post.tag}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {post.title && post.title !== post.content.slice(0, 80) && (
                        <h4 className="font-bold text-sm mb-1">{post.title}</h4>
                      )}
                      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words mb-3">
                        {post.content}
                      </p>

                      {/* Like button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs transition-all hover:scale-110 ${
                            post.liked_by_me ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
                          }`}>
                          <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                          {post.likes}
                        </button>
                      </div>

                      {/* Comments */}
                      <CommentsSection
                        postId={post.id}
                        commentCount={post.comments}
                        fetchComments={fetchComments}
                        addComment={addComment}
                        deleteComment={deleteComment}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5 xl:sticky xl:top-28 self-start">
            {/* Trending tags */}
            <div className="gaming-card p-5">
              <h3 className="font-orbitron text-sm font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />Trending Topics
              </h3>
              <div className="space-y-2">
                {['eFootball 2026', 'Tournament Tips', 'Weekend Scrimmage', 'ProClub Guide', 'Lagos eSports'].map(t => (
                  <div key={t} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm hover:text-cyan-400 cursor-pointer transition-colors">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live tournaments */}
            {live.length > 0 && (
              <div className="gaming-card p-5">
                <h3 className="font-orbitron text-sm font-bold mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />Live Now
                </h3>
                <div className="space-y-3">
                  {live.slice(0, 3).map(t => (
                    <Link to="/tournaments" key={t.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-xl">{(t as { games?: { icon?: string } }).games?.icon ?? '🎮'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Live
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            {!isAuthenticated && (
              <div className="gaming-card p-5 text-center">
                <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-bold mb-2 text-sm">Join the Community</h3>
                <p className="text-xs text-muted-foreground mb-4">Sign up to post, comment, and compete.</p>
                <Link to="/register">
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm">
                    Create Account
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
