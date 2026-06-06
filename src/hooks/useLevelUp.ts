import { toast } from 'sonner';
import { awardGamerCred, type GamerCredEvent, type AwardResult } from '@/lib/gamercred/scoring';
import { getLevelInfo } from '@/hooks/useGamerCred';

export async function awardXpAndNotify(
  userId: string,
  event: GamerCredEvent,
  meta: Record<string, unknown> = {},
): Promise<AwardResult | null> {
  const result = await awardGamerCred(userId, event, meta);
  if (!result) return null;

  const { xp_gained, leveled_up, level } = result;
  const levelInfo = getLevelInfo(level);

  if (leveled_up) {
    toast.success(
      `${levelInfo.icon} Level Up! You're now Level ${level} — ${levelInfo.label}`,
      {
        duration: 6000,
        description: `+${xp_gained} XP earned`,
      }
    );
  } else {
    toast.success(`+${xp_gained} XP`, { duration: 2500, description: eventLabel(event) });
  }

  return result;
}

function eventLabel(event: GamerCredEvent): string {
  const map: Record<GamerCredEvent, string> = {
    clip_uploaded:       'Clip uploaded',
    clip_liked_received: 'Your clip got a like',
    tournament_joined:   'Joined a tournament',
    tournament_won:      'Tournament victory!',
    tournament_top3:     'Top 3 finish!',
    post_created:        'Post published',
    comment_posted:      'Comment posted',
    match_played:        'Match completed',
    match_won:           'Match won!',
    dispute_won:         'Dispute resolved in your favour',
    account_verified:    'Account verified',
    daily_login:         'Daily login bonus',
    profile_completed:   'Profile completed',
    first_tournament:    'First tournament bonus',
    followed_game:       'Followed a game',
  };
  return map[event] ?? event;
}
