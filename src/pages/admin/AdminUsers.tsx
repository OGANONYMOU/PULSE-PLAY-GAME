import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Search, Ban, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

type Profile = {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  is_banned: boolean;
  avatar_url: string | null;
  created_at: string;
};

const roleBadge = (role: string) => {
  if (role === 'ADMIN') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">ADMIN</Badge>;
  if (role === 'MODERATOR') return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">MOD</Badge>;
  return <Badge className="bg-muted text-muted-foreground">USER</Badge>;
};

export function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers((data as Profile[]) ?? []);
      setFiltered((data as Profile[]) ?? []);
      setIsLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    );
  }, [search, users]);

  const handleRoleChange = async (userId: string, role: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).update({ role }).eq('id', userId);
    if (error) {
      toast.error('Failed to update role.');
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: role as Profile['role'] } : u))
      );
      toast.success('Role updated.');
    }
  };

  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update({ is_banned: !isBanned })
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update ban status.');
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: !isBanned } : u))
      );
      toast.success(isBanned ? 'User unbanned.' : 'User banned.');
    }
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              Manage <span className="gradient-text">Users</span>
            </h1>
            <p className="text-muted-foreground">
              {users.length} registered · {users.filter((u) => u.is_banned).length} banned
            </p>
          </div>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : (
          <div className="gaming-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {['User', 'Email', 'Role', 'Status', 'Joined', 'Change Role', 'Actions'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-border/30 transition-colors ${
                        user.is_banned ? 'bg-destructive/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <Link
                          to={`/profile/${user.username}`}
                          className="flex items-center gap-3 hover:text-cyan-400 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-600/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {user.avatar_url
                              ? <img src={user.avatar_url} className="w-full h-full object-cover" />
                              : <User className="w-4 h-4 text-muted-foreground" />
                            }
                          </div>
                          <span className="font-medium text-sm">{user.username}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-4">{roleBadge(user.role)}</td>
                      <td className="px-5 py-4">
                        {user.is_banned
                          ? <Badge className="bg-destructive/20 text-destructive border-destructive/30">Banned</Badge>
                          : <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        }
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-5 py-4">
                        <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER"><User className="w-3 h-3 mr-1 inline" />User</SelectItem>
                            <SelectItem value="MODERATOR"><Shield className="w-3 h-3 mr-1 inline" />Moderator</SelectItem>
                            <SelectItem value="ADMIN"><Shield className="w-3 h-3 mr-1 inline" />Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 text-xs ${user.is_banned ? 'text-green-400 hover:text-green-300' : 'text-destructive hover:text-destructive/80'}`}
                          onClick={() => handleToggleBan(user.id, user.is_banned)}
                        >
                          {user.is_banned
                            ? <><CheckCircle className="w-3 h-3 mr-1" />Unban</>
                            : <><Ban className="w-3 h-3 mr-1" />Ban</>
                          }
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
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