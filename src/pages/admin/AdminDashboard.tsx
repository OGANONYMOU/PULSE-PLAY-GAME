// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Professional Dashboard (Consolidated)
// Intelligent command center with real-time metrics, alerts, and quick actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Trophy, ShieldAlert, Activity,
  TrendingUp, TrendingDown, Zap, Clock, AlertTriangle,
  Ban, Gamepad2, RefreshCw,
  ChevronRight, Flame, Terminal,
  BarChart3, PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { differenceInHours } from 'date-fns';
import type { AdminActivity, SystemAlert } from '@/types/admin';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
} from 'recharts';

// ── Metric Card Component ──────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  onClick?: () => void;
}

function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last week',
  icon,
  color,
  trend = 'neutral',
  loading,
  onClick,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-slate-900/50 backdrop-blur-sm",
        "transition-all duration-300",
        onClick && "cursor-pointer hover:border-slate-600",
        color === 'cyan' && "border-cyan-500/20",
        color === 'purple' && "border-purple-500/20",
        color === 'yellow' && "border-yellow-500/20",
        color === 'red' && "border-red-500/20",
        color === 'green' && "border-green-500/20",
        color === 'blue' && "border-blue-500/20",
      )}
      onClick={onClick}
    >
      {/* Glow effect */}
      <div className={cn(
        "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-10",
        color === 'cyan' && "bg-cyan-500",
        color === 'purple' && "bg-purple-500",
        color === 'yellow' && "bg-yellow-500",
        color === 'red' && "bg-red-500",
        color === 'green' && "bg-green-500",
        color === 'blue' && "bg-blue-500",
      )} />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            color === 'cyan' && "bg-cyan-500/10 text-cyan-400",
            color === 'purple' && "bg-purple-500/10 text-purple-400",
            color === 'yellow' && "bg-yellow-500/10 text-yellow-400",
            color === 'red' && "bg-red-500/10 text-red-400",
            color === 'green' && "bg-green-500/10 text-green-400",
            color === 'blue' && "bg-blue-500/10 text-blue-400",
          )}>
            {icon}
          </div>
          
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === 'up' && "text-green-400",
              trend === 'down' && "text-red-400",
              trend === 'neutral' && "text-slate-400",
            )}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
               trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
              {change > 0 ? '+' : ''}{change}%
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-white tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-sm text-slate-400 mt-1">{title}</div>
            
            {changeLabel && (
              <div className="text-xs text-slate-500 mt-2">{changeLabel}</div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Activity Timeline Component ───────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: AdminActivity[] }) {
  const getActivityIcon = (type: AdminActivity['type']) => {
    switch (type) {
      case 'moderation_action': return <Ban className="w-3 h-3" />;
      case 'tournament_created': return <Trophy className="w-3 h-3" />;
      case 'dispute_filed': return <AlertTriangle className="w-3 h-3" />;
      case 'system_alert': return <ShieldAlert className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const getActivityColor = (severity: AdminActivity['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-red-500';
      case 'warning': return 'bg-yellow-500 text-yellow-500';
      default: return 'bg-cyan-500 text-cyan-500';
    }
  };

  return (
    <div className="space-y-4">
      {activities.slice(0, 8).map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex gap-3"
        >
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "bg-slate-800 border border-slate-700",
              getActivityColor(activity.severity).split(' ')[1]
            )}>
              <span className={getActivityColor(activity.severity).split(' ')[1]}>
                {getActivityIcon(activity.type)}
              </span>
            </div>
            {index < activities.length - 1 && (
              <div className="w-px flex-1 bg-slate-800 my-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activity.description}
                </p>
                {activity.actor && (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[8px] bg-slate-700">
                        {activity.actor.username[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-slate-400">
                      {activity.actor.username}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {formatDistanceToNowShort(activity.created_at)}
              </span>
            </div>
          </div>
        </motion.div>
      ))}

      {activities.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      )}
    </div>
  );
}

// ── Quick Actions Panel ────────────────────────────────────────────────────────

function QuickActionsPanel() {
  const { hasPermission } = useAdmin();
  const navigate = useNavigate();

  const actions = [
    { id: 'ban', label: 'Ban User', icon: Ban, color: 'red', permission: 'users.ban' },
    { id: 'tournament', label: 'New Tournament', icon: Trophy, color: 'cyan', permission: 'tournaments.create' },
    { id: 'moderate', label: 'Review Reports', icon: ShieldAlert, color: 'yellow', permission: 'moderation.view' },
    { id: 'game', label: 'Add Game', icon: Gamepad2, color: 'purple', permission: 'games.create' },
  ].filter(a => !a.permission || hasPermission(a.permission as never));

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (action.id === 'tournament') {
              navigate('/admin/tournaments/create');
            } else if (action.id === 'moderate') {
              navigate('/admin/moderation');
            } else if (action.id === 'game') {
              navigate('/admin/games');
            }
          }}
          className={cn(
            "p-4 rounded-xl border bg-slate-900/50 text-left transition-all",
            action.color === 'red' && "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5",
            action.color === 'cyan' && "border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5",
            action.color === 'yellow' && "border-yellow-500/20 hover:border-yellow-500/40 hover:bg-yellow-500/5",
            action.color === 'purple' && "border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5",
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
            action.color === 'red' && "bg-red-500/10 text-red-400",
            action.color === 'cyan' && "bg-cyan-500/10 text-cyan-400",
            action.color === 'yellow' && "bg-yellow-500/10 text-yellow-400",
            action.color === 'purple' && "bg-purple-500/10 text-purple-400",
          )}>
            <action.icon className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-200">{action.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">Quick action</p>
        </motion.button>
      ))}
    </div>
  );
}

// ── System Health Monitor ────────────────────────────────────────────────────

function SystemHealthMonitor() {
  const { metrics } = useAdmin();
  const systemMetrics = metrics?.system;

  const healthChecks = [
    { name: 'API Response', value: systemMetrics?.response_time || 120, threshold: 500, unit: 'ms' },
    { name: 'Uptime', value: systemMetrics?.uptime || 99.9, threshold: 99, unit: '%' },
    { name: 'Error Rate', value: (systemMetrics?.error_rate || 0.01) * 100, threshold: 5, unit: '%' },
  ];

  return (
    <div className="space-y-4">
      {healthChecks.map((check) => {
        const isHealthy = check.value < check.threshold;
        return (
          <div key={check.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{check.name}</span>
              <span className={cn(
                "font-medium",
                isHealthy ? "text-green-400" : "text-red-400"
              )}>
                {check.value.toFixed(1)}{check.unit}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((check.value / check.threshold) * 100, 100)}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className={cn(
                  "h-full rounded-full",
                  isHealthy ? "bg-green-500" : "bg-red-500"
                )}
              />
            </div>
          </div>
        );
      })}

      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-slate-300">All Systems Operational</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
            Healthy
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ── Alert Banner Component ───────────────────────────────────────────────────

function AlertBanner({ alert }: { alert: SystemAlert }) {
  const colors = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
    high: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    low: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border",
        colors[alert.severity]
      )}
    >
      {alert.severity === 'critical' ? (
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      ) : (
        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{alert.title}</p>
        <p className="text-xs opacity-80 line-clamp-1">{alert.message}</p>
      </div>
      <Button size="sm" variant="ghost" className="flex-shrink-0 h-7 text-xs">
        View
      </Button>
    </motion.div>
  );
}

// ── Chart Components ────────────────────────────────────────────────────────────

function UserGrowthChart() {
  const data = [
    { date: 'Mon', users: 120, new: 12 },
    { date: 'Tue', users: 135, new: 15 },
    { date: 'Wed', users: 148, new: 13 },
    { date: 'Thu', users: 162, new: 14 },
    { date: 'Fri', users: 185, new: 23 },
    { date: 'Sat', users: 210, new: 25 },
    { date: 'Sun', users: 245, new: 35 },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Area
          type="monotone"
          dataKey="users"
          stroke="#06b6d4"
          strokeWidth={2}
          fill="url(#userGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TournamentStatusChart() {
  const data = [
    { name: 'Live', value: 5, color: '#22c55e' },
    { name: 'Upcoming', value: 12, color: '#06b6d4' },
    { name: 'Pending', value: 3, color: '#eab308' },
    { name: 'Completed', value: 45, color: '#64748b' },
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RePieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function formatDistanceToNowShort(date: string): string {
  const hours = differenceInHours(new Date(), new Date(date));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Main Dashboard Component ───────────────────────────────────────────────────

export function AdminDashboard() {
  const { profile } = useAuth();
  const { 
    metrics, 
    activities, 
    alerts, 
    refreshMetrics, 
    isLoading,
    isRealtimeConnected,
  } = useAdmin();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshMetrics();
    setIsRefreshing(false);
  };

  // Get critical alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Command Center
            </h1>
            {isRealtimeConnected && (
              <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back, {profile?.username}. Here's your operations overview.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      <AnimatePresence>
        {criticalAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {criticalAlerts.slice(0, 2).map(alert => (
              <AlertBanner key={alert.id} alert={alert} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={metrics?.users.total || 0}
          change={12.5}
          changeLabel="+120 this week"
          icon={<Users className="w-5 h-5" />}
          color="cyan"
          trend="up"
          loading={isLoading}
          onClick={() => navigate('/admin/users')}
        />
        <MetricCard
          title="Live Tournaments"
          value={metrics?.tournaments.live_now || 0}
          change={8.2}
          changeLabel="Active now"
          icon={<Trophy className="w-5 h-5" />}
          color="yellow"
          trend="up"
          loading={isLoading}
          onClick={() => navigate('/admin/tournaments')}
        />
        <MetricCard
          title="Pending Reports"
          value={metrics?.moderation.pending_reports || 0}
          change={metrics?.moderation.pending_reports ? -5 : 0}
          changeLabel="Needs attention"
          icon={<ShieldAlert className="w-5 h-5" />}
          color="red"
          trend={metrics?.moderation.pending_reports ? 'down' : 'neutral'}
          loading={isLoading}
          onClick={() => navigate('/admin/moderation')}
        />
        <MetricCard
          title="Active Today"
          value={metrics?.users.active_today || 0}
          change={15.3}
          changeLabel="Daily active users"
          icon={<Activity className="w-5 h-5" />}
          color="green"
          trend="up"
          loading={isLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  User Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserGrowthChart />
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-yellow-400" />
                  Tournament Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TournamentStatusChart />
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Live
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" /> Upcoming
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" /> Pending
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Timeline */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-slate-400">
                View All <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActionsPanel />
            </CardContent>
          </Card>

          {/* System Health */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-green-400" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SystemHealthMonitor />
            </CardContent>
          </Card>

          {/* Live Stats */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Live Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Active Sessions</span>
                <span className="text-sm font-medium text-white">247</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Matches Today</span>
                <span className="text-sm font-medium text-white">18</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Posts Today</span>
                <span className="text-sm font-medium text-white">{metrics?.community.posts_today || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">New Signups</span>
                <span className="text-sm font-medium text-green-400">+{metrics?.users.new_today || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}