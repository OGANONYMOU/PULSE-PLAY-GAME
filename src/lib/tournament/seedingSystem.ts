// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Tournament Engine - Seeding System
// Random, Ranking-based, and GamerCred-based seeding
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { checkServerPermission } from '@/lib/security';
import type { AdminPermission } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SeedingMethod = 'random' | 'ranking' | 'gamercred' | 'manual';

export interface SeedParticipant {
  user_id: string;
  username: string;
  gamercred: number;
  rank?: number;
  previous_wins?: number;
  tournaments_played?: number;
}

export interface SeededParticipant extends SeedParticipant {
  seed: number;
  seed_reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDING ALGORITHMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Random seeding - completely random assignment
 */
export function randomSeed(participants: SeedParticipant[]): SeededParticipant[] {
  // Fisher-Yates shuffle
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.map((p, idx) => ({
    ...p,
    seed: idx + 1,
    seed_reason: 'Random assignment',
  }));
}

/**
 * Ranking-based seeding
 * Higher rank = lower seed number (better position)
 */
export function rankingSeed(participants: SeedParticipant[]): SeededParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    // First sort by rank (lower rank number = better)
    if ((a.rank || 999999) !== (b.rank || 999999)) {
      return (a.rank || 999999) - (b.rank || 999999);
    }
    // Tie-break by GamerCred
    return (b.gamercred || 0) - (a.gamercred || 0);
  });
  
  return sorted.map((p, idx) => ({
    ...p,
    seed: idx + 1,
    seed_reason: p.rank ? `Rank #${p.rank}` : 'Unranked (GamerCred tie-break)',
  }));
}

/**
 * GamerCred-based seeding
 * Higher GamerCred = lower seed number (better position)
 */
export function gamercredSeed(participants: SeedParticipant[]): SeededParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    // Primary: GamerCred
    if ((b.gamercred || 0) !== (a.gamercred || 0)) {
      return (b.gamercred || 0) - (a.gamercred || 0);
    }
    // Tie-break by previous wins
    if ((b.previous_wins || 0) !== (a.previous_wins || 0)) {
      return (b.previous_wins || 0) - (a.previous_wins || 0);
    }
    // Final tie-break: random
    return Math.random() - 0.5;
  });
  
  return sorted.map((p, idx) => ({
    ...p,
    seed: idx + 1,
    seed_reason: `GamerCred: ${p.gamercred || 0}`,
  }));
}

/**
 * Snake seeding for groups
 * Used to distribute strong players evenly across groups
 */
export function snakeSeedForGroups(
  participants: SeedParticipant[],
  numGroups: number
): Map<number, SeedParticipant[]> {
  // First sort by ranking/GamerCred
  const sorted = gamercredSeed(participants);
  
  const groups = new Map<number, SeedParticipant[]>();
  for (let i = 0; i < numGroups; i++) {
    groups.set(i, []);
  }
  
  // Snake pattern: 1-2-3-4, then 4-3-2-1, then 1-2-3-4, etc.
  let direction = 1;
  let currentGroup = 0;
  
  sorted.forEach((participant) => {
    groups.get(currentGroup)!.push(participant);
    
    currentGroup += direction;
    
    if (currentGroup >= numGroups) {
      currentGroup = numGroups - 1;
      direction = -1;
    } else if (currentGroup < 0) {
      currentGroup = 0;
      direction = 1;
    }
  });
  
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply seeding to tournament participants
 */
export async function applySeeding(
  tournament_id: string,
  method: SeedingMethod,
  actor_id: string,
  manualSeeds?: Map<string, number>  // For manual seeding: user_id -> seed
): Promise<{ success: boolean; seeded?: SeededParticipant[]; error?: string }> {
  try {
    // Check permission
    const permCheck = await checkServerPermission(actor_id, 'tournaments.edit' as AdminPermission, {
      type: 'tournament',
      id: tournament_id,
    });
    
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Get participants with their stats
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select(`
        user_id,
        profiles:user_id(id, username, gamercred),
        tournaments_won:profiles!user_id(tournaments_won)
      `)
      .eq('tournament_id', tournament_id)
      .returns<{
        user_id: string;
        profiles: { id: string; username: string; gamercred: number };
        tournaments_won: { tournaments_won: number }[];
      }[]>();
    
    if (!participants || participants.length === 0) {
      return { success: false, error: 'No participants found' };
    }
    
    // Convert to seed participants
    const seedParticipants: SeedParticipant[] = participants.map(p => ({
      user_id: p.user_id,
      username: p.profiles.username,
      gamercred: p.profiles.gamercred || 0,
      previous_wins: p.tournaments_won?.[0]?.tournaments_won || 0,
    }));
    
    // Apply seeding method
    let seeded: SeededParticipant[];
    
    switch (method) {
      case 'random':
        seeded = randomSeed(seedParticipants);
        break;
      case 'ranking':
        seeded = rankingSeed(seedParticipants);
        break;
      case 'gamercred':
        seeded = gamercredSeed(seedParticipants);
        break;
      case 'manual':
        if (!manualSeeds) {
          return { success: false, error: 'Manual seeds required for manual seeding' };
        }
        seeded = seedParticipants.map(p => ({
          ...p,
          seed: manualSeeds.get(p.user_id) || 999,
          seed_reason: 'Manually assigned',
        })).sort((a, b) => a.seed - b.seed);
        break;
      default:
        return { success: false, error: 'Unknown seeding method' };
    }
    
    // Update database with seeds
    for (const s of seeded) {
      await supabase
        .from('tournament_participants')
        .update({
          seed: s.seed,
          seed_method: method,
          seeded_at: new Date().toISOString(),
        } as never)
        .eq('tournament_id', tournament_id)
        .eq('user_id', s.user_id);
    }
    
    // Update tournament
    await supabase
      .from('tournaments')
      .update({
        seeding_applied: true,
        seeding_method: method,
        seeded_at: new Date().toISOString(),
      } as never)
      .eq('id', tournament_id);
    
    // Audit log
    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', actor_id)
      .single<{ email: string; role: string }>();
    
    await writeAudit(
      {
        actor_id,
        actor_email: user?.email,
        actor_role: user?.role || 'UNKNOWN',
      },
      {
        action: 'tournament.seeding_applied',
        category: 'tournament',
        target_id: tournament_id,
        target_type: 'tournament',
        severity: 'info',
        metadata: {
          method,
          participant_count: seeded.length,
          top_seeds: seeded.slice(0, 4).map(s => s.username),
        },
      }
    );
    
    return { success: true, seeded };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get recommended seeding based on available data
 */
export async function recommendSeeding(
  tournament_id: string
): Promise<{ method: SeedingMethod; reason: string }> {
  try {
    // Check if we have ranked players
    const { data: rankedCount } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament_id)
      .not('profiles.rank', 'is', null)
      .limit(1)
      .maybeSingle();
    
    if (rankedCount) {
      return { method: 'ranking', reason: 'Tournament has ranked players' };
    }
    
    // Check GamerCred distribution
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('profiles:gamercred')
      .eq('tournament_id', tournament_id)
      .returns<{ profiles: { gamercred: number } }[]>();
    
    const hasGamerCred = participants?.some(p => (p.profiles?.gamercred || 0) > 0);
    
    if (hasGamerCred) {
      return { method: 'gamercred', reason: 'Players have GamerCred scores' };
    }
    
    return { method: 'random', reason: 'No ranking or GamerCred data available' };
  } catch {
    return { method: 'random', reason: 'Unable to determine - defaulting to random' };
  }
}
