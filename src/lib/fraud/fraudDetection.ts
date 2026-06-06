// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Fraud Detection Engine
// Pattern detection, anomaly alerts, automated flagging
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { createIncident } from '../incident/incidentSystem';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FraudFlagType = 
  | 'repeated_winner' 
  | 'abnormal_scores' 
  | 'suspicious_timing' 
  | 'account_cluster' 
  | 'reported_by_users';

export type FraudSeverity = 'low' | 'medium' | 'high';
export type FraudStatus = 'open' | 'under_investigation' | 'confirmed' | 'dismissed';

export interface FraudFlag {
  id: string;
  tournament_id: string | null;
  match_id: string | null;
  user_id: string | null;
  
  flag_type: FraudFlagType;
  severity: FraudSeverity;
  
  evidence: {
    pattern_description: string;
    affected_matches: string[];
    confidence_score: number;  // 0-100
    statistical_deviation: number;
    supporting_data: Record<string, unknown>;
  };
  
  status: FraudStatus;
  investigated_by: string | null;
  investigation_notes: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface FraudAnalysisResult {
  has_fraud_indicators: boolean;
  flags: Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'>[];
  risk_score: number;  // 0-100
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAUD DETECTION ALGORITHMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze tournament for fraud patterns
 */
export async function analyzeTournamentForFraud(
  tournament_id: string,
  auto_create_flags: boolean = true
): Promise<FraudAnalysisResult> {
  const flags: Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'>[] = [];
  
  // 1. Check for repeated winners
  const repeatedWinnerFlag = await detectRepeatedWinners(tournament_id);
  if (repeatedWinnerFlag) flags.push(repeatedWinnerFlag);
  
  // 2. Check for abnormal scores
  const abnormalScoreFlag = await detectAbnormalScores(tournament_id);
  if (abnormalScoreFlag) flags.push(abnormalScoreFlag);
  
  // 3. Check for suspicious timing
  const suspiciousTimingFlag = await detectSuspiciousTiming(tournament_id);
  if (suspiciousTimingFlag) flags.push(suspiciousTimingFlag);
  
  // 4. Check for account clustering
  const clusterFlag = await detectAccountClustering(tournament_id);
  if (clusterFlag) flags.push(clusterFlag);
  
  // Calculate overall risk score
  const risk_score = calculateRiskScore(flags);
  
  // Auto-create flags if enabled
  if (auto_create_flags && flags.length > 0) {
    for (const flag of flags) {
      await createFraudFlag(flag);
    }
  }
  
  // Create incident for high risk
  if (risk_score > 70) {
    await createIncident({
      type: 'fraud_detected',
      severity: 'critical',
      title: 'High Fraud Risk Detected',
      description: `Tournament shows ${flags.length} fraud indicators with risk score ${risk_score}.`,
      affected_entities: [{ type: 'tournament', id: tournament_id }],
      metrics: flags.map(f => ({
        name: f.flag_type,
        value: f.evidence.confidence_score,
        threshold: 70,
        unit: 'confidence',
      })),
      auto_response: true,
    }, 'system');
  }
  
  return {
    has_fraud_indicators: flags.length > 0,
    flags,
    risk_score,
    recommendations: generateRecommendations(flags),
  };
}

/**
 * Detect repeated winner patterns
 * Same player winning multiple tournaments suspiciously
 */
async function detectRepeatedWinners(tournament_id: string): Promise<Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'> | null> {
  // Get recent tournaments by same organizer
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id, created_at')
    .eq('id', tournament_id)
    .single<{ organizer_id: string; created_at: string }>();
  
  if (!tournament) return null;
  
  // Get all completed tournaments by this organizer in last 30 days
  const { data: recentTournaments } = await supabase
    .from('tournaments')
    .select('id, winner')
    .eq('organizer_id', tournament.organizer_id)
    .eq('status', 'completed')
    .gte('completed_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
    .returns<{ id: string; winner: string | null }[]>();
  
  if (!recentTournaments || recentTournaments.length < 3) return null;
  
  // Count winner frequency
  const winnerCounts = new Map<string, number>();
  recentTournaments.forEach(t => {
    if (t.winner) {
      winnerCounts.set(t.winner, (winnerCounts.get(t.winner) || 0) + 1);
    }
  });
  
  // Check if any winner has >50% win rate
  let suspiciousWinner: string | null = null;
  let winCount = 0;
  
  winnerCounts.forEach((count, winner) => {
    if (count >= 3 && count / recentTournaments!.length > 0.5) {
      suspiciousWinner = winner;
      winCount = count;
    }
  });
  
  if (suspiciousWinner) {
    return {
      tournament_id,
      match_id: null,
      user_id: suspiciousWinner,
      flag_type: 'repeated_winner',
      severity: winCount >= 5 ? 'high' : 'medium',
      evidence: {
        pattern_description: `User won ${winCount} out of ${recentTournaments.length} recent tournaments (${Math.round((winCount / recentTournaments.length) * 100)}% win rate)`,
        affected_matches: recentTournaments.filter(t => t.winner === suspiciousWinner).map(t => t.id),
        confidence_score: Math.min(100, (winCount / recentTournaments.length) * 100 + 20),
        statistical_deviation: calculateDeviation(winCount, recentTournaments.length, 1 / recentTournaments.length),
        supporting_data: {
          tournament_ids: recentTournaments.map(t => t.id),
          winner_distribution: Array.from(winnerCounts.entries()),
        },
      },
      status: 'open',
      investigated_by: null,
      investigation_notes: null,
    };
  }
  
  return null;
}

/**
 * Detect abnormal score patterns
 * Scores that deviate significantly from expected ranges
 */
async function detectAbnormalScores(tournament_id: string): Promise<Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'> | null> {
  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('id, player1_score, player2_score, player1_id, player2_id, score_details')
    .eq('tournament_id', tournament_id)
    .eq('status', 'completed')
    .not('player1_score', 'is', null)
    .not('player2_score', 'is', null)
    .returns<{
      id: string;
      player1_score: number;
      player2_score: number;
      player1_id: string;
      player2_id: string;
      score_details: Record<string, unknown> | null;
    }[]>();
  
  if (!matches || matches.length < 3) return null;
  
  // Calculate score statistics
  const allScores = matches.flatMap(m => [m.player1_score, m.player2_score]);
  const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const stdDev = Math.sqrt(allScores.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / allScores.length);
  
  // Find matches with abnormal scores (>3 standard deviations)
  const abnormalMatches = matches.filter(m => {
    const score1Dev = Math.abs(m.player1_score - avg) / stdDev;
    const score2Dev = Math.abs(m.player2_score - avg) / stdDev;
    return score1Dev > 3 || score2Dev > 3;
  });
  
  if (abnormalMatches.length >= 2) {
    // Check if same players involved
    const involvedPlayers = new Set<string>();
    abnormalMatches.forEach(m => {
      involvedPlayers.add(m.player1_id);
      involvedPlayers.add(m.player2_id);
    });
    
    return {
      tournament_id,
      match_id: abnormalMatches[0].id,
      user_id: null,  // Could be either player
      flag_type: 'abnormal_scores',
      severity: abnormalMatches.length > 5 ? 'high' : 'medium',
      evidence: {
        pattern_description: `${abnormalMatches.length} matches with statistically abnormal scores (>3σ deviation)`,
        affected_matches: abnormalMatches.map(m => m.id),
        confidence_score: Math.min(100, abnormalMatches.length * 15 + 30),
        statistical_deviation: stdDev,
        supporting_data: {
          average_score: avg,
          standard_deviation: stdDev,
          abnormal_matches: abnormalMatches.map(m => ({
            match_id: m.id,
            score: `${m.player1_score}-${m.player2_score}`,
            deviation: Math.max(
              Math.abs(m.player1_score - avg) / stdDev,
              Math.abs(m.player2_score - avg) / stdDev
            ),
          })),
        },
      },
      status: 'open',
      investigated_by: null,
      investigation_notes: null,
    };
  }
  
  return null;
}

/**
 * Detect suspicious timing patterns
 * Matches completed too fast or at unusual times
 */
async function detectSuspiciousTiming(tournament_id: string): Promise<Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'> | null> {
  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('id, started_at, completed_at, player1_id, player2_id')
    .eq('tournament_id', tournament_id)
    .eq('status', 'completed')
    .not('started_at', 'is', null)
    .not('completed_at', 'is', null)
    .returns<{
      id: string;
      started_at: string;
      completed_at: string;
      player1_id: string;
      player2_id: string;
    }[]>();
  
  if (!matches || matches.length < 3) return null;
  
  // Calculate match durations
  const matchDurations = matches.map(m => {
    const start = new Date(m.started_at);
    const end = new Date(m.completed_at);
    return {
      id: m.id,
      duration_minutes: (end.getTime() - start.getTime()) / 60000,
      players: [m.player1_id, m.player2_id],
    };
  });
  
  // Find suspiciously fast matches (< 2 minutes for esports)
  const fastMatches = matchDurations.filter(m => m.duration_minutes < 2);
  
  if (fastMatches.length >= 3) {
    // Check if same pair of players
    const playerPairs = fastMatches.map(m => m.players.sort().join('-'));
    const pairCounts = new Map<string, number>();
    playerPairs.forEach(pair => {
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    });
    
    const mostCommonPair = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (mostCommonPair && mostCommonPair[1] >= 2) {
      return {
        tournament_id,
        match_id: null,
        user_id: null,
        flag_type: 'suspicious_timing',
        severity: mostCommonPair[1] >= 3 ? 'high' : 'medium',
        evidence: {
          pattern_description: `${fastMatches.length} matches completed suspiciously fast (< 2 min)`,
          affected_matches: fastMatches.map(m => m.id),
          confidence_score: Math.min(100, mostCommonPair[1] * 20 + 40),
          statistical_deviation: 0,  // Would calculate proper deviation
          supporting_data: {
            average_duration: matchDurations.reduce((sum, m) => sum + m.duration_minutes, 0) / matchDurations.length,
            fast_match_count: fastMatches.length,
            suspicious_player_pair: mostCommonPair[0].split('-'),
          },
        },
        status: 'open',
        investigated_by: null,
        investigation_notes: null,
      };
    }
  }
  
  return null;
}

/**
 * Detect account clustering
 * Multiple accounts from same IP/device
 */
async function detectAccountClustering(_tournament_id: string): Promise<Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'> | null> {
  // This would require IP/device tracking data
  // Implementation would check for:
  // - Same IP registering multiple accounts
  // - Same device fingerprint for multiple users
  // - Same payment method across accounts
  
  // Placeholder - would be implemented with actual tracking data
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAUD FLAG MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function createFraudFlag(
  flag: Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('fraud_flags')
      .insert({
        ...flag,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .select('id')
      .single<{ id: string }>();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get fraud flags for investigation
 */
export async function getFraudFlags(
  filter: {
    tournament_id?: string;
    status?: FraudStatus;
    severity?: FraudSeverity;
  }
): Promise<{ flags: FraudFlag[]; error?: string }> {
  try {
    let query = supabase
      .from('fraud_flags')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (filter.tournament_id) {
      query = query.eq('tournament_id', filter.tournament_id);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.severity) {
      query = query.eq('severity', filter.severity);
    }
    
    const { data, error } = await query.returns<FraudFlag[]>();
    
    if (error) {
      return { flags: [], error: error.message };
    }
    
    return { flags: data || [] };
  } catch (_err) {
    return { flags: [], error: 'Query failed' };
  }
}

/**
 * Notify admins about fraud detection
 */
async function notifyAdminsAboutFraud(
  tournament_id: string,
  risk_score: number,
  flag_count: number,
  incident_id?: string
): Promise<void> {
  try {
    // Get tournament info
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, organizer_id')
      .eq('id', tournament_id)
      .single<{ name: string; organizer_id: string }>();
    
    // Get admin users
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'superadmin'])
      .returns<{ id: string }[]>();
    
    if (!admins?.length) return;
    
    // Create notifications for each admin
    const notifications = admins.map((admin: { id: string }) => ({
      user_id: admin.id,
      type: 'fraud_alert',
      title: `Fraud Risk Detected: ${tournament?.name || 'Tournament'}`,
      message: `Risk Score: ${risk_score}/100, ${flag_count} flag(s) raised`,
      data: { tournament_id, risk_score, incident_id },
      priority: risk_score > 70 ? 'high' : 'medium',
      read: false,
      created_at: new Date().toISOString(),
    }));
    
    await supabase.from('notifications').insert(notifications as any);
    
    // Log to audit
    await writeAudit(
      { actor_id: 'system', actor_role: 'system' },
      {
        action: 'fraud_alert_generated',
        category: 'fraud',
        target_type: 'tournament',
        target_id: tournament_id,
        severity: risk_score > 70 ? 'critical' : 'warning',
        metadata: { risk_score, flag_count, incident_id },
      }
    );
  } catch (err) {
    console.error('Failed to notify admins about fraud:', err);
  }
}

/**
 * Run automated fraud analysis when tournament completes
 * This should be called when a tournament status changes to 'completed'
 */
export async function runPostTournamentFraudAnalysis(
  tournament_id: string,
  triggered_by: string
): Promise<{
  success: boolean;
  risk_score: number;
  flags_created: number;
  incident_created: boolean;
  error?: string;
}> {
  try {
    // Check if already analyzed
    const { data: existing } = await supabase
      .from('fraud_flags')
      .select('id')
      .eq('tournament_id', tournament_id)
      .limit(1);
    
    // Skip if already analyzed
    if (existing && existing.length > 0) {
      return {
        success: true,
        risk_score: 0,
        flags_created: 0,
        incident_created: false,
      };
    }
    
    // Run analysis
    const result = await analyzeTournamentForFraud(tournament_id, true);
    
    // Notify admins if any flags found
    if (result.flags.length > 0) {
      await notifyAdminsAboutFraud(
        tournament_id,
        result.risk_score,
        result.flags.length,
        result.risk_score > 70 ? undefined : undefined
      );
    }
    
    // Log completion
    await writeAudit(
      { actor_id: 'system', actor_role: 'system' },
      {
        action: 'post_tournament_fraud_analysis',
        category: 'fraud',
        target_type: 'tournament',
        target_id: tournament_id,
        severity: result.risk_score > 70 ? 'critical' : 'info',
        metadata: { triggered_by, risk_score: result.risk_score, flags_found: result.flags.length },
      }
    );
    
    return {
      success: true,
      risk_score: result.risk_score,
      flags_created: result.flags.length,
      incident_created: result.risk_score > 70,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Post-tournament fraud analysis failed:', err);
    
    await writeAudit(
      { actor_id: 'system', actor_role: 'system' },
      {
        action: 'post_tournament_fraud_analysis_failed',
        category: 'fraud',
        target_type: 'tournament',
        target_id: tournament_id,
        severity: 'critical',
        metadata: { error: message },
      }
    );
    
    return { success: false, risk_score: 0, flags_created: 0, incident_created: false, error: message };
  }
}

/**
 * Investigate fraud flag
 */
export async function investigateFraudFlag(
  flag_id: string,
  params: {
    status: FraudStatus;
    notes: string;
    investigated_by: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('fraud_flags')
      .update({
        status: params.status,
        investigation_notes: params.notes,
        investigated_by: params.investigated_by,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', flag_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    await writeAudit(
      { actor_id: params.investigated_by, actor_role: 'admin' },
      {
        action: 'fraud_flag_investigated',
        category: 'fraud',
        target_type: 'fraud_flag',
        target_id: flag_id,
        severity: params.status === 'confirmed' ? 'critical' : 'warning',
        metadata: { status: params.status, notes: params.notes },
      }
    );
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateDeviation(actual: number, total: number, expected: number): number {
  return (actual / total - expected) / expected;
}

function calculateRiskScore(flags: Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'>[]): number {
  if (flags.length === 0) return 0;
  
  const severityWeights = {
    low: 20,
    medium: 50,
    high: 80,
  };
  
  const totalScore = flags.reduce((sum, flag) => {
    return sum + severityWeights[flag.severity] * (flag.evidence.confidence_score / 100);
  }, 0);
  
  return Math.min(100, Math.round(totalScore / flags.length + flags.length * 5));
}

function generateRecommendations(flags: Omit<FraudFlag, 'id' | 'created_at' | 'updated_at'>[]): string[] {
  const recommendations: string[] = [];
  
  if (flags.some(f => f.flag_type === 'repeated_winner')) {
    recommendations.push('Review tournament matchmaking algorithm');
    recommendations.push('Investigate repeated winner account history');
  }
  
  if (flags.some(f => f.flag_type === 'abnormal_scores')) {
    recommendations.push('Review match score reporting process');
    recommendations.push('Consider requiring evidence for high-scoring matches');
  }
  
  if (flags.some(f => f.flag_type === 'suspicious_timing')) {
    recommendations.push('Implement minimum match duration requirements');
    recommendations.push('Review fast matches manually');
  }
  
  if (flags.some(f => f.flag_type === ('account_clustering' as FraudFlagType))) {
    recommendations.push('Enforce IP/device restrictions');
    recommendations.push('Require additional verification for clustered accounts');
  }
  
  return recommendations;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Monitor tournament in real-time for fraud
 * Call this when match results are reported
 */
export async function monitorMatchResult(
  tournament_id: string,
  match_id: string,
  winner_id: string
): Promise<void> {
  // Quick checks that can be done in real-time
  
  // Check if same player just won multiple matches
  const { data: recentWins } = await supabase
    .from('tournament_matches')
    .select('id')
    .eq('tournament_id', tournament_id)
    .eq('winner_id', winner_id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(3)
    .returns<{ id: string }[]>();
  
  if (recentWins && recentWins.length >= 3) {
    // Check time between wins
    const { data: matchTimes } = await supabase
      .from('tournament_matches')
      .select('completed_at')
      .in('id', recentWins.map(m => m.id))
      .order('completed_at', { ascending: false })
      .returns<{ completed_at: string }[]>();
    
    if (matchTimes && matchTimes.length >= 2) {
      const timeDiff = new Date(matchTimes[0].completed_at).getTime() - 
                       new Date(matchTimes[matchTimes.length - 1].completed_at).getTime();
      
      // If 3 wins within 10 minutes, flag immediately
      if (timeDiff < 600000) {
        await createFraudFlag({
          tournament_id,
          match_id,
          user_id: winner_id,
          flag_type: 'suspicious_timing',
          severity: 'high',
          evidence: {
            pattern_description: `Player won ${recentWins.length} matches in ${Math.round(timeDiff / 60000)} minutes`,
            affected_matches: recentWins.map(m => m.id),
            confidence_score: 90,
            statistical_deviation: 0,
            supporting_data: {
              win_times: matchTimes.map(m => m.completed_at),
            },
          },
          status: 'open',
          investigated_by: null,
          investigation_notes: null,
        });
      }
    }
  }
}
