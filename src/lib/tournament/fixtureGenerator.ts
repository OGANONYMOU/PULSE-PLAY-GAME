// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Tournament Engine - Fixture Generator
// Round Robin, Group Stage, and Home/Away scheduling
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { checkServerPermission } from '@/lib/security';
import type { AdminPermission } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FixtureParticipant {
  id: string;
  user_id: string;
  username: string;
  team_name?: string;
  group?: string;
  seed: number;
}

export interface Fixture {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  group_name?: string | null;
  
  // Teams
  home_id: string;
  away_id: string;
  
  // Scheduling
  scheduled_date: string;
  scheduled_time: string | null;
  home_away_switched: boolean;  // If fixture was rescheduled to opponent's venue
  
  // Results
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
  winner_id: string | null;
  
  // Meta
  venue: string | null;
  notes: string | null;
}

export interface GroupConfig {
  name: string;
  participants: FixtureParticipant[];
  home_and_away: boolean;
}

export interface GeneratedFixtures {
  fixtures: Omit<Fixture, 'id'>[];
  total_rounds: number;
  matches_per_round: number;
  total_matches: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUND ROBIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate round robin fixtures using circle method (Berger tables)
 * https://en.wikipedia.org/wiki/Round-robin_tournament
 */
export function generateRoundRobin(
  tournament_id: string,
  participants: FixtureParticipant[],
  options: {
    home_and_away?: boolean;
    start_date: string;
    matches_per_day?: number;
    match_interval_hours?: number;
  }
): GeneratedFixtures {
  const n = participants.length;
  
  // Handle odd number of participants (add a "bye" slot)
  const hasBye = n % 2 === 1;
  const teams = hasBye ? [...participants, { id: 'BYE', user_id: 'BYE', username: 'BYE', seed: 0 }] : participants;
  const totalTeams = teams.length;
  
  const rounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;
  
  const fixtures: Omit<Fixture, 'id'>[] = [];
  const startDate = new Date(options.start_date);
  
  // Generate fixtures for each round
  for (let round = 1; round <= rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      // Calculate positions using circle method
      const homeIdx = match === 0 ? 0 : (round + match - 1) % (totalTeams - 1) + 1;
      const awayIdx = match === 0 ? rounds : (rounds - match + round - 1) % (totalTeams - 1) + 1;
      
      const home = teams[homeIdx];
      const away = teams[awayIdx];
      
      // Skip bye matches
      if (home.id === 'BYE' || away.id === 'BYE') continue;
      
      // Calculate match date
      const matchDate = new Date(startDate);
      const daysToAdd = Math.floor((round - 1) / (options.matches_per_day || 1));
      matchDate.setDate(matchDate.getDate() + daysToAdd);
      
      const fixture: Omit<Fixture, 'id'> = {
        tournament_id,
        round,
        match_number: match + 1,
        group_name: null,
        home_id: home.user_id,
        away_id: away.user_id,
        scheduled_date: matchDate.toISOString().split('T')[0],
        scheduled_time: calculateMatchTime(match, options.match_interval_hours || 2),
        home_away_switched: false,
        home_score: null,
        away_score: null,
        status: 'scheduled',
        winner_id: null,
        venue: null,
        notes: null,
      };
      
      fixtures.push(fixture);
    }
  }
  
  // If home and away, generate reverse fixtures
  if (options.home_and_away) {
    const reverseFixtures = fixtures.map((f, idx) => ({
      ...f,
      round: f.round + rounds,
      match_number: idx + 1,
      home_id: f.away_id,
      away_id: f.home_id,
      scheduled_date: calculateReverseMatchDate(f.scheduled_date, fixtures.length, options.matches_per_day || 1),
    }));
    
    fixtures.push(...reverseFixtures);
  }
  
  return {
    fixtures,
    total_rounds: options.home_and_away ? rounds * 2 : rounds,
    matches_per_round: matchesPerRound - (hasBye ? 1 : 0),
    total_matches: fixtures.length,
  };
}

/**
 * Generate group stage with multiple groups
 */
export function generateGroupStage(
  tournament_id: string,
  groups: GroupConfig[],
  options: {
    start_date: string;
    matches_per_day?: number;
    match_interval_hours?: number;
    top_per_group_advance?: number;
  }
): GeneratedFixtures {
  const allFixtures: Omit<Fixture, 'id'>[] = [];
  let maxRounds = 0;
  
  groups.forEach((group, groupIdx) => {
    const groupFixtures = generateRoundRobin(tournament_id, group.participants, {
      home_and_away: group.home_and_away,
      start_date: options.start_date,
      matches_per_day: options.matches_per_day,
      match_interval_hours: options.match_interval_hours,
    });
    
    // Tag fixtures with group name
    groupFixtures.fixtures.forEach(f => {
      f.group_name = group.name;
    });
    
    allFixtures.push(...groupFixtures.fixtures);
    maxRounds = Math.max(maxRounds, groupFixtures.total_rounds);
  });
  
  return {
    fixtures: allFixtures,
    total_rounds: maxRounds,
    matches_per_round: 0, // Variable across groups
    total_matches: allFixtures.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save fixtures to database
 */
export async function saveFixtures(
  tournament_id: string,
  fixtures: GeneratedFixtures,
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
    
    // Delete existing fixtures
    await supabase
      .from('tournament_fixtures')
      .delete()
      .eq('tournament_id', tournament_id);
    
    // Insert new fixtures with IDs
    const fixturesWithIds = fixtures.fixtures.map(f => ({
      ...f,
      id: crypto.randomUUID(),
    }));
    
    const { error } = await supabase
      .from('tournament_fixtures')
      .insert(fixturesWithIds as never);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Update tournament
    await supabase
      .from('tournaments')
      .update({
        fixtures_generated: true,
        fixtures_count: fixtures.total_matches,
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
        action: 'tournament.fixtures_generated',
        category: 'tournament',
        target_id: tournament_id,
        target_type: 'tournament',
        severity: 'info',
        metadata: {
          total_fixtures: fixtures.total_matches,
          total_rounds: fixtures.total_rounds,
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
// FIXTURE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reschedule a fixture
 */
export async function rescheduleFixture(
  fixture_id: string,
  params: {
    new_date: string;
    new_time?: string;
    reason: string;
    rescheduled_by: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get fixture for audit
    const { data: fixture } = await supabase
      .from('tournament_fixtures')
      .select('tournament_id, scheduled_date, scheduled_time')
      .eq('id', fixture_id)
      .single<{ tournament_id: string; scheduled_date: string; scheduled_time: string | null }>();
    
    if (!fixture) {
      return { success: false, error: 'Fixture not found' };
    }
    
    // Check permission
    const permCheck = await checkServerPermission(params.rescheduled_by, 'tournaments.edit' as AdminPermission, {
      type: 'tournament',
      id: fixture.tournament_id,
    });
    
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Update fixture
    const { error } = await supabase
      .from('tournament_fixtures')
      .update({
        scheduled_date: params.new_date,
        scheduled_time: params.new_time || null,
        status: 'scheduled',
      } as never)
      .eq('id', fixture_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Audit log
    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', params.rescheduled_by)
      .single<{ email: string; role: string }>();
    
    await writeAudit(
      {
        actor_id: params.rescheduled_by,
        actor_email: user?.email,
        actor_role: user?.role || 'UNKNOWN',
      },
      {
        action: 'tournament.fixture_rescheduled',
        category: 'tournament',
        target_id: fixture_id,
        target_type: 'fixture',
        severity: 'info',
        reason: params.reason,
        previous_state: {
          scheduled_date: fixture.scheduled_date,
          scheduled_time: fixture.scheduled_time,
        },
        new_state: {
          scheduled_date: params.new_date,
          scheduled_time: params.new_time,
        },
        is_reversible: true,
      }
    );
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Report fixture result
 */
export async function reportFixtureResult(
  fixture_id: string,
  params: {
    home_score: number;
    away_score: number;
    reported_by: string;
  }
): Promise<{ success: boolean; error?: string; standings?: GroupStandings[] }> {
  try {
    const { data: fixture } = await supabase
      .from('tournament_fixtures')
      .select('*')
      .eq('id', fixture_id)
      .single<Fixture>();
    
    if (!fixture) {
      return { success: false, error: 'Fixture not found' };
    }
    
    if (fixture.status === 'completed') {
      return { success: false, error: 'Fixture already completed' };
    }
    
    const winner_id = params.home_score > params.away_score ? fixture.home_id : 
                      params.away_score > params.home_score ? fixture.away_id : null;
    
    const { error } = await supabase
      .from('tournament_fixtures')
      .update({
        home_score: params.home_score,
        away_score: params.away_score,
        status: 'completed',
        winner_id,
      } as never)
      .eq('id', fixture_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Recalculate standings
    const standings = await calculateGroupStandings(fixture.tournament_id, fixture.group_name || undefined);
    
    return { success: true, standings };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDINGS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface GroupStandings {
  group_name: string | null;
  position: number;
  participant_id: string;
  username: string;
  
  // Matches
  played: number;
  won: number;
  drawn: number;
  lost: number;
  
  // Goals/Points (for football)
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  
  // Form
  form: ('W' | 'D' | 'L')[];
  
  // Tie breakers
  head_to_head_points?: number;
  head_to_head_goal_diff?: number;
}

/**
 * Calculate group standings from completed fixtures
 */
export async function calculateGroupStandings(
  tournament_id: string,
  group_name?: string
): Promise<GroupStandings[]> {
  const query = supabase
    .from('tournament_fixtures')
    .select('*')
    .eq('tournament_id', tournament_id)
    .eq('status', 'completed');
  
  if (group_name) {
    query.eq('group_name', group_name);
  }
  
  const { data: fixtures } = await query.returns<Fixture[]>();
  
  if (!fixtures || fixtures.length === 0) {
    return [];
  }
  
  // Group fixtures by group_name
  const fixturesByGroup = new Map<string | null, Fixture[]>();
  fixtures.forEach(f => {
    const key = f.group_name || null;
    if (!fixturesByGroup.has(key)) {
      fixturesByGroup.set(key, []);
    }
    fixturesByGroup.get(key)!.push(f);
  });
  
  const allStandings: GroupStandings[] = [];
  
  fixturesByGroup.forEach((groupFixtures, groupKey) => {
    // Collect all unique participants
    const participantStats = new Map<string, {
      id: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goals_for: number;
      goals_against: number;
      points: number;
      form: ('W' | 'D' | 'L')[];
    }>();
    
    // Get participant details from fixtures
    groupFixtures.forEach(f => {
      // Home team
      if (!participantStats.has(f.home_id)) {
        participantStats.set(f.home_id, {
          id: f.home_id,
          played: 0, won: 0, drawn: 0, lost: 0,
          goals_for: 0, goals_against: 0, points: 0,
          form: [],
        });
      }
      
      // Away team
      if (!participantStats.has(f.away_id)) {
        participantStats.set(f.away_id, {
          id: f.away_id,
          played: 0, won: 0, drawn: 0, lost: 0,
          goals_for: 0, goals_against: 0, points: 0,
          form: [],
        });
      }
      
      const home = participantStats.get(f.home_id)!;
      const away = participantStats.get(f.away_id)!;
      
      home.played++;
      away.played++;
      
      home.goals_for += f.home_score || 0;
      home.goals_against += f.away_score || 0;
      away.goals_for += f.away_score || 0;
      away.goals_against += f.home_score || 0;
      
      const homeGoals = f.home_score || 0;
      const awayGoals = f.away_score || 0;
      
      if (homeGoals > awayGoals) {
        home.won++;
        home.points += 3;
        home.form.unshift('W');
        away.lost++;
        away.form.unshift('L');
      } else if (awayGoals > homeGoals) {
        away.won++;
        away.points += 3;
        away.form.unshift('W');
        home.lost++;
        home.form.unshift('L');
      } else {
        home.drawn++;
        home.points += 1;
        home.form.unshift('D');
        away.drawn++;
        away.points += 1;
        away.form.unshift('D');
      }
      
      // Keep only last 5
      if (home.form.length > 5) home.form = home.form.slice(0, 5);
      if (away.form.length > 5) away.form = away.form.slice(0, 5);
    });
    
    // Convert to standings
    const standings: GroupStandings[] = Array.from(participantStats.values()).map(stats => ({
      group_name: groupKey,
      position: 0, // Will be set after sorting
      participant_id: stats.id,
      username: '', // Will be populated
      played: stats.played,
      won: stats.won,
      drawn: stats.drawn,
      lost: stats.lost,
      goals_for: stats.goals_for,
      goals_against: stats.goals_against,
      goal_difference: stats.goals_for - stats.goals_against,
      points: stats.points,
      form: stats.form,
    }));
    
    // Sort by points, then goal difference, then goals for
    standings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goal_difference !== b.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_for - a.goals_for;
    });
    
    // Assign positions
    standings.forEach((s, idx) => {
      s.position = idx + 1;
    });
    
    allStandings.push(...standings);
  });
  
  return allStandings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateMatchTime(matchIndex: number, intervalHours: number): string {
  const hour = 10 + (matchIndex * intervalHours); // Start at 10 AM
  return `${hour.toString().padStart(2, '0')}:00:00`;
}

function calculateReverseMatchDate(
  originalDate: string,
  totalFixtures: number,
  matchesPerDay: number
): string {
  const date = new Date(originalDate);
  const daysToAdd = Math.ceil(totalFixtures / matchesPerDay);
  date.setDate(date.getDate() + daysToAdd + 1); // +1 for rest day
  return date.toISOString().split('T')[0];
}
