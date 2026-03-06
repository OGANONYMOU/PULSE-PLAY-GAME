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
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export function usePosts(tagFilter?: string) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(15);  // Limit to 15 posts per request

    if (tagFilter && tagFilter !== 'all') {
      query = query.eq('tag', tagFilter);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setPosts((data as unknown as PostWithAuthor[]) || []);
    }
    setIsLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const createPost = async (
    authorId: string,
    title: string,
    content: string,
    tag: PostTag
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('posts') as any).insert({
      author_id: authorId,
      title,
      content,
      tag,
    });
    return { error };
  };

  const likePost = async (postId: string, currentLikes: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('posts') as any)
      .update({ likes: currentLikes + 1 })
      .eq('id', postId);

    if (!error) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: currentLikes + 1 } : p))
      );
    }
    return { error };
  };

  return { posts, isLoading, error, createPost, likePost, refetch: fetchPosts };
}