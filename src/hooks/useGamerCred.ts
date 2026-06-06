import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCredTier } from '@/lib/gamercred/scoring';

export type XpEvent = {
  id: string;
  event_type: string;
  xp_gained: number;
  meta: Record<string, unknown>;
  created_at: string;
};

// XP required to reach a given level: (level-1)^2 * 100
export function levelToXp(level: number): number {
  return Math.max(0, (level - 1) ** 2 * 100);
}

// XP needed for next level
export function xpForNextLevel(level: number): number {
  return levelToXp(level + 1);
}

// Progress percentage within current level (0-100)
export function levelProgress(xp: number, level: number): number {
  const start = levelToXp(level);
  const end   = levelToXp(level + 1);
  if (end <= start) return 100;
  return Math.min(100, Math.round(((xp - start) / (end - start)) * 100));
}

export type LevelMeta = {
  level: number;
  xp: number;
  xpForThisLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  xpRemaining: number;
  tier: { label: string; color: string; icon: string };
  levelLabel: string;
  levelColor: string;
  levelIcon: string;
};

function getLevelMeta(level: number, xp: number): LevelMeta {
  const start     = levelToXp(level);
  const end       = levelToXp(level + 1);
  const pct       = levelProgress(xp, level);
  const remaining = Math.max(0, end - xp);
  const { label, color, icon } = getLevelInfo(level);
  return {
    level,
    xp,
    xpForThisLevel: start,
    xpForNextLevel: end,
    progressPct: pct,
    xpRemaining: remaining,
    tier: getCredTier(xp),
    levelLabel: label,
    levelColor: color,
    levelIcon: icon,
  };
}

export function getLevelInfo(level: number): { label: string; color: string; icon: string; bg: string; border: string } {
  if (level >= 50) return { label: 'Immortal',   color: 'text-red-300',    icon: '👹', bg: 'bg-red-500/15',    border: 'border-red-500/30' };
  if (level >= 40) return { label: 'Mythic',     color: 'text-pink-400',   icon: '🔥', bg: 'bg-pink-500/15',   border: 'border-pink-500/30' };
  if (level >= 30) return { label: 'Legend',     color: 'text-yellow-400', icon: '👑', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' };
  if (level >= 20) return { label: 'Elite',      color: 'text-purple-400', icon: '💎', bg: 'bg-purple-500/15', border: 'border-purple-500/30' };
  if (level >= 15) return { label: 'Veteran',    color: 'text-cyan-400',   icon: '⚡', bg: 'bg-cyan-500/15',   border: 'border-cyan-500/30' };
  if (level >= 10) return { label: 'Pro',        color: 'text-blue-400',   icon: '🎯', bg: 'bg-blue-500/15',   border: 'border-blue-500/30' };
  if (level >= 5)  return { label: 'Rising',     color: 'text-green-400',  icon: '🚀', bg: 'bg-green-500/15',  border: 'border-green-500/30' };
  if (level >= 3)  return { label: 'Rookie',     color: 'text-teal-400',   icon: '🎮', bg: 'bg-teal-500/15',   border: 'border-teal-500/30' };
  return               { label: 'Newcomer',  color: 'text-white/50',   icon: '🌱', bg: 'bg-white/5',        border: 'border-white/10' };
}

export function useGamerCred(userId: string | undefined) {
  const [score, setScore]     = useState<number>(0);
  const [level, setLevel]     = useState<number>(1);
  const [xp, setXp]           = useState<number>(0);
  const [events, setEvents]   = useState<XpEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setScore(0); setLevel(1); setXp(0); setEvents([]); setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      const [{ data: profile }, { data: evts }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('profiles')
          .select('gamercred_score, xp, level')
          .eq('id', userId).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('xp_events')
          .select('id, event_type, xp_gained, meta, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      const p = profile as { gamercred_score: number; xp: number; level: number } | null;
      setScore(p?.gamercred_score ?? 0);
      setXp(p?.xp ?? 0);
      setLevel(p?.level ?? 1);
      setEvents((evts as XpEvent[]) ?? []);
      setLoading(false);
    };

    run();
  }, [userId]);

  const meta = getLevelMeta(level, xp);

  return { score, tier: getCredTier(score), level, xp, levelMeta: meta, events, loading };
}
