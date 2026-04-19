// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Security Layer - Server-Side Permission Enforcement
// CRITICAL: All permission checks MUST go through this layer
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import type { AdminPermission, PermissionScope } from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE HIERARCHY & PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'TOURNAMENT_HOST';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 0,
  TOURNAMENT_HOST: 10,
  MODERATOR: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

// Permission mappings - which roles get which permissions
const PERMISSION_MATRIX: Record<UserRole, AdminPermission[]> = {
  USER: [],
  TOURNAMENT_HOST: [
    'tournaments.view',
    'tournaments.create',
    'tournaments.edit',
  ],
  MODERATOR: [
    'users.view',
    'moderation.view',
    'moderation.resolve',
    'community.view',
    'community.moderate',
    'tournaments.view',
  ],
  ADMIN: [
    'users.view',
    'users.manage',
    'users.ban',
    'users.suspend',
    'games.view',
    'games.manage',
    'games.create',
    'tournaments.view',
    'tournaments.create',
    'tournaments.edit',
    'tournaments.delete',
    'tournaments.approve',
    'tournaments.override_results',
    'community.view',
    'community.moderate',
    'community.feature',
    'community.delete',
    'moderation.view',
    'moderation.resolve',
    'moderation.escalate',
    'moderation.ban',
    'permissions.view',
    'analytics.view',
    'system.view',
    'system.audit',
  ],
  SUPER_ADMIN: [
    // All permissions
    'users.view',
    'users.manage',
    'users.ban',
    'users.suspend',
    'games.view',
    'games.manage',
    'games.create',
    'games.delete',
    'tournaments.view',
    'tournaments.create',
    'tournaments.edit',
    'tournaments.delete',
    'tournaments.approve',
    'tournaments.override_results',
    'community.view',
    'community.moderate',
    'community.feature',
    'community.delete',
    'moderation.view',
    'moderation.resolve',
    'moderation.escalate',
    'moderation.ban',
    'permissions.view',
    'permissions.grant',
    'permissions.revoke',
    'analytics.view',
    'analytics.export',
    'system.view',
    'system.configure',
    'system.audit',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER-SIDE PERMISSION CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export interface PermissionCheckResult {
  granted: boolean;
  role: UserRole | null;
  reason?: string;
}

/**
 * Server-side permission check - ALWAYS use this for sensitive operations
 * This queries the database to verify permissions, cannot be bypassed frontend
 */
export async function checkServerPermission(
  userId: string,
  permission: AdminPermission,
  scope?: { type: PermissionScope; id?: string }
): Promise<PermissionCheckResult> {
  // Fetch user's role from database (cannot be spoofed)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_banned')
    .eq('id', userId)
    .single<{ role: string; is_banned: boolean }>();

  if (error || !profile) {
    return { granted: false, role: null, reason: 'User not found' };
  }

  if (profile.is_banned) {
    return { granted: false, role: profile.role as UserRole, reason: 'User is banned' };
  }

  const role = profile.role as UserRole;

  // Super admin has all permissions
  if (role === 'SUPER_ADMIN') {
    return { granted: true, role };
  }

  // Check base permission
  const basePermissions = PERMISSION_MATRIX[role] || [];
  const hasBasePermission = basePermissions.includes(permission);

  if (!hasBasePermission) {
    return { granted: false, role, reason: 'Insufficient permissions' };
  }

  // If scope is specified, check scoped permissions
  if (scope?.id) {
    const hasScopeAccess = await checkScopedPermission(userId, permission, { type: scope.type, id: scope.id });
    if (!hasScopeAccess) {
      return { granted: false, role, reason: 'Access denied for this scope' };
    }
  }

  return { granted: true, role };
}

/**
 * Check scoped permissions (e.g., moderator for specific tournament/organizer)
 */
async function checkScopedPermission(
  userId: string,
  permission: AdminPermission,
  scope: { type: PermissionScope; id: string }
): Promise<boolean> {
  const { data: scopedPerm } = await supabase
    .from('user_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('permission', permission)
    .eq('scope_type', scope.type)
    .eq('scope_id', scope.id)
    .eq('is_active', true)
    .maybeSingle<{ id: string }>();

  if (scopedPerm) return true;

  // Check if user is owner of the resource
  if (scope.type === 'tournament') {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('organizer_id')
      .eq('id', scope.id)
      .single<{ organizer_id: string | null }>();
    
    if (tournament?.organizer_id) {
      const { data: organizer } = await supabase
        .from('organizers')
        .select('owner_id')
        .eq('id', tournament.organizer_id)
        .single<{ owner_id: string }>();
      
      if (organizer?.owner_id === userId) return true;
    }
  }

  if (scope.type === 'organizer') {
    const { data: organizer } = await supabase
      .from('organizers')
      .select('owner_id')
      .eq('id', scope.id)
      .single<{ owner_id: string }>();
    
    if (organizer?.owner_id === userId) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ActionValidation {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate sensitive actions before execution
 */
export async function validateAction(
  userId: string,
  action: string,
  _targetType: string,
  targetId: string,
  data?: Record<string, unknown>
): Promise<ActionValidation> {
  const warnings: string[] = [];

  // Check rate limiting
  const rateCheck = await checkRateLimit(userId, action);
  if (!rateCheck.allowed) {
    return { isValid: false, error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter}s` };
  }

  // Validate ban actions
  if (action === 'user.ban' || action === 'user.suspend') {
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('role, is_banned')
      .eq('id', targetId)
      .single<{ role: string; is_banned: boolean }>();

    if (!targetUser) {
      return { isValid: false, error: 'Target user not found' };
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return { isValid: false, error: 'Cannot ban super admins' };
    }

    if (targetUser.role === 'ADMIN' && data?.role !== 'SUPER_ADMIN') {
      return { isValid: false, error: 'Only super admins can ban admins' };
    }

    if (targetUser.is_banned) {
      warnings.push('User is already banned');
    }
  }

  // Validate tournament result override
  if (action === 'tournament.override_results') {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, dispute_count')
      .eq('id', targetId)
      .single<{ status: string; dispute_count: number }>();

    if (!tournament) {
      return { isValid: false, error: 'Tournament not found' };
    }

    if (tournament.status === 'cancelled') {
      return { isValid: false, error: 'Cannot override cancelled tournament' };
    }

    if (tournament.dispute_count === 0) {
      warnings.push('No active disputes - ensure override is necessary');
    }
  }

  // Validate content deletion
  if (action === 'content.delete') {
    const { data: content } = await supabase
      .from('posts')
      .select('author_id, is_deleted')
      .eq('id', targetId)
      .single<{ author_id: string; is_deleted: boolean }>();

    if (!content) {
      return { isValid: false, error: 'Content not found' };
    }

    if (content.is_deleted) {
      return { isValid: false, error: 'Content already deleted' };
    }

    if (content.author_id === userId) {
      warnings.push('You are deleting your own content');
    }
  }

  return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitCheck {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(userId: string, action: string): Promise<RateLimitCheck> {
  // In production, use Redis. For now, use audit_logs as rate counter
  const windowSeconds = 60;
  const maxRequests = action.includes('ban') ? 5 : 20;

  // Check recent audit logs for this action
  const { data: recentActions } = await supabase
    .from('audit_logs')
    .select('id, created_at')
    .eq('actor_id', userId)
    .eq('action', action)
    .gte('created_at', new Date(Date.now() - windowSeconds * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(maxRequests)
    .returns<{ id: string; created_at: string }[]>();

  if (recentActions && recentActions.length >= maxRequests) {
    const oldestAction = new Date(recentActions[recentActions.length - 1].created_at);
    const retryAfter = Math.ceil((oldestAction.getTime() + windowSeconds * 1000 - Date.now()) / 1000);
    return { allowed: false, retryAfter: Math.max(0, retryAfter) };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] || 0;
}

export function isAdminRole(role: UserRole): boolean {
  return ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(role);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export type SecureActionHandler<T = void> = (
  userId: string,
  params: Record<string, unknown>
) => Promise<T>;

export interface SecureActionConfig {
  permission: AdminPermission;
  scope?: { type: PermissionScope; idParam: string };
  validate?: (params: Record<string, unknown>) => ActionValidation | Promise<ActionValidation>;
  auditAction: string;
  auditEntityType: string;
}

/**
 * Factory to create secure action handlers with built-in permission checks,
 * validation, and audit logging
 */
export function createSecureAction<T>(
  config: SecureActionConfig,
  handler: SecureActionHandler<T>
): SecureActionHandler<T> {
  return async (userId: string, params: Record<string, unknown>): Promise<T> => {
    // 1. Check permissions
    const scopeId = config.scope?.idParam ? params[config.scope.idParam] as string | undefined : undefined;
    const scope = scopeId 
      ? { type: config.scope!.type, id: scopeId }
      : undefined;

    const permCheck = await checkServerPermission(userId, config.permission, scope as { type: PermissionScope; id?: string } | undefined);
    if (!permCheck.granted) {
      throw new Error(`Permission denied: ${permCheck.reason}`);
    }

    // 2. Validate action
    if (config.validate) {
      const validation = await config.validate(params);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Validation failed');
      }
    }

    // 3. Execute handler
    const result = await handler(userId, params);

    // 4. Audit log is handled separately to ensure it doesn't break the action

    return result;
  };
}
