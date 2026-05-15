import { supabase } from '@/lib/supabase';

export const GAMERCRED_POINTS = {
  clip_uploaded:        10,
  clip_liked_received:  2,
  tournament_joined:    5,
  tournament_won:       50,
  tournament_top3:      20,
  post_created:         3,
  match_played:         5,
  match_won:            10,
  dispute_won:          15,
  account_verified:     25,
} as const;

export type GamerCredEvent = keyof typeof GAMERCRED_POINTS;

export async function awardGamerCred(
  userId: string,
  event: GamerCredEvent,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const points = GAMERCRED_POINTS[event];
  await (supabase as any).rpc('award_gamercred', {
    p_user_id: userId,
    p_event:   event,
    p_points:  points,
    p_meta:    meta,
  });
}

export function getCredTier(score: number): { label: string; color: string; icon: string } {
  if (score >= 500) return { label: 'Legend',   color: 'text-yellow-400', icon: '👑' };
  if (score >= 200) return { label: 'Elite',    color: 'text-purple-400', icon: '💎' };
  if (score >= 100) return { label: 'Pro',      color: 'text-cyan-400',   icon: '⚡' };
  if (score >= 50)  return { label: 'Rising',   color: 'text-green-400',  icon: '🚀' };
  if (score >= 10)  return { label: 'Rookie',   color: 'text-blue-400',   icon: '🎮' };
  return               { label: 'Newcomer', color: 'text-white/50',   icon: '🌱' };
}
