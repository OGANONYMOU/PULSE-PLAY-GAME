// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Command Center Layout
// Professional esports operations console layout
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, Gamepad2, Trophy, MessageSquare,
  Shield, ShieldAlert, Key, BarChart3, FileText, Settings,
  Bell, Search, Command, Menu, X, ChevronRight, LogOut,
  Zap, Activity, AlertTriangle, CheckCircle2, Clock,
  UserCircle, Crown, Terminal, Sparkles, Filter,
  ArrowUpRight, ArrowDownRight, TrendingUp, Eye, Ban,
  MoreHorizontal, ExternalLink, RefreshCw, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CommandDialog, CommandInput, CommandList,
  CommandEmpty, CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ── Navigation Structure ───────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number | string;
  permission?: string;
  children?: NavItem[];
}

const NAVIGATION: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    id: 'users',
    label: 'Users',
    href: '/admin/users',
    icon: <Users className="w-5 h-5" />,
    permission: 'users.view',
  },
  {
    id: 'games',
    label: 'Games',
    href: '/admin/games',
    icon: <Gamepad2 className="w-5 h-5" />,
    permission: 'games.view',
  },
  {
    id: 'tournaments',
    label: 'Tournaments',
    href: '/admin/tournaments',
    icon: <Trophy className="w-5 h-5" />,
    permission: 'tournaments.view',
    badge: 'Live',
  },
  {
    id: 'community',
    label: 'Community',
    href: '/admin/community',
    icon: <MessageSquare className="w-5 h-5" />,
    permission: 'community.view',
  },
  {
    id: 'moderation',
    label: 'Moderation',
    href: '/admin/moderation',
    icon: <ShieldAlert className="w-5 h-5" />,
    permission: 'moderation.view',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    href: '/admin/permissions',
    icon: <Key className="w-5 h-5" />,
    permission: 'permissions.view',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/admin/analytics',
    icon: <BarChart3 className="w-5 h-5" />,
    permission: 'analytics.view',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    href: '/admin/audit',
    icon: <FileText className="w-5 h-5" />,
    permission: 'system.audit',
  },
  {
    id: 'system',
    label: 'System',
    href: '/admin/system',
    icon: <Settings className="w-5 h-5" />,
    permission: 'system.view',
  },
];

// ── Activity Feed Component ────────────────────────────────────────────────────

function ActivityFeed({ 
  activities, 
  onDismiss 
}: { 
  activities: ReturnType<typeof useAdmin>['activities'];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {activities.slice(0, 10).map((activity) => (
          <motion.div
            key={activity.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              activity.severity === 'critical' 
                ? "bg-red-500/10 border-red-500/30" 
                : activity.severity === 'warning'
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                activity.severity === 'critical' && "bg-red-500 animate-pulse",
                activity.severity === 'warning' && "bg-yellow-500",
                activity.severity === 'info' && "bg-blue-500"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-slate-500">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                  {activity.actor && (
                    <span className="text-[10px] text-slate-400">
                      by {activity.actor.username}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDismiss(activity.id)}
                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {activities.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED GLOBAL SEARCH COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_ICONS: Record<string, React.ReactNode> = {
  user: <Users className="w-4 h-4 text-cyan-400" />,
  tournament: <Trophy className="w-4 h-4 text-yellow-400" />,
  post: <MessageSquare className="w-4 h-4 text-blue-400" />,
  clip: <Play className="w-4 h-4 text-pink-400" />,
  game: <Gamepad2 className="w-4 h-4 text-green-400" />,
  report: <ShieldAlert className="w-4 h-4 text-red-400" />,
  team: <Users className="w-4 h-4 text-purple-400" />,
  club: <Users className="w-4 h-4 text-orange-400" />,
};

const TYPE_COLORS: Record<string, string> = {
  user: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  tournament: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  post: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  clip: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  game: 'bg-green-500/20 text-green-400 border-green-500/30',
  report: 'bg-red-500/20 text-red-400 border-red-500/30',
  team: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  club: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

function GlobalSearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { search, searchResults, isSearching } = useAdmin();
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        search(query, selectedTypes.length > 0 ? { types: selectedTypes as any } : undefined);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search, selectedTypes]);

  const handleSelect = (result: typeof searchResults[0]) => {
    onOpenChange(false);
    switch (result.type) {
      case 'user':
        navigate(`/admin/users?id=${result.id}`);
        break;
      case 'tournament':
        navigate(`/admin/tournaments?id=${result.id}`);
        break;
      case 'game':
        navigate(`/admin/games?id=${result.id}`);
        break;
      case 'report':
        navigate(`/admin/moderation?report=${result.id}`);
        break;
      case 'post':
        navigate(`/admin/community?post=${result.id}`);
        break;
      case 'team':
        navigate(`/teams/${result.id}`);
        break;
      case 'club':
        navigate(`/clubs/${result.id}`);
        break;
      default:
        navigate(`/${result.type}s/${result.id}`);
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const groupedResults = searchResults.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, typeof searchResults>);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search across all entities..."
        value={query}
        onValueChange={setQuery}
        className="border-none focus:ring-0 text-base"
      />

      {/* Type Filters */}
      <div className="px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Filter:</span>
          {['user', 'tournament', 'game', 'post', 'report'].map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-medium capitalize transition-all',
                selectedTypes.includes(type)
                  ? TYPE_COLORS[type]
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <CommandList className="max-h-[60vh]">
        {isSearching ? (
          <div className="py-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
            <p className="text-sm text-slate-400 mt-3">Searching across all entities...</p>
          </div>
        ) : query && searchResults.length === 0 ? (
          <CommandEmpty className="py-8">
            <div className="text-center">
              <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-slate-400">No results found for &quot;{query}&quot;</p>
              <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
            </div>
          </CommandEmpty>
        ) : query ? (
          <>
            {Object.entries(groupedResults).map(([type, results]) => (
              <CommandGroup key={type} heading={`${type.charAt(0).toUpperCase() + type.slice(1)}s (${results.length})`}>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-slate-800/50"
                  >
                    <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center', TYPE_COLORS[type].replace('text-', 'bg-').replace('400', '500/20'))}>
                      {result.image_url ? (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={result.image_url} />
                        </Avatar>
                      ) : (
                        TYPE_ICONS[type] || <Search className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {result.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {result.subtitle}
                      </p>
                    </div>
                    {result.status && (
                      <Badge className={cn('text-[10px] capitalize', TYPE_COLORS[type])}>
                        {result.status}
                      </Badge>
                    )}
                    <ArrowUpRight className="w-4 h-4 text-slate-600" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        ) : (
          <div className="p-4 text-center text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Type to search across all entities</p>
            <p className="text-xs mt-1 opacity-60">Users, tournaments, games, posts, and more</p>
          </div>
        )}

        <CommandSeparator className="my-2" />

        <CommandGroup heading="Quick Actions">
          <div className="grid grid-cols-2 gap-2 p-2">
            <CommandItem
              onSelect={() => { navigate('/admin/users'); onOpenChange(false); }}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-sm">Users</span>
            </CommandItem>
            <CommandItem
              onSelect={() => { navigate('/admin/tournaments'); onOpenChange(false); }}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-sm">Tournaments</span>
            </CommandItem>
            <CommandItem
              onSelect={() => { navigate('/admin/games'); onOpenChange(false); }}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Gamepad2 className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-sm">Games</span>
            </CommandItem>
            <CommandItem
              onSelect={() => { navigate('/admin/moderation'); onOpenChange(false); }}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-sm">Moderation</span>
            </CommandItem>
          </div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// ── Sidebar Component ───────────────────────────────────────────────────────────

function Sidebar({
  isCollapsed,
  onToggle,
  navigation,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
  navigation: NavItem[];
}) {
  const location = useLocation();
  const { hasPermission, activities, dismissActivity, alerts, unreadAlerts } = useAdmin();
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);

  const filteredNav = navigation.filter(item => 
    !item.permission || hasPermission(item.permission as any)
  );

  return (
    <>
      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        className={cn(
          "fixed left-0 top-0 h-full z-50 bg-slate-950 border-r border-slate-800/50",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
          {!isCollapsed && (
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">
                  PULSE<span className="text-cyan-400">ADMIN</span>
                </h1>
                <p className="text-[10px] text-slate-500">Operations Console</p>
              </div>
            </Link>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={() => window.innerWidth < 1024 && onToggle()}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  "group relative",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <span className={cn(
                  "transition-colors",
                  isActive ? "text-cyan-400" : "group-hover:text-slate-200"
                )}>
                  {item.icon}
                </span>
                
                {!isCollapsed && (
                  <>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge 
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          item.badge === 'Live' 
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-cyan-500/20 text-cyan-400"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                
                {/* Tooltip for collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Activity Feed Toggle */}
        {!isCollapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setActivityPanelOpen(!activityPanelOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg",
                "text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors",
                activityPanelOpen && "bg-slate-800/50 text-slate-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Activity Feed
              </span>
              {activities.length > 0 && (
                <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 h-5 min-w-[20px]">
                  {activities.length}
                </Badge>
              )}
            </button>
            
            <AnimatePresence>
              {activityPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 pb-1 max-h-[300px] overflow-y-auto">
                    <ActivityFeed activities={activities} onDismiss={dismissActivity} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800/50 p-3">
          {/* Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50",
            isCollapsed && "justify-center"
          )}>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {!isCollapsed && (
              <div className="flex-1">
                <p className="text-xs text-slate-300">System Online</p>
                <p className="text-[10px] text-slate-500">All systems operational</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}

// ── Top Bar Component ─────────────────────────────────────────────────────────

function TopBar({
  onSearchOpen,
}: {
  onSearchOpen: () => void;
}) {
  const { profile, signOut } = useAuth();
  const { alerts, unreadAlerts, quickActions, role } = useAdmin();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left - Search & Quick Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all w-64"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Search...</span>
            <kbd className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">
              ⌘K
            </kbd>
          </button>
          
          {/* Quick Actions */}
          <div className="hidden md:flex items-center gap-1">
            {quickActions.slice(0, 3).map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => action.href ? navigate(action.href) : action.action?.()}
              >
                <Zap className="w-4 h-4 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Right - Alerts & Profile */}
        <div className="flex items-center gap-3">
          {/* Alerts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                <Bell className="w-5 h-5" />
                {unreadAlerts > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-slate-900 border-slate-800">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Alerts</span>
                {unreadAlerts > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {unreadAlerts} new
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              {alerts.slice(0, 5).map((alert) => (
                <DropdownMenuItem
                  key={alert.id}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer",
                    !alert.acknowledged_by && "bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : alert.severity === 'high' ? (
                      <ShieldAlert className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <Activity className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="text-sm font-medium text-slate-200 flex-1">
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 pl-6">
                    {alert.message}
                  </p>
                </DropdownMenuItem>
              ))}
              {alerts.length === 0 && (
                <div className="py-8 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No alerts</p>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <Avatar className="w-8 h-8 border-2 border-cyan-500/30">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-slate-700 text-cyan-400 text-xs font-bold">
                    {profile?.username?.[0]?.toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-200">{profile?.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {role}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800">
              <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserCircle className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/system')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem onClick={() => { signOut(); navigate('/'); }} className="text-red-400">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// ── Main Layout Component ─────────────────────────────────────────────────────

export function AdminCommandCenter() {
  const { profile } = useAuth();
  const { isLoading, isInitialized } = useAdmin();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if user is authorized
  const isAuthorized = profile && ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(profile.role);

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Initializing Admin Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Global Search */}
      <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        navigation={NAVIGATION}
      />

      {/* Main Content */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 80 : 280 }}
      >
        <TopBar onSearchOpen={() => setSearchOpen(true)} />
        
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
