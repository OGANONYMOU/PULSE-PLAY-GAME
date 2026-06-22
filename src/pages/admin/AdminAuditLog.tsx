// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Audit Logs Module
// Comprehensive audit trail with filtering, analytics, and export
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Activity, ShieldAlert, RefreshCw, Search, ChevronDown,
  Shield, Users, Gamepad2, Trophy, MessageSquare, AlertTriangle, Layers,
  FileText, Download, Filter, Calendar, Ban, Gavel,
  CheckCircle2, Trash2, Lock, Unlock, Eye,
  FileJson, FileSpreadsheet, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, subDays, subHours, isAfter, parseISO } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type AuditLogEntry = {
  id: string;
  ts: string;
  actor_id: string | null;
  actor_email?: string;
  actor_username?: string;
  action: string;
  action_category: string;
  target_type: string;
  target_id: string | null;
  target_name?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
};

type AuditStats = {
  totalEntries: number;
  todayEntries: number;
  criticalEvents: number;
  uniqueActors: number;
  actionsByCategory: Record<string, number>;
  severityDistribution: Record<string, number>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ACTION_CATEGORIES = [
  { id: 'all', label: 'All', icon: Activity },
  { id: 'user', label: 'Users', icon: Users },
  { id: 'tournament', label: 'Tournaments', icon: Trophy },
  { id: 'match', label: 'Matches', icon: Layers },
  { id: 'moderation', label: 'Moderation', icon: Shield },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'system', label: 'System', icon: ShieldAlert },
] as const;

type ActionCategory = typeof ACTION_CATEGORIES[number]['id'];

const SEVERITY_CONFIG = {
  low: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: CheckCircle2, label: 'Low' },
  medium: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Eye, label: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: AlertTriangle, label: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', icon: ShieldAlert, label: 'Critical' },
};

const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  'tournament.create': { icon: Trophy, color: 'text-green-400' },
  'tournament.update': { icon: Trophy, color: 'text-yellow-400' },
  'tournament.delete': { icon: Trophy, color: 'text-red-400' },
  'tournament.status_change': { icon: Trophy, color: 'text-purple-400' },
  'match.start': { icon: Layers, color: 'text-green-400' },
  'match.status_change': { icon: Layers, color: 'text-purple-400' },
  'dispute.open': { icon: AlertTriangle, color: 'text-red-400' },
  'dispute.resolve': { icon: AlertTriangle, color: 'text-green-400' },
  'user.ban': { icon: Ban, color: 'text-red-400' },
  'user.unban': { icon: Ban, color: 'text-green-400' },
  'user.role_change': { icon: Users, color: 'text-yellow-400' },
  'user.delete': { icon: Trash2, color: 'text-red-400' },
  'user.mute': { icon: MessageSquare, color: 'text-orange-400' },
  'user.unmute': { icon: MessageSquare, color: 'text-green-400' },
  'content.post_delete': { icon: FileText, color: 'text-red-400' },
  'content.clip_delete': { icon: Gamepad2, color: 'text-red-400' },
  'system.login': { icon: Lock, color: 'text-green-400' },
  'system.logout': { icon: Unlock, color: 'text-slate-400' },
  'system.permission_change': { icon: Shield, color: 'text-purple-400' },
  'moderation.resolve': { icon: Gavel, color: 'text-cyan-400' },
};

const getActionIcon = (action: string) => ACTION_ICONS[action] ?? { icon: Activity, color: 'text-slate-400' };

function formatTimestamp(ts: string): string {
  return format(new Date(ts), 'MMM dd, yyyy HH:mm:ss');
}

function formatRelative(ts: string): string {
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SeverityBadge({ severity }: { severity: AuditLogEntry['severity'] }) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;
  return (
    <Badge className={cn('border', config.bg, config.color)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function AuditLogRow({ entry, index, onExpand, isExpanded }: {
  entry: AuditLogEntry;
  index: number;
  onExpand: (id: string) => void;
  isExpanded: boolean;
}) {
  const { icon: Icon, color } = getActionIcon(entry.action);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="rounded-xl overflow-hidden border border-slate-800 hover:border-slate-700 transition-colors"
    >
      <div
        onClick={() => hasDetails && onExpand(entry.id)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
          isExpanded ? 'bg-slate-900/80' : 'bg-slate-950 hover:bg-slate-900/50'
        )}
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color.replace('text-', 'bg-').replace('400', '500') + '/20')}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-200">{entry.action}</span>
            <SeverityBadge severity={entry.severity} />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="font-mono">{entry.actor_username ?? 'system'}</span>
            <span>•</span>
            <span>{formatRelative(entry.ts)}</span>
            {entry.target_name && (
              <>
                <span>•</span>
                <span className="text-slate-400">{entry.target_type}:{entry.target_name}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:block">{formatTimestamp(entry.ts)}</span>
          {hasDetails && (
            <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800 overflow-hidden"
          >
            <div className="p-4 bg-slate-900/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {entry.actor_id && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Actor</p>
                    <p className="text-sm text-slate-300">{entry.actor_email}</p>
                    <p className="text-xs text-slate-600 font-mono">{entry.actor_id}</p>
                  </div>
                )}
                {entry.target_id && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Target</p>
                    <p className="text-sm text-slate-300">{entry.target_type}:{entry.target_name}</p>
                    <p className="text-xs text-slate-600 font-mono">{entry.target_id}</p>
                  </div>
                )}
                {entry.ip_address && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">IP Address</p>
                    <p className="text-sm text-slate-300 font-mono">{entry.ip_address}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">Details</p>
                <pre className="text-xs text-slate-400 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ title, value, change, icon: Icon, color }: {
  title: string;
  value: number;
  change?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
            {change && <p className="text-xs text-green-400 mt-1">{change}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminAuditLog(): React.ReactElement {
  const { hasPermission } = useAdmin();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalEntries: 0, todayEntries: 0, criticalEvents: 0, uniqueActors: 0,
    actionsByCategory: {}, severityDistribution: {},
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActionCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const pageSize = 25;

  const canViewAuditLogs = hasPermission('system.view');

  // Fetch audit logs from Supabase
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles:actor_id(username, email, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date range filter
      if (dateRange === '24h') {
        query = query.gte('created_at', subDays(new Date(), 1).toISOString());
      } else if (dateRange === '7d') {
        query = query.gte('created_at', subDays(new Date(), 7).toISOString());
      } else if (dateRange === '30d') {
        query = query.gte('created_at', subDays(new Date(), 30).toISOString());
      }

      // Apply severity filter
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      // Apply tab/category filter
      if (activeTab !== 'all') {
        query = query.eq('action_category', activeTab);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(
          `action.ilike.%${searchQuery}%,target_name.ilike.%${searchQuery}%,actor_email.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        toast.error('Failed to load audit logs');
        setIsLoading(false);
        return;
      }

      const transformedLogs: AuditLogEntry[] = (data || []).map((log: Record<string, unknown>) => ({
        id: log.id as string,
        ts: log.created_at as string,
        actor_id: log.actor_id as string | null,
        actor_email: log.actor_email as string | undefined,
        actor_username: (log.profiles as { username?: string })?.username,
        action: log.action as string,
        action_category: (log.action_category as string) || 'system',
        target_type: log.target_type as string,
        target_id: log.target_id as string,
        target_name: log.target_name as string | undefined,
        severity: (log.severity as 'low' | 'medium' | 'high' | 'critical') || 'low',
        details: (log.metadata as Record<string, unknown>) || {},
        ip_address: log.ip_address as string | undefined,
      }));

      setLogs(transformedLogs);
      setFilteredLogs(transformedLogs);
      calculateStats(transformedLogs);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateRange, severityFilter, searchQuery]);

  // Fetch logs on mount and when filters change
  useEffect(() => {
    if (canViewAuditLogs) {
      fetchLogs();
    }
  }, [fetchLogs, canViewAuditLogs]);

  // Calculate statistics
  const calculateStats = useCallback((data: AuditLogEntry[]) => {
    const today = new Date();
    const todayEntries = data.filter(l => isAfter(parseISO(l.ts), subDays(today, 1))).length;
    const criticalEvents = data.filter(l => l.severity === 'critical' || l.severity === 'high').length;
    const uniqueActors = new Set(data.map(l => l.actor_id).filter(Boolean)).size;

    const actionsByCategory = data.reduce((acc, l) => {
      acc[l.action_category] = (acc[l.action_category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityDistribution = data.reduce((acc, l) => {
      acc[l.severity] = (acc[l.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setStats({
      totalEntries: data.length,
      todayEntries,
      criticalEvents,
      uniqueActors,
      actionsByCategory,
      severityDistribution,
    });
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...logs];

    // Category filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(l => l.action_category === activeTab);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(query) ||
        l.actor_username?.toLowerCase().includes(query) ||
        l.target_name?.toLowerCase().includes(query) ||
        l.target_type?.toLowerCase().includes(query)
      );
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(l => l.severity === severityFilter);
    }

    // Date range filter
    const now = new Date();
    const cutoffDate = dateRange === '24h' ? subHours(now, 24) :
      dateRange === '7d' ? subDays(now, 7) :
        dateRange === '30d' ? subDays(now, 30) :
          subDays(now, 90);
    filtered = filtered.filter(l => isAfter(parseISO(l.ts), cutoffDate));

    setFilteredLogs(filtered);
    setCurrentPage(0);
  }, [logs, activeTab, searchQuery, severityFilter, dateRange]);

  const paginatedLogs = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handleExport = (exportFormat: 'json' | 'csv') => {
    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulseplay-audit-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    } else {
      const headers = ['timestamp', 'actor', 'action', 'target_type', 'target', 'severity', 'details'];
      const rows = filteredLogs.map(l => [
        l.ts,
        l.actor_username ?? 'system',
        l.action,
        l.target_type,
        l.target_name ?? '',
        l.severity,
        JSON.stringify(l.details),
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulseplay-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    }
    setIsExportDialogOpen(false);
    toast.success(`Exported ${filteredLogs.length} entries as ${exportFormat.toUpperCase()}`);
  };

  if (!canViewAuditLogs) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You do not have permission to view audit logs.</p>
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
          <h1 className="font-orbitron text-2xl font-black text-white mb-1 flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            Audit Logs
          </h1>
          <p className="text-slate-400 text-sm">
            {stats.totalEntries.toLocaleString()} total entries • {stats.criticalEvents} high/critical events
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExportDialogOpen(true)}
            className="border-slate-700 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => setIsLoading(false), 500);
            }}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Entries"
          value={stats.totalEntries}
          icon={FileText}
          color="bg-blue-500/20"
        />
        <StatCard
          title="Today"
          value={stats.todayEntries}
          change="+12% vs yesterday"
          icon={Calendar}
          color="bg-green-500/20"
        />
        <StatCard
          title="Critical Events"
          value={stats.criticalEvents}
          icon={ShieldAlert}
          color="bg-red-500/20"
        />
        <StatCard
          title="Active Actors"
          value={stats.uniqueActors}
          icon={Users}
          color="bg-purple-500/20"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by action, actor, or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800"
          />
        </div>
        <div className="flex gap-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36 bg-slate-900/50 border-slate-800">
              <Filter className="w-4 h-4 mr-2" />
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

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36 bg-slate-900/50 border-slate-800">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActionCategory)}>
        <TabsList className="bg-slate-900/50 border border-slate-800 flex-wrap h-auto gap-1">
          {ACTION_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = stats.actionsByCategory[cat.id] || 0;
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-slate-800 text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {cat.label}
                {count > 0 && <span className="ml-1 text-slate-500">({count})</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <h3 className="text-lg font-medium text-white mb-2">No audit entries found</h3>
              <p className="text-slate-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {paginatedLogs.map((entry, index) => (
                  <AuditLogRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                    isExpanded={expandedId === entry.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && paginatedLogs.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500">
                Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="border-slate-700 text-slate-400 hover:bg-slate-800"
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-500 px-2">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="border-slate-700 text-slate-400 hover:bg-slate-800"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-white">Export Audit Logs</DialogTitle>
            <DialogDescription className="text-slate-400">
              Export {filteredLogs.length} entries
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 py-4">
            <button
              onClick={() => handleExport('json')}
              className="flex-1 p-4 rounded-lg border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all text-center"
            >
              <FileJson className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
              <p className="text-sm font-medium text-white">JSON</p>
              <p className="text-xs text-slate-500">Full structured data</p>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex-1 p-4 rounded-lg border border-slate-800 hover:border-green-500/50 hover:bg-slate-900 transition-all text-center"
            >
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium text-white">CSV</p>
              <p className="text-xs text-slate-500">Spreadsheet format</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
