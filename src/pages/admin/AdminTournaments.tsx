// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Tournament Management Module
// Professional tournament operations with health monitoring, disputes, fraud detection
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format, differenceInDays, isPast, isFuture } from 'date-fns';
import { toast } from 'sonner';
import {
  Search, Filter, Plus, Trophy, Users, Calendar, Clock, Flame, CheckCircle2,
  AlertTriangle, AlertOctagon, ShieldAlert, RefreshCw, ChevronRight,
  ExternalLink, Lock, Unlock, Edit3, Trash2,
  Activity, Flag, DollarSign, Loader2, FileText, Gavel,
  Crown,
  AlertCircle, CheckCircle, Skull, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TournamentStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'locked';
type TournamentHealthStatus = 'healthy' | 'warning' | 'critical' | 'suspended';
type FraudRiskLevel = 'low' | 'medium' | 'high' | 'critical';
type HealthIndicatorType = 'participation' | 'engagement' | 'disputes' | 'fraud' | 'timing';
type HealthStatus = 'good' | 'warning' | 'critical';

type HealthIndicator = {
  type: HealthIndicatorType;
  status: HealthStatus;
  message: string;
  value: number;
};

type TournamentDispute = {
  id: string;
  tournament_id: string;
  match_id?: string;
  type: 'match_result' | 'cheating' | 'no_show' | 'rule_violation' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  reported_by: string;
  reported_by_username?: string;
  against_user_id?: string;
  against_username?: string;
  evidence: string[];
  resolution?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
};

type TournamentHealth = {
  tournament_id: string;
  status: TournamentHealthStatus;
  participant_fill_rate: number;
  check_in_rate: number;
  dispute_count: number;
  pending_reports: number;
  fraud_risk: FraudRiskLevel;
  last_assessed: string;
  indicators: HealthIndicator[];
};

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  date: string;
  end_date: string | null;
  prize_pool: string;
  max_players: number;
  current_players: number;
  duration: string;
  winner: string | null;
  rules: string | null;
  entry_fee: string | null;
  format: string;
  region: string | null;
  is_featured: boolean;
  requires_verification: boolean;
  min_rank_required: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  organizer_id: string | null;
  game_id: string;
  // Joined fields
  games: { id: string; name: string; icon: string; slug: string } | null;
  profiles: { username: string; avatar_url: string | null } | null;
  organizers: { name: string; verified: boolean } | null;
};

type Game = { id: string; name: string; icon: string; slug: string; category: string };

type Participant = {
  id: string;
  user_id: string;
  tournament_id: string;
  status: 'registered' | 'checked_in' | 'eliminated' | 'winner' | 'withdrawn' | 'disqualified';
  checked_in: boolean;
  checked_in_at: string | null;
  seed: number | null;
  registered_at: string;
  profiles: { username: string; avatar_url: string | null; gamercred: number } | null;
};

type TournamentMatch = {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'disputed';
  scheduled_time: string | null;
  completed_at: string | null;
  score: string | null;
};

type ExtendedTournamentDispute = TournamentDispute & {
  tournament_name?: string;
  match_details?: {
    round: number;
    match_number: number;
    player1_name: string;
    player2_name: string;
  };
};

type TournamentFilters = {
  status: 'all' | TournamentStatus;
  game: string;
  organizer: string;
  region: string;
  healthStatus: 'all' | TournamentHealthStatus;
  fraudRisk: 'all' | FraudRiskLevel;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'upcoming';
  hasDisputes: boolean | null;
  featuredOnly: boolean;
  sortBy: 'date_desc' | 'date_asc' | 'prize_high' | 'prize_low' | 'players_high' | 'created_desc';
};

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CALCULATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function calculateTournamentHealth(
  tournament: Tournament,
  participants: Participant[],
  disputes: TournamentDispute[],
  matches: TournamentMatch[]
): TournamentHealth {
  const totalParticipants = tournament.max_players;
  const registered = participants.length;
  const checkedIn = participants.filter(p => p.checked_in).length;
  const fillRate = totalParticipants > 0 ? (registered / totalParticipants) * 100 : 0;
  const checkInRate = registered > 0 ? (checkedIn / registered) * 100 : 0;
  
  // Calculate dispute metrics
  const activeDisputes = disputes.filter(d => d.status === 'pending' || d.status === 'under_review').length;
  const disputeRate = registered > 0 ? (disputes.length / registered) * 100 : 0;
  
  // Calculate match completion rate
  const totalMatches = matches.length;
  const completedMatches = matches.filter(m => m.status === 'completed').length;
  const completionRate = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 100;
  
  // Detect no-shows (registered but not checked in after tournament starts)
  const noShows = tournament.status === 'ongoing' || tournament.status === 'completed'
    ? registered - checkedIn
    : 0;
  const noShowRate = registered > 0 ? (noShows / registered) * 100 : 0;
  
  // Fraud risk assessment
  let fraudRisk: FraudRiskLevel = 'none';
  let fraudFactors: string[] = [];
  
  if (disputeRate > 20) {
    fraudRisk = 'high';
    fraudFactors.push('High dispute rate');
  } else if (disputeRate > 10) {
    fraudRisk = 'medium';
    fraudFactors.push('Elevated disputes');
  }
  
  if (noShowRate > 30) {
    fraudRisk = fraudRisk === 'high' ? 'high' : 'medium';
    fraudFactors.push('High no-show rate');
  }
  
  // Determine overall health status
  let status: TournamentHealthStatus = 'healthy';
  
  if (activeDisputes > 5 || fraudRisk === 'high' || completionRate < 50) {
    status = 'critical';
  } else if (activeDisputes > 2 || fraudRisk === 'medium' || fillRate < 30 || noShowRate > 20) {
    status = 'warning';
  }
  
  // Build health indicators
  const indicators: HealthIndicator[] = [
    {
      type: 'participation',
      status: fillRate >= 70 ? 'good' : fillRate >= 40 ? 'warning' : 'critical',
      message: `${Math.round(fillRate)}% fill rate (${registered}/${totalParticipants})`,
      value: fillRate,
    },
    {
      type: 'engagement',
      status: checkInRate >= 80 ? 'good' : checkInRate >= 50 ? 'warning' : 'critical',
      message: `${Math.round(checkInRate)}% check-in rate`,
      value: checkInRate,
    },
    {
      type: 'disputes',
      status: activeDisputes === 0 ? 'good' : activeDisputes <= 2 ? 'warning' : 'critical',
      message: `${activeDisputes} active dispute${activeDisputes !== 1 ? 's' : ''}`,
      value: activeDisputes,
    },
    {
      type: 'fraud',
      status: fraudRisk === 'none' ? 'good' : fraudRisk === 'low' ? 'warning' : 'critical',
      message: fraudFactors.length > 0 ? fraudFactors.join(', ') : 'No fraud signals',
      value: fraudRisk === 'high' ? 3 : fraudRisk === 'medium' ? 2 : fraudRisk === 'low' ? 1 : 0,
    },
    {
      type: 'timing',
      status: tournament.status === 'ongoing' ? 'good' : isPast(new Date(tournament.date)) && tournament.status === 'upcoming' ? 'critical' : 'good',
      message: tournament.status === 'upcoming' 
        ? `Starts ${formatDistanceToNow(new Date(tournament.date), { addSuffix: true })}`
        : tournament.status === 'ongoing'
        ? 'Tournament in progress'
        : `Ended ${formatDistanceToNow(new Date(tournament.date), { addSuffix: true })}`,
      value: 0,
    },
  ];
  
  return {
    tournament_id: tournament.id,
    status,
    participant_fill_rate: fillRate,
    check_in_rate: checkInRate,
    dispute_count: activeDisputes,
    pending_reports: disputes.filter(d => d.status === 'pending').length,
    fraud_risk: fraudRisk,
    last_assessed: new Date().toISOString(),
    indicators,
  };
}

function getHealthColor(status: TournamentHealthStatus): string {
  switch (status) {
    case 'healthy': return 'text-green-500 bg-green-500/10 border-green-500/30';
    case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'suspended': return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    default: return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
  }
}

function getFraudRiskColor(risk: FraudRiskLevel): string {
  switch (risk) {
    case 'high': return 'text-red-500';
    case 'medium': return 'text-orange-500';
    case 'low': return 'text-yellow-500';
    default: return 'text-green-500';
  }
}

function getStatusIcon(status: TournamentStatus) {
  switch (status) {
    case 'ongoing': return Flame;
    case 'upcoming': return Calendar;
    case 'completed': return CheckCircle2;
    case 'cancelled': return XCircle;
    case 'locked': return Lock;
    default: return Calendar;
  }
}

function getStatusColor(status: TournamentStatus): string {
  switch (status) {
    case 'ongoing': return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
    case 'upcoming': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'cancelled': return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    case 'locked': return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: TournamentStatus }) {
  const Icon = getStatusIcon(status);
  const labels: Record<TournamentStatus, string> = {
    ongoing: 'Live',
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled',
    locked: 'Locked',
  };
  
  return (
    <Badge className={cn("border font-medium", getStatusColor(status))}>
      <Icon className="w-3 h-3 mr-1" />
      {labels[status]}
    </Badge>
  );
}

function HealthBadge({ health }: { health: TournamentHealth }) {
  const icons = {
    healthy: CheckCircle2,
    warning: AlertTriangle,
    critical: AlertOctagon,
    suspended: Lock,
  };
  const Icon = icons[health.status];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium",
      getHealthColor(health.status)
    )}>
      <Icon className="w-3 h-3" />
      {health.status === 'healthy' ? 'Healthy' : health.status === 'warning' ? 'Warning' : 'Critical'}
      {health.fraud_risk !== 'none' && (
        <span className={cn("ml-1", getFraudRiskColor(health.fraud_risk))}>
          • {health.fraud_risk} risk
        </span>
      )}
    </div>
  );
}

function _FraudRiskBadge({ risk }: { risk: FraudRiskLevel }) {
  if (risk === 'none') return null;
  
  const icons = { low: AlertTriangle, medium: AlertOctagon, high: Skull, critical: Skull };
  const Icon = icons[risk];
  
  return (
    <Badge className={cn(
      "border",
      risk === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
      risk === 'medium' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    )}>
      <Icon className="w-3 h-3 mr-1" />
      {risk} risk
    </Badge>
  );
}

function DisputeBadge({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <Badge className={cn(
      "border",
      count > 5 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
      count > 2 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    )}>
      <Flag className="w-3 h-3 mr-1" />
      {count} dispute{count !== 1 ? 's' : ''}
    </Badge>
  );
}

function HealthIndicatorCard({ indicator }: { indicator: HealthIndicator }) {
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-red-500',
  };
  
  const icons = {
    participation: Users,
    engagement: Activity,
    disputes: Flag,
    fraud: ShieldAlert,
    timing: Clock,
  };
  const Icon = icons[indicator.type];
  
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
      <Icon className={cn("w-4 h-4 mt-0.5", statusColors[indicator.status])} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 capitalize">{indicator.type}</p>
        <p className={cn("text-sm font-medium truncate", statusColors[indicator.status])}>
          {indicator.message}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function FilterPanel({
  filters,
  onChange,
  games,
  isOpen,
}: {
  filters: TournamentFilters;
  onChange: (filters: TournamentFilters) => void;
  games: Game[];
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Status</label>
                <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v as TournamentFilters['status'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Game</label>
                <Select value={filters.game} onValueChange={(v) => onChange({ ...filters, game: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Games</SelectItem>
                    {games.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.icon} {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Health Status</label>
                <Select value={filters.healthStatus} onValueChange={(v) => onChange({ ...filters, healthStatus: v as TournamentFilters['healthStatus'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Health</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Fraud Risk</label>
                <Select value={filters.fraudRisk} onValueChange={(v) => onChange({ ...filters, fraudRisk: v as TournamentFilters['fraudRisk'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Risks</SelectItem>
                    <SelectItem value="none">No Risk</SelectItem>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(v) => onChange({ ...filters, dateRange: v as TournamentFilters['dateRange'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="upcoming">Upcoming Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(v) => onChange({ ...filters, sortBy: v as TournamentFilters['sortBy'] })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="date_desc">Date (Newest)</SelectItem>
                    <SelectItem value="date_asc">Date (Oldest)</SelectItem>
                    <SelectItem value="prize_high">Prize (High-Low)</SelectItem>
                    <SelectItem value="prize_low">Prize (Low-High)</SelectItem>
                    <SelectItem value="players_high">Most Players</SelectItem>
                    <SelectItem value="created_desc">Recently Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Region</label>
                <Select value={filters.region} onValueChange={(v) => onChange({ ...filters, region: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="lagos">Lagos</SelectItem>
                    <SelectItem value="abuja">Abuja</SelectItem>
                    <SelectItem value="port-harcourt">Port Harcourt</SelectItem>
                    <SelectItem value="ibadan">Ibadan</SelectItem>
                    <SelectItem value="kano">Kano</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant={filters.hasDisputes === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ ...filters, hasDisputes: filters.hasDisputes === true ? null : true })}
                className={filters.hasDisputes === true ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
              >
                <Flag className="w-4 h-4 mr-1" />
                Has Disputes
              </Button>
              <Button
                variant={filters.featuredOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange({ ...filters, featuredOnly: !filters.featuredOnly })}
                className={filters.featuredOnly ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : ''}
              >
                <Crown className="w-4 h-4 mr-1" />
                Featured Only
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT DETAIL SHEET
// ═══════════════════════════════════════════════════════════════════════════════

function TournamentDetailSheet({
  tournament,
  health,
  participants,
  disputes,
  matches,
  isOpen,
  onClose,
  onAction,
  canEdit,
  canDelete,
  canModerate,
}: {
  tournament: Tournament | null;
  health: TournamentHealth | null;
  participants: Participant[];
  disputes: ExtendedTournamentDispute[];
  matches: TournamentMatch[];
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, data?: object) => void;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDispute, setSelectedDispute] = useState<ExtendedTournamentDispute | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  
  if (!tournament || !health) return null;

  const _StatusIcon = getStatusIcon(tournament.status);
  const fillPercentage = Math.round(health.participant_fill_rate);
  const checkInPercentage = Math.round(health.check_in_rate);
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl bg-slate-950 border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{tournament.games?.icon ?? '🎮'}</span>
                <SheetTitle className="font-orbitron text-lg text-white truncate">
                  {tournament.name}
                </SheetTitle>
              </div>
              <SheetDescription className="text-slate-400">
                {tournament.games?.name} • {tournament.region || 'Online'} • Created {formatDistanceToNow(new Date(tournament.created_at), { addSuffix: true })}
              </SheetDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={tournament.status} />
              <HealthBadge health={health} />
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <Users className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
              <p className="text-lg font-bold text-white">{participants.length}</p>
              <p className="text-[10px] text-slate-500">Players</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <DollarSign className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
              <p className="text-lg font-bold text-white">{tournament.prize_pool}</p>
              <p className="text-[10px] text-slate-500">Prize Pool</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <Calendar className="w-4 h-4 mx-auto mb-1 text-purple-400" />
              <p className="text-sm font-bold text-white">{format(new Date(tournament.date), 'MMM d')}</p>
              <p className="text-[10px] text-slate-500">{format(new Date(tournament.date), 'h:mm a')}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <Flag className="w-4 h-4 mx-auto mb-1 text-orange-400" />
              <p className="text-lg font-bold text-white">{disputes.filter(d => d.status === 'pending' || d.status === 'under_review').length}</p>
              <p className="text-[10px] text-slate-500">Disputes</p>
            </div>
          </div>
        </SheetHeader>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 py-4 border-b border-slate-800">
          {canEdit && tournament.status !== 'completed' && tournament.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction('edit')}
              className="border-slate-700 hover:bg-slate-800"
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          {canModerate && (
            <>
              {tournament.status === 'ongoing' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction('lock')}
                  className="border-purple-700 text-purple-400 hover:bg-purple-900/30"
                >
                  <Lock className="w-4 h-4 mr-1" />
                  Lock
                </Button>
              )}
              {tournament.status === 'locked' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction('unlock')}
                  className="border-green-700 text-green-400 hover:bg-green-900/30"
                >
                  <Unlock className="w-4 h-4 mr-1" />
                  Unlock
                </Button>
              )}
              {tournament.status !== 'cancelled' && tournament.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction('cancel')}
                  className="border-red-700 text-red-400 hover:bg-red-900/30"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
            </>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction('delete')}
              className="border-red-900 text-red-500 hover:bg-red-900/30"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('view_public')}
            className="border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 ml-auto"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View Public
          </Button>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800">Overview</TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-slate-800">Health</TabsTrigger>
            <TabsTrigger value="participants" className="data-[state=active]:bg-slate-800">
              Participants ({participants.length})
            </TabsTrigger>
            <TabsTrigger value="disputes" className="data-[state=active]:bg-slate-800">
              Disputes ({disputes.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Description */}
            {tournament.description && (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Description
                </h4>
                <p className="text-sm text-slate-400">{tournament.description}</p>
              </div>
            )}
            
            {/* Rules */}
            {tournament.rules && (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-yellow-400" />
                  Rules
                </h4>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{tournament.rules}</p>
              </div>
            )}
            
            {/* Tournament Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <p className="text-xs text-slate-500">Format</p>
                <p className="text-sm font-medium text-white">{tournament.format || 'Standard'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-sm font-medium text-white">{tournament.duration}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <p className="text-xs text-slate-500">Entry Fee</p>
                <p className="text-sm font-medium text-white">{tournament.entry_fee || 'Free'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <p className="text-xs text-slate-500">Verification Required</p>
                <p className="text-sm font-medium text-white">{tournament.requires_verification ? 'Yes' : 'No'}</p>
              </div>
            </div>
            
            {/* Organizer Info */}
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                Organizer
              </h4>
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={tournament.profiles?.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                    {tournament.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-white">{tournament.profiles?.username || 'Unknown'}</p>
                  {tournament.organizers && (
                    <p className="text-xs text-slate-400">
                      {tournament.organizers.name}
                      {tournament.organizers.verified && (
                        <span className="ml-2 text-cyan-400">✓ Verified</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Winner Section */}
            {tournament.winner && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Champion
                </h4>
                <p className="text-lg font-bold text-white">{tournament.winner}</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="health" className="mt-4 space-y-4">
            {/* Health Status Card */}
            <div className={cn(
              "p-4 rounded-lg border",
              getHealthColor(health.status)
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <span className="font-bold">Tournament Health</span>
                </div>
                <span className="text-xs opacity-75">
                  Assessed {formatDistanceToNow(new Date(health.last_assessed), { addSuffix: true })}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs opacity-75 mb-1">Fill Rate</p>
                  <Progress value={fillPercentage} className="h-2" />
                  <p className="text-sm font-medium mt-1">{fillPercentage}%</p>
                </div>
                <div>
                  <p className="text-xs opacity-75 mb-1">Check-in Rate</p>
                  <Progress value={checkInPercentage} className="h-2" />
                  <p className="text-sm font-medium mt-1">{checkInPercentage}%</p>
                </div>
              </div>
            </div>
            
            {/* Health Indicators */}
            <div className="grid grid-cols-1 gap-2">
              {health.indicators.map((indicator, i) => (
                <HealthIndicatorCard key={i} indicator={indicator} />
              ))}
            </div>
            
            {/* Fraud Risk Assessment */}
            {health.fraud_risk !== 'none' && (
              <div className={cn(
                "p-4 rounded-lg border",
                health.fraud_risk === 'high' ? 'bg-red-500/10 border-red-500/30' :
                health.fraud_risk === 'medium' ? 'bg-orange-500/10 border-orange-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'
              )}>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Fraud Risk: {health.fraud_risk.toUpperCase()}
                </h4>
                <p className="text-xs opacity-75">
                  This tournament shows signals that may indicate fraudulent activity. Review disputes and player behavior carefully.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="participants" className="mt-4">
            {participants.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No participants registered yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                    <span className="text-xs text-slate-500 w-6">{i + 1}</span>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={p.profiles?.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs">
                        {p.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.profiles?.username || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">
                        GamerCred: {p.profiles?.gamercred || 0} • Registered {formatDistanceToNow(new Date(p.registered_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.checked_in && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Checked In
                        </Badge>
                      )}
                      <Badge className={cn(
                        "text-[10px]",
                        p.status === 'winner' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        p.status === 'eliminated' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        p.status === 'withdrawn' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                        'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      )}>
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="disputes" className="mt-4">
            {disputes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20 text-green-500" />
                <p>No disputes reported</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      dispute.status === 'pending' ? 'bg-red-500/5 border-red-500/20' :
                      dispute.status === 'under_review' ? 'bg-yellow-500/5 border-yellow-500/20' :
                      dispute.status === 'resolved' ? 'bg-green-500/5 border-green-500/20' :
                      'bg-slate-900/50 border-slate-800'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn(
                            "text-[10px]",
                            dispute.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                            dispute.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            dispute.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          )}>
                            {dispute.priority}
                          </Badge>
                          <Badge className={cn(
                            "text-[10px]",
                            dispute.status === 'pending' ? 'bg-red-500/20 text-red-400' :
                            dispute.status === 'under_review' ? 'bg-yellow-500/20 text-yellow-400' :
                            dispute.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                            'bg-slate-500/20 text-slate-400'
                          )}>
                            {dispute.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-white">{dispute.type.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-500">
                          Reported by {dispute.reporter_name} • {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {dispute.match_details && (
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Match</p>
                          <p className="text-sm font-medium text-white">
                            Round {dispute.match_details.round} • Match {dispute.match_details.match_number}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-400 mb-3">{dispute.description}</p>
                    
                    {dispute.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {dispute.evidence.map((evidence, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-slate-700">
                            Evidence {i + 1}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {canModerate && dispute.status !== 'resolved' && dispute.status !== 'dismissed' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDispute(dispute)}
                          className="border-green-700 text-green-400 hover:bg-green-900/30"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAction('dismiss_dispute', { disputeId: dispute.id })}
                          className="border-slate-700 hover:bg-slate-800"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                    
                    {dispute.resolution && (
                      <div className="mt-3 p-3 rounded bg-slate-900/50">
                        <p className="text-xs text-slate-500 mb-1">Resolution</p>
                        <p className="text-sm text-slate-300">{dispute.resolution}</p>
                        {dispute.resolved_by && (
                          <p className="text-xs text-slate-500 mt-1">
                            Resolved by {dispute.resolved_by} • {dispute.resolved_at && formatDistanceToNow(new Date(dispute.resolved_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Resolve Dispute Dialog */}
        <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
          <DialogContent className="bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="font-orbitron text-white">Resolve Dispute</DialogTitle>
              <DialogDescription className="text-slate-400">
                Provide a resolution for this dispute. This will be recorded in the audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <p className="text-xs text-slate-500">Dispute</p>
                <p className="text-sm font-medium text-white">{selectedDispute?.type.replace('_', ' ')}</p>
                <p className="text-sm text-slate-400">{selectedDispute?.description}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Resolution Notes</label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Describe how this dispute was resolved..."
                  className="bg-slate-900 border-slate-800 min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDispute(null)} className="border-slate-700">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onAction('resolve_dispute', { disputeId: selectedDispute?.id, resolution: resolutionNote });
                  setSelectedDispute(null);
                  setResolutionNote('');
                }}
                className="bg-green-600 hover:bg-green-700"
                disabled={!resolutionNote.trim()}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Resolve Dispute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminTournaments(): React.ReactElement {
  const { hasPermission, role } = useAdmin();
  const navigate = useNavigate();
  
  // Data states
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [disputes, setDisputes] = useState<Record<string, ExtendedTournamentDispute[]>>({});
  const [matches, setMatches] = useState<Record<string, TournamentMatch[]>>({});
  const [healthData, setHealthData] = useState<Record<string, TournamentHealth>>({});
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TournamentFilters>({
    status: 'all',
    game: 'all',
    organizer: 'all',
    region: 'all',
    healthStatus: 'all',
    fraudRisk: 'all',
    dateRange: 'all',
    hasDisputes: null,
    featuredOnly: false,
    sortBy: 'date_desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  // Form states for create/edit
  const [formData, setFormData] = useState<Partial<Tournament>>({
    name: '',
    game_id: '',
    status: 'upcoming',
    date: '',
    prize_pool: '',
    max_players: 64,
    duration: '1 Day',
    description: '',
    rules: '',
    entry_fee: '₦0',
    format: 'single_elimination',
    region: 'online',
    requires_verification: false,
  });

  // Permissions
  const canView = hasPermission('tournaments.view');
  const canCreate = hasPermission('tournaments.create');
  const canEdit = hasPermission('tournaments.edit');
  const canDelete = hasPermission('tournaments.delete') || role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canModerate = hasPermission('tournaments.override_results') || role === 'SUPER_ADMIN' || role === 'ADMIN';

  // Fetch tournaments
  const fetchTournaments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          games(id, name, icon, slug),
          profiles!tournaments_created_by_fkey(username, avatar_url),
          organizers(name, verified)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTournaments(data as Tournament[] || []);
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
      toast.error('Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch games
  const fetchGames = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, name, icon, slug, category')
        .order('name');
      
      if (error) throw error;
      setGames(data || []);
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  }, []);

  // Fetch tournament details
  const fetchTournamentDetails = useCallback(async (tournamentId: string) => {
    try {
      const [participantsRes, disputesRes, matchesRes] = await Promise.all([
        supabase
          .from('tournament_participants')
          .select('*, profiles(username, avatar_url, gamercred)')
          .eq('tournament_id', tournamentId)
          .order('registered_at', { ascending: true }),
        supabase
          .from('tournament_disputes')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('round', { ascending: true }),
      ]);

      setParticipants(prev => ({ ...prev, [tournamentId]: participantsRes.data || [] }));
      setDisputes(prev => ({ ...prev, [tournamentId]: disputesRes.data || [] }));
      setMatches(prev => ({ ...prev, [tournamentId]: matchesRes.data || [] }));

      // Calculate health
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (tournament) {
        const health = calculateTournamentHealth(
          tournament,
          participantsRes.data || [],
          disputesRes.data || [],
          matchesRes.data || []
        );
        setHealthData(prev => ({ ...prev, [tournamentId]: health }));
      }
    } catch (err) {
      console.error('Failed to fetch tournament details:', err);
    }
  }, [tournaments]);

  // Initial load
  useEffect(() => {
    fetchTournaments();
    fetchGames();
  }, [fetchTournaments, fetchGames]);

  // Fetch details when tournament selected
  useEffect(() => {
    if (selectedTournament && !participants[selectedTournament.id]) {
      fetchTournamentDetails(selectedTournament.id);
    }
  }, [selectedTournament, fetchTournamentDetails, participants]);

  // Filter tournaments
  const filteredTournaments = useMemo(() => {
    let filtered = [...tournaments];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.games?.name.toLowerCase().includes(query) ||
        t.region?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    
    // Game filter
    if (filters.game !== 'all') {
      filtered = filtered.filter(t => t.game_id === filters.game);
    }
    
    // Region filter
    if (filters.region !== 'all') {
      filtered = filtered.filter(t => t.region === filters.region);
    }
    
    // Health status filter
    if (filters.healthStatus !== 'all') {
      filtered = filtered.filter(t => {
        const health = healthData[t.id];
        return health?.status === filters.healthStatus;
      });
    }
    
    // Fraud risk filter
    if (filters.fraudRisk !== 'all') {
      filtered = filtered.filter(t => {
        const health = healthData[t.id];
        return health?.fraud_risk === filters.fraudRisk;
      });
    }
    
    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(t => {
        const date = new Date(t.date);
        switch (filters.dateRange) {
          case 'today':
            return format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
          case 'week':
            return differenceInDays(date, now) <= 7;
          case 'month':
            return differenceInDays(date, now) <= 30;
          case 'upcoming':
            return isFuture(date);
          default:
            return true;
        }
      });
    }
    
    // Featured only filter
    if (filters.featuredOnly) {
      filtered = filtered.filter(t => t.is_featured);
    }
    
    // Has disputes filter
    if (filters.hasDisputes !== null) {
      filtered = filtered.filter(t => {
        const hasDisputes = disputes[t.id]?.length > 0;
        return filters.hasDisputes ? hasDisputes : !hasDisputes;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'prize_high':
          return parseFloat(b.prize_pool.replace(/[^0-9.]/g, '')) - parseFloat(a.prize_pool.replace(/[^0-9.]/g, ''));
        case 'prize_low':
          return parseFloat(a.prize_pool.replace(/[^0-9.]/g, '')) - parseFloat(b.prize_pool.replace(/[^0-9.]/g, ''));
        case 'players_high':
          return b.current_players - a.current_players;
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [tournaments, searchQuery, filters, healthData, disputes]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPrize = tournaments.reduce((sum, t) => {
      const value = parseFloat(t.prize_pool.replace(/[^0-9.]/g, ''));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    
    return {
      total: tournaments.length,
      live: tournaments.filter(t => t.status === 'ongoing').length,
      upcoming: tournaments.filter(t => t.status === 'upcoming').length,
      completed: tournaments.filter(t => t.status === 'completed').length,
      critical: Object.values(healthData).filter(h => h.status === 'critical').length,
      totalPrize,
    };
  }, [tournaments, healthData]);

  // Handle tournament actions
  const handleAction = async (action: string, data?: object) => {
    if (!selectedTournament) return;
    
    setActionInProgress(true);
    try {
      switch (action) {
        case 'edit':
          // Navigate to edit page or open edit modal
          toast.info('Edit functionality coming soon');
          break;
          
        case 'lock':
          await supabase.from('tournaments').update({ status: 'locked' } as never).eq('id', selectedTournament.id);
          await writeAudit('unknown', 'lock_tournament', selectedTournament.id);
          toast.success('Tournament locked');
          fetchTournaments();
          break;
          
        case 'unlock':
          await supabase.from('tournaments').update({ status: 'ongoing' } as never).eq('id', selectedTournament.id);
          await writeAudit('unknown', 'unlock_tournament', selectedTournament.id);
          toast.success('Tournament unlocked');
          fetchTournaments();
          break;
          
        case 'cancel':
          await supabase.from('tournaments').update({ status: 'cancelled' } as never).eq('id', selectedTournament.id);
          await writeAudit('unknown', 'cancel_tournament', selectedTournament.id);
          toast.success('Tournament cancelled');
          fetchTournaments();
          break;
          
        case 'delete':
          setDeleteConfirmOpen(true);
          break;
          
        case 'confirm_delete':
          await supabase.from('tournaments').delete().eq('id', selectedTournament.id);
          await writeAudit('unknown', 'delete_tournament', selectedTournament.id);
          toast.success('Tournament deleted');
          setDeleteConfirmOpen(false);
          setIsDetailOpen(false);
          fetchTournaments();
          break;
          
        case 'view_public':
          navigate(`/tournaments/${selectedTournament.id}`);
          break;
          
        case 'dismiss_dispute':
          if (data && 'disputeId' in data) {
            await supabase.from('tournament_disputes')
              .update({ status: 'dismissed', resolved_at: new Date().toISOString() } as never)
              .eq('id', data.disputeId as string);
            toast.success('Dispute dismissed');
            fetchTournamentDetails(selectedTournament.id);
          }
          break;
          
        case 'resolve_dispute':
          if (data && 'disputeId' in data && 'resolution' in data) {
            await supabase.from('tournament_disputes')
              .update({
                status: 'resolved',
                resolution: data.resolution,
                resolved_at: new Date().toISOString(),
              } as never)
              .eq('id', data.disputeId as string);
            await writeAudit('unknown', 'resolve_dispute', data.disputeId as string, { resolution: data.resolution });
            toast.success('Dispute resolved');
            fetchTournamentDetails(selectedTournament.id);
          }
          break;
      }
    } catch (err) {
      console.error('Action failed:', err);
      toast.error('Action failed');
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle create tournament
  const handleCreate = async () => {
    if (!formData.name || !formData.game_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setActionInProgress(true);
    try {
      const { data, error } = await supabase.from('tournaments').insert({
        ...formData,
        created_at: new Date().toISOString(),
        current_players: 0,
      }).select().single();
      
      if (error) throw error;
      
      await writeAudit('unknown', 'create_tournament', data.id, { name: formData.name });
      toast.success('Tournament created successfully');
      setCreateModalOpen(false);
      fetchTournaments();
      
      // Reset form
      setFormData({
        name: '',
        game_id: '',
        status: 'upcoming',
        date: '',
        prize_pool: '',
        max_players: 64,
        duration: '1 Day',
        description: '',
        rules: '',
        entry_fee: '₦0',
        format: 'single_elimination',
        region: 'online',
        requires_verification: false,
      });
    } catch (err) {
      console.error('Failed to create tournament:', err);
      toast.error('Failed to create tournament');
    } finally {
      setActionInProgress(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You don't have permission to view tournaments.</p>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Tournament Management</h1>
          <p className="text-slate-400 text-sm">
            {kpis.total} total • {kpis.live} live • {kpis.upcoming} upcoming • {kpis.critical} critical health
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "border-slate-700 hover:bg-slate-800",
              showFilters && "bg-slate-800"
            )}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTournaments}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Tournament
            </Button>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: kpis.total, icon: Trophy, color: 'cyan' },
          { label: 'Live', value: kpis.live, icon: Flame, color: 'red' },
          { label: 'Upcoming', value: kpis.upcoming, icon: Calendar, color: 'purple' },
          { label: 'Completed', value: kpis.completed, icon: CheckCircle2, color: 'green' },
          { label: 'Critical', value: kpis.critical, icon: AlertOctagon, color: 'orange' },
          { label: 'Prize Pool', value: `₦${(kpis.totalPrize / 1000).toFixed(0)}K`, icon: DollarSign, color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={cn("w-5 h-5", `text-${color}-400`)} />
              <div>
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search tournaments by name, game, or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800"
          />
        </div>
        
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          games={games}
          isOpen={showFilters}
        />
      </div>

      {/* Tournament List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-700" />
          <h3 className="text-lg font-medium text-white mb-2">No tournaments found</h3>
          <p className="text-slate-500">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredTournaments.map((tournament, index) => {
              const health = healthData[tournament.id];
              const tournamentDisputes = disputes[tournament.id] || [];
              
              return (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTournament(tournament);
                      setIsDetailOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Game Icon */}
                        <div className="text-3xl flex-shrink-0">
                          {tournament.games?.icon || '🎮'}
                        </div>
                        
                        {/* Tournament Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-orbitron font-bold text-white truncate">
                              {tournament.name}
                            </h3>
                            {tournament.is_featured && (
                              <Crown className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>{tournament.games?.name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {tournament.prize_pool}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {tournament.current_players}/{tournament.max_players}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {tournament.duration}
                            </span>
                            <span>•</span>
                            <span>{format(new Date(tournament.date), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        
                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={tournament.status} />
                          {health && <HealthBadge health={health} />}
                          {tournamentDisputes.length > 0 && (
                            <DisputeBadge count={tournamentDisputes.length} />
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTournament(tournament);
                              setIsDetailOpen(true);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Tournament Detail Sheet */}
      <TournamentDetailSheet
        tournament={selectedTournament}
        health={selectedTournament ? healthData[selectedTournament.id] || null : null}
        participants={selectedTournament ? participants[selectedTournament.id] || [] : []}
        disputes={selectedTournament ? disputes[selectedTournament.id] || [] : []}
        matches={selectedTournament ? matches[selectedTournament.id] || [] : []}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onAction={handleAction}
        canEdit={canEdit}
        canDelete={canDelete}
        canModerate={canModerate}
      />

      {/* Create Tournament Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-white">Create Tournament</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new tournament. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <label className="text-sm text-slate-400">Tournament Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., eFootball Premier League Season 1"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Game *</label>
              <Select
                value={formData.game_id}
                onValueChange={(v) => setFormData({ ...formData, game_id: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {games.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.icon} {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Date & Time *</label>
              <Input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Prize Pool *</label>
              <Input
                value={formData.prize_pool}
                onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
                placeholder="e.g., ₦500,000"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Max Players</label>
              <Input
                type="number"
                value={formData.max_players}
                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Duration</label>
              <Select
                value={formData.duration}
                onValueChange={(v) => setFormData({ ...formData, duration: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="1 Day">1 Day</SelectItem>
                  <SelectItem value="2 Days">2 Days</SelectItem>
                  <SelectItem value="3 Days">3 Days</SelectItem>
                  <SelectItem value="1 Week">1 Week</SelectItem>
                  <SelectItem value="2 Weeks">2 Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Format</label>
              <Select
                value={formData.format}
                onValueChange={(v) => setFormData({ ...formData, format: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="swiss">Swiss</SelectItem>
                  <SelectItem value="bracket">Bracket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Region</label>
              <Select
                value={formData.region}
                onValueChange={(v) => setFormData({ ...formData, region: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="lagos">Lagos</SelectItem>
                  <SelectItem value="abuja">Abuja</SelectItem>
                  <SelectItem value="port-harcourt">Port Harcourt</SelectItem>
                  <SelectItem value="ibadan">Ibadan</SelectItem>
                  <SelectItem value="kano">Kano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2 space-y-2">
              <label className="text-sm text-slate-400">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the tournament..."
                className="bg-slate-900 border-slate-800 min-h-[80px]"
              />
            </div>
            
            <div className="col-span-2 space-y-2">
              <label className="text-sm text-slate-400">Rules</label>
              <Textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="Tournament rules and regulations..."
                className="bg-slate-900 border-slate-800 min-h-[80px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={actionInProgress}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
            >
              {actionInProgress ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              Create Tournament
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Tournament
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <strong>{selectedTournament?.name}</strong>? This action cannot be undone and will remove all associated data including participants, matches, and disputes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('confirm_delete')}
              disabled={actionInProgress}
            >
              {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Tournament
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}