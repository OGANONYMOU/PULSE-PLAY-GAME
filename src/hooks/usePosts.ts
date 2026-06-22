import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type PostTag = 'general' | 'tournament' | 'tips' | 'clips';

export type PostWithAuthor = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tag: PostTag;
  likes: number;
  comments: number;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
  // Whether the current user has liked this post (populated client-side)
  liked_by_me?: boolean;
};

export type PostCommentWithAuthor = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

export function usePosts(tagFilter?: string) {
  const [posts, setPosts]       = useState<PostWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [myLikes, setMyLikes]   = useState<Set<string>>(new Set());

  // Load current user's liked post IDs so we can reflect UI accurately
  const loadMyLikes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id);
    if (data) setMyLikes(new Set(data.map((r: { post_id: string }) => r.post_id)));
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (tagFilter && tagFilter !== 'all') {
      query = query.eq('tag', tagFilter);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setPosts((data as unknown as PostWithAuthor[]) ?? []);
    }
    setIsLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    fetchPosts();
    loadMyLikes();

    const channel = supabase
      .channel(`posts_realtime_${tagFilter ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts, loadMyLikes, tagFilter]);

  // ── Create post ───────────────────────────────────────────────────────────
  const createPost = async (authorId: string, title: string, content: string, tag: PostTag) => {
    const { error } = await supabase.from('posts').insert({ author_id: authorId, title, content, tag } as never);
    return { error };
  };

  // ── Toggle like (deduped via post_likes table) ────────────────────────────
  const likePost = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('Not authenticated') };

    const alreadyLiked = myLikes.has(postId);

    if (alreadyLiked) {
      const { error } = await supabase.from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (!error) {
        setMyLikes(prev => { const s = new Set(prev); s.delete(postId); return s; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1), liked_by_me: false } : p));
      }
      return { error };
    } else {
      const { error } = await supabase.from('post_likes')
        .insert({ post_id: postId, user_id: user.id } as never);
      if (!error) {
        setMyLikes(prev => new Set([...prev, postId]));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1, liked_by_me: true } : p));
      }
      return { error };
    }
  };

  // ── Fetch comments for a specific post ────────────────────────────────────
  const fetchComments = async (postId: string): Promise<PostCommentWithAuthor[]> => {
    const { data, error: err } = await supabase
      .from('post_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (err) return [];
    return (data as unknown as PostCommentWithAuthor[]) ?? [];
  };

  // ── Add a comment ─────────────────────────────────────────────────────────
  const addComment = async (postId: string, authorId: string, content: string) => {
    const { error } = await supabase.from('post_comments')
      .insert({ post_id: postId, author_id: authorId, content } as never);
    if (!error) {
      // Optimistically bump comment counter
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
    }
    return { error };
  };

  // ── Delete a comment ──────────────────────────────────────────────────────
  const deleteComment = async (commentId: string, postId: string) => {
    const { error } = await supabase.from('post_comments')
      .delete()
      .eq('id', commentId);
    if (!error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: Math.max(0, p.comments - 1) } : p));
    }
    return { error };
  };

  return {
    posts: posts.map(p => ({ ...p, liked_by_me: myLikes.has(p.id) })),
    isLoading, error, myLikes,
    createPost, likePost, fetchComments, addComment, deleteComment,
    refetch: fetchPosts,
  };
}