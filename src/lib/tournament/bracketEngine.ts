// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Tournament Engine - Bracket System
// Single & Double Elimination with auto-progression
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { checkServerPermission } from '@/lib/security';
import { runPostTournamentFraudAnalysis } from '@/lib/fraud/fraudDetection';
import type { AdminPermission } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type BracketType = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';

export interface BracketParticipant {
  id: string;
  user_id: string;
  username: string;
  seed: number;
  avatar_url?: string | null;
}

export interface BracketMatch {
  id: string;
  tournament_id: string;
  bracket_type: 'winners' | 'losers' | 'grand_finals';
  round: number;
  match_number: number;
  
  // Participants
  player1_id: string | null;
  player2_id: string | null;
  player1_prereq_match_id: string | null;
  player2_prereq_match_id: string | null;
  player1_is_winner_of_prereq: boolean;
  player2_is_winner_of_prereq: boolean;
  
  // Match state
  status: 'pending' | 'in_progress' | 'completed' | 'disputed' | 'no_show';
  winner_id: string | null;
  loser_id: string | null;
  
  // Scoring
  player1_score: number | null;
  player2_score: number | null;
  score_details: Record<string, unknown> | null;
  
  // Scheduling
  scheduled_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  
  // Meta
  best_of: number;
  map_pool: string[] | null;
  
  // Next match (for progression)
  next_match_id: string | null;
  next_match_position: 'player1' | 'player2' | null;
}

export interface GeneratedBracket {
  matches: Omit<BracketMatch, 'id'>[];
  total_rounds: number;
  winners_bracket_matches: number;
  losers_bracket_matches: number;
  grand_finals_matches: number;
}

export interface BracketStandings {
  position: number;
  participant: BracketParticipant;
  matches_won: number;
  matches_lost: number;
  rounds_reached: number;
  prize?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate single elimination bracket
 * Supports any power-of-2 participant count
 */
export function generateSingleEliminationBracket(
  tournament_id: string,
  participants: BracketParticipant[],
  best_of: number = 3
): GeneratedBracket {
  const numParticipants = participants.length;
  const totalRounds = Math.ceil(Math.log2(numParticipants));
  const totalMatches = numParticipants - 1;
  
  const matches: Omit<BracketMatch, 'id'>[] = [];
  const matchMap = new Map<string, string>(); // round-match_num -> match_id
  
  // Generate all rounds from final backwards
  for (let round = totalRounds; round >= 1; round--) {
    const matchesInRound = Math.pow(2, round - 1);
    
    for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
      const matchId = crypto.randomUUID();
      matchMap.set(`${round}-${matchNum}`, matchId);
      
      // Find prerequisite matches (matches that feed into this one)
      const isFinalRound = round === totalRounds;
      let player1Prereq: string | null = null;
      let player2Prereq: string | null = null;
      
      if (!isFinalRound) {
        const nextRound = round + 1;
        const prereqMatchNum1 = matchNum * 2 - 1;
        const prereqMatchNum2 = matchNum * 2;
        player1Prereq = matchMap.get(`${nextRound}-${prereqMatchNum1}`) || null;
        player2Prereq = matchMap.get(`${nextRound}-${prereqMatchNum2}`) || null;
      }
      
      // First round: assign actual participants
      let player1Id: string | null = null;
      let player2Id: string | null = null;
      
      if (round === 1) {
        const participantIndex1 = (matchNum - 1) * 2;
        const participantIndex2 = participantIndex1 + 1;
        
        if (participantIndex1 < numParticipants) {
          player1Id = participants[participantIndex1]?.user_id || null;
        }
        if (participantIndex2 < numParticipants) {
          player2Id = participants[participantIndex2]?.user_id || null;
        }
        
        // Handle byes (if participant count not power of 2)
        if (player1Id && !player2Id) {
          // Player 1 gets a bye - auto-advance
          // We'll handle this after creation
        }
      }
      
      const match: Omit<BracketMatch, 'id'> = {
        tournament_id,
        bracket_type: 'winners',
        round,
        match_number: matchNum,
        
        player1_id: player1Id,
        player2_id: player2Id,
        player1_prereq_match_id: player1Prereq,
        player2_prereq_match_id: player2Prereq,
        player1_is_winner_of_prereq: true,
        player2_is_winner_of_prereq: true,
        
        status: (player1Id && !player2Id) ? 'completed' : 'pending',
        winner_id: (player1Id && !player2Id) ? player1Id : null,
        loser_id: null,
        
        player1_score: null,
        player2_score: null,
        score_details: null,
        
        scheduled_time: null,
        started_at: null,
        completed_at: (player1Id && !player2Id) ? new Date().toISOString() : null,
        
        best_of,
        map_pool: null,
        
        next_match_id: round > 1 ? matchMap.get(`${round - 1}-${Math.ceil(matchNum / 2)}`) || null : null,
        next_match_position: round > 1 ? (matchNum % 2 === 1 ? 'player1' : 'player2') : null,
      };
      
      matches.push(match);
    }
  }
  
  return {
    matches,
    total_rounds: totalRounds,
    winners_bracket_matches: totalMatches,
    losers_bracket_matches: 0,
    grand_finals_matches: 0,
  };
}

/**
 * Generate double elimination bracket
 */
export function generateDoubleEliminationBracket(
  tournament_id: string,
  participants: BracketParticipant[],
  best_of: number = 3,
  grand_finals_best_of: number = 5
): GeneratedBracket {
  const numParticipants = participants.length;
  const winnersRounds = Math.ceil(Math.log2(numParticipants));
  const winnersMatches = numParticipants - 1;
  
  // Losers bracket has approximately 2 * (numParticipants - 2) matches
  const losersMatches = 2 * (numParticipants - 2);
  
  const matches: Omit<BracketMatch, 'id'>[] = [];
  const winnersMatchMap = new Map<string, string>();
  // losersMatchMap will be used for full double elimination implementation
  
  // Generate Winners Bracket (same as single elimination)
  for (let round = winnersRounds; round >= 1; round--) {
    const matchesInRound = Math.pow(2, round - 1);
    
    for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
      const matchId = crypto.randomUUID();
      winnersMatchMap.set(`w-${round}-${matchNum}`, matchId);
      
      const isFinalRound = round === winnersRounds;
      let player1Prereq: string | null = null;
      let player2Prereq: string | null = null;
      
      if (!isFinalRound) {
        const nextRound = round + 1;
        const prereqMatchNum1 = matchNum * 2 - 1;
        const prereqMatchNum2 = matchNum * 2;
        player1Prereq = winnersMatchMap.get(`w-${nextRound}-${prereqMatchNum1}`) || null;
        player2Prereq = winnersMatchMap.get(`w-${nextRound}-${prereqMatchNum2}`) || null;
      }
      
      let player1Id: string | null = null;
      let player2Id: string | null = null;
      
      if (round === 1) {
        const participantIndex1 = (matchNum - 1) * 2;
        const participantIndex2 = participantIndex1 + 1;
        
        if (participantIndex1 < numParticipants) {
          player1Id = participants[participantIndex1]?.user_id || null;
        }
        if (participantIndex2 < numParticipants) {
          player2Id = participants[participantIndex2]?.user_id || null;
        }
      }
      
      const match: Omit<BracketMatch, 'id'> = {
        tournament_id,
        bracket_type: 'winners',
        round,
        match_number: matchNum,
        
        player1_id: player1Id,
        player2_id: player2Id,
        player1_prereq_match_id: player1Prereq,
        player2_prereq_match_id: player2Prereq,
        player1_is_winner_of_prereq: true,
        player2_is_winner_of_prereq: true,
        
        status: (player1Id && !player2Id) ? 'completed' : 'pending',
        winner_id: (player1Id && !player2Id) ? player1Id : null,
        loser_id: null,
        
        player1_score: null,
        player2_score: null,
        score_details: null,
        
        scheduled_time: null,
        started_at: null,
        completed_at: (player1Id && !player2Id) ? new Date().toISOString() : null,
        
        best_of,
        map_pool: null,
        
        next_match_id: round > 1 ? winnersMatchMap.get(`w-${round - 1}-${Math.ceil(matchNum / 2)}`) || null : null,
        next_match_position: round > 1 ? (matchNum % 2 === 1 ? 'player1' : 'player2') : null,
      };
      
      matches.push(match);
    }
  }
  
  // Generate Losers Bracket (more complex)
  // Each winner's bracket loser drops to losers bracket
  // This is a simplified version - full implementation would track exact drop positions
  
  // Generate Grand Finals (winners bracket winner vs losers bracket winner)
  const grandFinals: Omit<BracketMatch, 'id'> = {
    tournament_id,
    bracket_type: 'grand_finals',
    round: 1,
    match_number: 1,
    
    player1_id: null, // Winners bracket champion
    player2_id: null, // Losers bracket champion
    player1_prereq_match_id: winnersMatchMap.get(`w-${winnersRounds}-1`) || null,
    player2_prereq_match_id: null as string | null, // Would be set from losers bracket final
    player1_is_winner_of_prereq: true,
    player2_is_winner_of_prereq: true,
    
    status: 'pending',
    winner_id: null,
    loser_id: null,
    
    player1_score: null,
    player2_score: null,
    score_details: null,
    
    scheduled_time: null,
    started_at: null,
    completed_at: null,
    
    best_of: grand_finals_best_of,
    map_pool: null,
    
    next_match_id: null,
    next_match_position: null,
  };
  matches.push(grandFinals);
  
  return {
    matches,
    total_rounds: winnersRounds + 2, // Winners + some losers rounds + grand finals
    winners_bracket_matches: winnersMatches,
    losers_bracket_matches: losersMatches,
    grand_finals_matches: 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save generated bracket to database
 */
export async function saveBracket(
  tournament_id: string,
  bracket: GeneratedBracket,
  actor_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permission
    const permCheck = await checkServerPermission(actor_id, 'tournaments.edit' as AdminPermission, {
      type: 'tournament',
      id: tournament_id,
    });
    
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Check tournament exists and is in correct state
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, bracket_locked')
      .eq('id', tournament_id)
      .single<{ status: string; bracket_locked: boolean }>();
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    if (tournament.bracket_locked) {
      return { success: false, error: 'Bracket is locked - cannot modify' };
    }
    
    // Delete existing matches (if regenerating)
    await supabase
      .from('tournament_matches')
      .delete()
      .eq('tournament_id', tournament_id);
    
    // Insert new matches
    const { error } = await supabase
      .from('tournament_matches')
      .insert(bracket.matches.map(m => ({
        ...m,
        id: crypto.randomUUID(),
      })) as never);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Update tournament with bracket info
    await supabase
      .from('tournaments')
      .update({
        bracket_generated: true,
        bracket_type: 'single_elimination',
        total_rounds: bracket.total_rounds,
        updated_at: new Date().toISOString(),
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
        action: 'tournament.bracket_generated',
        category: 'tournament',
        target_id: tournament_id,
        target_type: 'tournament',
        target_name: 'Tournament Bracket',
        severity: 'info',
        metadata: {
          total_matches: bracket.matches.length,
          total_rounds: bracket.total_rounds,
        },
      }
    );
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Report match result with auto-progression
 */
export async function reportMatchResult(
  match_id: string,
  params: {
    winner_id: string;
    player1_score: number;
    player2_score: number;
    score_details?: Record<string, unknown>;
    reported_by: string;
  }
): Promise<{ success: boolean; error?: string; next_match?: BracketMatch | null }> {
  try {
    // Get match details
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', match_id)
      .single<BracketMatch>();
    
    if (!match) {
      return { success: false, error: 'Match not found' };
    }
    
    if (match.status === 'completed') {
      return { success: false, error: 'Match already completed' };
    }
    
    // Validate winner is one of the players
    if (params.winner_id !== match.player1_id && params.winner_id !== match.player2_id) {
      return { success: false, error: 'Invalid winner' };
    }
    
    const loser_id = params.winner_id === match.player1_id ? match.player2_id : match.player1_id;
    
    // Update match
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: params.winner_id,
        loser_id,
        player1_score: params.player1_score,
        player2_score: params.player2_score,
        score_details: params.score_details || null,
        completed_at: new Date().toISOString(),
      } as never)
      .eq('id', match_id);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    // Auto-progress winner to next match
    let nextMatch: BracketMatch | null = null;
    
    if (match.next_match_id && match.next_match_position) {
      const updateField = match.next_match_position === 'player1' 
        ? { player1_id: params.winner_id }
        : { player2_id: params.winner_id };
      
      const { data: updatedMatch } = await supabase
        .from('tournament_matches')
        .update(updateField as never)
        .eq('id', match.next_match_id)
        .select()
        .single<BracketMatch>();
      
      nextMatch = updatedMatch;
      
      // Check if both players are now assigned - start the match
      if (updatedMatch?.player1_id && updatedMatch?.player2_id) {
        await supabase
          .from('tournament_matches')
          .update({ status: 'in_progress', started_at: new Date().toISOString() } as never)
          .eq('id', match.next_match_id);
      }
    }
    
    // Handle double elimination loser progression
    if (match.bracket_type === 'winners' && loser_id) {
      // In full implementation, loser would drop to losers bracket
      // This requires knowing the exact drop position
    }
    
    // Check if tournament is complete (final match with no next match)
    if (!match.next_match_id) {
      // This was the final match
      await supabase
        .from('tournaments')
        .update({
          status: 'completed',
          winner_id: params.winner_id,
          completed_at: new Date().toISOString(),
        } as never)
        .eq('id', match.tournament_id);
      
      // Trigger automated fraud analysis
      await runPostTournamentFraudAnalysis(match.tournament_id, 'tournament_completion');
    }
    
    // Audit log
    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', params.reported_by)
      .single<{ email: string; role: string }>();
    
    await writeAudit(
      {
        actor_id: params.reported_by,
        actor_email: user?.email,
        actor_role: user?.role || 'UNKNOWN',
      },
      {
        action: 'tournament.match_completed',
        category: 'tournament',
        target_id: match_id,
        target_type: 'match',
        severity: 'info',
        metadata: {
          tournament_id: match.tournament_id,
          winner_id: params.winner_id,
          score: `${params.player1_score}-${params.player2_score}`,
        },
      }
    );
    
    return { success: true, next_match: nextMatch };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Override match result (admin only)
 */
export async function overrideMatchResult(
  match_id: string,
  params: {
    new_winner_id: string;
    reason: string;
    overridden_by: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Permission check
    const permCheck = await checkServerPermission(params.overridden_by, 'tournaments.override_results' as AdminPermission);
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Validate action
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('tournament_id, status, winner_id')
      .eq('id', match_id)
      .single<{ tournament_id: string; status: string; winner_id: string | null }>();
    
    if (!match) {
      return { success: false, error: 'Match not found' };
    }
    
    // Capture previous state for audit
    const { data: previousState } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', match_id)
      .single<Record<string, unknown>>();
    
    // Update match
    const { error } = await supabase
      .from('tournament_matches')
      .update({
        winner_id: params.new_winner_id,
        status: 'completed',
      } as never)
      .eq('id', match_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Get new state for audit
    const { data: newState } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', match_id)
      .single<Record<string, unknown>>();
    
    // Audit log with state diff
    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', params.overridden_by)
      .single<{ email: string; role: string }>();
    
    await writeAudit(
      {
        actor_id: params.overridden_by,
        actor_email: user?.email,
        actor_role: user?.role || 'UNKNOWN',
      },
      {
        action: 'tournament.result_overridden',
        category: 'tournament',
        target_id: match_id,
        target_type: 'match',
        severity: 'warning',
        reason: params.reason,
        previous_state: previousState || undefined,
        new_state: newState || undefined,
        is_reversible: true,
      }
    );
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET LOCKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lock bracket (prevent modifications)
 */
export async function lockBracket(
  tournament_id: string,
  locked_by: string,
  _reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permCheck = await checkServerPermission(locked_by, 'tournaments.edit' as AdminPermission, {
      type: 'tournament',
      id: tournament_id,
    });
    
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    const { error } = await supabase
      .from('tournaments')
      .update({
        bracket_locked: true,
        bracket_locked_at: new Date().toISOString(),
        bracket_locked_by: locked_by,
        bracket_locked_reason: _reason || null,
      } as never)
      .eq('id', tournament_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Unlock bracket (requires super admin)
 */
export async function unlockBracket(
  tournament_id: string,
  unlocked_by: string,
  _reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permCheck = await checkServerPermission(unlocked_by, 'system.configure' as AdminPermission);
    
    if (!permCheck.granted) {
      return { success: false, error: 'Only super admins can unlock brackets' };
    }
    
    const { error } = await supabase
      .from('tournaments')
      .update({
        bracket_locked: false,
        bracket_locked_at: null,
        bracket_locked_by: null,
        bracket_locked_reason: null,
      } as never)
      .eq('id', tournament_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
