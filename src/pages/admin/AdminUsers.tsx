import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Crown, Shield, ChevronDown, Loader2, RefreshCw,
  Ban, UserCheck, Trash2, Mail, Phone, Calendar, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type Profile } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const PRIMARY_ADMIN_EMAIL = 'adegbesanadebola@outlook.com';
type Role = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function writeAudit(actorId: string, action: string, targetId: string, meta?: object) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('audit_logs') as any).insert({
    actor_id: actorId, action, target_type: 'user', target_id: targetId, meta: meta ?? null,
  });
}

function RolePill({ role }: { role: Role }) {
  const cls = role === 'ADMIN' || role === 'SUPER_ADMIN'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : role === 'MODERATOR'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${cls}`}>{role}</span>;
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  const letter = username[0]?.toUpperCase() ?? 'U';
  return url
    ? <img src={url} alt={username} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10" />
    : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold font-orbitron flex-shrink-0">{letter}</div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AdminUsers(): React.ReactElement {
  const { profile: self } = useAuth();
  const [users, setUsers]           = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [banTarget, setBanTarget]   = useState<Profile | null>(null);
  const [banReason, setBanReason]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isSuper = self?.role === 'ADMIN' || self?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true); setFetchError('');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setFetchError(error.message); }
    else { setUsers((data as Profile[]) ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Role change ────────────────────────────────────────────────────────────
  const changeRole = async (user: Profile, role: Role) => {
    if (user.email === PRIMARY_ADMIN_EMAIL) { toast.error('Cannot change primary admin.'); return; }
    if (!isSuper) { toast.error('Only super-admins can change roles.'); return; }
    const { error } = await supabase.from('profiles').update({ role } as never).eq('id', user.id);
    if (error) { toast.error('Failed: ' + error.message); return; }
    await writeAudit(self!.id, 'change_role', user.id, { from: user.role, to: role, username: user.username });
    toast.success(`${user.username} → ${role}`);
    load();
  };

  // ── Ban ────────────────────────────────────────────────────────────────────
  const confirmBan = async () => {
    if (!banTarget || !self) return;
    setActionLoading(true);
    const isBanning = !banTarget.is_banned;
    const { error } = await supabase.from('profiles')
      .update({ is_banned: isBanning, ban_reason: isBanning ? (banReason || null) : null } as never)
      .eq('id', banTarget.id);
    if (error) { toast.error('Failed: ' + error.message); setActionLoading(false); return; }
    await writeAudit(self.id, isBanning ? 'ban_user' : 'unban_user', banTarget.id, {
      username: banTarget.username, reason: banReason || null,
    });
    toast.success(isBanning ? `${banTarget.username} banned.` : `${banTarget.username} unbanned.`);
    setBanTarget(null); setBanReason(''); setActionLoading(false);
    load();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget || !self) return;
    if (!isSuper) { toast.error('Super-admin only.'); return; }
    setActionLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    if (error) { toast.error('Failed: ' + error.message); setActionLoading(false); return; }
    await writeAudit(self.id, 'delete_user', deleteTarget.id, { username: deleteTarget.username });
    toast.success(`${deleteTarget.username} deleted.`);
    setDeleteTarget(null); setActionLoading(false);
    load();
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q
      || u.username.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.first_name ?? '').toLowerCase().includes(q)
      || (u.last_name ?? '').toLowerCase().includes(q);
    const matchR = roleFilter === 'all' || u.role === roleFilter;
    return matchQ && matchR;
  });

  const counts = {
    total: users.length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    mods: users.filter(u => u.role === 'MODERATOR').length,
    banned: users.filter(u => u.is_banned).length,
  };

  return (
    <div className="p-5 sm:p-7 max-w-7xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Users</h1>
          <p className="text-white/35 text-sm">{counts.total} total · {counts.admins} admins · {counts.mods} mods · {counts.banned} banned</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or email…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 h-9 text-sm" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-28 h-9 bg-white/5 border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all" className="text-white text-xs">All Roles</SelectItem>
              <SelectItem value="USER" className="text-white text-xs">User</SelectItem>
              <SelectItem value="MODERATOR" className="text-white text-xs">Moderator</SelectItem>
              <SelectItem value="ADMIN" className="text-white text-xs">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}
            className="text-white/40 hover:text-white hover:bg-white/8 h-9 flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-18 rounded-2xl"/>)}</div>
      ) : fetchError ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-red-400 text-sm mb-3">{fetchError}</p>
          <Button onClick={load} variant="outline" size="sm">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-10 h-10 mx-auto text-white/15 mb-3" />
          <p className="text-white/30 text-sm">No users found</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((u, i) => {
            const isPrimary   = u.email === PRIMARY_ADMIN_EMAIL;
            const isSelf      = self?.id === u.id;
            const isExpanded  = expandedId === u.id;
            const fullName    = [u.first_name, u.last_name].filter(Boolean).join(' ');

            return (
              <motion.div key={u.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                transition={{ delay: i * 0.02 }}
                className={`rounded-2xl border overflow-hidden transition-all ${u.is_banned ? 'bg-red-500/5 border-red-500/15' : 'bg-white/4 border-white/8 hover:border-white/14'}`}>
                {/* Row */}
                <div className="flex items-center gap-3 p-4">
                  <Avatar url={u.avatar_url} username={u.username} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-orbitron font-bold text-sm text-white truncate">{u.username}</span>
                      {isPrimary && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                      {isSelf && <span className="text-[10px] text-white/25">(you)</span>}
                      <RolePill role={u.role} />
                      {u.is_banned && <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/30 h-4">BANNED</Badge>}
                    </div>
                    {fullName && <p className="text-xs text-white/35 truncate">{fullName}</p>}
                    <p className="text-[10px] text-white/25 truncate font-mono">{u.email}</p>
                  </div>
                  <div className="text-[10px] text-white/20 hidden sm:block font-mono flex-shrink-0">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/35 hover:text-white transition-all flex-shrink-0">
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-white/8 px-4 pb-4 pt-3">
                    {isPrimary ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
                        <Shield className="w-3.5 h-3.5" />Protected primary admin — cannot be modified
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Info row */}
                        <div className="flex flex-wrap gap-3 text-[10px] text-white/30 font-mono w-full mb-2">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>
                          {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {format(new Date(u.created_at), 'MMM d, yyyy')}</span>
                        </div>

                        {/* Role change — super admin only */}
                        {isSuper && !isSelf && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-white/40">Role:</span>
                            <Select value={u.role} onValueChange={v => changeRole(u, v as Role)}>
                              <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-white/10">
                                <SelectItem value="USER" className="text-white text-xs">User</SelectItem>
                                <SelectItem value="MODERATOR" className="text-white text-xs">Moderator</SelectItem>
                                <SelectItem value="ADMIN" className="text-white text-xs">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Ban / Unban */}
                        {!isSelf && (
                          <Button size="sm"
                            className={`h-8 text-xs gap-1.5 ${u.is_banned ? 'border-white/20 text-white bg-white/5 hover:bg-white/10' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}
                            variant={u.is_banned ? 'outline' : 'ghost'}
                            onClick={() => setBanTarget(u)}>
                            {u.is_banned ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            {u.is_banned ? 'Unban User' : 'Ban User'}
                          </Button>
                        )}

                        {/* Delete — super admin only, not self */}
                        {isSuper && !isSelf && (
                          <Button size="sm" variant="ghost"
                            className="h-8 text-xs gap-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 ml-auto"
                            onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="w-3.5 h-3.5" />Delete Account
                          </Button>
                        )}

                        {/* Ban reason */}
                        {u.is_banned && (u as { ban_reason?: string | null }).ban_reason && (
                          <div className="w-full text-xs text-rose-400 bg-rose-500/8 border border-rose-500/20 rounded-lg px-3 py-2">
                            Ban reason: {(u as { ban_reason?: string | null }).ban_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Ban confirm dialog */}
      <Dialog open={!!banTarget} onOpenChange={v => { if (!v) { setBanTarget(null); setBanReason(''); } }}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2">
              {banTarget?.is_banned
                ? <><UserCheck className="w-5 h-5 text-green-400" />Unban {banTarget?.username}</>
                : <><Ban className="w-5 h-5 text-red-400" />Ban {banTarget?.username}</>}
            </DialogTitle>
          </DialogHeader>
          {!banTarget?.is_banned && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Reason (optional — shown to admins only):</p>
              <Textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Reason for ban…"
                className="min-h-[80px] text-sm"
                maxLength={300}
              />
            </div>
          )}
          {banTarget?.is_banned && (
            <p className="text-muted-foreground text-sm">This will restore full access for {banTarget?.username}.</p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBanTarget(null); setBanReason(''); }}>Cancel</Button>
            <Button disabled={actionLoading}
              className={banTarget?.is_banned ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}
              variant="ghost"
              onClick={confirmBan}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : banTarget?.is_banned ? 'Confirm Unban' : 'Confirm Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Permanently delete <strong className="text-white">{deleteTarget?.username}</strong>?
              This removes their profile, posts, and tournament history. Cannot be undone.
            </p>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This action is permanent and logged in the audit trail.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={actionLoading} onClick={confirmDelete}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}