// @ts-nocheck
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, CheckCircle, XCircle, Search, Building2,
  Trophy, AlertCircle, UserCheck, Clock,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOrganizers } from '@/hooks/useOrganizers';
import { usePermissionManagement, type GlobalPermission } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface UserWithPermissions {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
  permissions: Array<{
    id: string;
    permission: GlobalPermission;
    scope_type: 'global' | 'organizer' | 'tournament';
    scope_id: string | null;
    is_active: boolean;
    granted_at: string;
    granted_by: { username: string } | null;
  }>;
}

const permissionLabels: Record<GlobalPermission, { label: string; description: string; icon: typeof Trophy }> = {
  host_tournaments: { 
    label: 'Host Tournaments', 
    description: 'Can create and manage tournaments',
    icon: Trophy 
  },
  moderate_content: { 
    label: 'Moderate Content', 
    description: 'Can moderate posts and comments',
    icon: Shield 
  },
  review_disputes: { 
    label: 'Review Disputes', 
    description: 'Can resolve match disputes',
    icon: AlertCircle 
  },
  manage_users: { 
    label: 'Manage Users', 
    description: 'Can ban/mute users',
    icon: UserCheck 
  },
  access_audit_logs: { 
    label: 'Audit Access', 
    description: 'Can view audit logs',
    icon: Clock 
  },
  featured_host: { 
    label: 'Featured Host', 
    description: 'Gets featured organizer status',
    icon: CheckCircle 
  },
};

function GrantPermissionDialog({
  open,
  onClose,
  onGrant,
  organizers
}: {
  open: boolean;
  onClose: () => void;
  onGrant: (userId: string, permission: GlobalPermission, scopeType: string, scopeId: string | null) => Promise<void>;
  organizers: Array<{ id: string; name: string }>;
}) {
  const [step, setStep] = useState<'user' | 'permission'>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; username: string; email: string; avatar_url: string | null; role: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<GlobalPermission | null>(null);
  const [scopeType, setScopeType] = useState<'global' | 'organizer'>('global');
  const [selectedOrganizer, setSelectedOrganizer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    
    const { data } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, role')
      .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .limit(10);
    
    setUsers(data || []);
    setSearching(false);
  }, [searchQuery]);

  const handleSubmit = async () => {
    if (!selectedUser || !selectedPermission) return;
    
    setLoading(true);
    try {
      await onGrant(
        selectedUser, 
        selectedPermission, 
        scopeType, 
        scopeType === 'organizer' ? selectedOrganizer : null
      );
      onClose();
      reset();
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('user');
    setSearchQuery('');
    setUsers([]);
    setSelectedUser(null);
    setSelectedPermission(null);
    setScopeType('global');
    setSelectedOrganizer(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) { onClose(); reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Grant Permission
          </DialogTitle>
          <DialogDescription>
            Grant a user permission to perform specific actions on the platform.
          </DialogDescription>
        </DialogHeader>

        {step === 'user' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or email..."
                className="bg-white/5 border-white/10"
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              />
              <Button 
                variant="secondary" 
                onClick={searchUsers}
                disabled={searching || !searchQuery.trim()}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searching ? (
                <div className="text-center py-4 text-white/50">Searching...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-4 text-white/50">
                  {searchQuery ? 'No users found' : 'Search for a user'}
                </div>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { setSelectedUser(user.id); setStep('permission'); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      selectedUser === user.id
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-sm">
                        {user.username[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{user.username}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {user.role}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setStep('user')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <ChevronDown className="w-3 h-3 rotate-90" /> Back to user selection
            </button>

            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">Permission</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(permissionLabels) as GlobalPermission[]).map((perm) => {
                  const { label, description, icon: Icon } = permissionLabels[perm];
                  return (
                    <button
                      key={perm}
                      onClick={() => setSelectedPermission(perm)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selectedPermission === perm
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedPermission === perm ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
                        <Icon className={`w-4 h-4 ${selectedPermission === perm ? 'text-cyan-400' : 'text-white/50'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-white">{label}</p>
                        <p className="text-xs text-white/40">{description}</p>
                      </div>
                      {selectedPermission === perm && <CheckCircle className="w-4 h-4 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPermission === 'host_tournaments' && (
              <div className="space-y-2">
                <label className="text-xs text-white/50 uppercase tracking-wider">Scope</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScopeType('global')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                      scopeType === 'global'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                        : 'border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    Global (All Organizers)
                  </button>
                  <button
                    onClick={() => setScopeType('organizer')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                      scopeType === 'organizer'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                        : 'border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    Specific Organizer
                  </button>
                </div>

                {scopeType === 'organizer' && (
                  <Select value={selectedOrganizer || ''} onValueChange={setSelectedOrganizer}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select an organizer" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizers.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setStep('user')}>
                Back
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={loading || !selectedPermission || (scopeType === 'organizer' && !selectedOrganizer)}
                className="bg-gradient-to-r from-cyan-500 to-purple-600"
              >
                {loading ? 'Granting...' : 'Grant Permission'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserPermissionsCard({ 
  user, 
  onRevoke,
  organizers 
}: { 
  user: UserWithPermissions; 
  onRevoke: (permissionId: string) => Promise<void>;
  organizers: Array<{ id: string; name: string }>;
}) {
  const activePermissions = user.permissions.filter(p => p.is_active);

  return (
    <div className="gaming-card p-5">
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600">
            {user.username[0]}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-white">{user.username}</h3>
              <p className="text-sm text-white/40">{user.email}</p>
            </div>
            <Badge variant="outline">{user.role}</Badge>
          </div>

          {activePermissions.length > 0 ? (
            <div className="space-y-2 mt-4">
              {activePermissions.map((perm) => {
                const permInfo = permissionLabels[perm.permission];
                const organizer = perm.scope_id ? organizers.find(o => o.id === perm.scope_id) : null;
                
                return (
                  <div 
                    key={perm.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <permInfo.icon className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{permInfo.label}</p>
                        <p className="text-xs text-white/40">
                          {perm.scope_type === 'global' 
                            ? 'Global access' 
                            : organizer ? `Scoped to: ${organizer.name}` : 'Scoped access'
                          }
                          {' • '}
                          Granted {formatDistanceToNow(new Date(perm.granted_at))} ago
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(perm.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 mt-4">No active permissions</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminPermissions() {
  const { profile } = useAuth();
  const { organizers } = useOrganizers();
  const { grantPermission, revokePermission, isAdmin } = usePermissionManagement();
  
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    
    // Fetch users with their permissions
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, role, created_at');

    if (profiles) {
      const usersWithPerms = await Promise.all(
        profiles.map(async (user) => {
          const { data: permissions } = await supabase
            .from('global_permissions')
            .select('*, granted_by:granted_by(username)')
            .eq('user_id', user.id)
            .order('granted_at', { ascending: false });
          
          return {
            ...user,
            permissions: permissions || [],
          };
        })
      );
      
      // Filter to only users with permissions or MODERATOR role
      const relevantUsers = usersWithPerms.filter(
        u => u.permissions.some(p => p.is_active) || u.role === 'MODERATOR'
      );
      
      setUsers(relevantUsers);
    }
    
    setLoading(false);
  }, []);

  const handleGrant = async (
    userId: string, 
    permission: GlobalPermission, 
    scopeType: string, 
    scopeId: string | null
  ) => {
    const result = await grantPermission(
      userId, 
      permission, 
      scopeType as 'global' | 'organizer' | 'tournament', 
      scopeId
    );
    
    if (result.success) {
      toast.success('Permission granted successfully');
      fetchUsers();
    } else {
      toast.error(result.error || 'Failed to grant permission');
      throw new Error(result.error);
    }
  };

  const handleRevoke = async (permissionId: string) => {
    const result = await revokePermission(permissionId);
    
    if (result.success) {
      toast.success('Permission revoked');
      fetchUsers();
    } else {
      toast.error(result.error || 'Failed to revoke permission');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Access Denied</h3>
        <p className="text-white/50">Only administrators can manage permissions.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Permissions
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Manage moderator and host permissions across the platform
          </p>
        </div>
        
        <Button 
          onClick={() => setGrantDialogOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-600"
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Grant Permission
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by username or email..."
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="gaming-card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/4" />
                  <div className="h-3 bg-white/10 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="gaming-card p-12 text-center">
          <UserCheck className="w-12 h-12 mx-auto text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {searchQuery ? 'No users found' : 'No users with permissions'}
          </h3>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Grant permissions to moderators to allow them to host tournaments or perform other actions.'
            }
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => setGrantDialogOpen(true)}
              className="mt-4 bg-gradient-to-r from-cyan-500 to-purple-600"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Grant First Permission
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <UserPermissionsCard
                user={user}
                onRevoke={handleRevoke}
                organizers={organizers}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Grant Dialog */}
      <GrantPermissionDialog
        open={grantDialogOpen}
        onClose={() => setGrantDialogOpen(false)}
        onGrant={handleGrant}
        organizers={organizers}
      />
    </div>
  );
}
