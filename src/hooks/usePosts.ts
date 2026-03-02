import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Post = Database['public']['Tables']['posts']['Row'];

export type PostWithAuthor = Post & {
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
      .order('created_at', { ascending: false });

    if (tagFilter && tagFilter !== 'all') {
      query = query.eq('tag', tagFilter);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setPosts((data as PostWithAuthor[]) || []);
    }
    setIsLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime changes
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
    tag: Post['tag']
  ) => {
    const { error } = await supabase.from('posts').insert({
      author_id: authorId,
      title,
      content,
      tag,
    });
    return { error };
  };

  const likePost = async (postId: string, currentLikes: number) => {
    const { error } = await supabase
      .from('posts')
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
