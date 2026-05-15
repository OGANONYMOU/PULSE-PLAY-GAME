import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCredTier } from '@/lib/gamercred/scoring';

export type GamerCredEvent = {
  id: string;
  event_type: string;
  points: number;
  meta: Record<string, unknown>;
  created_at: string;
};

export function useGamerCred(userId: string | undefined) {
  const [score, setScore]   = useState<number>(0);
  const [events, setEvents] = useState<GamerCredEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const run = async () => {
      setLoading(true);
      const [{ data: profile }, { data: evts }] = await Promise.all([
        (supabase as any).from('profiles').select('gamercred_score').eq('id', userId).single(),
        (supabase as any).from('gamercred_events')
          .select('id, event_type, points, meta, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setScore((profile as { gamercred_score: number } | null)?.gamercred_score ?? 0);
      setEvents((evts as GamerCredEvent[]) ?? []);
      setLoading(false);
    };

    run();
  }, [userId]);

  return { score, tier: getCredTier(score), events, loading };
}
