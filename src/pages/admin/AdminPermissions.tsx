// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Permissions & Role Management Module
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, Crown, Users, Trophy, Search,
  Check, X, ChevronRight, RefreshCw, MoreHorizontal,
  FileText, Settings, Lock, Unlock,
  AlertTriangle, CheckCircle2, XCircle, Edit3, Loader2, Plus,
  LayoutGrid, Ban, VolumeX, Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'HOST' | 'USER';

type AdminUser = {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role: AdminRole;
  permissions: string[];
  created_at: string;
  last_active?: string;
  two_factor_enabled?: boolean;
};

type PermissionChange = {
  id: string;
  user_id: string;
  user_name: string;
  changed_by: string;
  changed_by_name: string;
  action: 'granted' | 'revoked' | 'role_changed';
  permission?: string;
  old_role?: string;
  new_role?: string;
  reason?: string;
  created_at: string;
};

type RoleStats = {
  totalUsers: number;
  roleDistribution: Record<AdminRole, number>;
  permissionCount: number;
  recentChanges: number;
};

const ROLE_CONFIG: Record<AdminRole, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  level: number;
}> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Full system access, cannot be restricted',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: Crown,
    level: 100,
  },
  ADMIN: {
    label: 'Admin',
    description: 'Full admin access except super admin functions',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: ShieldAlert,
    level: 80,
  },
  MODERATOR: {
    label: 'Moderator',
    description: 'Content moderation and user management',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: Shield,
    level: 60,
  },
  HOST: {
    label: 'Host',
    description: 'Can create and manage tournaments',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: Trophy,
    level: 40,
  },
  USER: {
    label: 'User',
    description: 'Standard user with no admin privileges',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    icon: Users,
    level: 0,
  },
};

const PERMISSION_CATEGORIES = [
  {
    id: 'users',
    label: 'User Management',
    icon: Users,
    permissions: [
      { id: 'users.view', label: 'View Users', description: 'Access user profiles' },
      { id: 'users.edit', label: 'Edit Users', description: 'Modify user profiles' },
      { id: 'users.ban', label: 'Ban Users', description: 'Ban/suspend accounts' },
      { id: 'users.mute', label: 'Mute Users', description: 'Mute from chat' },
      { id: 'users.delete', label: 'Delete Users', description: 'Delete accounts' },
    ],
  },
  {
    id: 'tournaments',
    label: 'Tournaments',
    icon: Trophy,
    permissions: [
      { id: 'tournaments.view', label: 'View Tournaments', description: 'View all tournaments' },
      { id: 'tournaments.create', label: 'Create Tournaments', description: 'Create tournaments' },
      { id: 'tournaments.edit', label: 'Edit Tournaments', description: 'Modify tournaments' },
      { id: 'tournaments.delete', label: 'Delete Tournaments', description: 'Remove tournaments' },
      { id: 'tournaments.override_results', label: 'Override Results', description: 'Change match results' },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    icon: Shield,
    permissions: [
      { id: 'moderation.view', label: 'View Reports', description: 'Access reports' },
      { id: 'moderation.resolve', label: 'Resolve Reports', description: 'Take action' },
      { id: 'moderation.ban', label: 'Ban via Moderation', description: 'Ban from reports' },
      { id: 'moderation.escalate', label: 'Escalate', description: 'Escalate to admins' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    permissions: [
      { id: 'content.posts.view', label: 'View Posts', description: 'Access posts' },
      { id: 'content.posts.delete', label: 'Delete Posts', description: 'Remove posts' },
      { id: 'content.clips.view', label: 'View Clips', description: 'Access clips' },
      { id: 'content.clips.delete', label: 'Delete Clips', description: 'Remove clips' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    permissions: [
      { id: 'system.admin_access', label: 'Admin Panel', description: 'Access admin' },
      { id: 'system.audit_logs', label: 'Audit Logs', description: 'View logs' },
      { id: 'system.permissions', label: 'Manage Permissions', description: 'Manage RBAC' },
      { id: 'system.settings', label: 'System Settings', description: 'System config' },
    ],
  },
];

const ROLE_TEMPLATES = [
  { id: 'super_admin', name: 'Super Admin', role: 'SUPER_ADMIN', permissions: PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.id)) },
  { id: 'admin', name: 'Admin', role: 'ADMIN', permissions: PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.id)).filter(p => p !== 'users.delete') },
  { id: 'senior_moderator', name: 'Senior Moderator', role: 'MODERATOR', permissions: ['users.view', 'users.edit', 'users.ban', 'users.mute', 'moderation.view', 'moderation.resolve', 'moderation.ban', 'content.posts.view', 'content.posts.delete'] },
  { id: 'junior_moderator', name: 'Junior Moderator', role: 'MODERATOR', permissions: ['users.view', 'moderation.view', 'moderation.resolve', 'content.posts.view'] },
  { id: 'tournament_host', name: 'Tournament Host', role: 'HOST', permissions: ['tournaments.view', 'tournaments.create', 'tournaments.edit', 'users.view'] },
];

function RoleBadge({ role }: { role: AdminRole }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <Badge className={cn("border", config.bgColor, config.color)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function PermissionMatrix({
  userPermissions,
  onToggle,
  readonly = false,
}: {
  userPermissions: string[];
  onToggle: (permissionId: string, granted: boolean) => void;
  readonly?: boolean;
}) {
  return (
    <div className="space-y-6">
      {PERMISSION_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const grantedCount = category.permissions.filter(p => userPermissions.includes(p.id)).length;
        return (
          <div key={category.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-cyan-400" />
                <h4 className="font-medium text-white">{category.label}</h4>
              </div>
              <Badge variant="outline" className="text-xs text-slate-400">
                {grantedCount}/{category.permissions.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {category.permissions.map((perm) => {
                const isGranted = userPermissions.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    disabled={readonly}
                    onClick={() => onToggle(perm.id, !isGranted)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border text-left transition-all",
                      isGranted
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700',
                      readonly && "cursor-default"
                    )}
                  >
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        isGranted ? 'text-cyan-400' : 'text-slate-400'
                      )}>
                        {perm.label}
                      </p>
                      <p className="text-xs text-slate-500">{perm.description}</p>
                    </div>
                    {isGranted ? (
                      <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminPermissions(): React.ReactElement {
  const { hasPermission, role, user } = useAdmin();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [changeHistory, setChangeHistory] = useState<PermissionChange[]>([]);
  const [stats, setStats] = useState<RoleStats>({
    totalUsers: 0,
    roleDistribution: { SUPER_ADMIN: 0, ADMIN: 0, MODERATOR: 0, HOST: 0, USER: 0 },
    permissionCount: 0,
    recentChanges: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  const [tempRole, setTempRole] = useState<AdminRole>('USER');
  const [saving, setSaving] = useState(false);

  const canManagePermissions = hasPermission('system.permissions') || role === 'SUPER_ADMIN' || role === 'ADMIN';

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url, role, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const adminUsers: AdminUser[] = (profiles || []).map(p => ({
        ...p,
        role: (p.role as AdminRole) || 'USER',
        permissions: [],
        last_active: p.updated_at,
      }));

      setUsers(adminUsers);

      const distribution = adminUsers.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {} as Record<AdminRole, number>);

      setStats({
        totalUsers: adminUsers.length,
        roleDistribution: distribution,
        permissionCount: PERMISSION_CATEGORIES.reduce((sum, c) => sum + c.permissions.length, 0),
        recentChanges: 12,
      });
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setTempRole(user.role);
    setTempPermissions(user.permissions);
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: tempRole })
        .eq('id', selectedUser.id);

      if (error) throw error;

      if (tempRole !== selectedUser.role) {
        await writeAudit('unknown', 'role_change', selectedUser.id, {
          old_role: selectedUser.role,
          new_role: tempRole,
        });
      }

      toast.success('User permissions updated');
      fetchUsers();
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkRoleChange = async (userIds: string[], newRole: AdminRole) => {
    try {
      await Promise.all(
        userIds.map(id =>
          supabase.from('profiles').update({ role: newRole }).eq('id', id)
        )
      );
      await writeAudit('unknown', 'bulk_role_change', 'multiple', { count: userIds.length, newRole });
      toast.success(`Updated ${userIds.length} users to ${newRole}`);
      fetchUsers();
    } catch (err) {
      console.error('Bulk update failed:', err);
      toast.error('Bulk update failed');
    }
  };

  if (!canManagePermissions) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">Only administrators can manage permissions.</p>
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
            <Shield className="w-6 h-6 text-cyan-400" />
            Permissions & Roles
          </h1>
          <p className="text-slate-400 text-sm">
            {stats.totalUsers} users • {Object.keys(stats.roleDistribution).filter(r => stats.roleDistribution[r as AdminRole] > 0).length} roles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsBulkDialogOpen(true)}
            className="border-slate-700 hover:bg-slate-800"
          >
            <Users className="w-4 h-4 mr-1" />
            Bulk Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchUsers}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      {/* Role Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(ROLE_CONFIG) as AdminRole[]).map((roleKey) => {
          const config = ROLE_CONFIG[roleKey];
          const count = stats.roleDistribution[roleKey] || 0;
          const Icon = config.icon;
          return (
            <Card key={roleKey} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={cn("w-5 h-5", config.color)} />
                <div>
                  <p className="text-lg font-bold text-white">{count}</p>
                  <p className="text-[10px] text-slate-500">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="users" className="data-[state=active]:bg-slate-800">
            <Users className="w-4 h-4 mr-1" />
            Users
          </TabsTrigger>
          <TabsTrigger value="matrix" className="data-[state=active]:bg-slate-800">
            <LayoutGrid className="w-4 h-4 mr-1" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-slate-800">
            <Key className="w-4 h-4 mr-1" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search users by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-800"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <h3 className="text-lg font-medium text-white mb-2">No users found</h3>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredUsers.map((u, index) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={u.avatar_url || ''} />
                            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                              {u.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-white">@{u.username}</h3>
                              <RoleBadge role={u.role} />
                            </div>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(u)}
                            className="border-slate-700 text-slate-400"
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <p className="text-sm text-slate-400 mb-4">
              Permission matrix shows which permissions are available per role.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 text-slate-400 font-medium">Permission</th>
                    {(Object.keys(ROLE_CONFIG) as AdminRole[]).map(role => (
                      <th key={role} className="text-center py-2 text-slate-400 font-medium">
                        {ROLE_CONFIG[role].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_CATEGORIES.map(cat => (
                    <>
                      <tr key={cat.id} className="bg-slate-900/30">
                        <td colSpan={6} className="py-2 px-2 text-xs font-medium text-cyan-400">
                          {cat.label}
                        </td>
                      </tr>
                      {cat.permissions.map(perm => (
                        <tr key={perm.id} className="border-b border-slate-800/50">
                          <td className="py-2 px-4 text-slate-300">{perm.label}</td>
                          {(Object.keys(ROLE_CONFIG) as AdminRole[]).map(role => {
                            const hasAccess = role === 'SUPER_ADMIN' ||
                              (role === 'ADMIN' && perm.id !== 'users.delete') ||
                              ROLE_TEMPLATES.find(t => t.role === role)?.permissions.includes(perm.id);
                            return (
                              <td key={role} className="text-center py-2">
                                {hasAccess ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_TEMPLATES.map(template => {
              const config = ROLE_CONFIG[template.role];
              return (
                <Card key={template.id} className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <config.icon className={cn("w-5 h-5", config.color)} />
                        <CardTitle className="text-white text-base">{template.name}</CardTitle>
                      </div>
                      <Badge className={cn("border", config.bgColor, config.color)}>
                        {template.permissions.length} perms
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {template.permissions.slice(0, 6).map(p => (
                        <Badge key={p} variant="outline" className="text-[10px] text-slate-400">
                          {p.split('.').pop()}
                        </Badge>
                      ))}
                      {template.permissions.length > 6 && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          +{template.permissions.length - 6} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-cyan-400" />
              Edit User Role
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedUser && `@${selectedUser.username}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Role</label>
              <Select value={tempRole} onValueChange={(v) => setTempRole(v as AdminRole)}>
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {(Object.keys(ROLE_CONFIG) as AdminRole[]).map(r => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = ROLE_CONFIG[r].icon;
                          return <Icon className={cn("w-4 h-4", ROLE_CONFIG[r].color)} />;
                        })()}
                        {ROLE_CONFIG[r].label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {ROLE_CONFIG[tempRole].description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={saving}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-white">Bulk Role Change</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select users and assign a new role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">Feature coming soon - select users from the list above</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDialogOpen(false)}
              className="border-slate-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
