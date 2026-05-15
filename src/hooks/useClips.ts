import { useState, useEffect, useCallback } from 'react';
import type { Clip } from '@/components/community/ClipCard';
import { fetchClips, fetchUserLikes, toggleLike } from '@/lib/clips/clipsService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ClipTab = 'this-week' | 'previous' | 'all-time';

export function useClips(tab: ClipTab) {
  const { user, isAuthenticated } = useAuth();
  const [clips, setClips]       = useState<Clip[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClips({ tab });
      setClips(data);
      if (user && data.length) {
        const liked = await fetchUserLikes(user.id, data.map(c => c.id));
        setLikedIds(liked);
      }
    } catch {
      setError('Failed to load clips. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => { load(); }, [load]);

  const handleLike = useCallback(async (clipId: string) => {
    if (!isAuthenticated || !user) { toast.error('Sign in to like clips'); return; }
    const liked = likedIds.has(clipId);
    setLikedIds(prev => {
      const next = new Set(prev);
      liked ? next.delete(clipId) : next.add(clipId);
      return next;
    });
    setClips(prev => prev.map(c =>
      c.id === clipId ? { ...c, likes_count: c.likes_count + (liked ? -1 : 1) } : c
    ));
    try {
      await toggleLike(clipId, user.id, liked);
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        liked ? next.add(clipId) : next.delete(clipId);
        return next;
      });
      setClips(prev => prev.map(c =>
        c.id === clipId ? { ...c, likes_count: c.likes_count + (liked ? 1 : -1) } : c
      ));
      toast.error('Failed to update like');
    }
  }, [isAuthenticated, user, likedIds]);

  return { clips, loading, error, likedIds, handleLike, refresh: load };
}
