import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Flame, MessageSquare, Heart, TrendingUp,
  Trophy, X, Hash, Lock, Loader2,
  Share2, Clock, Star
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
  const [selectedPost, setSelectedPost]     = useState<typeof posts[0] | null>(null);
  const [postComments, setPostComments]     = useState<PostCommentWithAuthor[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const {
    posts, isLoading: postsLoading, error: postsError,
    createPost, likePost, fetchComments, addComment,
  } = usePosts(activeFilter === 'all' ? undefined : activeFilter);

  // Sort posts based on selected option
  const sortedPosts = useCallback(() => {
    const sorted = [...posts];
    switch (sortBy) {
      case 'new':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'top':
        return sorted.sort((a, b) => b.likes - a.likes);
      case 'hot':
      default:
        // Hot = combination of likes and recency
        return sorted.sort((a, b) => {
          const aScore = a.likes + (new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
          const bScore = b.likes + (new Date().getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60);
          return bScore - aScore;
        });
    }
  }, [posts, sortBy]);

  // Share post
  const handleSharePost = async (post: typeof posts[0]) => {
    const url = `${window.location.origin}/community?post=${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'PulsePlay Community Post',
          text: post.content.slice(0, 100),
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Post link copied to clipboard');
    }
  };

  // Open post detail
  const openPostDetail = async (post: typeof posts[0]) => {
    setSelectedPost(post);
    setSearchParams({ post: post.id }, { replace: true });
    
    setLoadingComments(true);
    const comments = await fetchComments(post.id);
    setPostComments(comments);
    setLoadingComments(false);
  };

  // Close post detail
  const closePostDetail = () => {
    setSelectedPost(null);
    setPostComments([]);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('post');
    setSearchParams(newParams, { replace: true });
  };

  // Auto-open post from URL
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId && posts.length > 0 && !selectedPost) {
      const post = posts.find(p => p.id === postId);
      if (post) {
        openPostDetail(post);
      }
    }
  }, [searchParams, posts]);

  const { tournaments } = useTournaments();
  const live = tournaments.filter(t => t.status === 'ongoing');

  const handleSubmitPost = async () => {
    if (!newPostContent.trim() || !user) return;
    if (profile?.is_banned) { toast.error('Your account is restricted. Contact support for assistance.'); return; }
    setIsSubmitting(true);
    const title = newPostContent.split('\n')[0].slice(0, 80);
    const { error } = await createPost(user.id, title, newPostContent, selectedTag);
    if (error) { toast.error('Failed to post. Please try again.'); }
    else { setNewPostContent(''); toast.success('Post published!'); }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) { toast.error('Sign in to like posts.'); return; }
    if (profile?.is_banned) { toast.error('Your account is restricted.'); return; }
    await likePost(postId);
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      {/* Hero */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="max-w-7xl mx-auto mb-10">
        <div className="gaming-card p-5 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <h1 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
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

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main feed */}
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
                      className="min-h-[90px] bg-muted/50 border-border/40 resize-none mb-3 text-sm"
                      maxLength={1000}
                    />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                        className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white gap-2 text-xs h-8 flex-shrink-0"
                        onClick={handleSubmitPost}>
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {isSubmitting ? 'Posting…' : 'Post'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />Sign in to join the conversation
                  </div>
                  <Link to="/signin">
                    <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs">Sign In</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Filter & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeFilter === 'all' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                  All Posts
                </button>
                {tags.map(tag => (
                  <button key={tag.value} onClick={() => setActiveFilter(tag.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeFilter === tag.value ? tag.color + ' ring-1 ring-current' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                    {tag.label}
                  </button>
                ))}
              </div>
              
              {/* Sort options */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                {([
                  { value: 'hot', icon: Flame, label: 'Hot' },
                  { value: 'new', icon: Clock, label: 'New' },
                  { value: 'top', icon: Star, label: 'Top' },
                ] as { value: SortOption; icon: typeof Flame; label: string }[]).map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sortBy === value 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' 
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
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
                {sortedPosts().map((post, i) => (
                  <motion.div key={post.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay: i * 0.04 }} layout>
                    <div className="gaming-card p-5 hover:border-cyan-500/30 transition-colors">
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

                      <div 
                        className="cursor-pointer"
                        onClick={() => openPostDetail(post)}
                      >
                        {post.title && post.title !== post.content.slice(0, 80) && (
                          <h4 className="font-bold text-sm mb-1 hover:text-cyan-400 transition-colors">{post.title}</h4>
                        )}
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words mb-3 hover:text-white/90 transition-colors">
                          {post.content}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs transition-all hover:scale-110 ${
                            post.liked_by_me ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
                          }`}>
                          <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                          {post.likes}
                        </button>
                        
                        <button
                          onClick={() => openPostDetail(post)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {post.comments || 'Comment'}
                        </button>
                        
                        <button
                          onClick={() => handleSharePost(post)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
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

      {/* Post Detail Dialog */}
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
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleSharePost(selectedPost)} className="text-white/60 hover:text-white">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tagClass(selectedPost.tag)}`}>
                  {tags.find(t => t.value === selectedPost.tag)?.label ?? selectedPost.tag}
                </span>

                {selectedPost.title && selectedPost.title !== selectedPost.content.slice(0, 80) && (
                  <h3 className="font-bold text-lg">{selectedPost.title}</h3>
                )}
                <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {selectedPost.content}
                </p>

                <div className="flex items-center gap-4 py-3 border-y border-white/10">
                  <button
                    onClick={() => handleLike(selectedPost.id)}
                    className={`flex items-center gap-1.5 text-sm transition-all hover:scale-110 ${
                      selectedPost.liked_by_me ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
                    }`}>
                    <Heart className={`w-5 h-5 ${selectedPost.liked_by_me ? 'fill-current' : ''}`} />
                    {selectedPost.likes} likes
                  </button>
                  
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MessageSquare className="w-5 h-5" />
                    {selectedPost.comments || 0} comments
                  </span>
                </div>

                {/* Comments Section */}
                <div>
                  <h4 className="font-bold text-sm mb-3">Comments</h4>
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : postComments.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">No comments yet. Be the first!</p>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {postComments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                          <AvatarBlock url={comment.profiles?.avatar_url ?? null} username={comment.profiles?.username ?? '?'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.profiles?.username ?? 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm text-white/80">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  {isAuthenticated && (
                    <div className="mt-4 flex gap-3">
                      <div className="flex-1">
                        <Textarea
                          placeholder="Add a comment..."
                          className="min-h-[60px] bg-muted/50 border-border/40 resize-none text-sm"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (profile?.is_banned) { toast.error('Your account is restricted.'); return; }
                              const target = e.target as HTMLTextAreaElement;
                              const content = target.value.trim();
                              if (content && user) {
                                await addComment(selectedPost.id, user.id, content);
                                target.value = '';
                                // Refresh comments
                                const comments = await fetchComments(selectedPost.id);
                                setPostComments(comments);
                              }
                            }
                          }}
                        />
                      </div>
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