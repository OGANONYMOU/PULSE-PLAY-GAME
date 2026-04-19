// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Moderation System - Case Management
// Full workflow system for content moderation with case tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CaseStatus = 
  | 'new'           // Just created, unassigned
  | 'assigned'      // Assigned to moderator
  | 'reviewing'     // Moderator actively reviewing
  | 'evidence_gathering' // Collecting more evidence
  | 'awaiting_response'  // Waiting for user response
  | 'action_taken'  // Action executed
  | 'escalated'     // Escalated to senior staff
  | 'resolved'      // Case closed
  | 'dismissed';    // Case dismissed without action

export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ContentType = 'post' | 'clip' | 'comment' | 'user' | 'tournament' | 'message';
export type OffenseType = 
  | 'harassment' | 'hate_speech' | 'spam' | 'inappropriate_content' 
  | 'cheating' | 'impersonation' | 'scam' | 'copyright' | 'violence' | 'other';

export interface ModerationCase {
  id: string;
  case_number: string;  // Human-readable: MOD-2024-001
  status: CaseStatus;
  priority: CasePriority;
  
  // Reporter info
  reporter_id: string;
  reporter_username: string;
  
  // Subject info (who/what is being reported)
  subject_type: ContentType;
  subject_id: string;
  subject_author_id: string;
  subject_author_username: string;
  subject_content: string | null;
  subject_url: string | null;
  
  // Report details
  offense_type: OffenseType;
  description: string;
  evidence_urls: string[];
  
  // Assignment
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  
  // Timeline
  created_at: string;
  updated_at: string;
  due_at: string | null;  // SLA deadline
  resolved_at: string | null;
  
  // Action taken
  action_taken: string | null;  // e.g., 'content_removed', 'user_warned', 'user_banned'
  action_reason: string | null;
  action_metadata: Record<string, unknown> | null;
  
  // Violation tracking
  is_violation: boolean | null;
  violation_severity: 'minor' | 'moderate' | 'severe' | null;
  
  // Stats
  notes_count: number;
  history: CaseHistoryEntry[];
}

export interface CaseHistoryEntry {
  id: string;
  case_id: string;
  action: string;
  actor_id: string;
  actor_username: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  author_id: string;
  author_username: string;
  author_role: string;
  content: string;
  note_type: 'internal' | 'user_visible' | 'system';
  created_at: string;
}

export interface CaseFilter {
  status?: CaseStatus[];
  priority?: CasePriority[];
  assigned_to?: string | 'unassigned' | 'me';
  offense_type?: OffenseType[];
  subject_type?: ContentType[];
  created_after?: string;
  created_before?: string;
  due_soon?: boolean;  // Due within 24h
  overdue?: boolean;
  search?: string;
}

export interface CaseStats {
  total_cases: number;
  by_status: Record<CaseStatus, number>;
  by_priority: Record<CasePriority, number>;
  by_offense: Record<OffenseType, number>;
  avg_resolution_time: number;  // hours
  overdue_count: number;
  assigned_to_me: number;
}

export interface OffenderProfile {
  user_id: string;
  username: string;
  total_cases: number;
  violations_confirmed: number;
  violations_dismissed: number;
  current_strikes: number;
  last_offense_at: string | null;
  offense_history: OffenseRecord[];
  risk_score: number;  // 0-100
}

export interface OffenseRecord {
  id: string;
  case_id: string;
  offense_type: OffenseType;
  severity: 'minor' | 'moderate' | 'severe';
  action_taken: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASE MANAGEMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new moderation case from a report
 */
export async function createCase(
  reporter_id: string,
  params: {
    subject_type: ContentType;
    subject_id: string;
    offense_type: OffenseType;
    description: string;
    evidence_urls?: string[];
  }
): Promise<{ success: boolean; case?: ModerationCase; error?: string }> {
  try {
    // 1. Check if subject exists and get details
    let subject_author_id: string | null = null;
    let subject_author_username: string | null = null;
    let subject_content: string | null = null;

    if (params.subject_type === 'user') {
      const { data: user } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', params.subject_id)
        .single<{ id: string; username: string }>();
      if (!user) return { success: false, error: 'User not found' };
      subject_author_id = user.id;
      subject_author_username = user.username;
    } else if (params.subject_type === 'post') {
      const { data: post } = await supabase
        .from('posts')
        .select('id, title, content, author_id, profiles:author_id(username)')
        .eq('id', params.subject_id)
        .single<{ id: string; title: string; content: string; author_id: string; profiles: { username: string } }>();
      if (!post) return { success: false, error: 'Post not found' };
      subject_author_id = post.author_id;
      subject_author_username = post.profiles?.username || 'Unknown';
      subject_content = `${post.title}\n${post.content}`;
    }
    // Add more content types as needed

    if (!subject_author_id) {
      return { success: false, error: 'Could not determine subject author' };
    }

    // 2. Check for repeat offender and auto-prioritize
    const priority = await calculatePriority(subject_author_id, params.offense_type);

    // 3. Generate case number
    const case_number = await generateCaseNumber();

    // 4. Calculate SLA (due date)
    const due_at = calculateSLADueDate(priority);

    // 5. Create the case
    const { data: newCase, error } = await supabase
      .from('moderation_cases')
      .insert({
        case_number,
        status: 'new',
        priority,
        reporter_id,
        subject_type: params.subject_type,
        subject_id: params.subject_id,
        subject_author_id,
        subject_author_username,
        subject_content,
        offense_type: params.offense_type,
        description: params.description,
        evidence_urls: params.evidence_urls || [],
        due_at,
        notes_count: 0,
        history: [],
      } as never)
      .select()
      .single<ModerationCase>();

    if (error || !newCase) {
      return { success: false, error: error?.message || 'Failed to create case' };
    }

    // 6. Add initial history entry
    await addCaseHistory(newCase.id, 'case_created', reporter_id, {
      offense_type: params.offense_type,
      priority,
    });

    return { success: true, case: newCase };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Assign a case to a moderator
 */
export async function assignCase(
  case_id: string,
  moderator_id: string,
  assigned_by_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: moderator } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', moderator_id)
      .single<{ username: string; role: string }>();

    if (!moderator) {
      return { success: false, error: 'Moderator not found' };
    }

    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(moderator.role)) {
      return { success: false, error: 'User is not a moderator' };
    }

    const { error } = await supabase
      .from('moderation_cases')
      .update({
        assigned_to: moderator_id,
        assigned_at: new Date().toISOString(),
        assigned_by: assigned_by_id,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', case_id);

    if (error) {
      return { success: false, error: error.message };
    }

    await addCaseHistory(case_id, 'case_assigned', assigned_by_id, {
      assigned_to: moderator_id,
      moderator_username: moderator.username,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update case status
 */
export async function updateCaseStatus(
  case_id: string,
  new_status: CaseStatus,
  actor_id: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Record<string, unknown> = {
      status: new_status,
      updated_at: new Date().toISOString(),
    };

    if (new_status === 'reviewing') {
      updates.reviewing_started_at = new Date().toISOString();
    }

    if (new_status === 'resolved' || new_status === 'dismissed') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('moderation_cases')
      .update(updates as never)
      .eq('id', case_id);

    if (error) {
      return { success: false, error: error.message };
    }

    await addCaseHistory(case_id, 'status_changed', actor_id, {
      new_status,
      ...details,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Take action on a case
 */
export async function takeCaseAction(
  case_id: string,
  params: {
    action: string;  // e.g., 'warn', 'mute', 'ban', 'content_remove', 'dismiss'
    is_violation: boolean;
    severity?: 'minor' | 'moderate' | 'severe';
    reason: string;
    duration?: number;  // For mutes/bans in hours
    actor_id: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get case details
    const { data: modCase } = await supabase
      .from('moderation_cases')
      .select('*')
      .eq('id', case_id)
      .single<ModerationCase>();

    if (!modCase) {
      return { success: false, error: 'Case not found' };
    }

    // 2. Execute the action (permission check happens here)
    const actionResult = await executeModerationAction({
      action: params.action,
      subject_type: modCase.subject_type,
      subject_id: modCase.subject_id,
      subject_author_id: modCase.subject_author_id,
      duration: params.duration,
      reason: params.reason,
      actor_id: params.actor_id,
    });

    if (!actionResult.success) {
      return { success: false, error: actionResult.error };
    }

    // 3. Update case with action taken
    const { error } = await supabase
      .from('moderation_cases')
      .update({
        status: 'action_taken',
        action_taken: params.action,
        action_reason: params.reason,
        action_metadata: {
          duration: params.duration,
          executed_at: new Date().toISOString(),
        },
        is_violation: params.is_violation,
        violation_severity: params.severity || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', case_id);

    if (error) {
      return { success: false, error: error.message };
    }

    // 4. Record in history
    await addCaseHistory(case_id, 'action_taken', params.actor_id, {
      action: params.action,
      is_violation: params.is_violation,
      severity: params.severity,
    });

    // 5. Update offender profile if violation confirmed
    if (params.is_violation) {
      await recordOffense(modCase.subject_author_id, {
        case_id,
        offense_type: modCase.offense_type,
        severity: params.severity || 'moderate',
        action_taken: params.action,
      });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Add a note to a case
 */
export async function addCaseNote(
  case_id: string,
  author_id: string,
  content: string,
  note_type: CaseNote['note_type'] = 'internal'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: author } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', author_id)
      .single<{ username: string; role: string }>();

    const { error } = await supabase
      .from('case_notes')
      .insert({
        case_id,
        author_id,
        author_username: author?.username || 'Unknown',
        author_role: author?.role || 'UNKNOWN',
        content,
        note_type,
      } as never);

    if (error) {
      return { success: false, error: error.message };
    }

    // Increment notes count on case
    await supabase.rpc('increment_case_notes', { case_id } as any);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Query cases with filters
 */
export async function queryCases(
  filter: CaseFilter,
  options: { page?: number; limit?: number } = {}
): Promise<{ cases: ModerationCase[]; total: number; error?: string }> {
  const { page = 1, limit = 20 } = options;

  try {
    let query = supabase
      .from('moderation_cases')
      .select('*', { count: 'exact' });

    if (filter.status?.length) {
      query = query.in('status', filter.status);
    }
    if (filter.priority?.length) {
      query = query.in('priority', filter.priority);
    }
    if (filter.offense_type?.length) {
      query = query.in('offense_type', filter.offense_type);
    }
    if (filter.subject_type?.length) {
      query = query.in('subject_type', filter.subject_type);
    }
    if (filter.assigned_to === 'unassigned') {
      query = query.is('assigned_to', null);
    } else if (filter.assigned_to && filter.assigned_to !== 'me') {
      query = query.eq('assigned_to', filter.assigned_to);
    }
    if (filter.created_after) {
      query = query.gte('created_at', filter.created_after);
    }
    if (filter.created_before) {
      query = query.lte('created_at', filter.created_before);
    }
    if (filter.due_soon) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      query = query.lte('due_at', tomorrow.toISOString());
    }
    if (filter.overdue) {
      query = query.lt('due_at', new Date().toISOString()).not('status', 'in', ['resolved', 'dismissed']);
    }
    if (filter.search) {
      query = query.or(`case_number.ilike.%${filter.search}%,subject_author_username.ilike.%${filter.search}%`);
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await query
      .order('priority', { ascending: false })  // Urgent first
      .order('created_at', { ascending: true }) // Oldest first
      .range(from, from + limit - 1)
      .returns<ModerationCase[]>();

    if (error) {
      return { cases: [], total: 0, error: error.message };
    }

    return { cases: data || [], total: count || 0 };
  } catch (err) {
    return { cases: [], total: 0, error: 'Query failed' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFENDER TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function getOffenderProfile(user_id: string): Promise<OffenderProfile | null> {
  const { data: user } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user_id)
    .single<{ username: string }>();

  if (!user) return null;

  const { data: cases } = await supabase
    .from('moderation_cases')
    .select('id, is_violation, violation_severity, action_taken, created_at, offense_type')
    .eq('subject_author_id', user_id)
    .returns<{
      id: string;
      is_violation: boolean;
      violation_severity: string;
      action_taken: string;
      created_at: string;
      offense_type: OffenseType;
    }[]>();

  const violations = cases?.filter(c => c.is_violation) || [];
  const dismissed = cases?.filter(c => !c.is_violation) || [];

  // Calculate strikes (3 minor = 1 strike, 1 moderate = 1 strike, 1 severe = 2 strikes)
  let strikes = 0;
  violations.forEach(v => {
    if (v.violation_severity === 'minor') strikes += 0.33;
    else if (v.violation_severity === 'moderate') strikes += 1;
    else if (v.violation_severity === 'severe') strikes += 2;
  });

  // Calculate risk score
  const riskScore = Math.min(100, Math.round(
    (violations.length * 10) +
    (strikes * 15) +
    (violations.filter(v => v.action_taken === 'ban').length * 20)
  ));

  return {
    user_id,
    username: user.username,
    total_cases: cases?.length || 0,
    violations_confirmed: violations.length,
    violations_dismissed: dismissed.length,
    current_strikes: Math.floor(strikes),
    last_offense_at: violations.length > 0 
      ? violations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null,
    offense_history: violations.map(v => ({
      id: v.id,
      case_id: v.id,
      offense_type: v.offense_type,
      severity: (v.violation_severity || 'moderate') as 'minor' | 'moderate' | 'severe',
      action_taken: v.action_taken || 'none',
      created_at: v.created_at,
    })),
    risk_score: riskScore,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('moderation_cases')
    .select('case_number')
    .ilike('case_number', `MOD-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ case_number: string }>();

  let sequence = 1;
  if (data?.case_number) {
    const match = data.case_number.match(/MOD-\d{4}-(\d+)/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `MOD-${year}-${sequence.toString().padStart(4, '0')}`;
}

async function calculatePriority(
  subject_author_id: string,
  offense_type: OffenseType
): Promise<CasePriority> {
  // Check for repeat offender
  const { data: previousCases } = await supabase
    .from('moderation_cases')
    .select('id')
    .eq('subject_author_id', subject_author_id)
    .eq('is_violation', true)
    .limit(3);

  const repeatOffender = (previousCases?.length || 0) >= 2;

  // High-priority offenses
  const highPriorityOffenses: OffenseType[] = ['hate_speech', 'violence', 'scam', 'cheating'];

  if (highPriorityOffenses.includes(offense_type)) {
    return repeatOffender ? 'urgent' : 'high';
  }

  if (repeatOffender) {
    return 'high';
  }

  if (offense_type === 'harassment' || offense_type === 'impersonation') {
    return 'medium';
  }

  return 'low';
}

function calculateSLADueDate(priority: CasePriority): string {
  const hours = {
    urgent: 4,
    high: 24,
    medium: 72,
    low: 168,  // 7 days
  };

  const due = new Date();
  due.setHours(due.getHours() + hours[priority]);
  return due.toISOString();
}

async function addCaseHistory(
  case_id: string,
  action: string,
  actor_id: string,
  details: Record<string, unknown>
): Promise<void> {
  const { data: actor } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', actor_id)
    .single<{ username: string }>();

  const historyEntry = {
    id: crypto.randomUUID(),
    case_id,
    action,
    actor_id,
    actor_username: actor?.username || 'System',
    details,
    created_at: new Date().toISOString(),
  };

  await supabase.rpc('append_case_history', {
    case_id,
    entry: historyEntry,
  } as any);
}

async function executeModerationAction(_params: {
  action: string;
  subject_type: ContentType;
  subject_id: string;
  subject_author_id: string;
  duration?: number;
  reason: string;
  actor_id: string;
}): Promise<{ success: boolean; error?: string }> {
  // This would integrate with your actual moderation actions
  // For now, return success - implement based on your specific actions
  return { success: true };
}

async function recordOffense(
  user_id: string,
  params: {
    case_id: string;
    offense_type: OffenseType;
    severity: 'minor' | 'moderate' | 'severe';
    action_taken: string;
  }
): Promise<void> {
  // Update offender tracking
  await supabase.rpc('record_offense', {
    user_id,
    case_id: params.case_id,
    offense_type: params.offense_type,
    severity: params.severity,
    action_taken: params.action_taken,
  } as any);
}
