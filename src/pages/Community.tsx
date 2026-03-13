import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send, Flame, MessageSquare, Share2, TrendingUp,
  Trophy, Users, X, Hash, AlertCircle, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePosts, type PostTag } from '@/hooks/usePosts';
import { useTournaments } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const tags: { value: PostTag; label: string; color: string }[] = [
  { value: 'general', label: '💬 General', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'tournament', label: '🏆 Tournament', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'tips', label: '💡 Tips', color: 'bg-green-500/20 text-green-400' },
  { value: 'clips', label: '🎬 Clips', color: 'bg-pink-500/20 text-pink-400' },
];

export function Community() {
  const { user, profile, isAuthenticated } = useAuth();
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedTag, setSelectedTag] = useState<PostTag>('general');
  const [activeFilter, setActiveFilter] = useState<PostTag | 'all'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { posts, isLoading: postsLoading, error: postsError, createPost, likePost } = usePosts(
    activeFilter === 'all' ? undefined : activeFilter
  );
  const { tournaments } = useTournaments();
  const liveTournaments = tournaments.filter((t) => t.status === 'ongoing');

  const handleSubmitPost = async () => {
    if (!newPostContent.trim() || !user) return;
    setIsSubmitting(true);

    const title = newPostContent.split('\n')[0].slice(0, 80);
    const { error } = await createPost(user.id, title, newPostContent, selectedTag);

    if (error) {
      toast.error('Failed to post. Please try again.');
    } else {
      setNewPostContent('');
      toast.success('Post published!');
    }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string, currentLikes: number) => {
    if (!isAuthenticated) {
      toast.error('Sign in to like posts.');
      return;
    }
    await likePost(postId, currentLikes);
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto mb-8 sm:mb-12"
      >
        <div className="gaming-card p-6 sm:p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <h1 className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              The <span className="gradient-text">PulsePlay</span> Community
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto mb-4 sm:mb-6">
              Connect with mobile gamers. Share updates, discuss tactics, celebrate victories.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400 font-medium">{liveTournaments.length}</span>
              <span className="text-muted-foreground text-sm">live tournaments running</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Composer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="gaming-card p-6"
            >
              {isAuthenticated ? (
                <div className="flex gap-4">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600">
                      {profile?.username?.[0]?.toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="What's on your mind? Share a clip, ask for tips, or hype up a tournament..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="min-h-[100px] bg-muted/50 border-border/50 resize-none mb-4"
                    />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <button
                            key={tag.value}
                            onClick={() => setSelectedTag(tag.value)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              selectedTag === tag.value
                                ? tag.color + ' ring-2 ring-offset-2 ring-offset-background'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewPostContent('')}
                          disabled={!newPostContent.trim()}
                        >
                          <X className="w-4 h-4 mr-1" /> Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSubmitPost}
                          disabled={!newPostContent.trim() || isSubmitting}
                          className="bg-gradient-to-r from-cyan-500 to-purple-600"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          {isSubmitting ? 'Posting…' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                  <Lock className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Sign in to share posts and join the conversation
                    </p>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600">
                    <Link to="/signin">Sign In</Link>
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Feed Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex gap-2 overflow-x-auto pb-2"
            >
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                className={activeFilter === 'all' ? 'bg-gradient-to-r from-cyan-500 to-purple-600' : ''}
              >
                All Posts
              </Button>
              {tags.map((tag) => (
                <Button
                  key={tag.value}
                  variant={activeFilter === tag.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(tag.value)}
                  className={activeFilter === tag.value ? 'bg-gradient-to-r from-cyan-500 to-purple-600' : ''}
                >
                  {tag.label}
                </Button>
              ))}
            </motion.div>

            {/* Error State */}
            {postsError && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Failed to load posts: {postsError}</p>
              </div>
            )}

            {/* Loading */}
            {postsLoading && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            )}

            {/* Posts */}
            {!postsLoading && (
              <div className="space-y-4">
                {posts.map((post, index) => {
                  const tagMeta = tags.find((t) => t.value === post.tag);
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.05 * index }}
                      className="gaming-card p-6"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar className="w-10 h-10">
                          {post.profiles?.avatar_url && (
                            <AvatarImage src={post.profiles.avatar_url} />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500/40 to-purple-600/40">
                            {post.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{post.profiles?.username ?? 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        {tagMeta && (
                          <Badge className={tagMeta.color}>{tagMeta.label}</Badge>
                        )}
                      </div>

                      <h3 className="font-orbitron text-lg font-bold mb-2">{post.title}</h3>
                      <p className="text-muted-foreground mb-4">{post.content}</p>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLike(post.id, post.likes)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-orange-400 transition-colors"
                        >
                          <Flame className="w-4 h-4" />
                          {post.likes}
                        </button>
                        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors">
                          <MessageSquare className="w-4 h-4" />
                          {post.comments}
                        </button>
                        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 transition-colors">
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                      </div>
                    </motion.div>
                  );
                })}

                {posts.length === 0 && (
                  <div className="text-center py-16">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No posts yet. Be the first to post!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Live Tournaments */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="gaming-card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-purple-400" />
                <h3 className="font-orbitron font-bold">Live Tournaments</h3>
              </div>
              {liveTournaments.length > 0 ? (
                <div className="space-y-3">
                  {liveTournaments.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                    >
                      <span className="text-2xl">{t.games?.icon ?? '🎮'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="flex items-center gap-1 text-xs text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Live Now
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No live tournaments right now.</p>
              )}
              <Button asChild variant="link" className="w-full mt-4 text-cyan-400">
                <Link to="/tournaments">View All Tournaments</Link>
              </Button>
            </motion.div>

            {/* Categories */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="gaming-card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="font-orbitron font-bold">Categories</h3>
              </div>
              <div className="space-y-2">
                {tags.map((tag) => {
                  const count = posts.filter((p) => p.tag === tag.value).length;
                  return (
                    <button
                      key={tag.value}
                      onClick={() => setActiveFilter(tag.value)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{tag.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{count} posts</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Community Rules */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="gaming-card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-pink-400" />
                <h3 className="font-orbitron font-bold">Community Rules</h3>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {[
                  'Be respectful to all members',
                  'No spam or self-promotion',
                  'Keep posts relevant to gaming',
                  'No hate speech or harassment',
                  'Have fun and compete fairly',
                ].map((rule, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-cyan-400 font-bold">{i + 1}.</span>
                    {rule}
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}