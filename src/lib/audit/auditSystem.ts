// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Audit System - Production-Grade Audit Logging
// Immutable, searchable, exportable audit trail for all admin actions
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { checkServerPermission } from '@/lib/security/permissions';
import type { AdminPermission, PermissionScope } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AuditActionCategory = 
  | 'user' | 'game' | 'tournament' | 'community' | 'moderation' 
  | 'permission' | 'system' | 'auth' | 'incident' | 'dispute' | 'fraud';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_email?: string;
  actor_role: string;
  action: string;
  action_category: AuditActionCategory;
  target_id: string | null;
  target_type: string | null;
  target_name?: string | null;
  severity: AuditSeverity;
  
  // Change tracking
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  change_summary: string | null;
  
  // Context
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  
  // Reversibility
  is_reversible: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
}

export interface AuditFilter {
  categories?: AuditActionCategory[];
  severity?: AuditSeverity[];
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  is_reversed?: boolean;
}

export interface AuditStats {
  total_entries: number;
  entries_today: number;
  critical_events: number;
  unique_actors: number;
  top_actions: { action: string; count: number }[];
  severity_distribution: Record<AuditSeverity, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED AUDIT WRITER
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditContext {
  actor_id: string;
  actor_email?: string;
  actor_role: string;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
}

export interface AuditActionConfig {
  action: string;
  category: AuditActionCategory;
  target_id?: string;
  target_type?: string;
  target_name?: string;
  severity?: AuditSeverity;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  is_reversible?: boolean;
}

/**
 * Write an audit log entry - THE ONLY WAY to log admin actions
 * This is the centralized audit function that replaces all duplicate writeAudit functions
 */
export async function writeAudit(
  context: AuditContext,
  config: AuditActionConfig
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Generate change summary if states are provided
    let change_summary: string | null = null;
    if (config.previous_state && config.new_state) {
      change_summary = generateChangeSummary(config.previous_state, config.new_state);
    }

    const entry: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
      actor_id: context.actor_id,
      actor_email: context.actor_email,
      actor_role: context.actor_role,
      action: config.action,
      action_category: config.category,
      target_id: config.target_id ?? null,
      target_type: config.target_type ?? null,
      target_name: config.target_name ?? null,
      severity: config.severity || 'info',
      previous_state: config.previous_state || null,
      new_state: config.new_state || null,
      change_summary,
      reason: config.reason || null,
      metadata: config.metadata || null,
      ip_address: context.ip_address || null,
      user_agent: context.user_agent || null,
      session_id: context.session_id || null,
      is_reversible: config.is_reversible ?? false,
      reversed_at: null,
      reversed_by: null,
      reversal_reason: null,
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(entry as never)
      .select('id')
      .single<{ id: string }>();

    if (error) {
      console.error('[Audit] Failed to write audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('[Audit] Exception writing audit log:', err);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Write audit with automatic state capture
 * Fetches current state before action, logs the change
 */
export async function writeAuditWithStateCapture<T extends Record<string, unknown>>(
  context: AuditContext,
  config: Omit<AuditActionConfig, 'previous_state' | 'new_state'> & {
    table: string;
    target_id: string;
    action_handler: () => Promise<T>;
  }
): Promise<{ success: boolean; result?: T; error?: string }> {
  try {
    // 1. Capture current state
    const { data: previous_state } = await supabase
      .from(config.table)
      .select('*')
      .eq('id', config.target_id)
      .single<Record<string, unknown>>();

    // 2. Execute the action
    const result = await config.action_handler();

    // 3. Write audit log with both states
    await writeAudit(context, {
      action: config.action,
      category: config.category,
      target_id: config.target_id,
      target_type: config.target_type,
      target_name: config.target_name,
      severity: config.severity,
      previous_state: previous_state || undefined,
      new_state: result as Record<string, unknown>,
      reason: config.reason,
      metadata: config.metadata,
      is_reversible: config.is_reversible,
    });

    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Reverse an audit action (for undo functionality)
 */
export async function reverseAuditAction(
  audit_id: string,
  reversed_by: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get the original audit entry
    const { data: entry } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', audit_id)
      .single<AuditLogEntry>();

    if (!entry) {
      return { success: false, error: 'Audit entry not found' };
    }

    if (!entry.is_reversible) {
      return { success: false, error: 'This action cannot be reversed' };
    }

    if (entry.reversed_at) {
      return { success: false, error: 'This action has already been reversed' };
    }

    if (!entry.previous_state) {
      return { success: false, error: 'No previous state to restore' };
    }

    // 2. Restore previous state (implementation depends on target type)
    const restoreResult = await restorePreviousState(entry);
    if (!restoreResult.success) {
      return { success: false, error: restoreResult.error };
    }

    // 3. Mark as reversed
    await supabase
      .from('audit_logs')
      .update({
        reversed_at: new Date().toISOString(),
        reversed_by,
        reversal_reason: reason,
      } as never)
      .eq('id', audit_id);

    // 4. Write reversal audit entry
    const { data: reverser } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', reversed_by)
      .single<{ email: string; role: string }>();

    await writeAudit(
      {
        actor_id: reversed_by,
        actor_email: reverser?.email,
        actor_role: reverser?.role || 'UNKNOWN',
      },
      {
        action: 'audit.reverse',
        category: 'system',
        target_id: audit_id,
        target_type: 'audit_log',
        reason,
        metadata: { original_action: entry.action },
      }
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function queryAuditLogs(
  filter: AuditFilter,
  options: { page?: number; limit?: number } = {}
): Promise<{ entries: AuditLogEntry[]; total: number; error?: string }> {
  const { page = 1, limit = 50 } = options;
  
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filter.categories?.length) {
      query = query.in('action_category', filter.categories);
    }
    if (filter.severity?.length) {
      query = query.in('severity', filter.severity);
    }
    if (filter.actor_id) {
      query = query.eq('actor_id', filter.actor_id);
    }
    if (filter.target_type) {
      query = query.eq('target_type', filter.target_type);
    }
    if (filter.target_id) {
      query = query.eq('target_id', filter.target_id);
    }
    if (filter.action) {
      query = query.eq('action', filter.action);
    }
    if (filter.date_from) {
      query = query.gte('timestamp', filter.date_from);
    }
    if (filter.date_to) {
      query = query.lte('timestamp', filter.date_to);
    }
    if (filter.is_reversed !== undefined) {
      if (filter.is_reversed) {
        query = query.not('reversed_at', 'is', null);
      } else {
        query = query.is('reversed_at', null);
      }
    }
    if (filter.search) {
      query = query.or(`action.ilike.%${filter.search}%,target_name.ilike.%${filter.search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const { data, error, count } = await query
      .order('timestamp', { ascending: false })
      .range(from, from + limit - 1)
      .returns<AuditLogEntry[]>();

    if (error) {
      return { entries: [], total: 0, error: error.message };
    }

    return { entries: data || [], total: count || 0 };
  } catch (_err) {
    return { entries: [], total: 0, error: 'Query failed' };
  }
}

export async function getAuditStats(days = 30): Promise<AuditStats> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data: entries } = await supabase
    .from('audit_logs')
    .select('action, severity, actor_id, timestamp')
    .gte('timestamp', fromDate.toISOString())
    .returns<{ action: string; severity: AuditSeverity; actor_id: string; timestamp: string }[]>();

  if (!entries) {
    return {
      total_entries: 0,
      entries_today: 0,
      critical_events: 0,
      unique_actors: 0,
      top_actions: [],
      severity_distribution: { debug: 0, info: 0, warning: 0, critical: 0 },
    };
  }

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const entriesToday = entries.filter(e => e.timestamp.startsWith(today)).length;
  
  const actionCounts: Record<string, number> = {};
  const severityDist: Record<AuditSeverity, number> = { debug: 0, info: 0, warning: 0, critical: 0 };
  const uniqueActors = new Set<string>();

  entries.forEach(entry => {
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    severityDist[entry.severity]++;
    uniqueActors.add(entry.actor_id);
  });

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  return {
    total_entries: entries.length,
    entries_today: entriesToday,
    critical_events: severityDist.critical,
    unique_actors: uniqueActors.size,
    top_actions: topActions,
    severity_distribution: severityDist,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateChangeSummary(
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): string {
  const changes: string[] = [];
  
  for (const key of Object.keys(current)) {
    if (previous[key] !== current[key]) {
      changes.push(`${key}: ${previous[key]} → ${current[key]}`);
    }
  }
  
  return changes.length > 0 ? changes.join(', ') : 'No changes detected';
}

interface RestoreResult {
  success: boolean;
  error?: string;
}

async function restorePreviousState(entry: AuditLogEntry): Promise<RestoreResult> {
  if (!entry.previous_state || !entry.target_type || !entry.target_id) {
    return { success: false, error: 'Cannot restore: missing state information' };
  }

  try {
    switch (entry.target_type) {
      case 'user':
        await supabase
          .from('profiles')
          .update(entry.previous_state as never)
          .eq('id', entry.target_id);
        break;
      case 'tournament':
        await supabase
          .from('tournaments')
          .update(entry.previous_state as never)
          .eq('id', entry.target_id);
        break;
      case 'post':
        await supabase
          .from('posts')
          .update(entry.previous_state as never)
          .eq('id', entry.target_id);
        break;
      default:
        return { success: false, error: `Cannot restore: unknown target type ${entry.target_type}` };
    }

    return { success: true };
  } catch (_err) {
    return { success: false, error: 'Failed to restore state' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURED ACTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecuredActionConfig {
  permission: AdminPermission;
  scope?: { type: PermissionScope; id?: string };
  audit: Omit<AuditActionConfig, 'previous_state' | 'new_state'> & {
    table: string;
  };
}

/**
 * Execute an action with full security: permission check + audit logging
 */
export async function executeSecuredAction<T extends Record<string, unknown>>(
  userId: string,
  config: SecuredActionConfig,
  action: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
  // 1. Get user context
  const { data: user } = await supabase
    .from('profiles')
    .select('email, role')
    .eq('id', userId)
    .single<{ email: string; role: string }>();

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // 2. Check permissions
  const permCheck = await checkServerPermission(userId, config.permission, config.scope);
  if (!permCheck.granted) {
    return { success: false, error: `Permission denied: ${permCheck.reason}` };
  }

  // 3. Capture state and execute
  const auditResult = await writeAuditWithStateCapture(
    {
      actor_id: userId,
      actor_email: user.email,
      actor_role: user.role,
    },
    {
      ...config.audit,
      table: config.audit.table,
      target_id: config.audit.target_id!,
      action_handler: action,
    }
  );

  return auditResult;
}

/**
 * Backwards-compatible wrapper for writeAudit
 * Supports legacy signature: writeAudit(actor_id, action, target_id, metadata)
 * @deprecated Use writeAudit with new signature instead
 */
export async function writeAuditLegacy(
  actor_id: string,
  action: string,
  target_id: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  return writeAudit(
    { actor_id, actor_role: 'admin' },
    {
      action,
      category: 'system',
      target_id,
      target_type: 'user',
      metadata,
    }
  );
}
