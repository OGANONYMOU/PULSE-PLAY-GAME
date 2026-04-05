// PostCard.tsx — compatible with usePosts v2 types
// This component is available for use but Community.tsx renders posts inline.
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { type PostWithAuthor, type PostCommentWithAuthor } from '@/hooks/usePosts';

const TAG_COLORS: Record<string, string> = {
  general:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tournament: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tips:       'bg-green-500/20 text-green-400 border-green-500/30',
  clips:      'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const TAG_LABELS: Record<string, string> = {
  general: '💬 General', tournament: '🏆 Tournament',
  tips: '💡 Tips', clips: '🎬 Clips',
};

interface PostCardProps {
  post: PostWithAuthor;
  currentUserId?: string;
  onLike: (postId: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<PostCommentWithAuthor[]>;
  onAddComment: (postId: string, authorId: string, content: string) => Promise<{ error: Error | null }>;
  onDeleteComment: (commentId: string, postId: string) => Promise<{ error: Error | null }>;
}

export function PostCard({
  post,
  currentUserId,
  onLike,
  fetchComments,
  onAddComment,
  onDeleteComment,
}: PostCardProps): React.ReactElement {
  const [liked, setLiked]           = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount]   = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]     = useState<PostCommentWithAuthor[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const username = post.profiles?.username ?? 'Unknown';
  const avatarUrl = post.profiles?.avatar_url ?? null;
  const initials = username[0]?.toUpperCase() ?? '?';

  const handleLike = async () => {
    if (!currentUserId) { toast.error('Sign in to like posts.'); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    await onLike(post.id);
  };

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      setLoadingComments(true);
      const data = await fetchComments(post.id);
      setComments(data);
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !currentUserId || submitting) return;
    setSubmitting(true);
    const { error } = await onAddComment(post.id, currentUserId, commentText.trim());
    if (error) { toast.error('Failed to post comment.'); }
    else {
      setCommentText('');
      const data = await fetchComments(post.id);
      setComments(data);
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await onDeleteComment(commentId, post.id);
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/community').then(() =>
      toast.success('Link copied!')
    );
  };

  return (
    <div className="gaming-card p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} />}
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">{username}</span>
            <Badge className={`text-[10px] border ${TAG_COLORS[post.tag] ?? 'bg-white/10 text-white/50'}`}>
              {TAG_LABELS[post.tag] ?? post.tag}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words mb-4">
        {post.content}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/20 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs transition-all hover:scale-110 ${
            liked ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          <span>{likeCount}</span>
        </button>

        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{post.comments}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 transition-colors ml-auto"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-border/20 space-y-3">
          {loadingComments && (
            <div className="text-xs text-muted-foreground">Loading comments…</div>
          )}

          {!loadingComments && comments.length === 0 && (
            <div className="text-xs text-muted-foreground">No comments yet.</div>
          )}

          {comments.map(c => (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="w-7 h-7 flex-shrink-0">
                {c.profiles?.avatar_url && <AvatarImage src={c.profiles.avatar_url} />}
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px] font-bold">
                  {c.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-white">{c.profiles?.username ?? 'Unknown'}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-white/80 break-words">{c.content}</p>
              </div>
              {c.author_id === currentUserId && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-red-400 transition-all px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {currentUserId && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                placeholder="Write a comment…"
                maxLength={500}
                className="flex-1 text-sm bg-muted/50 border border-border/40 rounded-xl px-3 py-2 text-white placeholder:text-muted-foreground/50 outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || submitting}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-2 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed sm:self-auto"
              >
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
