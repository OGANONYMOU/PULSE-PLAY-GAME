import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type PostTag = 'general' | 'tournament' | 'tips' | 'clips' | 'strategy' | 'matchmaking';

export type ReactionType = 'like' | 'fire' | 'trophy' | 'clap' | 'mind_blown';

export type PostWithAuthor = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tag: PostTag;
  likes: number;
  comments: number;
  reposts_count: number;
  saves_count: number;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
  // local state
  my_reaction?: ReactionType | null;
  is_saved?: boolean;
  is_repost?: boolean;
  original_post?: PostWithAuthor | null;
  quote_text?: string | null;
};

export type Comment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  upvotes: number;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
  replies?: Comment[];
};

export function usePosts(tagFilter?: string) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (err) { setError(err.message); }
    else { setPosts((data as PostWithAuthor[]) ?? []); }
    setIsLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    fetchPosts();
    const channel = supabase.channel('posts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const createPost = async (authorId: string, title: string, content: string, tag: PostTag) => {
    const { error } = await supabase.from('posts').insert({ author_id: authorId, title, content, tag } as never);
    if (!error) fetchPosts();
    return { error };
  };

  /** Toggle reaction — if same reaction exists, remove it (unlike) */
  const reactToPost = async (postId: string, userId: string, reaction: ReactionType) => {
    // Check existing
    const { data: existing } = await (supabase as any)
      .from('post_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle() as { data: { id: string; reaction_type: string } | null };

    if (existing) {
      if (existing.reaction_type === reaction) {
        // remove reaction
        await supabase.from('post_reactions').delete().eq('id', existing.id);
        await supabase.from('posts').update({ likes: Math.max(0, 0) } as never); // let DB trigger handle
        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, likes: Math.max(0, p.likes - 1), my_reaction: null }
          : p));
        return;
      } else {
        // change reaction
        await supabase.from('post_reactions').update({ reaction_type: reaction } as never).eq('id', existing.id);
      }
    } else {
      await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, reaction_type: reaction } as never);
      // bump likes counter
      const post = posts.find(p => p.id === postId);
      if (post) await supabase.from('posts').update({ likes: post.likes + 1 } as never).eq('id', postId);
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes: p.likes + 1, my_reaction: reaction }
        : p));
    }
  };

  /** Legacy simple like */
  const likePost = async (postId: string, currentLikes: number) => {
    const { error } = await supabase.from('posts').update({ likes: currentLikes + 1 } as never).eq('id', postId);
    if (!error) setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: currentLikes + 1 } : p));
    return { error };
  };

  const savePost = async (postId: string, userId: string) => {
    const { error } = await supabase.from('post_saves').insert({ post_id: postId, user_id: userId } as never);
    if (!error) {
      const post = posts.find(p => p.id === postId);
      if (post) await supabase.from('posts').update({ saves_count: (post.saves_count ?? 0) + 1 } as never).eq('id', postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: true, saves_count: (p.saves_count ?? 0) + 1 } : p));
    }
    return { error };
  };

  const unsavePost = async (postId: string, userId: string) => {
    await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', userId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: false } : p));
  };

  return { posts, isLoading, error, createPost, likePost, reactToPost, savePost, unsavePost, refetch: fetchPosts };
}

// ── Comments hook ──────────────────────────────────────────────────────────
export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .limit(50);

    const roots = (data as Comment[]) ?? [];

    // Load replies
    if (roots.length > 0) {
      const ids = roots.map(c => c.id);
      const { data: replies } = await supabase
        .from('post_comments')
        .select('*, profiles(username, avatar_url)')
        .in('parent_id', ids)
        .order('created_at', { ascending: true });
      const replyMap = new Map<string, Comment[]>();
      (replies ?? []).forEach((r: Comment) => {
        if (!replyMap.has(r.parent_id!)) replyMap.set(r.parent_id!, []);
        replyMap.get(r.parent_id!)!.push(r);
      });
      setComments(roots.map(c => ({ ...c, replies: replyMap.get(c.id) ?? [] })));
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const addComment = async (authorId: string, content: string, parentId?: string) => {
    const { error } = await supabase.from('post_comments').insert({
      post_id: postId, author_id: authorId, content, parent_id: parentId ?? null,
    } as never);
    if (!error) {
      await supabase.from('posts').update({ comments: posts.find(p => p.id === postId)?.comments ?? 0 + 1 } as never).eq('id', postId);
      load();
    }
    return { error };
  };

  const upvoteComment = async (commentId: string, current: number) => {
    await supabase.from('post_comments').update({ upvotes: current + 1 } as never).eq('id', commentId);
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, upvotes: current + 1 } : c));
  };

  return { comments, loading, addComment, upvoteComment, refetch: load };
}
