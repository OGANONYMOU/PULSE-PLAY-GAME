import { useEffect, useState } from 'react';
import { Search, Crown, Shield, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const PRIMARY_ADMIN = 'adegbesanadebola@outlook.com';
type Role = 'USER' | 'MODERATOR' | 'ADMIN';

function RolePill(p: { role: Role }): React.ReactElement {
  const cls =
    p.role === 'ADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    p.role === 'MODERATOR' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  return <span className={'text-xs px-2 py-0.5 rounded-full border font-bold ' + cls}>{p.role}</span>;
}

function BannedPill(p: { banned: boolean }): React.ReactElement {
  return p.banned ? (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold">Banned</span>
  ) : <span />;
}

function AvatarInitial(p: { username: string; url: string | null }): React.ReactElement {
  const letter = p.username[0] ? p.username[0].toUpperCase() : 'U';
  return p.url ? (
    <img src={p.url} alt={p.username} className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold font-orbitron">
      {letter}
    </div>
  );
}

export function AdminUsers() {
  const { profile: self } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load users: ' + error.message);
    } else {
      setUsers((data as Profile[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, email: string, role: Role) => {
    if (email === PRIMARY_ADMIN) { toast.error('Cannot change the primary admin role.'); return; }
    const { error } = await supabase.from('profiles').update({ role } as never).eq('id', userId);
    if (error) { toast.error('Failed: ' + error.message); } else { toast.success('Role updated.'); load(); }
  };

  const toggleBan = async (u: Profile) => {
    if (u.email === PRIMARY_ADMIN) { toast.error('Cannot ban the primary admin.'); return; }
    if (self && u.id === self.id) { toast.error('You cannot ban yourself.'); return; }
    const { error } = await supabase.from('profiles').update({ is_banned: !u.is_banned } as never).eq('id', u.id);
    if (error) { toast.error('Failed: ' + error.message); } else {
      toast.success(u.is_banned ? 'User unbanned.' : 'User banned.');
      load();
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.first_name ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-orbitron text-2xl font-bold text-white mb-1">Users</h1>
          <p className="text-white/40 text-sm">{users.length} total users</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isPrimary = u.email === PRIMARY_ADMIN;
            const isSelf = self?.id === u.id;
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
            const isExpanded = expandedId === u.id;
            return (
              <div key={u.id} className="rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <AvatarInitial username={u.username} url={u.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-orbitron font-bold text-sm text-white truncate">{u.username}</span>
                      {isPrimary ? <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" /> : null}
                      {isSelf ? <span className="text-xs text-white/30">(you)</span> : null}
                      <RolePill role={u.role} />
                      <BannedPill banned={u.is_banned} />
                    </div>
                    {fullName ? <p className="text-xs text-white/40 mt-0.5">{fullName}</p> : null}
                    <p className="text-xs text-white/30 truncate">{u.email}</p>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all ml-1">
                    <ChevronDown className={'w-4 h-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                  </button>
                </div>

                {isExpanded ? (
                  <div className="px-4 pb-4 pt-1 border-t border-white/10 flex flex-wrap items-center gap-3">
                    {isPrimary ? (
                      <span className="text-xs text-cyan-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <Shield className="w-3.5 h-3.5" />
                        Protected admin account
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">Role:</span>
                          <Select value={u.role} onValueChange={(val) => changeRole(u.id, u.email, val as Role)}>
                            <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-white/10">
                              <SelectItem value="USER" className="text-white hover:bg-white/10">User</SelectItem>
                              <SelectItem value="MODERATOR" className="text-white hover:bg-white/10">Moderator</SelectItem>
                              <SelectItem value="ADMIN" className="text-white hover:bg-white/10">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" variant={u.is_banned ? 'outline' : 'destructive'}
                          className={'h-8 text-xs ' + (u.is_banned ? 'border-white/20 text-white hover:bg-white/10' : '')}
                          onClick={() => toggleBan(u)} disabled={isSelf}>
                          {u.is_banned ? 'Unban User' : 'Ban User'}
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/30 text-sm">No users found.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}