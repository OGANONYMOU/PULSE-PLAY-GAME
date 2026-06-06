import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Flame, MessageSquare, Heart, TrendingUp,
  Trophy, X, Hash, Lock, Loader2,
  Share2, Clock, Star, BookOpen, Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePosts, type PostTag, type PostCommentWithAuthor } from '@/hooks/usePosts';
import { useTournaments } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { CommunitySEO } from '@/components/SEO';
import { awardXpAndNotify } from '@/hooks/useLevelUp';

const tags: { value: PostTag; label: string; color: string }[] = [
  { value: 'general',    label: '💬 General',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'tournament', label: '🏆 Tournament', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'tips',       label: '💡 Tips',       color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'clips',      label: '🎬 Clips',      color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
];

const TRENDING = [
  { label: 'eFootball 2026',    filter: 'general'    as PostTag },
  { label: 'Tournament Tips',   filter: 'tips'       as PostTag },
  { label: 'Weekend Scrimmage', filter: 'tournament' as PostTag },
  { label: 'ProClub Guide',     filter: 'tips'       as PostTag },
  { label: 'Lagos eSports',     filter: 'general'    as PostTag },
];

const RULES = [
  'Keep it respectful — attack the argument, not the player.',
  'No spam or self-promotion without context.',
  'Tournament disputes go to admin, not the feed.',
  'Clips must be your own content.',
  'Zero tolerance for hate speech or harassment.',
];

function tagClass(tag: PostTag): string {
  return tags.find(t => t.value === tag)?.color ?? 'bg-white/10 text-white/60';
}

function AvatarBlock({
  url, username, size = 'md',
}: { url: string | null; username: string; size?: 'sm' | 'md' }) {
  const sz  = size === 'sm' ? 'w-7 h-7'   : 'w-9 h-9';
  const txt = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <Avatar className={`${sz} flex-shrink-0`}>
      {url && <AvatarImage src={url} />}
      <AvatarFallback className={`bg-gradient-to-br from-cyan-500 to-purple-600 text-white ${txt} font-bold`}>
        {username[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type SortOption = 'hot' | 'new' | 'top';

export function Community() {
  const { user, profile, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [newPostContent, setNewPostContent] = useState('');
  const [selectedTag, setSelectedTag]       = useState<PostTag>('general');
  const [activeFilter, setActiveFilter]     = useState<PostTag | 'all'>('all');
  const [sortBy, setSortBy]                 = useState<SortOption>('hot');
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const [selectedPost, setSelectedPost]       = useState<typeof posts[0] | null>(null);
  const [postComments, setPostComments]       = useState<PostCommentWithAuthor[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText]         = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  // Prevents the URL-based auto-open effect from re-opening a dialog the user just closed
  const closedPostIdRef = useRef<string | null>(null);

  const {
    posts, isLoading: postsLoading, error: postsError,
    createPost, likePost, fetchComments, addComment,
  } = usePosts(activeFilter === 'all' ? undefined : activeFilter);

  // Wilson-score-inspired hot sort: engagement divided by age decay.
  // Prevents the old bug where elapsed hours were *added* (rewarding old posts).
  const sortedPosts = useMemo(() => {
    const copy = [...posts];
    switch (sortBy) {
      case 'new':
        return copy.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'top':
        return copy.sort((a, b) => b.likes - a.likes);
      case 'hot':
      default:
        return copy.sort((a, b) => {
          const ageA = (Date.now() - new Date(a.created_at).getTime()) / 3_600_000;
          const ageB = (Date.now() - new Date(b.created_at).getTime()) / 3_600_000;
          const sA = (a.likes + 1) / Math.pow(ageA + 2, 1.5);
          const sB = (b.likes + 1) / Math.pow(ageB + 2, 1.5);
          return sB - sA;
        });
    }
  }, [posts, sortBy]);

  const { tournaments } = useTournaments();
  const live = tournaments.filter(t => t.status === 'ongoing');

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleSharePost = async (post: typeof posts[0]) => {
    const url = `${window.location.origin}/community?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title || 'PulsePlay Community Post', text: post.content.slice(0, 100), url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  // ── Open / close detail ───────────────────────────────────────────────────
  const openPostDetail = async (post: typeof posts[0]) => {
    closedPostIdRef.current = null;
    setSelectedPost(post);
    setSearchParams({ post: post.id }, { replace: true });
    setLoadingComments(true);
    setPostComments(await fetchComments(post.id));
    setLoadingComments(false);
    setTimeout(() => commentRef.current?.focus(), 300);
  };

  const closePostDetail = () => {
    if (selectedPost) closedPostIdRef.current = selectedPost.id;
    setSelectedPost(null);
    setPostComments([]);
    setCommentText('');
    const p = new URLSearchParams(searchParams);
    p.delete('post');
    setSearchParams(p, { replace: true });
  };

  // Auto-open from URL — guarded so closing the dialog can't race-reopen it
  useEffect(() => {
    const id = searchParams.get('post');
    if (id && posts.length > 0 && !selectedPost && id !== closedPostIdRef.current) {
      const found = posts.find(p => p.id === id);
      if (found) openPostDetail(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, posts]);

  // ── Post actions ──────────────────────────────────────────────────────────
  const handleSubmitPost = async () => {
    if (!newPostContent.trim() || !user) return;
    if (profile?.is_banned) { toast.error('Your account is restricted. Contact support.'); return; }
    setIsSubmitting(true);
    const title = newPostContent.split('\n')[0].slice(0, 80);
    const { error } = await createPost(user.id, title, newPostContent, selectedTag);
    if (error) toast.error('Failed to post. Please try again.');
    else {
      setNewPostContent('');
      await awardXpAndNotify(user.id, 'post_created', { tag: selectedTag });
    }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated)   { toast.error('Sign in to like posts.'); return; }
    if (profile?.is_banned) { toast.error('Your account is restricted.'); return; }
    await likePost(postId);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user || submittingComment || !selectedPost) return;
    if (profile?.is_banned) { toast.error('Your account is restricted.'); return; }
    setSubmittingComment(true);
    const { error } = await addComment(selectedPost.id, user.id, commentText.trim());
    if (error) {
      toast.error('Failed to post comment.');
    } else {
      closePostDetail();
      await awardXpAndNotify(user.id, 'comment_posted', { post_id: selectedPost.id });
    }
    setSubmittingComment(false);
  };

  const charsLeft    = 1000 - newPostContent.length;
  const charsWarning = charsLeft < 100;

  // Keep like state live while the dialog is open
  const currentDialogPost = selectedPost
    ? (posts.find(p => p.id === selectedPost.id) ?? selectedPost)
    : null;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <CommunitySEO />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-10">
        <div className="gaming-card p-5 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <h1 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              The <span className="gradient-text">PulsePlay</span> Community
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-5">
              Share highlights, drop knowledge, and connect with competitors across Africa.
            </p>
            <div className="flex items-center justify-center flex-wrap gap-3">
              {live.length > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <Flame className="w-4 h-4 text-red-400" />
                  <span className="text-green-400 font-bold">{live.length}</span>
                  <span className="text-muted-foreground text-sm">
                    live tournament{live.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {posts.length > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 font-bold">{posts.length}</span>
                  <span className="text-muted-foreground text-sm">posts</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main feed ──────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Composer */}
            <div className="gaming-card p-5">
              {isAuthenticated ? (
                <div className="flex gap-3">
                  <AvatarBlock url={profile?.avatar_url ?? null} username={profile?.username ?? '?'} />
                  <div className="flex-1">
                    <Textarea
                      placeholder="Share a clip, ask for tips, or hype up a tournament…"
                      value={newPostContent}
                      onChange={e => setNewPostContent(e.target.value)}
                      className="min-h-[90px] bg-muted/50 border-border/40 resize-none mb-2 text-sm"
                      maxLength={1000}
                    />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                          <button key={tag.value} onClick={() => setSelectedTag(tag.value)}
                            className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-all ${
                              selectedTag === tag.value
                                ? tag.color + ' ring-1 ring-current'
                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-white/20'
                            }`}>
                            {tag.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {newPostContent.length > 0 && (
                          <span className={`text-[10px] tabular-nums ${charsWarning ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {charsLeft}
                          </span>
                        )}
                        <Button
                          disabled={!newPostContent.trim() || isSubmitting}
                          className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2 text-xs h-8"
                          onClick={handleSubmitPost}>
                          {isSubmitting
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                          {isSubmitting ? 'Posting…' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />Sign in to join the conversation
                  </div>
                  <Link to="/signin">
                    <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Filter & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    activeFilter === 'all'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}>
                  All Posts
                </button>
                {tags.map(tag => (
                  <button key={tag.value} onClick={() => setActiveFilter(tag.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      activeFilter === tag.value
                        ? tag.color + ' ring-1 ring-current'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}>
                    {tag.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                {([
                  { value: 'hot', icon: Flame, label: 'Hot' },
                  { value: 'new', icon: Clock, label: 'New' },
                  { value: 'top', icon: Star,  label: 'Top' },
                ] as { value: SortOption; icon: typeof Flame; label: string }[]).map(({ value, icon: Icon, label }) => (
                  <button key={value} onClick={() => setSortBy(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sortBy === value
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts */}
            {postsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="gaming-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-1/4" />
                      <Skeleton className="h-2.5 w-1/6" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            ) : postsError ? (
              <div className="gaming-card p-8 text-center">
                <X className="w-10 h-10 mx-auto text-red-400 mb-3" />
                <p className="text-red-400 text-sm font-medium">Failed to load posts</p>
                <p className="text-muted-foreground text-xs mt-1">{postsError}</p>
              </div>
            ) : sortedPosts.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="gaming-card p-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-white/15 mb-4" />
                <h3 className="font-orbitron text-base mb-2">Nothing here yet</h3>
                <p className="text-muted-foreground text-sm">
                  {activeFilter !== 'all'
                    ? `No ${activeFilter} posts yet — drop the first one.`
                    : 'Be the first to start a conversation.'}
                </p>
              </motion.div>
            ) : (
              <AnimatePresence>
                {sortedPosts.map((post, i) => (
                  <motion.div key={post.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: i * 0.04 }} layout>
                    <div className="gaming-card p-5 hover:border-cyan-500/30 transition-all duration-200 group">
                      <div className="flex items-start gap-3 mb-3">
                        <Link to={`/profile/${post.profiles?.username}`}
                          onClick={e => e.stopPropagation()}>
                          <AvatarBlock url={post.profiles?.avatar_url ?? null} username={post.profiles?.username ?? '?'} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Link to={`/profile/${post.profiles?.username}`}
                              onClick={e => e.stopPropagation()}
                              className="font-bold text-sm hover:text-cyan-400 transition-colors">
                              {post.profiles?.username ?? 'Unknown'}
                            </Link>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tagClass(post.tag)}`}>
                              {tags.find(t => t.value === post.tag)?.label ?? post.tag}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <div className="cursor-pointer" onClick={() => openPostDetail(post)}>
                        {post.title && post.title !== post.content.slice(0, 80) && (
                          <h4 className="font-bold text-sm mb-1.5 group-hover:text-cyan-400 transition-colors line-clamp-2">
                            {post.title}
                          </h4>
                        )}
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words mb-3 line-clamp-4">
                          {post.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                        <button onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs transition-all hover:scale-110 active:scale-95 ${
                            post.liked_by_me ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
                          }`}>
                          <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                          <span>{post.likes}</span>
                        </button>
                        <button onClick={() => openPostDetail(post)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors">
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.comments || 'Reply'}</span>
                        </button>
                        <button onClick={() => handleSharePost(post)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors ml-auto">
                          <Share2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Share</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Trending topics — clicking sets the tag filter */}
            <div className="gaming-card p-5">
              <h3 className="font-orbitron text-sm font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />Trending Topics
              </h3>
              <div className="space-y-1">
                {TRENDING.map(({ label, filter }) => (
                  <button key={label} onClick={() => setActiveFilter(filter)}
                    className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group text-left">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm group-hover:text-cyan-400 transition-colors flex-1">{label}</span>
                    <Zap className="w-3 h-3 text-transparent group-hover:text-cyan-400/60 transition-all" />
                  </button>
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

            {/* Community Rules */}
            <div className="gaming-card p-5">
              <h3 className="font-orbitron text-sm font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />Community Rules
              </h3>
              <ol className="space-y-2.5">
                {RULES.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-purple-400 flex-shrink-0 tabular-nums mt-0.5">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* CTA for guests */}
            {!isAuthenticated && (
              <div className="gaming-card p-5 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5" />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-bold mb-1 text-sm">Join the Community</h3>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Post, comment, like, and compete with players across Africa.
                  </p>
                  <div className="space-y-2">
                    <Link to="/register">
                      <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm">
                        Create Account
                      </Button>
                    </Link>
                    <Link to="/signin">
                      <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-white">
                        Already a member? Sign in
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Post Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!selectedPost} onOpenChange={v => { if (!v) closePostDetail(); }}>
        <DialogContent className="max-w-2xl glass border-border/40 max-h-[90vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="font-orbitron flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AvatarBlock url={selectedPost.profiles?.avatar_url ?? null} username={selectedPost.profiles?.username ?? '?'} />
                    <div>
                      <div className="text-base">{selectedPost.profiles?.username ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleSharePost(selectedPost)}
                    className="text-white/60 hover:text-white">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tagClass(selectedPost.tag)}`}>
                  {tags.find(t => t.value === selectedPost.tag)?.label ?? selectedPost.tag}
                </span>

                {selectedPost.title && selectedPost.title !== selectedPost.content.slice(0, 80) && (
                  <h3 className="font-bold text-lg leading-snug">{selectedPost.title}</h3>
                )}
                <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {selectedPost.content}
                </p>

                <div className="flex items-center gap-4 py-3 border-y border-white/10">
                  <button onClick={() => handleLike(selectedPost.id)}
                    className={`flex items-center gap-1.5 text-sm transition-all hover:scale-110 active:scale-95 ${
                      currentDialogPost?.liked_by_me ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
                    }`}>
                    <Heart className={`w-5 h-5 ${currentDialogPost?.liked_by_me ? 'fill-current' : ''}`} />
                    {currentDialogPost?.likes ?? selectedPost.likes} {(currentDialogPost?.likes ?? selectedPost.likes) === 1 ? 'like' : 'likes'}
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MessageSquare className="w-5 h-5" />
                    {postComments.length} {postComments.length === 1 ? 'comment' : 'comments'}
                  </span>
                </div>

                {/* Comments */}
                <div>
                  <h4 className="font-bold text-sm mb-3">Comments</h4>
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : postComments.length === 0 ? (
                    <div className="text-center py-6">
                      <MessageSquare className="w-8 h-8 mx-auto text-white/15 mb-2" />
                      <p className="text-muted-foreground text-sm">No comments yet — start the conversation.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {postComments.map(comment => (
                        <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                          <AvatarBlock url={comment.profiles?.avatar_url ?? null} username={comment.profiles?.username ?? '?'} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.profiles?.username ?? 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm text-white/80 break-words">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment composer */}
                  {isAuthenticated ? (
                    <div className="mt-4 flex gap-2 items-end">
                      <AvatarBlock url={profile?.avatar_url ?? null} username={profile?.username ?? '?'} size="sm" />
                      <div className="flex-1">
                        <Textarea
                          ref={commentRef}
                          placeholder="Write a comment… (Enter to send, Shift+Enter for newline)"
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              await handleSubmitComment();
                            }
                          }}
                          className="min-h-[60px] bg-muted/50 border-border/40 resize-none text-sm"
                          maxLength={500}
                        />
                      </div>
                      <Button
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim() || submittingComment}
                        size="sm"
                        className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-9 px-3 mb-0.5 flex-shrink-0">
                        {submittingComment
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                      <p className="text-xs text-muted-foreground">
                        <Link to="/signin" className="text-cyan-400 hover:underline">Sign in</Link> to leave a comment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
