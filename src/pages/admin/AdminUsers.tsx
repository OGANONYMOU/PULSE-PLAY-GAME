import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown, Shield, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const PRIMARY_ADMIN_EMAIL = 'adegbesanadebola@outlook.com';
type Role = 'USER' | 'MODERATOR' | 'ADMIN';

// ── Sub-components: single-return ternary (strict TS JSX requirement) ──

function AvatarInitial(p: { username: string; url: string | null }): React.ReactElement {
  const letter = p.username[0] ? p.username[0].toUpperCase() : 'U';
  return p.url ? (
    <img src={p.url} alt={p.username} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold font-orbitron flex-shrink-0">
      {letter}
    </div>
  );
}

function RolePill(p: { role: Role }): React.ReactElement {
  const cls =
    p.role === 'ADMIN' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    p.role === 'MODERATOR' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  return (
    <span className={'text-xs px-2 py-0.5 rounded-full border font-bold ' + cls}>{p.role}</span>
  );
}

function BannedPill(p: { banned: boolean }): React.ReactElement {
  return p.banned ? (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold">BANNED</span>
  ) : <span />;
}

function CrownIcon(p: { show: boolean }): React.ReactElement {
  return p.show ? <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" /> : <span />;
}

function FullNameLabel(p: { name: string }): React.ReactElement {
  return p.name ? (
    <p className="text-xs text-white/40 mt-0.5 truncate">{p.name}</p>
  ) : <span />;
}

function ExpandedControls(p: {
  user: Profile;
  isPrimary: boolean;
  isSelf: boolean;
  onRoleChange: (role: Role) => void;
  onToggleBan: () => void;
}): React.ReactElement {
  return p.isPrimary ? (
    <div className="px-4 pb-4 pt-1 border-t border-white/10">
      <span className="text-xs text-cyan-400 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 w-fit">
        <Shield className="w-3.5 h-3.5" />
        Protected primary admin — cannot be modified
      </span>
    </div>
  ) : (
    <div className="px-4 pb-4 pt-1 border-t border-white/10 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Role:</span>
        <Select value={p.user.role} onValueChange={(val) => p.onRoleChange(val as Role)}>
          <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-white/10">
            <SelectItem value="USER" className="text-white text-xs focus:bg-white/10">User</SelectItem>
            <SelectItem value="MODERATOR" className="text-white text-xs focus:bg-white/10">Moderator</SelectItem>
            <SelectItem value="ADMIN" className="text-white text-xs focus:bg-white/10">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        variant={p.user.is_banned ? 'outline' : 'destructive'}
        className={'h-8 text-xs ' + (p.user.is_banned ? 'border-white/20 text-white hover:bg-white/10' : '')}
        onClick={p.onToggleBan}
        disabled={p.isSelf}
      >
        {p.user.is_banned ? 'Unban User' : 'Ban User'}
      </Button>
    </div>
  );
}

// ── Main component ──

export function AdminUsers(): React.ReactElement {
  const { profile: self } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFetchError('');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setFetchError(error.message);
    } else {
      setUsers((data as Profile[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, email: string, role: Role) => {
    if (email === PRIMARY_ADMIN_EMAIL) { toast.error('Cannot change the primary admin.'); return; }
    const { error } = await supabase.from('profiles').update({ role } as never).eq('id', userId);
    if (error) { toast.error('Failed: ' + error.message); } else { toast.success('Role updated.'); load(); }
  };

  const toggleBan = async (u: Profile) => {
    if (u.email === PRIMARY_ADMIN_EMAIL) { toast.error('Cannot ban the primary admin.'); return; }
    if (self && u.id === self.id) { toast.error('You cannot ban yourself.'); return; }
    const { error } = await supabase.from('profiles').update({ is_banned: !u.is_banned } as never).eq('id', u.id);
    if (error) { toast.error('Failed: ' + error.message); } else {
      toast.success(u.is_banned ? 'User unbanned.' : 'User banned.');
      load();
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.first_name ?? '').toLowerCase().includes(q) ||
      (u.last_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 sm:p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-orbitron text-2xl font-bold text-white mb-1">Users</h1>
          <p className="text-white/40 text-sm">{users.length} total registered players</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="text-white/50 hover:text-white hover:bg-white/10 h-9 flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-white/40 py-16">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading users…</span>
        </div>
      ) : fetchError ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-red-400 text-sm mb-3">{fetchError}</p>
          <Button onClick={load} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u, i) => {
            const isPrimary = u.email === PRIMARY_ADMIN_EMAIL;
            const isSelf = self?.id === u.id;
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
            const isExpanded = expandedId === u.id;

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className="rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4">
                  <AvatarInitial username={u.username} url={u.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-orbitron font-bold text-sm text-white truncate">{u.username}</span>
                      <CrownIcon show={isPrimary} />
                      {isSelf ? <span className="text-xs text-white/30">(you)</span> : null}
                      <RolePill role={u.role} />
                      <BannedPill banned={u.is_banned} />
                    </div>
                    <FullNameLabel name={fullName} />
                    <p className="text-xs text-white/30 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all flex-shrink-0"
                  >
                    <ChevronDown className={'w-4 h-4 transition-transform duration-200 ' + (isExpanded ? 'rotate-180' : '')} />
                  </button>
                </div>

                {isExpanded ? (
                  <ExpandedControls
                    user={u}
                    isPrimary={isPrimary}
                    isSelf={isSelf}
                    onRoleChange={(role) => changeRole(u.id, u.email, role)}
                    onToggleBan={() => toggleBan(u)}
                  />
                ) : null}
              </motion.div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-10 h-10 mx-auto text-white/20 mb-3" />
              <p className="text-white/40 text-sm">No users match your search.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}