// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Status Badge Components
// Reusable status indicators for admin interface
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Ban,
  Eye, EyeOff, Lock, Sparkles, Pin,
  AlertCircle, Shield, UserCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// USER STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type UserStatus = 'active' | 'inactive' | 'banned' | 'suspended' | 'muted' | 'verified';

const USER_STATUS_CONFIG: Record<UserStatus, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  active: {
    label: 'Active',
    color: 'bg-green-500/10 text-green-400 border-green-500/30',
    icon: CheckCircle2,
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: Clock,
  },
  banned: {
    label: 'Banned',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    icon: Ban,
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    icon: AlertTriangle,
  },
  muted: {
    label: 'Muted',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    icon: EyeOff,
  },
  verified: {
    label: 'Verified',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    icon: UserCheck,
  },
};

interface UserStatusBadgeProps {
  status: UserStatus;
  className?: string;
  showIcon?: boolean;
}

export function UserStatusBadge({ status, className, showIcon = true }: UserStatusBadgeProps): ReactElement {
  const config = USER_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn('border', config.color, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type ContentStatus = 'active' | 'hidden' | 'deleted' | 'featured' | 'pinned' | 'under_review';

const CONTENT_STATUS_CONFIG: Record<ContentStatus, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  active: {
    label: 'Active',
    color: 'bg-green-500/10 text-green-400 border-green-500/30',
    icon: CheckCircle2,
  },
  hidden: {
    label: 'Hidden',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    icon: EyeOff,
  },
  deleted: {
    label: 'Deleted',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    icon: XCircle,
  },
  featured: {
    label: 'Featured',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    icon: Sparkles,
  },
  pinned: {
    label: 'Pinned',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: Pin,
  },
  under_review: {
    label: 'Under Review',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: Eye,
  },
};

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
  showIcon?: boolean;
}

export function ContentStatusBadge({ status, className, showIcon = true }: ContentStatusBadgeProps): ReactElement {
  const config = CONTENT_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn('border', config.color, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type TournamentStatus = 'draft' | 'registration_open' | 'registration_closed' | 'live' | 'completed' | 'cancelled';

const TOURNAMENT_STATUS_CONFIG: Record<TournamentStatus, {
  label: string;
  color: string;
}> = {
  draft: {
    label: 'Draft',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  },
  registration_open: {
    label: 'Registration Open',
    color: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
  registration_closed: {
    label: 'Registration Closed',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  live: {
    label: 'Live',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse',
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
};

interface TournamentStatusBadgeProps {
  status: TournamentStatus;
  className?: string;
}

export function TournamentStatusBadge({ status, className }: TournamentStatusBadgeProps): ReactElement {
  const config = TOURNAMENT_STATUS_CONFIG[status];

  return (
    <Badge className={cn('border', config.color, className)}>
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIORITY BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  color: string;
}> = {
  low: {
    label: 'Low',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  },
  medium: {
    label: 'Medium',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  high: {
    label: 'High',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
  urgent: {
    label: 'Urgent',
    color: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse',
  },
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps): ReactElement {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge className={cn('border', config.color, className)}>
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEVERITY BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type Severity = 'info' | 'warning' | 'error' | 'critical';

const SEVERITY_CONFIG: Record<Severity, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  info: {
    label: 'Info',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: AlertCircle,
  },
  warning: {
    label: 'Warning',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    icon: AlertTriangle,
  },
  error: {
    label: 'Error',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    icon: AlertCircle,
  },
  critical: {
    label: 'Critical',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    icon: AlertCircle,
  },
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({ severity, className, showIcon = true }: SeverityBadgeProps): ReactElement {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <Badge className={cn('border', config.color, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type UserRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'TOURNAMENT_HOST';

const ROLE_CONFIG: Record<UserRole, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  USER: {
    label: 'User',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: UserCheck,
  },
  MODERATOR: {
    label: 'Moderator',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    icon: Shield,
  },
  ADMIN: {
    label: 'Admin',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: Shield,
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    icon: Lock,
  },
  TOURNAMENT_HOST: {
    label: 'Host',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    icon: UserCheck,
  },
};

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
  showIcon?: boolean;
}

export function RoleBadge({ role, className, showIcon = true }: RoleBadgeProps): ReactElement {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <Badge className={cn('border', config.color, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK LEVEL BADGE
// ═══════════════════════════════════════════════════════════════════════════════

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  color: string;
  scoreRange: string;
}> = {
  low: {
    label: 'Low Risk',
    color: 'bg-green-500/10 text-green-400 border-green-500/30',
    scoreRange: '0-30',
  },
  medium: {
    label: 'Medium Risk',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    scoreRange: '30-60',
  },
  high: {
    label: 'High Risk',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    scoreRange: '60-80',
  },
  critical: {
    label: 'Critical Risk',
    color: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse',
    scoreRange: '80-100',
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showScore?: boolean;
}

export function RiskBadge({ level, className, showScore = false }: RiskBadgeProps): ReactElement {
  const config = RISK_CONFIG[level];

  return (
    <Badge className={cn('border', config.color, className)}>
      {config.label}
      {showScore && (
        <span className="ml-1 opacity-60">({config.scoreRange})</span>
      )}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAMER CRED SCORE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

interface GamerCredDisplayProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GamerCredDisplay({ score, showLabel = true, size = 'md' }: GamerCredDisplayProps): ReactElement {
  const getColor = (s: number): string => {
    if (s >= 80) return 'text-purple-400';
    if (s >= 60) return 'text-cyan-400';
    if (s >= 40) return 'text-blue-400';
    if (s >= 20) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getLabel = (s: number): string => {
    if (s >= 80) return 'Legendary';
    if (s >= 60) return 'Elite';
    if (s >= 40) return 'Pro';
    if (s >= 20) return 'Rising';
    return 'Novice';
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-bold font-mono", getColor(score), sizeClasses[size])}>
        {score}
      </span>
      {showLabel && (
        <span className={cn("text-xs text-slate-500", size === 'sm' && 'text-[10px]')}>
          {getLabel(score)} Cred
        </span>
      )}
    </div>
  );
}
