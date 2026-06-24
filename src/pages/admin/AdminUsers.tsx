// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Advanced User Management
// Professional esports user management with risk scoring and trust analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Search, Filter, Crown, Shield,
  Ban, UserCheck, AlertTriangle, CheckCircle2,
  Flag, CheckSquare, Square,
  AlertOctagon,
  ChevronDown,
  RefreshCw, Download,
  Lock, Unlock, UserMinus, UserPlus,
  Calendar,
  Loader2,
  Skull, Star, Mail, Trash2, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PRIMARY_ADMIN_EMAIL = (import.meta.env.VITE_PRIMARY_ADMIN_EMAIL as string | undefined) ?? '';
type Role = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UserRiskProfile {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  warnings: number;
  mutes: number;
  bans: number;
  lastReviewed: string | null;
  reviewerNotes: string;
}

interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface UserDevice {
  id: string;
  type: 'mobile' | 'desktop' | 'tablet';
  os: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  isTrusted: boolean;
}

interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  isBanned: boolean;
  isMuted: boolean;
  mutedUntil: string | null;
  isSuspended: boolean;
  suspendedUntil: string | null;
  status: 'active' | 'inactive' | 'restricted';
  gamercred: number;
  trustScore: number;
  verified: boolean;
  createdAt: string;
  lastActive: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  location: string | null;
  discordUsername: string | null;
  twitterUsername: string | null;
  tournamentCount: number;
  postCount: number;
  clipCount: number;
  reportCount: number;
  riskProfile: UserRiskProfile;
  devices: UserDevice[];
}

interface UserFilters {
  role: string;
  status: 'all' | 'active' | 'inactive' | 'banned' | 'muted' | 'suspended';
  riskLevel: 'all' | 'low' | 'medium' | 'high' | 'critical';
  sortBy: 'created_desc' | 'created_asc' | 'last_active' | 'gamercred_high' | 'gamercred_low' | 'risk_high';
  minGamerCred: number;
  maxGamerCred: number;
  verifiedOnly: boolean;
  flaggedOnly: boolean;
  repeatOffenders: boolean;
  withDisputes: boolean;
  lastActiveDays: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK SCORING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function calculateRiskLevel(score: number): UserRiskProfile['level'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function getRiskColor(level: UserRiskProfile['level']): string {
  switch (level) {
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    default: return 'text-green-500 bg-green-500/10 border-green-500/30';
  }
}

function getTrustScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  if (score >= 30) return 'text-orange-500';
  return 'text-red-500';
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function RolePill({ role }: { role: Role }) {
  const cls = role === 'ADMIN' || role === 'SUPER_ADMIN'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : role === 'MODERATOR'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${cls}`}>{role}</span>;
}

function RiskBadge({ score, level }: { score: number; level: UserRiskProfile['level'] }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium",
      getRiskColor(level)
    )}>
      {level === 'critical' && <Skull className="w-3 h-3" />}
      {level === 'high' && <AlertTriangle className="w-3 h-3" />}
      {level === 'medium' && <AlertOctagon className="w-3 h-3" />}
      {level === 'low' && <Shield className="w-3 h-3" />}
      Risk {score}
    </div>
  );
}

function TrustScoreBadge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-3 h-3",
              star <= Math.ceil(score / 20) ? getTrustScoreColor(score) : "text-slate-600"
            )}
            fill={star <= Math.ceil(score / 20) ? "currentColor" : "none"}
          />
        ))}
      </div>
      <span className={cn("text-xs font-medium", getTrustScoreColor(score))}>
        {score}/100
      </span>
    </div>
  );
}

function UserAvatar({ user, size = 'md' }: { user: ExtendedUser; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };
  
  return (
    <div className="relative">
      <Avatar className={cn(sizes[size], "border-2", user.verified ? "border-cyan-500" : "border-slate-700")}>
        <AvatarImage src={user.avatarUrl || ''} />
        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-bold">
          {user.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {user.verified && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function FilterPanel({ 
  filters, 
  onChange,
  isOpen,
}: { 
  filters: UserFilters; 
  onChange: (filters: UserFilters) => void;
  isOpen: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-slate-800"
        >
          <div className="p-4 space-y-4 bg-slate-900/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Role</label>
                <Select value={filters.role} onValueChange={(v) => onChange({ ...filters, role: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="MODERATOR">Moderator</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Status</label>
                <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v as UserFilters['status'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="muted">Muted</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Risk Level</label>
                <Select value={filters.riskLevel} onValueChange={(v) => onChange({ ...filters, riskLevel: v as UserFilters['riskLevel'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(v) => onChange({ ...filters, sortBy: v as UserFilters['sortBy'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="created_desc">Newest First</SelectItem>
                    <SelectItem value="created_asc">Oldest First</SelectItem>
                    <SelectItem value="last_active">Last Active</SelectItem>
                    <SelectItem value="gamercred_high">Highest GamerCred</SelectItem>
                    <SelectItem value="gamercred_low">Lowest GamerCred</SelectItem>
                    <SelectItem value="risk_high">Highest Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">
                GamerCred Range: {filters.minGamerCred} - {filters.maxGamerCred}
              </label>
              <Slider
                value={[filters.minGamerCred, filters.maxGamerCred]}
                onValueChange={([min, max]) => onChange({ ...filters, minGamerCred: min, maxGamerCred: max })}
                max={1000}
                step={10}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant={filters.verifiedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
                className={filters.verifiedOnly ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : ''}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Verified Only
              </Button>
              <Button
                variant={filters.flaggedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ ...filters, flaggedOnly: !filters.flaggedOnly })}
                className={filters.flaggedOnly ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}
              >
                <Flag className="w-4 h-4 mr-1" />
                Flagged Users
              </Button>
              <Button
                variant={filters.repeatOffenders ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ ...filters, repeatOffenders: !filters.repeatOffenders })}
                className={filters.repeatOffenders ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
              >
                <Skull className="w-4 h-4 mr-1" />
                Repeat Offenders
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  user,
  action,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; duration?: number; durationUnit?: 'hours' | 'days' | 'weeks' }) => void;
  user: ExtendedUser | null;
  action: string;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(24);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days' | 'weeks'>('hours');

  if (!user) return null;

  const actionConfig: Record<string, { title: string; color: string; icon: React.ElementType; description: string }> = {
    ban: { title: 'Ban User', color: 'text-red-400', icon: Ban, description: 'This will prevent the user from accessing the platform. All their content will remain but they cannot log in.' },
    unban: { title: 'Unban User', color: 'text-green-400', icon: UserCheck, description: 'Restore full access to the platform.' },
    mute: { title: 'Mute User', color: 'text-yellow-400', icon: Lock, description: 'Prevent the user from posting, commenting, or chatting for the specified duration.' },
    unmute: { title: 'Unmute User', color: 'text-green-400', icon: Unlock, description: 'Restore posting and commenting privileges.' },
    suspend: { title: 'Suspend Account', color: 'text-orange-400', icon: UserMinus, description: 'Temporarily disable the account. The user will be logged out and cannot access any features.' },
    unsuspend: { title: 'Unsuspend Account', color: 'text-green-400', icon: UserPlus, description: 'Restore full account access.' },
    warn: { title: 'Issue Warning', color: 'text-yellow-400', icon: AlertTriangle, description: 'Send a formal warning to the user. This will be recorded in their moderation history.' },
  };

  const config = actionConfig[action] || actionConfig.ban;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass border-border/50 max-w-md bg-slate-950">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2 font-orbitron", config.color)}>
            <config.icon className="w-5 h-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-sm text-slate-500">Target User</p>
            <p className="font-medium text-white">{user.username}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>

          {(action === 'mute' || action === 'suspend') && (
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Duration</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDuration(parseInt(e.target.value))}
                  className="bg-slate-800 border-slate-700 w-24"
                />
                <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as typeof durationUnit)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Reason {action !== 'unban' && action !== 'unmute' && action !== 'unsuspend' && <span className="text-red-400">*</span>}</label>
            <Textarea
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Enter the reason for this action..."
              className="bg-slate-800 border-slate-700 min-h-[100px]"
            />
            <p className="text-xs text-slate-500">This will be logged in the audit trail and may be visible to the user.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ reason, duration, durationUnit })}
            disabled={isLoading || (!reason && action !== 'unban' && action !== 'unmute' && action !== 'unsuspend')}
            className={cn(
              config.color.includes('red') && "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30",
              config.color.includes('yellow') && "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30",
              config.color.includes('green') && "bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30",
              config.color.includes('orange') && "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-orange-500/30",
            )}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminUsers(): React.ReactElement {
  const { profile: self, hasPermission } = useAdmin();
  
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
    riskLevel: 'all',
    sortBy: 'created_desc',
    minGamerCred: 0,
    maxGamerCred: 1000,
    verifiedOnly: false,
    flaggedOnly: false,
    repeatOffenders: false,
    withDisputes: false,
    lastActiveDays: 30,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ open: boolean; action: string; user: ExtendedUser | null }>({ open: false, action: '', user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExtendedUser | null>(null);

  const isSuper = self?.role === 'ADMIN' || self?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedUsers: ExtendedUser[] = (profiles || []).map((profile: Record<string, unknown>) => {
        let riskScore = 0;
        const riskFactors: RiskFactor[] = [];

        const isBanned = profile.is_banned as boolean;
        const isMuted = profile.is_muted as boolean;
        const isSuspended = profile.is_suspended as boolean;

        if (isBanned) {
          riskScore += 50;
          riskFactors.push({ type: 'ban_history', severity: 'high', description: 'Previously banned from platform' });
        }
        if (isMuted) {
          riskScore += 20;
          riskFactors.push({ type: 'mute_history', severity: 'medium', description: 'Currently muted' });
        }

        const gamercred = profile.gamercred as number || 0;
        if (gamercred < 50) {
          riskScore += 10;
          riskFactors.push({ type: 'low_cred', severity: 'low', description: 'Low GamerCred score' });
        }

        const lastActive = new Date((profile.last_active as string) || profile.created_at as string);
        const daysInactive = differenceInDays(new Date(), lastActive);
        if (daysInactive > 30) {
          riskScore += 5;
          riskFactors.push({ type: 'inactive', severity: 'low', description: `Inactive for ${daysInactive} days` });
        }

        const createdAt = new Date(profile.created_at as string);
        const daysSinceCreation = differenceInDays(new Date(), createdAt);
        if (daysSinceCreation < 7) {
          riskScore += 15;
          riskFactors.push({ type: 'new_account', severity: 'medium', description: 'Account created recently' });
        }

        const trustScore = Math.max(0, Math.min(100, 100 - riskScore + (gamercred / 20)));

        return {
          id: profile.id as string,
          username: profile.username as string,
          email: profile.email as string,
          role: profile.role as Role,
          isBanned,
          isMuted,
          mutedUntil: profile.muted_until as string | null,
          isSuspended,
          suspendedUntil: profile.suspended_until as string | null,
          status: isBanned ? 'inactive' : isSuspended ? 'restricted' : isMuted ? 'restricted' : 'active',
          gamercred,
          trustScore: Math.round(trustScore),
          verified: profile.verified as boolean || false,
          createdAt: profile.created_at as string,
          lastActive: profile.last_active as string || profile.created_at as string,
          avatarUrl: profile.avatar_url as string | null,
          bannerUrl: profile.banner_url as string | null,
          firstName: profile.first_name as string | null,
          lastName: profile.last_name as string | null,
          phone: profile.phone as string | null,
          bio: profile.bio as string | null,
          location: profile.location as string | null,
          discordUsername: profile.discord_username as string | null,
          twitterUsername: profile.twitter_username as string | null,
          tournamentCount: 0,
          postCount: 0,
          clipCount: 0,
          reportCount: 0,
          riskProfile: {
            score: riskScore,
            level: calculateRiskLevel(riskScore),
            factors: riskFactors,
            warnings: 0,
            mutes: isMuted ? 1 : 0,
            bans: isBanned ? 1 : 0,
            lastReviewed: null,
            reviewerNotes: '',
          },
          devices: [],
        };
      });

      setUsers(enrichedUsers);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const result = users.filter(user => {
      if (search) {
        const q = search.toLowerCase();
        const matches = 
          user.username.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q) ||
          (user.firstName?.toLowerCase() || '').includes(q) ||
          (user.lastName?.toLowerCase() || '').includes(q);
        if (!matches) return false;
      }

      if (filters.role !== 'all' && user.role !== filters.role) return false;
      if (filters.status !== 'all') {
        if (filters.status === 'banned' && !user.isBanned) return false;
        if (filters.status === 'muted' && !user.isMuted) return false;
        if (filters.status === 'suspended' && !user.isSuspended) return false;
        if (filters.status === 'active' && (user.isBanned || user.isSuspended)) return false;
        if (filters.status === 'inactive' && !user.isBanned && differenceInDays(new Date(), new Date(user.lastActive)) < 30) return false;
      }
      if (filters.riskLevel !== 'all' && user.riskProfile.level !== filters.riskLevel) return false;
      if (user.gamercred < filters.minGamerCred || user.gamercred > filters.maxGamerCred) return false;
      if (filters.verifiedOnly && !user.verified) return false;
      if (filters.repeatOffenders && user.riskProfile.bans === 0 && user.riskProfile.mutes === 0) return false;

      return true;
    });

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'created_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'created_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'last_active':
          return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
        case 'gamercred_high':
          return b.gamercred - a.gamercred;
        case 'gamercred_low':
          return a.gamercred - b.gamercred;
        case 'risk_high':
          return b.riskProfile.score - a.riskProfile.score;
        default:
          return 0;
      }
    });

    return result;
  }, [users, search, filters]);

  const stats = useMemo(() => ({
    total: users.length,
    online: users.filter(u => differenceInDays(new Date(), new Date(u.lastActive)) === 0).length,
    banned: users.filter(u => u.isBanned).length,
    muted: users.filter(u => u.isMuted).length,
    newToday: users.filter(u => differenceInDays(new Date(), new Date(u.createdAt)) === 0).length,
    highRisk: users.filter(u => u.riskProfile.level === 'high' || u.riskProfile.level === 'critical').length,
  }), [users]);

  const handleAction = async (action: string, user: ExtendedUser, data?: { reason: string; duration?: number; durationUnit?: 'hours' | 'days' | 'weeks' }) => {
    setActionLoading(true);
    try {
      const updates: Record<string, unknown> = {};
      
      switch (action) {
        case 'ban':
          updates.is_banned = true;
          updates.ban_reason = data?.reason;
          break;
        case 'unban':
          updates.is_banned = false;
          updates.ban_reason = null;
          break;
        case 'mute':
          updates.is_muted = true;
          if (data?.duration) {
            const multiplier = data.durationUnit === 'hours' ? 1 : data.durationUnit === 'days' ? 24 : 24 * 7;
            const hours = data.duration * multiplier;
            updates.muted_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
          }
          break;
        case 'unmute':
          updates.is_muted = false;
          updates.muted_until = null;
          break;
        case 'suspend':
          updates.is_suspended = true;
          if (data?.duration) {
            const multiplier = data.durationUnit === 'hours' ? 1 : data.durationUnit === 'days' ? 24 : 24 * 7;
            const hours = data.duration * multiplier;
            updates.suspended_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
          }
          break;
        case 'unsuspend':
          updates.is_suspended = false;
          updates.suspended_until = null;
          break;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', user.id);

      if (error) throw error;

      await writeAudit({ actor_id: self?.id || '', actor_role: self?.role || 'admin' }, { action: `user.${action}`, category: 'user', target_id: user.id, target_type: 'user', metadata: { reason: data?.reason, username: user.username } });

      toast.success(`User ${action.replace('_', ' ')}ed successfully`);
      load();
    } catch (err) { console.error(err); toast.error('Action failed');
    } finally {
      setActionLoading(false);
      setActionModal({ open: false, action: '', user: null });
    }
  };

  const changeRole = async (user: ExtendedUser, role: Role) => {
    if (user.email === PRIMARY_ADMIN_EMAIL) { toast.error('Cannot change primary admin.'); return; }
    if (!isSuper) { toast.error('Only super-admins can change roles.'); return; }
    const { error } = await supabase.from('profiles').update({ role } as never).eq('id', user.id);
    if (error) { toast.error('Failed: ' + error.message); return; }
    await writeAudit({ actor_id: self?.id || '', actor_role: self?.role || 'admin' }, { action: 'change_role', category: 'user', target_id: user.id, target_type: 'user', metadata: { from: user.role, to: role, username: user.username } });
    toast.success(`${user.username} → ${role}`);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !self) return;
    if (!isSuper) { toast.error('Super-admin only.'); return; }
    setActionLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    if (error) { toast.error('Failed: ' + error.message); setActionLoading(false); return; }
    await writeAudit({ actor_id: self.id, actor_role: self.role || 'admin' }, { action: 'delete_user', category: 'user', target_id: deleteTarget.id, target_type: 'user', metadata: { username: deleteTarget.username } });
    toast.success(`${deleteTarget.username} deleted.`);
    load();
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const toggleAllSelection = () => {
    if (selectedUsers.size === filtered.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filtered.map(u => u.id)));
  };

  const handleBulkAction = async (action: 'ban' | 'unban') => {
    if (selectedUsers.size === 0) return;
    if (!hasPermission('users.ban')) {
      toast.error('Insufficient permissions');
      return;
    }
    
    setIsBulkLoading(true);
    try {
      const updates = {
        is_banned: action === 'ban',
        ban_reason: action === 'ban' ? 'Bulk action by admin' : null
      };

      const ids = Array.from(selectedUsers);
      const { error } = await supabase
        .from('profiles')
        .update(updates as never)
        .in('id', ids);

      if (error) throw error;

      await writeAudit(
        { actor_id: self?.id || '', actor_role: self?.role || 'admin' },
        { action: `user.bulk_${action}`, category: 'user', target_id: ids[0], target_type: 'bulk_users', metadata: { count: ids.length } }
      );

      toast.success(`${ids.length} users ${action === 'ban' ? 'banned' : 'unbanned'}`);
      setSelectedUsers(new Set());
      load();
    } catch (err) {
      console.error(err);
      toast.error(`Bulk ${action} failed`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div className="p-5 sm:p-7 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-orbitron text-2xl font-black text-white mb-1">User Management</h1>
            <p className="text-white/35 text-sm">
              {stats.total} total · {stats.online} online · {stats.banned} banned · {stats.highRisk} high risk
            </p>
          </motion.div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
              <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold text-white">{stats.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Online Now</p>
              <p className="text-xl font-bold text-green-400">{stats.online}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">New Today</p>
              <p className="text-xl font-bold text-cyan-400">+{stats.newToday}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Banned</p>
              <p className="text-xl font-bold text-red-400">{stats.banned}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Muted</p>
              <p className="text-xl font-bold text-yellow-400">{stats.muted}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">High Risk</p>
              <p className="text-xl font-bold text-orange-400">{stats.highRisk}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search by username, email, or name..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'h-9'}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        <FilterPanel
          filters={filters}
          onChange={setFilters}
          isOpen={showFilters}
        />
      </div>

      {/* Results Count & Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400">
            Showing {filtered.length} of {users.length} users
          </p>
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs font-semibold text-white">{selectedUsers.size} selected</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20" onClick={() => handleBulkAction('ban')} disabled={isBulkLoading}>
                Bulk Ban
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/20" onClick={() => handleBulkAction('unban')} disabled={isBulkLoading}>
                Bulk Unban
              </Button>
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" className="text-slate-400" onClick={toggleAllSelection}>
          {selectedUsers.size === filtered.length && filtered.length > 0 ? (
            <><CheckSquare className="w-4 h-4 mr-2" /> Deselect All</>
          ) : (
            <><Square className="w-4 h-4 mr-2" /> Select All</>
          )}
        </Button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : fetchError ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-red-400 text-sm mb-3">{fetchError}</p>
          <Button onClick={load} variant="outline" size="sm">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No users found matching your criteria</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setFilters({ ...filters, role: 'all', status: 'all', riskLevel: 'all' }); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user, i) => {
            const isPrimary = user.email === PRIMARY_ADMIN_EMAIL;
            const isSelf = self?.id === user.id;
            const isExpanded = expandedId === user.id;

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  "rounded-2xl border overflow-hidden transition-all",
                  user.isBanned ? 'bg-red-500/5 border-red-500/15' : 'bg-white/4 border-white/8 hover:border-white/14',
                  user.riskProfile.level === 'critical' && "border-orange-500/30"
                )}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="flex items-center justify-center cursor-pointer p-1" onClick={() => toggleSelection(user.id)}>
                    {selectedUsers.has(user.id) ? (
                      <CheckSquare className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                    )}
                  </div>
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-orbitron font-bold text-sm text-white truncate">{user.username}</span>
                      {isPrimary && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                      {isSelf && <span className="text-[10px] text-white/25">(you)</span>}
                      <RolePill role={user.role} />
                      {user.isBanned && <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/30 h-4">BANNED</Badge>}
                      {user.isMuted && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30 h-4">MUTED</Badge>}
                    </div>
                    <p className="text-[10px] text-white/25 truncate font-mono">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <RiskBadge score={user.riskProfile.score} level={user.riskProfile.level} />
                      <TrustScoreBadge score={user.trustScore} />
                    </div>
                  </div>
                  <div className="text-[10px] text-white/20 hidden sm:block font-mono flex-shrink-0">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/35 hover:text-white transition-all flex-shrink-0"
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/8 px-4 pb-4 pt-3">
                    {isPrimary ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
                        <Shield className="w-3.5 h-3.5" />Protected primary admin — cannot be modified
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-3 text-[10px] text-white/30 font-mono w-full mb-2">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>
                          {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
                        </div>

                        {isSuper && !isSelf && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-white/40">Role:</span>
                            <Select value={user.role} onValueChange={(v) => changeRole(user, v as Role)}>
                              <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-white/10">
                                <SelectItem value="USER" className="text-white text-xs">User</SelectItem>
                                <SelectItem value="MODERATOR" className="text-white text-xs">Moderator</SelectItem>
                                <SelectItem value="ADMIN" className="text-white text-xs">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {hasPermission('users.mute') && !isSelf && (
                          <Button
                            size="sm"
                            className={cn(
                              "h-8 text-xs gap-1.5",
                              user.isMuted
                                ? 'border-white/20 text-white bg-white/5 hover:bg-white/10'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                            )}
                            variant="ghost"
                            onClick={() => setActionModal({ open: true, action: user.isMuted ? 'unmute' : 'mute', user })}
                          >
                            {user.isMuted ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            {user.isMuted ? 'Unmute' : 'Mute'}
                          </Button>
                        )}

                        {hasPermission('users.ban') && !isSelf && (
                          <Button
                            size="sm"
                            className={cn(
                              "h-8 text-xs gap-1.5",
                              user.isBanned
                                ? 'border-white/20 text-white bg-white/5 hover:bg-white/10'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                            )}
                            variant="ghost"
                            onClick={() => setActionModal({ open: true, action: user.isBanned ? 'unban' : 'ban', user })}
                          >
                            {user.isBanned ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            {user.isBanned ? 'Unban' : 'Ban'}
                          </Button>
                        )}

                        {isSuper && !isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 ml-auto"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />Delete Account
                          </Button>
                        )}

                        {user.isBanned && (user as unknown as { ban_reason?: string }).ban_reason && (
                          <div className="w-full text-xs text-rose-400 bg-rose-500/8 border border-rose-500/20 rounded-lg px-3 py-2">
                            Ban reason: {(user as unknown as { ban_reason?: string }).ban_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      <ActionModal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, action: '', user: null })}
        onConfirm={(data) => actionModal.user && handleAction(actionModal.action, actionModal.user, data)}
        user={actionModal.user}
        action={actionModal.action}
        isLoading={actionLoading}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="glass border-border/50 max-w-sm bg-slate-950">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Permanently delete <strong className="text-white">{deleteTarget?.username}</strong>?
              This removes their profile and cannot be undone.
            </p>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This action is permanent and logged in the audit trail.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={actionLoading} onClick={confirmDelete}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminUsers;