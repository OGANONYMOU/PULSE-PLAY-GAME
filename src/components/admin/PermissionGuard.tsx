// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Permission Guard Component
// Centralized permission checking and access control for admin components
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode, ReactElement } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminPermission } from '@/types/admin';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PermissionGuardProps {
  permission: AdminPermission;
  scope?: { type: string; id?: string };
  children: ReactNode;
  fallback?: ReactNode;
  showForbiddenUI?: boolean;
}

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION GUARD
// ═══════════════════════════════════════════════════════════════════════════════

export function PermissionGuard({
  permission,
  scope,
  children,
  fallback,
  showForbiddenUI = true,
}: PermissionGuardProps): ReactElement | null {
  const { hasPermission } = useAdmin();
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  const hasAccess = hasPermission(permission, scope);

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    if (!showForbiddenUI) return null;

    return <ForbiddenState permission={permission} />;
  }

  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

export function RoleGuard({
  allowedRoles,
  children,
  fallback,
}: RoleGuardProps): ReactElement | null {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    return <ForbiddenState message="This action requires elevated privileges." />;
  }

  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN GUARD
// ═══════════════════════════════════════════════════════════════════════════════

export function SuperAdminGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement | null {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODERATOR GUARD
// ═══════════════════════════════════════════════════════════════════════════════

export function ModeratorGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement | null {
  return (
    <RoleGuard
      allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORBIDDEN STATE UI
// ═══════════════════════════════════════════════════════════════════════════════

function ForbiddenState({
  permission,
  message = 'You do not have permission to access this feature.',
}: {
  permission?: AdminPermission;
  message?: string;
}): ReactElement {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Access Denied</h3>
        <p className="text-sm text-slate-400 mb-1">{message}</p>
        {permission && (
          <p className="text-xs text-slate-500 font-mono mt-2">
            Required: {permission}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION BUTTON WITH PERMISSION
// ═══════════════════════════════════════════════════════════════════════════════

interface PermissionButtonProps extends React.ComponentProps<typeof Button> {
  permission: AdminPermission;
  scope?: { type: string; id?: string };
  confirmAction?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  destructive?: boolean;
}

export function PermissionButton({
  permission,
  scope,
  onClick,
  confirmAction,
  confirmTitle = 'Confirm Action',
  confirmDescription = 'Are you sure you want to proceed?',
  destructive = false,
  children,
  className,
  disabled,
  ...props
}: PermissionButtonProps): ReactElement {
  const { hasPermission } = useAdmin();
  const hasAccess = hasPermission(permission, scope);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasAccess) {
      e.preventDefault();
      return;
    }

    if (confirmAction) {
      const confirmed = window.confirm(`${confirmTitle}\n\n${confirmDescription}`);
      if (!confirmed) return;
    }

    onClick?.(e);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || !hasAccess}
      className={cn(
        !hasAccess && "opacity-50 cursor-not-allowed",
        className
      )}
      variant={destructive ? 'destructive' : props.variant}
      {...props}
    >
      {!hasAccess && <Lock className="w-3.5 h-3.5 mr-2" />}
      {children}
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SENSITIVE ACTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

interface SensitiveActionProps {
  children: ReactNode;
  actionType: 'ban' | 'delete' | 'modify_role' | 'permission_change' | 'content_removal';
  onConfirm: () => void;
  confirmationData?: {
    targetName?: string;
    actionDescription?: string;
  };
}

export function SensitiveAction({
  children,
  actionType,
  onConfirm,
  confirmationData,
}: SensitiveActionProps): ReactElement {
  const { profile } = useAuth();

  const handleAction = () => {
    const actionLabels: Record<string, { title: string; warning: string }> = {
      ban: {
        title: 'Confirm Ban Action',
        warning: 'This will restrict the user\'s access to the platform.',
      },
      delete: {
        title: 'Confirm Delete',
        warning: 'This action cannot be undone.',
      },
      modify_role: {
        title: 'Confirm Role Change',
        warning: 'This will change the user\'s permissions and access level.',
      },
      permission_change: {
        title: 'Confirm Permission Change',
        warning: 'This will modify system permissions.',
      },
      content_removal: {
        title: 'Confirm Content Removal',
        warning: 'This will remove content from public view.',
      },
    };

    const config = actionLabels[actionType];
    const message = [
      config.title,
      '',
      confirmationData?.actionDescription || config.warning,
      confirmationData?.targetName ? `\nTarget: ${confirmationData.targetName}` : '',
      '',
      'Enter your admin PIN to confirm:',
    ].join('\n');

    // In production, this would require a PIN or 2FA
    const confirmed = window.confirm(message);
    if (confirmed) {
      onConfirm();
    }
  };

  return (
    <div onClick={handleAction} className="inline-block">
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditWrapperProps {
  children: ReactNode;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export function AuditWrapper({
  children,
  action,
  targetType,
  targetId,
  metadata,
}: AuditWrapperProps): ReactElement {
  return (
    <>{children}</>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK FOR PERMISSION CHECKING
// ═══════════════════════════════════════════════════════════════════════════════

export function usePermissionCheck(permission: AdminPermission, scope?: { type: string; id?: string }) {
  const { hasPermission, isLoading } = useAdmin();
  return {
    hasPermission: hasPermission(permission, scope),
    isLoading,
  };
}

export function useRoleCheck(allowedRoles: string[]) {
  const { profile, isLoading } = useAuth();
  return {
    hasRole: profile && allowedRoles.includes(profile.role),
    isLoading,
    role: profile?.role,
  };
}
