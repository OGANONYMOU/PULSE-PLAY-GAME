import { supabase } from '@/lib/supabase';

export const GAMERCRED_POINTS = {
  clip_uploaded:        15,
  clip_liked_received:  2,
  tournament_joined:    10,
  tournament_won:       100,
  tournament_top3:      40,
  post_created:         5,
  comment_posted:       3,
  match_played:         8,
  match_won:            20,
  dispute_won:          25,
  account_verified:     50,
  daily_login:          5,
  profile_completed:    30,
  first_tournament:     25,
  followed_game:        5,
} as const;

export type GamerCredEvent = keyof typeof GAMERCRED_POINTS;

export type AwardResult = {
  xp: number;
  level: number;
  leveled_up: boolean;
  old_level: number;
  xp_gained: number;
};

export async function awardGamerCred(
  userId: string,
  event: GamerCredEvent,
  meta: Record<string, unknown> = {},
): Promise<AwardResult | null> {
  const points = GAMERCRED_POINTS[event];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('award_gamercred', {
    p_user_id: userId,
    p_event:   event,
    p_points:  points,
    p_meta:    meta,
  });
  if (error) {
    console.error('[GamerCred] award failed:', error.message);
    return null;
  }
  return data as AwardResult;
}

export function getCredTier(score: number): { label: string; color: string; icon: string } {
  if (score >= 1000) return { label: 'Legend',   color: 'text-yellow-400', icon: '👑' };
  if (score >= 500)  return { label: 'Elite',    color: 'text-purple-400', icon: '💎' };
  if (score >= 200)  return { label: 'Pro',      color: 'text-cyan-400',   icon: '⚡' };
  if (score >= 100)  return { label: 'Rising',   color: 'text-green-400',  icon: '🚀' };
  if (score >= 30)   return { label: 'Rookie',   color: 'text-blue-400',   icon: '🎮' };
  return                    { label: 'Newcomer', color: 'text-white/50',   icon: '🌱' };
}
