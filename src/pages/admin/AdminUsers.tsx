import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Search, Ban, CheckCircle, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type ProfileRow = {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  is_banned: boolean;
  avatar_url: string | null;
  created_at: string;
};

function roleBadge(role: string) {
  if (role === 'ADMIN') {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Crown className="w-3 h-3 mr-1" />ADMIN</Badge>;
  }
  if (role === 'MODERATOR') {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Shield className="w-3 h-3 mr-1" />MOD</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground"><User className="w-3 h-3 mr-1" />USER</Badge>;
}

export function AdminUsers(): React.ReactElement {
  const { profile: currentAdmin } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [filtered, setFiltered] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers((data as ProfileRow[]) ?? []);
      setFiltered((data as ProfileRow[]) ?? []);
      setIsLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    let result = users;
    if (q) {
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.first_name ?? '').toLowerCase().includes(q) ||
          (u.last_name ?? '').toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'ALL') {
      result = result.filter((u) => u.role === roleFilter);
    }
    setFiltered(result);
  }, [search, users, roleFilter]);

  const handleRoleChange = async (userId: string, role: string, userEmail: string) => {
    if (userEmail === 'adegbesanadebola@outlook.com' && role !== 'ADMIN') {
      toast.error('Cannot change the primary admin role.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).update({ role }).eq('id', userId);
    if (error) {
      toast.error('Failed to update role.');
    } else {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: role as ProfileRow['role'] } : u)));
      toast.success('Role updated to ' + role + '.');
    }
  };

  const handleToggleBan = async (userId: string, isBanned: boolean, userEmail: string) => {
    if (userEmail === 'adegbesanadebola@outlook.com') {
      toast.error('Cannot ban the primary admin.');
      return;
    }
    if (userId === currentAdmin?.id) {
      toast.error('You cannot ban yourself.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).update({ is_banned: !isBanned }).eq('id', userId);
    if (error) {
      toast.error('Failed to update ban status.');
    } else {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: !isBanned } : u)));
      toast.success(isBanned ? 'User unbanned.' : 'User banned.');
    }
  };

  const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;
  const totalMods = users.filter((u) => u.role === 'MODERATOR').length;
  const totalBanned = users.filter((u) => u.is_banned).length;

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="font-orbitron text-3xl font-bold mb-1">
            Manage <span className="gradient-text">Users</span>
          </h1>
          <p className="text-muted-foreground">
            {users.length} registered
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="gaming-card p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-cyan-400">{users.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Users</div>
          </div>
          <div className="gaming-card p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-red-400">{totalAdmins}</div>
            <div className="text-xs text-muted-foreground mt-1">Admins</div>
          </div>
          <div className="gaming-card p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-yellow-400">{totalMods}</div>
            <div className="text-xs text-muted-foreground mt-1">Moderators</div>
          </div>
          <div className="gaming-card p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-destructive">{totalBanned}</div>
            <div className="text-xs text-muted-foreground mt-1">Banned</div>
          </div>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MODERATOR">Moderator</SelectItem>
              <SelectItem value="USER">User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : (
          <div className="gaming-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">User</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Role</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Joined</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Change Role</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => {
                    const isPrimaryAdmin = user.email === 'adegbesanadebola@outlook.com';
                    const isSelf = user.id === currentAdmin?.id;
                    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                    return (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className={'border-b border-border/30 transition-colors ' + (user.is_banned ? 'bg-destructive/5' : 'hover:bg-muted/30')}
                      >
                        <td className="px-5 py-4">
                          <Link to={'/profile/' + user.username} className="flex items-center gap-3 hover:text-cyan-400 transition-colors group">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-600/40 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/50">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.username} />
                              ) : (
                                <User className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-sm group-hover:text-cyan-400 flex items-center gap-1">
                                {user.username}
                                {isPrimaryAdmin && <Crown className="w-3 h-3 text-yellow-400" />}
                                {isSelf && <span className="text-xs text-cyan-400">(you)</span>}
                              </div>
                              {fullName && <div className="text-xs text-muted-foreground">{fullName}</div>}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{user.email}</td>
                        <td className="px-5 py-4">{roleBadge(user.role)}</td>
                        <td className="px-5 py-4">
                          {user.is_banned ? (
                            <Badge className="bg-destructive/20 text-destructive border-destructive/30">Banned</Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                        </td>
                        <td className="px-5 py-4">
                          {isPrimaryAdmin ? (
                            <span className="text-xs text-muted-foreground italic">Protected</span>
                          ) : (
                            <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v, user.email)}>
                              <SelectTrigger className="w-36 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USER">User</SelectItem>
                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isPrimaryAdmin || isSelf ? (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={'h-8 text-xs ' + (user.is_banned ? 'text-green-400 hover:text-green-300' : 'text-destructive hover:text-destructive/80')}
                              onClick={() => handleToggleBan(user.id, user.is_banned, user.email)}
                            >
                              {user.is_banned ? (
                                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Unban</span>
                              ) : (
                                <span className="flex items-center gap-1"><Ban className="w-3 h-3" />Ban</span>
                              )}
                            </Button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No users found.</div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}