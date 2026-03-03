import { useEffect, useState } from 'react';
import { Search, Crown, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const PRIMARY_ADMIN = 'adegbesanadebola@outlook.com';
type Role = 'USER' | 'MODERATOR' | 'ADMIN';

function RoleBadge(p: { role: Role }) {
  const cls =
    p.role === 'ADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    p.role === 'MODERATOR' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  return <Badge className={cls}>{p.role}</Badge>;
}

function BannedBadge(p: { banned: boolean }) {
  if (!p.banned) return null;
  return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Banned</Badge>;
}

export function AdminUsers() {
  const { profile: self } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, email: string, role: Role) => {
    if (email === PRIMARY_ADMIN) {
      toast.error('Cannot change the primary admin role.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role } as never)
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update role.');
    } else {
      toast.success('Role updated.');
      load();
    }
  };

  const toggleBan = async (user: Profile) => {
    if (user.email === PRIMARY_ADMIN) {
      toast.error('Cannot ban the primary admin.');
      return;
    }
    if (self && user.id === self.id) {
      toast.error('You cannot ban yourself.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: !user.is_banned } as never)
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to update ban status.');
    } else {
      toast.success(user.is_banned ? 'User unbanned.' : 'User banned.');
      load();
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.first_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-orbitron text-2xl font-bold">Users</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-muted/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const isPrimary = u.email === PRIMARY_ADMIN;
            const isSelf = self?.id === u.id;
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
            const avatarLetter = u.username[0] ? u.username[0].toUpperCase() : 'U';
            const banLabel = u.is_banned ? 'Unban' : 'Ban';
            return (
              <div key={u.id} className="gaming-card p-4 flex items-center gap-4">
                <Avatar className="w-10 h-10 border border-border/50">
                  <AvatarImage src={u.avatar_url ?? ''} alt={u.username} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-sm">
                    {avatarLetter}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-orbitron font-bold text-sm">{u.username}</span>
                    {isPrimary ? <Crown className="w-4 h-4 text-yellow-400" /> : null}
                    {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                    <RoleBadge role={u.role} />
                    <BannedBadge banned={u.is_banned} />
                  </div>
                  {fullName ? <p className="text-xs text-muted-foreground mt-0.5">{fullName}</p> : null}
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isPrimary ? (
                    <span className="text-xs text-cyan-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Protected
                    </span>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(val) => changeRole(u.id, u.email, val as Role)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="MODERATOR">Moderator</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    size="sm"
                    variant={u.is_banned ? 'outline' : 'destructive'}
                    className="h-8 text-xs"
                    onClick={() => toggleBan(u)}
                    disabled={isPrimary || isSelf}
                  >
                    {banLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}