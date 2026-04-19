// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Incident System - Real-Time Operations Center
// Auto-triggered incidents, SLA tracking, escalation rules
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { checkServerPermission } from '@/lib/security';
import type { AdminPermission } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type IncidentType = 
  | 'report_spike' 
  | 'dispute_spike' 
  | 'suspicious_activity' 
  | 'failed_action' 
  | 'moderation_backlog' 
  | 'no_show_spike' 
  | 'system_health' 
  | 'security_alert' 
  | 'fraud_detected';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'escalated';

export interface IncidentEntity {
  type: 'tournament' | 'user' | 'match' | 'dispute' | 'moderation_case';
  id: string;
  name?: string;
}

export interface IncidentMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
}

export interface Incident {
  id: string;
  incident_number: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  
  affected_entities: IncidentEntity[];
  metrics: IncidentMetric[];
  
  assigned_to: string | null;
  assigned_username: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  
  sla_deadline: string;
  auto_response_triggered: boolean;
  auto_response_action?: string;
  
  created_at: string;
  updated_at: string;
}

export interface IncidentFilter {
  type?: IncidentType[];
  severity?: IncidentSeverity[];
  status?: IncidentStatus[];
  assigned_to?: string | 'unassigned';
  created_after?: string;
  created_before?: string;
  due_soon?: boolean;
  overdue?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENT CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new incident (can be auto or manual)
 */
export async function createIncident(
  params: {
    type: IncidentType;
    severity: IncidentSeverity;
    title: string;
    description: string;
    affected_entities: IncidentEntity[];
    metrics?: IncidentMetric[];
    auto_response?: boolean;
  },
  _created_by: string
): Promise<{ success: boolean; incident?: Incident; error?: string }> {
  try {
    // Generate incident number
    const incident_number = await generateIncidentNumber();
    
    // Calculate SLA deadline based on severity
    const sla_deadline = calculateSLADeadline(params.severity);
    
    // Check for auto-response triggers
    let auto_response_triggered = false;
    let auto_response_action: string | undefined;
    
    if (params.auto_response) {
      const autoResponse = await evaluateAutoResponse(params);
      auto_response_triggered = autoResponse.triggered;
      auto_response_action = autoResponse.action;
    }
    
    // Create incident
    const { data: incident, error } = await supabase
      .from('incidents')
      .insert({
        incident_number,
        type: params.type,
        severity: params.severity,
        status: 'new',
        title: params.title,
        description: params.description,
        affected_entities: params.affected_entities,
        metrics: params.metrics || [],
        assigned_to: null,
        assigned_username: null,
        acknowledged_by: null,
        acknowledged_at: null,
        resolved_by: null,
        resolved_at: null,
        sla_deadline,
        auto_response_triggered,
        auto_response_action,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .select()
      .single<Incident>();
    
    if (error || !incident) {
      return { success: false, error: error?.message || 'Failed to create incident' };
    }
    
    // Execute auto-response if triggered
    if (auto_response_triggered && auto_response_action) {
      await executeAutoResponse(incident.id, auto_response_action, params.affected_entities);
    }
    
    // Notify admins for critical incidents
    if (params.severity === 'critical' || params.severity === 'high') {
      await notifyAdmins(incident);
    }
    
    return { success: true, incident };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Acknowledge incident
 */
export async function acknowledgeIncident(
  incident_id: string,
  acknowledged_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: _user } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', acknowledged_by)
      .single<{ username: string }>();
    
    const { error } = await supabase
      .from('incidents')
      .update({
        status: 'acknowledged',
        acknowledged_by,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', incident_id);
    
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
 * Assign incident to staff
 */
export async function assignIncident(
  incident_id: string,
  assigned_to: string,
  assigned_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permission
    const permCheck = await checkServerPermission(assigned_by, 'system.audit' as AdminPermission);
    if (!permCheck.granted) {
      return { success: false, error: 'Permission denied' };
    }
    
    const { data: assignee } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', assigned_to)
      .single<{ username: string; role: string }>();
    
    if (!assignee) {
      return { success: false, error: 'Assignee not found' };
    }
    
    const { error } = await supabase
      .from('incidents')
      .update({
        assigned_to,
        assigned_username: assignee.username,
        status: 'investigating',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', incident_id);
    
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
 * Resolve incident
 */
export async function resolveIncident(
  incident_id: string,
  resolution_notes: string,
  resolved_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('incidents')
      .update({
        status: 'resolved',
        resolved_by,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', incident_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Add resolution note
    await addIncidentNote(incident_id, resolved_by, `Resolution: ${resolution_notes}`, true);
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Escalate incident (requires higher authority)
 */
export async function escalateIncident(
  incident_id: string,
  reason: string,
  escalated_by: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only admins can escalate
    const permCheck = await checkServerPermission(escalated_by, 'system.configure' as AdminPermission);
    if (!permCheck.granted) {
      return { success: false, error: 'Only admins can escalate incidents' };
    }
    
    const { error } = await supabase
      .from('incidents')
      .update({
        status: 'escalated',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', incident_id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    await addIncidentNote(incident_id, escalated_by, `Escalated: ${reason}`, true);
    
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENT MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for incidents that need auto-creation
 * Call this periodically or via triggers
 */
export async function monitorForAutoIncidents(): Promise<void> {
  // Check for report spikes
  await checkReportSpike();
  
  // Check for dispute spikes
  await checkDisputeSpike();
  
  // Check for no-show spikes
  await checkNoShowSpike();
  
  // Check for suspicious match patterns
  await checkSuspiciousMatches();
}

async function checkReportSpike(): Promise<void> {
  const { data: recentReports } = await supabase
    .from('moderation_cases')
    .select('id')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())  // Last hour
    .limit(20);
  
  if (recentReports && recentReports.length >= 15) {
    await createIncident({
      type: 'report_spike',
      severity: 'high',
      title: 'Report Submission Spike Detected',
      description: `${recentReports.length} reports submitted in the last hour.`,
      affected_entities: [],
      metrics: [{
        name: 'reports_per_hour',
        value: recentReports.length,
        threshold: 15,
        unit: 'reports',
      }],
      auto_response: true,
    }, 'system');
  }
}

async function checkDisputeSpike(): Promise<void> {
  const { data: recentDisputes } = await supabase
    .from('disputes')
    .select('id, tournament_id')
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())  // Last 24h
    .limit(10);
  
  if (recentDisputes && recentDisputes.length >= 5) {
    await createIncident({
      type: 'dispute_spike',
      severity: 'high',
      title: 'Dispute Spike Detected',
      description: `${recentDisputes.length} disputes filed in the last 24 hours.`,
      affected_entities: (recentDisputes as { tournament_id: string }[]).map(d => ({ type: 'tournament', id: d.tournament_id })),
      auto_response: true,
    }, 'system');
  }
}

async function checkNoShowSpike(): Promise<void> {
  // Implementation would check tournament participants for no-shows
}

async function checkSuspiciousMatches(): Promise<void> {
  // Implementation would check for abnormal patterns
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RESPONSE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

interface AutoResponseResult {
  triggered: boolean;
  action?: string;
}

async function evaluateAutoResponse(params: {
  type: IncidentType;
  severity: IncidentSeverity;
  affected_entities: IncidentEntity[];
}): Promise<AutoResponseResult> {
  // Define auto-response rules
  switch (params.type) {
    case 'report_spike':
      if (params.severity === 'critical') {
        return {
          triggered: true,
          action: 'enable_additional_moderators',
        };
      }
      break;
      
    case 'fraud_detected':
      return {
        triggered: true,
        action: 'flag_for_investigation',
      };
      
    case 'security_alert':
      return {
        triggered: true,
        action: 'lock_affected_accounts',
      };
  }
  
  return { triggered: false };
}

async function executeAutoResponse(
  _incident_id: string,
  action: string,
  entities: IncidentEntity[]
): Promise<void> {
  switch (action) {
    case 'enable_additional_moderators':
      // Could trigger a notification to all available moderators
      break;
      
    case 'flag_for_investigation':
      // Could auto-create a fraud flag
      break;
      
    case 'lock_affected_accounts':
      // Could temporarily lock accounts pending investigation
      for (const entity of entities.filter(e => e.type === 'user')) {
        await supabase
          .from('profiles')
          .update({ is_locked: true, locked_reason: 'Security incident' } as never)
          .eq('id', entity.id);
      }
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function generateIncidentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('incidents')
    .select('incident_number')
    .ilike('incident_number', `INC-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ incident_number: string }>();
  
  let sequence = 1;
  if (data?.incident_number) {
    const match = data.incident_number.match(/INC-\d{4}-(\d+)/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }
  
  return `INC-${year}-${sequence.toString().padStart(4, '0')}`;
}

function calculateSLADeadline(severity: IncidentSeverity): string {
  const hours = {
    low: 48,
    medium: 24,
    high: 4,
    critical: 1,
  };
  
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours[severity]);
  return deadline.toISOString();
}

async function addIncidentNote(
  incident_id: string,
  author_id: string,
  content: string,
  is_system: boolean = false
): Promise<void> {
  const { data: author } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', author_id)
    .single<{ username: string }>();
  
  await supabase
    .from('incident_notes')
    .insert({
      incident_id,
      author_id,
      author_username: author?.username || 'System',
      content,
      is_system_generated: is_system,
    } as never);
}

async function notifyAdmins(incident: Incident): Promise<void> {
  // Get all admin/moderator users
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['ADMIN', 'SUPER_ADMIN', 'MODERATOR']);
  
  if (!admins) return;
  
  for (const admin of admins as { id: string }[]) {
    await supabase.rpc('create_notification', {
      user_id: admin.id,
      type: 'critical_incident',
      title: `Critical Incident: ${incident.title}`,
      message: incident.description,
      link: `/admin/incidents/${incident.id}`,
    } as any);
  }
}
