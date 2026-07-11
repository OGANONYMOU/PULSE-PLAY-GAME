// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Dispute System - Full Workflow Engine
// Evidence collection, counter-claims, referee assignment, decision enforcement
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { checkServerPermission } from '@/lib/security';
import { createIncident } from '../incident/incidentSystem';
import type { AdminPermission } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DisputeStatus = 
  | 'submitted'       // Just created
  | 'under_review'    // Referee assigned, reviewing
  | 'evidence_requested' // Waiting for more evidence
  | 'awaiting_response' // Waiting for counter-party
  | 'decided'         // Decision made
  | 'resolved'        // Fully closed
  | 'dismissed';      // Dismissed without action

export type DisputeType = 
  | 'cheating' 
  | 'harassment' 
  | 'no_show' 
  | 'disputed_result' 
  | 'rule_violation' 
  | 'other';

export type DisputePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DisputeEvidence {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  uploader_username: string;
  evidence_type: 'screenshot' | 'video' | 'replay' | 'chat_log' | 'witness_statement' | 'other';
  file_url: string;
  file_hash: string;  // For integrity verification
  description: string;
  uploaded_at: string;
}

export interface DisputeClaim {
  party: 'initiator' | 'respondent';
  claim: string;
  submitted_at: string;
}

export interface DisputeDecision {
  decision: string;
  reason: string;
  decided_by: string;
  decider_username: string;
  decided_at: string;
  
  // Penalties (if any)
  initiator_penalty?: {
    type: 'none' | 'warning' | 'disqualification' | 'ban' | 'score_adjustment';
    duration_hours?: number;
    description: string;
  };
  respondent_penalty?: {
    type: 'none' | 'warning' | 'disqualification' | 'ban' | 'score_adjustment';
    duration_hours?: number;
    description: string;
  };
  
  // Match result override
  match_result_override?: {
    winner_id: string;
    score: string;
    reason: string;
  };
}

export interface TournamentDispute {
  id: string;
  dispute_number: string;  // Human-readable: DISP-2024-001
  tournament_id: string;
  tournament_name: string;
  match_id: string | null;
  
  // Parties
  initiator_id: string;
  initiator_username: string;
  initiator_team?: string;
  
  respondent_id: string | null;
  respondent_username: string | null;
  respondent_team?: string | null;
  
  // Dispute details
  type: DisputeType;
  status: DisputeStatus;
  priority: DisputePriority;
  
  // Claims
  initiator_claim: string;
  respondent_claim: string | null;
  
  // Evidence
  initiator_evidence: DisputeEvidence[];
  respondent_evidence: DisputeEvidence[];
  
  // Referee assignment
  assigned_referee_id: string | null;
  assigned_referee_username: string | null;
  assigned_at: string | null;
  
  // Decision
  decision: DisputeDecision | null;
  
  // Timeline
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  due_at: string | null;  // SLA deadline
  
  // Meta
  is_auto_generated: boolean;
  parent_dispute_id: string | null;  // For linked disputes
}

export interface DisputeFilter {
  status?: DisputeStatus[];
  type?: DisputeType[];
  priority?: DisputePriority[];
  tournament_id?: string;
  assigned_to?: string | 'unassigned';
  created_after?: string;
  created_before?: string;
  due_soon?: boolean;
  overdue?: boolean;
  search?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit a new dispute
 */
export async function submitDispute(
  params: {
    tournament_id: string;
    match_id?: string;
    initiator_id: string;
    respondent_id?: string;
    type: DisputeType;
    claim: string;
    evidence_urls?: string[];
    is_auto_generated?: boolean;
  }
): Promise<{ success: boolean; dispute?: TournamentDispute; error?: string }> {
  try {
    // Get tournament details
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, organizer_id')
      .eq('id', params.tournament_id)
      .single<{ name: string; organizer_id: string }>();
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    // Get initiator details
    const { data: initiator } = await supabase
      .from('profiles')
      .select('username, gamertag')
      .eq('id', params.initiator_id)
      .single<{ username: string; gamertag: string | null }>();
    
    // Get respondent details
    let respondent: { username: string; gamertag: string | null } | null = null;
    if (params.respondent_id) {
      const { data: r } = await supabase
        .from('profiles')
        .select('username, gamertag')
        .eq('id', params.respondent_id)
        .single();
      respondent = r as { username: string; gamertag: string | null } | null;
    }
    
    // Generate dispute number
    const dispute_number = await generateDisputeNumber();
    
    // Calculate priority and due date
    const priority = await calculateDisputePriority(params.type, params.tournament_id);
    const due_at = calculateSLADueDate(priority);
    
    // Create dispute
    const { data: dispute, error } = await supabase
      .from('disputes')
      .insert({
        dispute_number,
        tournament_id: params.tournament_id,
        match_id: params.match_id || null,
        
        initiator_id: params.initiator_id,
        initiator_username: initiator?.username || 'Unknown',
        
        respondent_id: params.respondent_id || null,
        respondent_username: (respondent as { username: string } | null)?.username || null,
        
        type: params.type,
        status: 'submitted',
        priority,
        
        initiator_claim: params.claim,
        respondent_claim: null,
        
        assigned_referee_id: null,
        assigned_referee_username: null,
        
        decision: null,
        
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_at,
        
        is_auto_generated: params.is_auto_generated || false,
      } as never)
      .select()
      .single<TournamentDispute>();
    
    if (error || !dispute) {
      return { success: false, error: error?.message || 'Failed to create dispute' };
    }
    
    // Upload evidence if provided
    if (params.evidence_urls?.length) {
      for (const url of params.evidence_urls) {
        await addEvidence(dispute.id, params.initiator_id, {
          evidence_type: 'screenshot',
          file_url: url,
          file_hash: '',  // Would be calculated
          description: 'Initial evidence',
        });
      }
    }
    
    // Notify opponent
    if (params.respondent_id) {
      await notifyDisputeCreated(dispute.id, params.respondent_id);
    }
    
    // Create incident for high-priority disputes
    if (priority === 'high' || priority === 'urgent') {
      await createIncident({
        type: 'dispute_spike',
        severity: priority === 'urgent' ? 'critical' : 'high',
        title: `High Priority Dispute: ${dispute_number}`,
        description: `Dispute of type ${params.type} submitted for tournament ${tournament.name}`,
        affected_entities: [{ type: 'tournament', id: params.tournament_id }],
      }, 'system');
    }
    
    return { success: true, dispute };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Submit counter-claim/evidence by respondent
 */
export async function submitCounterClaim(
  dispute_id: string,
  params: {
    respondent_id: string;
    counter_claim: string;
    evidence_urls?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get dispute
    const { data: dispute } = await supabase
      .from('disputes')
      .select('respondent_id, status')
      .eq('id', dispute_id)
      .single<{ respondent_id: string | null; status: DisputeStatus }>();
    
    if (!dispute) {
      return { success: false, error: 'Dispute not found' };
    }
    
    // Verify respondent
    if (dispute.respondent_id && dispute.respondent_id !== params.respondent_id) {
      return { success: false, error: 'You are not the assigned respondent' };
    }
    
    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      return { success: false, error: 'Dispute is already closed' };
    }
    
    // Update with counter-claim
    const { error } = await supabase
      .from('disputes')
      .update({
        respondent_claim: params.counter_claim,
        status: 'awaiting_response',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', dispute_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Upload evidence
    if (params.evidence_urls?.length) {
      for (const url of params.evidence_urls) {
        await addEvidence(dispute_id, params.respondent_id, {
          evidence_type: 'screenshot',
          file_url: url,
          file_hash: '',
          description: 'Counter evidence',
        });
      }
    }
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Assign referee to dispute
 */
export async function assignReferee(
  dispute_id: string,
  referee_id: string,
  assigned_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permission
    const permCheck = await checkServerPermission(assigned_by, 'moderation.resolve' as AdminPermission);
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Get referee details
    const { data: referee } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', referee_id)
      .single<{ username: string; role: string }>();
    
    if (!referee) {
      return { success: false, error: 'Referee not found' };
    }
    
    if (!['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(referee.role)) {
      return { success: false, error: 'User must be moderator or admin to be assigned' };
    }
    
    // Update dispute
    const { error } = await supabase
      .from('disputes')
      .update({
        assigned_referee_id: referee_id,
        assigned_referee_username: referee.username,
        assigned_at: new Date().toISOString(),
        status: 'under_review',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', dispute_id);
    
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
 * Request additional evidence
 */
export async function requestEvidence(
  dispute_id: string,
  _params: {
    from_party: 'initiator' | 'respondent' | 'both';
    evidence_type: string;
    reason: string;
    requested_by: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'evidence_requested',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', dispute_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Create notification for requested party
    // Implementation depends on your notification system
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Make decision on dispute
 */
export async function makeDecision(
  dispute_id: string,
  params: {
    decision: string;
    reason: string;
    initiator_penalty?: DisputeDecision['initiator_penalty'];
    respondent_penalty?: DisputeDecision['respondent_penalty'];
    match_result_override?: DisputeDecision['match_result_override'];
    decided_by: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permission
    const permCheck = await checkServerPermission(params.decided_by, 'moderation.resolve' as AdminPermission);
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    // Get dispute and decider details
    const { data: dispute } = await supabase
      .from('disputes')
      .select('tournament_id, match_id, initiator_id, respondent_id, status')
      .eq('id', dispute_id)
      .single<{
        tournament_id: string;
        match_id: string | null;
        initiator_id: string;
        respondent_id: string | null;
        status: DisputeStatus;
      }>();
    
    if (!dispute) {
      return { success: false, error: 'Dispute not found' };
    }
    
    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      return { success: false, error: 'Dispute already resolved' };
    }
    
    const { data: decider } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', params.decided_by)
      .single<{ username: string }>();
    
    // Build decision object
    const decision: DisputeDecision = {
      decision: params.decision,
      reason: params.reason,
      decided_by: params.decided_by,
      decider_username: decider?.username || 'Unknown',
      decided_at: new Date().toISOString(),
      initiator_penalty: params.initiator_penalty,
      respondent_penalty: params.respondent_penalty,
      match_result_override: params.match_result_override,
    };
    
    // Update dispute
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'decided',
        decision: decision as never,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', dispute_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Enforce penalties
    if (params.initiator_penalty && params.initiator_penalty.type !== 'none') {
      await enforcePenalty(dispute.initiator_id, params.initiator_penalty, dispute.tournament_id);
    }
    
    if (params.respondent_penalty && params.respondent_penalty.type !== 'none' && dispute.respondent_id) {
      await enforcePenalty(dispute.respondent_id, params.respondent_penalty, dispute.tournament_id);
    }
    
    // Apply match result override
    if (params.match_result_override && dispute.match_id) {
      await applyMatchOverride(dispute.match_id, params.match_result_override, params.decided_by);
    }
    
    // Resolve the dispute
    await resolveDispute(dispute_id, params.decided_by);
    
    // Audit log
    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', params.decided_by)
      .single<{ email: string; role: string }>();
    
    await writeAudit(
      {
        actor_id: params.decided_by,
        actor_email: user?.email,
        actor_role: user?.role || 'UNKNOWN',
      },
      {
        action: 'dispute.decided',
        category: 'dispute',
        target_id: dispute_id,
        target_type: 'dispute',
        severity: 'info',
        reason: params.reason,
        metadata: {
          decision: params.decision,
          initiator_penalty: params.initiator_penalty?.type,
          respondent_penalty: params.respondent_penalty?.type,
        },
      }
    );
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Resolve dispute after decision
 */
export async function resolveDispute(
  dispute_id: string,
  _resolved_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', dispute_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVIDENCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function addEvidence(
  dispute_id: string,
  uploaded_by: string,
  evidence: Omit<DisputeEvidence, 'id' | 'dispute_id' | 'uploaded_by' | 'uploader_username' | 'uploaded_at'>
): Promise<void> {
  const { data: user } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', uploaded_by)
    .single<{ username: string }>();
  
  await supabase
    .from('dispute_evidence')
    .insert({
      dispute_id,
      uploaded_by,
      uploader_username: user?.username || 'Unknown',
      ...evidence,
      uploaded_at: new Date().toISOString(),
    } as never);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENALTY ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function enforcePenalty(
  user_id: string,
  penalty: NonNullable<DisputeDecision['initiator_penalty']>,
  tournament_id: string
): Promise<void> {
  switch (penalty.type) {
    case 'warning':
      // Add warning to user record
      await supabase.rpc('add_user_warning', {
        user_id,
        reason: penalty.description,
        source: 'dispute',
      } as any);
      break;
      
    case 'disqualification':
      // Remove from tournament
      await supabase
        .from('tournament_participants')
        .update({ status: 'disqualified' } as never)
        .eq('user_id', user_id)
        .eq('tournament_id', tournament_id);
      break;
      
    case 'ban':
      // Ban user temporarily
      if (penalty.duration_hours) {
        await supabase
          .from('profiles')
          .update({
            is_banned: true,
            ban_reason: penalty.description,
            ban_expires_at: new Date(Date.now() + penalty.duration_hours * 3600000).toISOString(),
          } as never)
          .eq('id', user_id);
      }
      break;
      
    case 'score_adjustment':
      // Score adjustments handled separately
      break;
  }
}

async function applyMatchOverride(
  match_id: string,
  override: NonNullable<DisputeDecision['match_result_override']>,
  overridden_by: string
): Promise<void> {
  // Update match result
  await supabase
    .from('matches')
    .update({
      winner_id: override.winner_id,
      score: override.score,
      status: 'completed',
      result_overridden: true,
      result_override_reason: override.reason,
      result_overridden_by: overridden_by,
    } as never)
    .eq('id', match_id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function generateDisputeNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('disputes')
    .select('dispute_number')
    .ilike('dispute_number', `DISP-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ dispute_number: string }>();
  
  let sequence = 1;
  if (data?.dispute_number) {
    const match = data.dispute_number.match(/DISP-\d{4}-(\d+)/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }
  
  return `DISP-${year}-${sequence.toString().padStart(4, '0')}`;
}

async function calculateDisputePriority(type: DisputeType, tournament_id: string): Promise<DisputePriority> {
  // Check for repeat disputes in tournament
  const { data: recentDisputes } = await supabase
    .from('disputes')
    .select('id')
    .eq('tournament_id', tournament_id)
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
    .limit(5);
  
  const highPriorityTypes: DisputeType[] = ['cheating', 'harassment', 'disputed_result'];
  
  if (recentDisputes && recentDisputes.length >= 3) {
    return 'urgent';  // Multiple disputes in 24h
  }
  
  if (highPriorityTypes.includes(type)) {
    return 'high';
  }
  
  return 'medium';
}

function calculateSLADueDate(priority: DisputePriority): string {
  const hours = {
    low: 72,
    medium: 48,
    high: 24,
    urgent: 8,
  };
  
  const due = new Date();
  due.setHours(due.getHours() + hours[priority]);
  return due.toISOString();
}

async function notifyDisputeCreated(dispute_id: string, respondent_id: string): Promise<void> {
  // Implementation depends on your notification system
  // Could be push notification, email, or in-app notification
  await supabase.rpc('create_notification', {
    user_id: respondent_id,
    type: 'dispute_filed',
    title: 'Dispute Filed Against You',
    message: 'A dispute has been filed against you in a tournament. Please respond within the deadline.',
    link: `/disputes/${dispute_id}`,
  } as any);
}
