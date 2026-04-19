// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Incident Center
// Real-time operations center for critical alerts and incident management
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { subscriptionManager } from '@/lib/realtime/subscriptionManager';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle, AlertOctagon, Bell, CheckCircle2, Clock,
  RefreshCw, Filter, Search, User,
  Activity, Shield,
  Users, Trophy, MessageSquare, Ban, Flag,
  ChevronDown, ExternalLink, Eye,
  Check, X, Loader2, Zap,
  AlertCircle, BarChart3,
  ShieldAlert,
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
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type IncidentType = 'report_spike' | 'dispute_spike' | 'suspicious_activity' |
  'failed_action' | 'moderation_backlog' | 'no_show_spike' | 'system_health' |
  'security_alert' | 'fraud_detected';

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'escalated';

interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  affectedEntities: {
    type: 'user' | 'tournament' | 'match' | 'post' | 'system';
    id: string;
    name: string;
  }[];
  metrics: {
    label: string;
    value: number;
    change: number;
    unit?: string;
  }[];
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  assignedTo?: string;
  notes: IncidentNote[];
  automatedResponse?: boolean;
  relatedIncidents?: string[];
}

interface IncidentNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isSystemGenerated: boolean;
}

interface IncidentStats {
  active: number;
  critical: number;
  high: number;
  acknowledged: number;
  resolvedToday: number;
  avgResolutionTime: number;
  topTypes: { type: string; count: number }[];
}

interface RealTimeMetrics {
  activeUsers: number;
  reportsPerHour: number;
  tournamentsLive: number;
  systemHealth: number;
  moderationQueue: number;
  pendingDisputes: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const INCIDENT_TYPE_CONFIG: Record<IncidentType, { label: string; icon: React.ElementType; color: string }> = {
  report_spike: { label: 'Report Spike', icon: Flag, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  dispute_spike: { label: 'Dispute Spike', icon: Trophy, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  suspicious_activity: { label: 'Suspicious Activity', icon: Eye, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  failed_action: { label: 'Failed Action', icon: AlertCircle, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  moderation_backlog: { label: 'Moderation Backlog', icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  no_show_spike: { label: 'No-Show Spike', icon: Users, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  system_health: { label: 'System Health', icon: Activity, color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  security_alert: { label: 'Security Alert', icon: ShieldAlert, color: 'text-red-500 bg-red-500/20 border-red-500/40' },
  fraud_detected: { label: 'Fraud Detected', icon: AlertOctagon, color: 'text-red-600 bg-red-500/20 border-red-500/40' },
};

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string; pulse: boolean }> = {
  low: { label: 'Low', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30', pulse: false },
  medium: { label: 'Medium', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', pulse: false },
  high: { label: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', pulse: true },
  critical: { label: 'Critical', color: 'text-red-400 bg-red-500/20 border-red-500/40 animate-pulse', pulse: true },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  acknowledged: { label: 'Acknowledged', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  investigating: { label: 'Investigating', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  resolved: { label: 'Resolved', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  escalated: { label: 'Escalated', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  color,
  alert,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
  alert?: boolean;
}) {
  return (
    <Card className={cn("bg-slate-900/50 border-slate-800", alert && "border-red-500/30")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              change > 0 ? "text-red-400" : "text-green-400"
            )}>
              {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentCard({
  incident,
  onSelect,
}: {
  incident: Incident;
  onSelect: () => void;
}) {
  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type];
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const statusConfig = STATUS_CONFIG[incident.status];
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className={cn(
        "group relative p-4 rounded-xl border cursor-pointer transition-all",
        "hover:border-slate-600 hover:bg-slate-800/30",
        incident.severity === 'critical' && "border-red-500/30 bg-red-500/5",
        incident.severity === 'high' && "border-orange-500/30 bg-orange-500/5",
        incident.status === 'resolved' && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", typeConfig.color)}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-slate-200 line-clamp-1">{incident.title}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
              {incident.assignedTo && (
                <>
                  <span>•</span>
                  <User className="w-3 h-3" />
                  {incident.assignedTo}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("border", severityConfig.color)}>
            {severityConfig.label}
          </Badge>
          <Badge className={cn("border text-[10px]", statusConfig.color)}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 mt-3 line-clamp-2">{incident.description}</p>

      {/* Metrics */}
      {incident.metrics.length > 0 && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800">
          {incident.metrics.map((metric, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-white">{metric.value}{metric.unit}</span>
              <span className="text-xs text-slate-500">{metric.label}</span>
              {metric.change !== 0 && (
                <span className={cn(
                  "text-xs flex items-center",
                  metric.change > 0 ? "text-red-400" : "text-green-400"
                )}>
                  {metric.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(metric.change)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Affected Entities */}
      <div className="flex flex-wrap gap-2 mt-3">
        {incident.affectedEntities.slice(0, 3).map((entity, i) => (
          <Badge key={i} variant="outline" className="text-[10px] border-slate-700 text-slate-500">
            {entity.type}: {entity.name}
          </Badge>
        ))}
        {incident.affectedEntities.length > 3 && (
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
            +{incident.affectedEntities.length - 3} more
          </Badge>
        )}
      </div>

      {/* Notes indicator */}
      {incident.notes.length > 0 && (
        <div className="absolute bottom-4 right-4">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MessageSquare className="w-3 h-3" />
            {incident.notes.length}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function IncidentDetailSheet({
  incident,
  isOpen,
  onClose,
  onAction,
  currentUserId,
  currentUserEmail,
}: {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, data?: object) => Promise<void>;
  currentUserId: string;
  currentUserEmail: string;
}) {
  const [newNote, setNewNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!incident) return null;

  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type];
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const statusConfig = STATUS_CONFIG[incident.status];
  const TypeIcon = typeConfig.icon;

  const handleAction = async (action: string) => {
    setIsProcessing(true);
    try {
      await onAction(action, { note: newNote });
      if (action === 'add_note') {
        setNewNote('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl bg-slate-950 border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", typeConfig.color)}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-white text-lg">{incident.title}</SheetTitle>
              <SheetDescription className="text-slate-400 flex items-center gap-2">
                <span className={cn("inline-block w-2 h-2 rounded-full", incident.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-slate-500')} />
                Incident #{incident.id}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("border", severityConfig.color)}>
              {severityConfig.label} Severity
            </Badge>
            <Badge className={cn("border", statusConfig.color)}>
              {statusConfig.label}
            </Badge>
            {incident.automatedResponse && (
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                <Zap className="w-3 h-3 mr-1" />
                Auto-Response
              </Badge>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Created {format(new Date(incident.createdAt), 'MMM d, yyyy HH:mm')}</span>
              </div>
              {incident.acknowledgedAt && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Check className="w-4 h-4 text-yellow-500" />
                  <span>Acknowledged by {incident.acknowledgedBy} at {format(new Date(incident.acknowledgedAt), 'HH:mm')}</span>
                </div>
              )}
              {incident.resolvedAt && (
                <div className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Resolved by {incident.resolvedBy} at {format(new Date(incident.resolvedAt), 'HH:mm')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          {incident.metrics.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Metrics</h4>
              <div className="grid grid-cols-2 gap-3">
                {incident.metrics.map((metric, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                    <p className="text-lg font-semibold text-white">{metric.value}{metric.unit}</p>
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    {metric.change !== 0 && (
                      <p className={cn(
                        "text-xs mt-1 flex items-center gap-1",
                        metric.change > 0 ? "text-red-400" : "text-green-400"
                      )}>
                        {metric.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(metric.change)}% vs baseline
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected Entities */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Affected Entities</h4>
            <div className="space-y-2">
              {incident.affectedEntities.map((entity, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500 capitalize">
                      {entity.type}
                    </Badge>
                    <span className="text-sm text-slate-300">{entity.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Notes</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {incident.notes.map((note) => (
                <div key={note.id} className={cn(
                  "p-3 rounded-lg border",
                  note.isSystemGenerated
                    ? "bg-blue-500/5 border-blue-500/20"
                    : "bg-slate-900/50 border-slate-800"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        note.isSystemGenerated ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-300"
                      )}>
                        {note.isSystemGenerated ? 'S' : note.authorName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-slate-300">{note.authorName}</span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{note.content}</p>
                </div>
              ))}
            </div>

            {/* Add Note */}
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-600"
              />
              <Button
                onClick={() => handleAction('add_note')}
                disabled={!newNote.trim() || isProcessing}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-sm font-medium text-slate-300">Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              {incident.status === 'new' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('acknowledge')}
                  disabled={isProcessing}
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Acknowledge
                </Button>
              )}
              {incident.status !== 'investigating' && incident.status !== 'resolved' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('investigate')}
                  disabled={isProcessing}
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Start Investigation
                </Button>
              )}
              {incident.status !== 'resolved' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('resolve')}
                  disabled={isProcessing}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Resolve
                </Button>
              )}
              {incident.severity !== 'critical' && incident.status !== 'escalated' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('escalate')}
                  disabled={isProcessing}
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Escalate
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminIncidents(): JSX.Element {
  const { profile } = useAdmin();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    activeUsers: 1247,
    reportsPerHour: 23,
    tournamentsLive: 18,
    systemHealth: 98,
    moderationQueue: 45,
    pendingDisputes: 12,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filter, setFilter] = useState<{
    severity: IncidentSeverity | 'all';
    status: IncidentStatus | 'all';
    type: IncidentType | 'all';
  }>({
    severity: 'all',
    status: 'all',
    type: 'all',
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch incidents from Supabase
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('incidents')
        .select('*, incident_notes(*), incident_affected_entities(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter.severity !== 'all') {
        query = query.eq('severity', filter.severity);
      }
      if (filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      if (filter.type !== 'all') {
        query = query.eq('type', filter.type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching incidents:', error);
        toast.error('Failed to load incidents');
        return;
      }

      // Transform data to match our Incident type
      const transformedIncidents: Incident[] = (data || []).map((inc: Record<string, unknown>) => ({
        id: inc.id as string,
        type: inc.type as IncidentType,
        severity: inc.severity as IncidentSeverity,
        status: inc.status as IncidentStatus,
        title: inc.title as string,
        description: inc.description as string,
        affectedEntities: (inc.incident_affected_entities as unknown[] || []).map((e: Record<string, unknown>) => ({
          type: e.entity_type as string,
          id: e.entity_id as string,
          name: e.entity_name as string,
        })),
        metrics: inc.metrics as { label: string; value: number; change?: number }[] || [],
        createdAt: inc.created_at as string,
        acknowledgedAt: inc.acknowledged_at as string | undefined,
        acknowledgedBy: inc.acknowledged_by as string | undefined,
        resolvedAt: inc.resolved_at as string | undefined,
        assignedTo: inc.assigned_to as string | undefined,
        notes: (inc.incident_notes as unknown[] || []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          authorId: n.author_id as string,
          authorName: n.author_name as string,
          content: n.content as string,
          createdAt: n.created_at as string,
          isSystemGenerated: n.is_system_generated as boolean,
        })),
        automatedResponse: inc.auto_response_triggered as boolean,
      }));

      setIncidents(transformedIncidents);

      // Calculate stats
      setStats({
        active: transformedIncidents.filter(i => i.status !== 'resolved').length,
        critical: transformedIncidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length,
        high: transformedIncidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length,
        acknowledged: transformedIncidents.filter(i => i.status === 'acknowledged').length,
        resolvedToday: transformedIncidents.filter(i => {
          if (i.status !== 'resolved') return false;
          const today = new Date().toDateString();
          return new Date(i.resolvedAt || '').toDateString() === today;
        }).length,
        avgResolutionTime: 45, // Could calculate this from data
        topTypes: Object.entries(
          transformedIncidents.reduce((acc, i) => {
            acc[i.type] = (acc[i.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      });

      // Fetch real-time metrics from RPC
      const { data: metricsData } = await supabase.rpc('get_admin_metrics');
      if (metricsData) {
        setMetrics({
          activeUsers: metricsData.active_users || 0,
          reportsPerHour: metricsData.reports_per_hour || 0,
          tournamentsLive: metricsData.tournaments_live || 0,
          systemHealth: metricsData.system_health || 98,
          moderationQueue: metricsData.moderation_queue || 0,
          pendingDisputes: metricsData.pending_disputes || 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [filter.severity, filter.status, filter.type]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Real-time subscription for new incidents
  useEffect(() => {
    const channelId = subscriptionManager.subscribe({
      table: 'incidents',
      event: 'INSERT',
      callback: (payload) => {
        const newIncident = payload.new;
        toast.warning(`New incident: ${newIncident.title || 'Alert'}`, {
          description: 'Refresh to see updated incident list',
          action: {
            label: 'Refresh',
            onClick: () => fetchIncidents(),
          },
        });
      },
    });

    return () => {
      subscriptionManager.unsubscribe(channelId);
    };
  }, [fetchIncidents]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 10) - 5,
        reportsPerHour: Math.max(0, prev.reportsPerHour + Math.floor(Math.random() * 6) - 3),
        moderationQueue: Math.max(0, prev.moderationQueue + Math.floor(Math.random() * 4) - 2),
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle incident action
  const handleIncidentAction = async (action: string, data?: object) => {
    if (!selectedIncident || !profile) return;

    try {
      const now = new Date().toISOString();
      const note = (data as { note?: string })?.note;

      setIncidents(prev => prev.map(inc => {
        if (inc.id !== selectedIncident.id) return inc;

        const updates: Partial<Incident> = {};

        switch (action) {
          case 'acknowledge':
            updates.status = 'acknowledged';
            updates.acknowledgedAt = now;
            updates.acknowledgedBy = profile.email || 'Unknown';
            break;
          case 'investigate':
            updates.status = 'investigating';
            updates.assignedTo = profile.email || 'Unknown';
            break;
          case 'resolve':
            updates.status = 'resolved';
            updates.resolvedAt = now;
            updates.resolvedBy = profile.email || 'Unknown';
            break;
          case 'escalate':
            updates.status = 'escalated';
            updates.severity = 'critical' as IncidentSeverity;
            break;
        }

        const newNotes = [...inc.notes];
        if (note) {
          newNotes.push({
            id: `note-${Date.now()}`,
            authorId: profile.id,
            authorName: profile.email || 'Admin',
            content: note,
            createdAt: now,
            isSystemGenerated: false,
          });
        }
        if (action !== 'add_note') {
          newNotes.push({
            id: `note-${Date.now()}-system`,
            authorId: 'system',
            authorName: 'System',
            content: `Incident ${action}d by ${profile.email}`,
            createdAt: now,
            isSystemGenerated: true,
          });
        }

        return { ...inc, ...updates, notes: newNotes };
      }));

      toast.success(`Incident ${action.replace('_', ' ')} successful`);

      if (action === 'resolve' || action === 'escalate') {
        setIsDetailOpen(false);
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (filter.severity !== 'all' && inc.severity !== filter.severity) return false;
      if (filter.status !== 'all' && inc.status !== filter.status) return false;
      if (filter.type !== 'all' && inc.type !== filter.type) return false;
      return true;
    });
  }, [incidents, filter]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Incident Center</h1>
            <p className="text-slate-400 mt-1">Real-time operations monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            Auto-refresh
          </label>
          <Button variant="outline" onClick={fetchIncidents} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Active Users"
          value={metrics.activeUsers.toLocaleString()}
          icon={Users}
          color="text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
        />
        <MetricCard
          label="Reports/Hour"
          value={metrics.reportsPerHour}
          change={15}
          icon={Flag}
          color="text-orange-400 bg-orange-500/10 border-orange-500/30"
          alert={metrics.reportsPerHour > 20}
        />
        <MetricCard
          label="Live Tournaments"
          value={metrics.tournamentsLive}
          icon={Trophy}
          color="text-green-400 bg-green-500/10 border-green-500/30"
        />
        <MetricCard
          label="System Health"
          value={`${metrics.systemHealth}%`}
          icon={Activity}
          color="text-green-400 bg-green-500/10 border-green-500/30"
        />
        <MetricCard
          label="Mod Queue"
          value={metrics.moderationQueue}
          icon={Shield}
          color="text-blue-400 bg-blue-500/10 border-blue-500/30"
          alert={metrics.moderationQueue > 50}
        />
        <MetricCard
          label="Pending Disputes"
          value={metrics.pendingDisputes}
          icon={AlertTriangle}
          color="text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
        />
      </div>

      {/* Incident Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats?.active ?? 0}</p>
            <p className="text-xs text-slate-500">Active Incidents</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{stats?.critical ?? 0}</p>
            <p className="text-xs text-red-400/60">Critical</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-orange-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-400">{stats?.high ?? 0}</p>
            <p className="text-xs text-orange-400/60">High Priority</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats?.acknowledged ?? 0}</p>
            <p className="text-xs text-slate-500">Acknowledged</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats?.resolvedToday ?? 0}</p>
            <p className="text-xs text-slate-500">Resolved Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={filter.severity}
              onValueChange={(v) => setFilter(f => ({ ...f, severity: v as any }))}
            >
              <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 text-slate-200">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filter.status}
              onValueChange={(v) => setFilter(f => ({ ...f, status: v as any }))}
            >
              <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 text-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filter.type}
              onValueChange={(v) => setFilter(f => ({ ...f, type: v as any }))}
            >
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700 text-slate-200">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(INCIDENT_TYPE_CONFIG).map(([type, config]) => (
                  <SelectItem key={type} value={type}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="active" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            Active ({filteredIncidents.filter(i => i.status !== 'resolved').length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            Resolved ({filteredIncidents.filter(i => i.status === 'resolved').length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            All ({filteredIncidents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 bg-slate-900/50" />
              ))}
            </div>
          ) : filteredIncidents.filter(i => i.status !== 'resolved').length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300">All Clear</h3>
                <p className="text-slate-500 mt-1">No active incidents matching your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredIncidents
                  .filter(i => i.status !== 'resolved')
                  .map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onSelect={() => {
                        setSelectedIncident(incident);
                        setIsDetailOpen(true);
                      }}
                    />
                  ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredIncidents
                .filter(i => i.status === 'resolved')
                .map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    onSelect={() => {
                      setSelectedIncident(incident);
                      setIsDetailOpen(true);
                    }}
                  />
                ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onSelect={() => {
                    setSelectedIncident(incident);
                    setIsDetailOpen(true);
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <IncidentDetailSheet
        incident={selectedIncident}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onAction={handleIncidentAction}
        currentUserId={profile?.id || ''}
        currentUserEmail={profile?.email || ''}
      />
    </div>
  );
}

export default AdminIncidents;
