// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Admin Context
// Core context for admin state, permissions, and real-time data
// ═══════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type {
  AdminRole,
  AdminPermission,
  DashboardMetrics,
  AdminActivity,
  SystemAlert,
  QuickAction,
  AuditLogEntry,
  SearchResult,
  SearchFilters,
} from '@/types/admin';

// ── Context State ─────────────────────────────────────────────────────────────

interface AdminContextState {
  // Permissions
  role: AdminRole | null;
  permissions: AdminPermission[];
  hasPermission: (permission: AdminPermission, scope?: { type: string; id?: string }) => boolean;
  
  // Dashboard Data
  metrics: DashboardMetrics | null;
  activities: AdminActivity[];
  alerts: SystemAlert[];
  unreadAlerts: number;
  
  // Global Search
  searchResults: SearchResult[];
  isSearching: boolean;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  
  // Quick Actions
  quickActions: QuickAction[];
  
  // Audit Logs (last 50 for sidebar)
  recentAuditLogs: AuditLogEntry[];
  
  // Real-time
  isRealtimeConnected: boolean;
  
  // Loading States
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  refreshMetrics: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissActivity: (activityId: string) => void;
}

// ── Default State ────────────────────────────────────────────────────────────

const defaultState: AdminContextState = {
  role: null,
  permissions: [],
  hasPermission: () => false,
  metrics: null,
  activities: [],
  alerts: [],
  unreadAlerts: 0,
  searchResults: [],
  isSearching: false,
  search: async () => {},
  quickActions: [],
  recentAuditLogs: [],
  isRealtimeConnected: false,
  isLoading: true,
  isInitialized: false,
  refreshMetrics: async () => {},
  refreshActivities: async () => {},
  markAlertRead: async () => {},
  acknowledgeAlert: async () => {},
  dismissActivity: () => {},
};

// ── Context Creation ──────────────────────────────────────────────────────────

const AdminContext = createContext<AdminContextState>(defaultState);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

// ── Quick Actions Configuration ──────────────────────────────────────────────

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'ban-user',
    label: 'Ban User',
    description: 'Quickly ban a user by username',
    icon: 'Ban',
    permission: 'users.ban',
    shortcut: '⌘+B',
  },
  {
    id: 'create-tournament',
    label: 'Create Tournament',
    description: 'Create a new tournament',
    icon: 'Trophy',
    permission: 'tournaments.create',
    href: '/admin/tournaments/create',
    shortcut: '⌘+T',
  },
  {
    id: 'moderate-reports',
    label: 'Review Reports',
    description: 'Check pending moderation reports',
    icon: 'Shield',
    permission: 'moderation.view',
    href: '/admin/moderation',
    shortcut: '⌘+R',
  },
  {
    id: 'add-game',
    label: 'Add Game',
    description: 'Add a new game to the platform',
    icon: 'Gamepad2',
    permission: 'games.create',
    href: '/admin/games',
    shortcut: '⌘+G',
  },
  {
    id: 'grant-permission',
    label: 'Grant Permission',
    description: 'Grant permissions to a user',
    icon: 'Key',
    permission: 'permissions.grant',
    href: '/admin/permissions',
    shortcut: '⌘+P',
  },
];

// ── Provider Component ────────────────────────────────────────────────────────

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  
  // State
  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine role from profile
  useEffect(() => {
    if (!profile) {
      setRole(null);
      setPermissions([]);
      return;
    }

    const userRole = profile.role as AdminRole;
    setRole(userRole);

    // Set default permissions based on role
    const rolePermissions = getRolePermissions(userRole);
    setPermissions(rolePermissions);
  }, [profile]);

  // Permission check function
  const hasPermission = useCallback((
    permission: AdminPermission,
    scope?: { type: string; id?: string }
  ): boolean => {
    // Super admin has all permissions
    if (role === 'SUPER_ADMIN') return true;
    
    // Check if permission exists
    if (permissions.includes(permission)) return true;
    
    // Check wildcard permissions (e.g., 'users.*')
    const [category] = permission.split('.');
    if (permissions.includes(`${category}.*` as AdminPermission)) return true;
    
    return false;
  }, [role, permissions]);

  // Filter quick actions based on permissions
  const quickActions = DEFAULT_QUICK_ACTIONS.filter(action => 
    hasPermission(action.permission)
  );

  // Fetch metrics
  const refreshMetrics = useCallback(async () => {
    if (!user) return;
    
    try {
      // Aggregate dashboard metrics from multiple tables
      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: newUsers },
        { count: totalTournaments },
        { count: liveTournaments },
        { count: pendingReports },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      // Get recent content counts
      const { count: postsToday } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setMetrics({
        users: {
          total: totalUsers || 0,
          active_today: activeUsers || 0,
          active_this_week: 0, // Will calculate
          new_today: newUsers || 0,
          new_this_week: 0,
          retention_rate: 0,
          top_regions: [],
          growth_trend: [],
        },
        tournaments: {
          total_active: totalTournaments || 0,
          live_now: liveTournaments || 0,
          pending_approval: 0,
          completed_this_week: 0,
          total_participants: 0,
          avg_participants: 0,
          top_games: [],
          fill_rates: [],
        },
        community: {
          posts_today: postsToday || 0,
          clips_today: 0,
          comments_today: 0,
          total_content: 0,
          engagement_rate: 0,
          trending_topics: [],
          top_creators: [],
        },
        moderation: {
          pending_reports: pendingReports || 0,
          resolved_today: 0,
          avg_resolution_time: 0,
          escalation_rate: 0,
          repeat_offenders: 0,
          toxicity_trend: [],
        },
        system: {
          uptime: 99.9,
          response_time: 120,
          error_rate: 0.01,
          active_connections: 0,
          queue_depth: 0,
        },
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [user]);

  // Fetch recent activities
  const refreshActivities = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch recent audit logs as activities
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logs) {
        const formattedActivities: AdminActivity[] = logs.map((log: Record<string, unknown>) => ({
          id: log.id as string,
          type: mapAuditToActivityType(log.action_type as string),
          severity: log.severity as AdminActivity['severity'],
          title: formatActivityTitle(log),
          description: log.details as string || '',
          actor: log.actor_id ? {
            id: log.actor_id as string,
            username: log.actor_username as string || 'Unknown',
            avatar_url: null,
            risk_level: 'low',
          } : null,
          target: log.target_id ? {
            id: log.target_id as string,
            type: log.target_type as AdminActivity['type'] || 'user',
            title: log.target_name as string || 'Unknown',
            content: null,
            author: {
              id: log.target_author_id as string || '',
              username: log.target_author_name as string || 'Unknown',
              avatar_url: null,
              risk_level: 'low',
            },
          } : null,
          created_at: log.created_at as string,
          is_read: false,
        }));

        setActivities(formattedActivities);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENHANCED GLOBAL SEARCH
  // ═══════════════════════════════════════════════════════════════════════════════

  const search = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const results: SearchResult[] = [];
      const searchTerm = query.toLowerCase();
      const limit = filters?.limit || 10;
      const types = filters?.types || ['user', 'tournament', 'post', 'clip', 'game', 'report', 'team', 'club'];

      // Search users
      if (types.includes('user')) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url, role, gamer_cred, status, created_at')
          .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .limit(limit);

        if (users) {
          results.push(...users.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            type: 'user' as const,
            title: u.username as string,
            subtitle: `${u.email as string} • ${u.gamer_cred ? (u.gamer_cred as number).toLocaleString() : 0} GC`,
            image_url: u.avatar_url as string | null,
            status: u.status as string || u.role as string || 'active',
            metadata: {
              joined: new Date(u.created_at as string).toLocaleDateString(),
              gamerCred: u.gamer_cred as number || 0,
            },
            updated_at: u.created_at as string,
          } as SearchResult)));
        }
      }

      // Search tournaments
      if (types.includes('tournament')) {
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('id, name, status, game_type, entry_fee, prize_pool, date, created_at')
          .ilike('name', `%${searchTerm}%`)
          .limit(limit);

        if (tournaments) {
          results.push(...tournaments.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            type: 'tournament' as const,
            title: t.name as string,
            subtitle: `${t.game_type as string || 'Game'} • ${t.status as string} • Prize: $${t.prize_pool || 0}`,
            image_url: null,
            status: t.status as string,
            metadata: {
              date: new Date(t.date as string).toLocaleDateString(),
              entryFee: t.entry_fee as number || 0,
              prizePool: t.prize_pool as number || 0,
            },
            updated_at: t.created_at as string,
          } as SearchResult)));
        }
      }

      // Search posts
      if (types.includes('post')) {
        const { data: posts } = await supabase
          .from('posts')
          .select('id, title, content, tag, likes, comments, created_at, user_id')
          .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
          .limit(limit);

        if (posts) {
          results.push(...posts.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            type: 'post' as const,
            title: (p.title as string) || 'Untitled Post',
            subtitle: `${(p.content as string)?.substring(0, 60)}... • ${p.likes || 0} likes`,
            image_url: null,
            status: 'active',
            metadata: {
              tag: p.tag as string,
              likes: p.likes as number || 0,
              comments: p.comments as number || 0,
            },
            updated_at: p.created_at as string,
          } as SearchResult)));
        }
      }

      // Search games
      if (types.includes('game')) {
        const { data: games } = await supabase
          .from('games')
          .select('id, name, category, player_count, tournament_count, status, created_at')
          .ilike('name', `%${searchTerm}%`)
          .limit(limit);

        if (games) {
          results.push(...games.map((g: Record<string, unknown>) => ({
            id: g.id as string,
            type: 'game' as const,
            title: g.name as string,
            subtitle: `${g.category as string || 'Game'} • ${g.player_count || 0} players • ${g.tournament_count || 0} tournaments`,
            image_url: null,
            status: g.status as string || 'active',
            metadata: {
              category: g.category as string,
              players: g.player_count as number || 0,
              tournaments: g.tournament_count as number || 0,
            },
            updated_at: g.created_at as string,
          } as SearchResult)));
        }
      }

      // Search reports
      if (types.includes('report')) {
        const { data: reports } = await supabase
          .from('reports')
          .select('id, reason, category, status, created_at')
          .or(`reason.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
          .limit(limit);

        if (reports) {
          results.push(...reports.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            type: 'report' as const,
            title: `Report: ${r.category as string}`,
            subtitle: r.reason as string,
            image_url: null,
            status: r.status as string,
            metadata: {
              category: r.category as string,
            },
            updated_at: r.created_at as string,
          } as SearchResult)));
        }
      }

      // Search teams
      if (types.includes('team')) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name, tag, members_count, wins, losses, created_at')
          .ilike('name', `%${searchTerm}%`)
          .limit(limit);

        if (teams) {
          results.push(...teams.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            type: 'team' as const,
            title: `[${t.tag as string}] ${t.name as string}`,
            subtitle: `${t.members_count || 0} members • ${t.wins || 0}W-${t.losses || 0}L`,
            image_url: null,
            status: 'active',
            metadata: {
              tag: t.tag as string,
              members: t.members_count as number || 0,
              record: `${t.wins || 0}-${t.losses || 0}`,
            },
            updated_at: t.created_at as string,
          } as SearchResult)));
        }
      }

      // Search clubs
      if (types.includes('club')) {
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id, name, description, member_count, created_at')
          .ilike('name', `%${searchTerm}%`)
          .limit(limit);

        if (clubs) {
          results.push(...clubs.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            type: 'club' as const,
            title: c.name as string,
            subtitle: `${(c.description as string)?.substring(0, 50)}... • ${c.member_count || 0} members`,
            image_url: null,
            status: 'active',
            metadata: {
              members: c.member_count as number || 0,
            },
            updated_at: c.created_at as string,
          } as SearchResult)));
        }
      }

      // Sort results by relevance (title match gets priority)
      results.sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().includes(searchTerm) ? 2 : 0;
        const bTitleMatch = b.title.toLowerCase().includes(searchTerm) ? 2 : 0;
        const aSubtitleMatch = a.subtitle.toLowerCase().includes(searchTerm) ? 1 : 0;
        const bSubtitleMatch = b.subtitle.toLowerCase().includes(searchTerm) ? 1 : 0;
        return (bTitleMatch + bSubtitleMatch) - (aTitleMatch + aSubtitleMatch);
      });

      // Limit total results
      setSearchResults(results.slice(0, 20));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Mark alert as read
  const markAlertRead = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged_at: new Date().toISOString() } : a
    ));
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('system_alerts')
        .update({ acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
        .eq('id', alertId);
      
      markAlertRead(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }, [user, markAlertRead]);

  // Dismiss activity
  const dismissActivity = useCallback((activityId: string) => {
    setActivities(prev => prev.filter(a => a.id !== activityId));
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!user || !role) return;

    setIsRealtimeConnected(true);

    // Subscribe to audit logs
    const auditChannel = supabase
      .channel('admin-audit-logs')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          // Add new activity
          const newActivity: AdminActivity = {
            id: payload.new.id,
            type: mapAuditToActivityType(payload.new.action_type),
            severity: payload.new.severity || 'info',
            title: formatActivityTitle(payload.new),
            description: payload.new.details || '',
            actor: payload.new.actor_id ? {
              id: payload.new.actor_id,
              username: payload.new.actor_username || 'Unknown',
              avatar_url: null,
              risk_level: 'low',
            } : null,
            target: payload.new.target_id ? {
              id: payload.new.target_id,
              type: payload.new.target_type || 'user',
              title: payload.new.target_name || 'Unknown',
              content: null,
              author: {
                id: payload.new.target_author_id || '',
                username: payload.new.target_author_name || 'Unknown',
                avatar_url: null,
                risk_level: 'low',
              },
            } : null,
            created_at: payload.new.created_at,
            is_read: false,
          };
          
          setActivities(prev => [newActivity, ...prev].slice(0, 50));
          
          // Show toast for critical actions
          if (payload.new.severity === 'critical') {
            toast.warning(`Critical: ${newActivity.title}`, {
              description: newActivity.description,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to system alerts
    const alertsChannel = supabase
      .channel('admin-alerts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_alerts' },
        (payload) => {
          setAlerts(prev => [payload.new as SystemAlert, ...prev]);
          
          if (payload.new.severity === 'critical') {
            toast.error(`System Alert: ${payload.new.title}`, {
              description: payload.new.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      auditChannel.unsubscribe();
      alertsChannel.unsubscribe();
      setIsRealtimeConnected(false);
    };
  }, [user, role]);

  // Initial data load
  useEffect(() => {
    if (!user || !role) {
      setIsLoading(false);
      return;
    }

    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([
        refreshMetrics(),
        refreshActivities(),
      ]);
      setIsInitialized(true);
      setIsLoading(false);
    };

    loadInitialData();
  }, [user, role, refreshMetrics, refreshActivities]);

  // Calculate unread alerts
  const unreadAlerts = alerts.filter(a => !a.acknowledged_by).length;

  const value: AdminContextState = {
    role,
    permissions,
    hasPermission,
    metrics,
    activities,
    alerts,
    unreadAlerts,
    searchResults,
    isSearching,
    search,
    quickActions,
    recentAuditLogs,
    isRealtimeConnected,
    isLoading,
    isInitialized,
    refreshMetrics,
    refreshActivities,
    markAlertRead,
    acknowledgeAlert,
    dismissActivity,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

// ── Helper Functions ────────────────────────────────────────────────────────────

function getRolePermissions(role: AdminRole): AdminPermission[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['*'] as AdminPermission[]; // All permissions
    case 'ADMIN':
      return [
        'users.view', 'users.manage', 'users.ban', 'users.suspend',
        'games.view', 'games.manage', 'games.create', 'games.delete',
        'tournaments.view', 'tournaments.create', 'tournaments.edit', 'tournaments.delete',
        'tournaments.approve', 'tournaments.override_results',
        'community.view', 'community.moderate', 'community.feature', 'community.delete',
        'moderation.view', 'moderation.resolve', 'moderation.escalate', 'moderation.ban',
        'permissions.view', 'permissions.grant', 'permissions.revoke',
        'analytics.view', 'analytics.export',
        'system.view', 'system.configure', 'system.audit',
      ];
    case 'MODERATOR':
      return [
        'users.view',
        'tournaments.view',
        'community.view', 'community.moderate',
        'moderation.view', 'moderation.resolve', 'moderation.ban',
        'analytics.view',
      ];
    case 'TOURNAMENT_HOST':
      return [
        'tournaments.view', 'tournaments.create', 'tournaments.edit',
        'users.view',
        'community.view',
      ];
    case 'CLUB_LEADER':
      return [
        'users.view',
        'community.view', 'community.moderate',
      ];
    default:
      return [];
  }
}

function mapAuditToActivityType(actionType: string): AdminActivity['type'] {
  if (actionType?.includes('ban') || actionType?.includes('suspend')) return 'moderation_action';
  if (actionType?.includes('tournament')) return 'tournament_created';
  if (actionType?.includes('report')) return 'user_report';
  if (actionType?.includes('dispute')) return 'dispute_filed';
  if (actionType?.includes('alert')) return 'system_alert';
  return 'user_report';
}

function formatActivityTitle(log: Record<string, unknown>): string {
  const action = log.action_type as string;
  const target = log.target_name as string || 'Unknown';
  
  switch (action) {
    case 'user.ban': return `Banned user ${target}`;
    case 'user.unban': return `Unbanned user ${target}`;
    case 'tournament.create': return `Created tournament ${target}`;
    case 'tournament.approve': return `Approved tournament ${target}`;
    case 'content.delete': return `Deleted ${log.target_type} ${target}`;
    case 'report.resolve': return `Resolved report on ${target}`;
    case 'permission.grant': return `Granted permissions to ${target}`;
    default: return `${action} on ${target}`;
  }
}
