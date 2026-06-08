import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Search, Users, Trophy, Crown,
  Globe, Lock, EyeOff, CheckCircle, AlertCircle,
  Edit2, Zap, Shield, UserPlus,
  X, Loader2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  useOrganizers, useOrganizerManagement,
  type OrganizerWithMembership, type OrganizerMemberWithProfile,
} from '@/hooks/useOrganizers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VISIBILITY_ICONS = { public: Globe, private: Lock, unlisted: EyeOff };
const VERIFIED_CLS = {
  unverified: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  pending:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  verified:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  featured:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
};
const ROLE_CLS = {
  member:    'bg-white/8 text-white/50',
  moderator: 'bg-blue-500/15 text-blue-400',
  manager:   'bg-purple-500/15 text-purple-400',
  co_host:   'bg-cyan-500/15 text-cyan-400',
};

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Create / Edit Organizer Dialog ────────────────────────────────────────────
function OrganizerFormDialog({
  open, onClose, onCreate, initialData, organizerId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate?: (d: { name: string; slug: string; description: string; visibility: 'public' | 'private' | 'unlisted' }) => Promise<void>;
  initialData?: Partial<OrganizerWithMembership>;
  organizerId?: string;
}) {
  const { updateOrganizer } = useOrganizerManagement();
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    slug: initialData?.slug ?? '',
    description: initialData?.description ?? '',
    visibility: (initialData?.visibility ?? 'public') as 'public' | 'private' | 'unlisted',
  });
  const [loading, setLoading] = useState(false);
  const isEdit = !!organizerId;

  useEffect(() => {
    if (open) setForm({
      name: initialData?.name ?? '',
      slug: initialData?.slug ?? '',
      description: initialData?.description ?? '',
      visibility: (initialData?.visibility ?? 'public') as 'public' | 'private' | 'unlisted',
    });
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setLoading(true);
    try {
      if (isEdit) {
        const res = await updateOrganizer(organizerId!, form);
        if (!res.success) throw new Error(res.error);
        toast.success('Organizer updated!');
        onClose();
      } else {
        await onCreate!(form);
        setForm({ name: '', slug: '', description: '', visibility: 'public' });
        onClose();
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md glass border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-orbitron">
            <Building2 className="w-5 h-5 text-cyan-400" />
            {isEdit ? 'Edit Organizer' : 'Create Organizer'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {isEdit ? 'Update your organizer profile.' : 'Create an organization to host tournaments under a branded identity.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Name *</label>
            <Input value={form.name} onChange={e => {
              const name = e.target.value;
              setForm(p => ({ ...p, name, slug: isEdit ? p.slug : generateSlug(name) }));
            }} placeholder="Lagos eSports Federation" className="bg-white/5 border-white/10" required />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Slug *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
              <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="lagos-esports" className="pl-7 bg-white/5 border-white/10 font-mono text-sm" required />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Brief description of your organization…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-cyan-500/40" />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider block mb-1.5">Visibility</label>
            <div className="grid grid-cols-3 gap-2">
              {(['public', 'private', 'unlisted'] as const).map(v => {
                const Icon = VISIBILITY_ICONS[v];
                return (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, visibility: v }))}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      form.visibility === v ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-white/10 text-white/50 hover:border-white/20'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/15">Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim() || !form.slug.trim()}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Organizer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Member Management Panel ───────────────────────────────────────────────────
function MemberPanel({ organizer, onClose }: { organizer: OrganizerWithMembership; onClose: () => void }) {
  const { profile } = useAuth();
  const { addMember, updateMember, removeMember } = useOrganizerManagement();
  const [members, setMembers] = useState<OrganizerMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; username: string; avatar_url: string | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [addRole, setAddRole] = useState<'member' | 'moderator' | 'manager' | 'co_host'>('member');
  const [addPermissions, setAddPermissions] = useState({ can_host: false, can_manage_staff: false, can_edit_branding: false });
  const [adding, setAdding] = useState(false);

  const isOwner = organizer.owner_id === profile?.id;
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const canManage = isOwner || isAdmin || organizer.my_permissions?.can_manage_staff;

  const loadMembers = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('organizer_members')
      .select('*, profile:user_id(username, avatar_url, role), added_by_profile:added_by(username)')
      .eq('organizer_id', organizer.id);
    setMembers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, [organizer.id]);

  const searchForUser = async () => {
    if (!searchUser.trim()) return;
    setSearching(true);
    setFoundUser(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', searchUser.trim())
      .limit(1)
      .single();
    setFoundUser(data ?? null);
    if (!data) toast.error('User not found');
    setSearching(false);
  };

  const handleAdd = async () => {
    if (!foundUser) return;
    setAdding(true);
    const res = await addMember(organizer.id, foundUser.id, addRole, addPermissions);
    if (res.success) {
      toast.success(`${foundUser.username} added as ${addRole}`);
      setFoundUser(null); setSearchUser('');
      await loadMembers();
    } else {
      toast.error(res.error || 'Failed to add member');
    }
    setAdding(false);
  };

  const handleTogglePermission = async (memberId: string, key: 'can_host_tournaments' | 'can_manage_staff' | 'can_edit_branding', current: boolean) => {
    const res = await updateMember(memberId, { [key]: !current });
    if (res.success) { await loadMembers(); }
    else toast.error(res.error || 'Failed to update');
  };

  const handleRemove = async (memberId: string, username: string) => {
    if (!confirm(`Remove ${username} from this organizer?`)) return;
    const res = await removeMember(memberId);
    if (res.success) { toast.success('Member removed'); await loadMembers(); }
    else toast.error(res.error || 'Failed');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-orbitron font-bold text-base">Members — {organizer.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {/* Add member */}
      {canManage && (
        <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
          <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Add Member</p>
          <div className="flex gap-2">
            <Input value={searchUser} onChange={e => setSearchUser(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchForUser()}
              placeholder="Search by username…" className="bg-white/5 border-white/10 text-sm flex-1" />
            <Button onClick={searchForUser} disabled={searching} size="sm" variant="outline" className="border-white/15 shrink-0">
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
            </Button>
          </div>

          {foundUser && (
            <div className="p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={foundUser.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">{foundUser.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-bold text-sm">{foundUser.username}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Role</label>
                  <select value={addRole} onChange={e => setAddRole(e.target.value as typeof addRole)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                    {['member','moderator','manager','co_host'].map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider block">Permissions</label>
                  {[
                    { key: 'can_host' as const, label: 'Host tournaments' },
                    { key: 'can_manage_staff' as const, label: 'Manage staff' },
                    { key: 'can_edit_branding' as const, label: 'Edit branding' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={addPermissions[key]} onChange={e => setAddPermissions(p => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-white/20" />
                      <span className="text-white/60">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleAdd} disabled={adding} size="sm"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                Add {foundUser.username}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Member list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : members.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const uname = m.profile?.username ?? '?';
            const isMe = m.user_id === profile?.id;
            const isOrgOwner = m.user_id === organizer.owner_id;
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">{uname[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{uname}</span>
                    {isOrgOwner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-bold">Owner</span>}
                    {isMe && <span className="text-[10px] text-white/30">you</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_CLS[m.role] ?? 'bg-white/5 text-white/40'}`}>
                      {m.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {m.can_host_tournaments && <span className="text-[9px] text-cyan-400 font-bold">HOST</span>}
                    {m.can_manage_staff && <span className="text-[9px] text-purple-400 font-bold">STAFF</span>}
                    {m.can_edit_branding && <span className="text-[9px] text-green-400 font-bold">BRAND</span>}
                  </div>
                </div>
                {canManage && !isOrgOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePermission(m.id, 'can_host_tournaments', m.can_host_tournaments)}
                      title="Toggle host permission"
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${m.can_host_tournaments ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/25 hover:bg-white/10'}`}>
                      H
                    </button>
                    <button
                      onClick={() => handleRemove(m.id, uname)}
                      className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Organizer Card ────────────────────────────────────────────────────────────
function OrganizerCard({
  organizer, onEdit, onManageMembers, canManage,
}: {
  organizer: OrganizerWithMembership;
  onEdit: (o: OrganizerWithMembership) => void;
  onManageMembers: (o: OrganizerWithMembership) => void;
  canManage: boolean;
}) {
  const VisIcon = VISIBILITY_ICONS[organizer.visibility];

  return (
    <div className="gaming-card p-5 group hover:border-cyan-500/20 transition-all">
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/10 flex-shrink-0">
          <AvatarImage src={organizer.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl">
            <Building2 className="w-6 h-6 text-white" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-orbitron font-bold text-base text-white truncate">{organizer.name}</h3>
              <p className="text-xs text-white/40 font-mono">@{organizer.slug}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${VERIFIED_CLS[organizer.verified_status]}`}>
              {organizer.verified_status}
            </Badge>
          </div>

          {organizer.description && (
            <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{organizer.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-white/40 flex-wrap">
            <span className="flex items-center gap-1"><VisIcon className="w-3 h-3" />{organizer.visibility}</span>
            <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-500/70" />{organizer.tournament_count} tournaments</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{organizer.follower_count} followers</span>
          </div>

          {organizer.owner && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
              <Avatar className="w-4 h-4">
                <AvatarImage src={organizer.owner.avatar_url ?? undefined} />
                <AvatarFallback className="bg-white/10 text-[8px]">{organizer.owner.username[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-white/35">Owner: <span className="text-white/55">{organizer.owner.username}</span></span>
              {organizer.my_role && (
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_CLS[organizer.my_role] ?? ''}`}>
                  {organizer.my_role.replace('_', ' ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 flex-wrap">
        <Link to={`/tournaments/create?organizer=${organizer.id}`} className="flex-1">
          <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs h-8 gap-1.5 font-bold">
            <Zap className="w-3.5 h-3.5" />Create Tournament
          </Button>
        </Link>

        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => onManageMembers(organizer)}
              className="border-white/15 text-white/60 hover:bg-white/5 text-xs h-8 gap-1.5">
              <Users className="w-3.5 h-3.5" />Members
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(organizer)}
              className="border-white/15 text-white/60 hover:bg-white/5 text-xs h-8 gap-1.5">
              <Edit2 className="w-3.5 h-3.5" />Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function AdminOrganizers() {
  const { profile } = useAuth();
  const { organizers, loading, error, refresh } = useOrganizers();
  const { createOrganizer } = useOrganizerManagement();

  const [searchQuery, setSearchQuery]         = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editOrganizer, setEditOrganizer]     = useState<OrganizerWithMembership | null>(null);
  const [membersOrganizer, setMembersOrganizer] = useState<OrganizerWithMembership | null>(null);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  const myOrganizers = organizers.filter(o =>
    o.owner_id === profile?.id || o.my_permissions?.can_manage_staff
  );

  const filtered = organizers.filter(o =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (data: Parameters<typeof createOrganizer>[0]) => {
    const result = await createOrganizer(data);
    if (result.success) {
      toast.success(`Organizer "${data.name}" created! You can now create tournaments.`);
      refresh();
    } else {
      toast.error(result.error || 'Failed to create organizer');
      throw new Error(result.error);
    }
  };

  if (error) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Error loading organizers</h3>
      <p className="text-white/50">{error}</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />Organizers
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {isAdmin ? 'Manage all tournament hosts and their permissions.' : 'Your organizer accounts for hosting tournaments.'}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold gap-2">
          <Plus className="w-4 h-4" />Create Organizer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: organizers.length,                                           icon: Building2,  color: 'text-cyan-400' },
          { label: 'Verified',   value: organizers.filter(o => o.verified_status === 'verified').length, icon: CheckCircle, color: 'text-blue-400' },
          { label: 'Featured',   value: organizers.filter(o => o.verified_status === 'featured').length, icon: Crown,       color: 'text-purple-400' },
          { label: 'Tournaments', value: organizers.reduce((s, o) => s + o.tournament_count, 0),     icon: Trophy,     color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="gaming-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-4 h-4" /></div>
            <div>
              <p className="text-xl font-orbitron font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search organizers…" className="pl-10 bg-white/5 border-white/10" />
      </div>

      {/* My organizers quick banner (for non-admins with orgs) */}
      {!isAdmin && myOrganizers.length > 0 && (
        <div className="p-4 rounded-2xl bg-cyan-500/8 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-cyan-400">Your organizer{myOrganizers.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-white/50">
            You manage {myOrganizers.length} organizer{myOrganizers.length > 1 ? 's' : ''}.
            Click <strong className="text-white">Create Tournament</strong> on any card below to host a tournament.
          </p>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="gaming-card p-5 animate-pulse space-y-3">
              <div className="flex gap-4"><div className="w-14 h-14 rounded-2xl bg-white/10" /><div className="flex-1 space-y-2"><div className="h-4 bg-white/10 rounded w-1/2" /><div className="h-3 bg-white/10 rounded w-1/3" /></div></div>
              <div className="h-8 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="gaming-card p-12 text-center">
          <Building2 className="w-14 h-14 mx-auto text-white/15 mb-4" />
          <h3 className="font-orbitron text-lg font-semibold text-white mb-2">
            {searchQuery ? 'No organizers found' : 'No organizers yet'}
          </h3>
          <p className="text-white/50 text-sm max-w-md mx-auto mb-5">
            {searchQuery
              ? 'Try adjusting your search terms.'
              : 'Create your first organizer to start hosting tournaments under a branded identity.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
              <Plus className="w-4 h-4 mr-2" />Create Organizer
            </Button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map(org => (
              <motion.div key={org.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <OrganizerCard
                  organizer={org}
                  onEdit={setEditOrganizer}
                  onManageMembers={setMembersOrganizer}
                  canManage={isAdmin || org.owner_id === profile?.id || !!org.my_permissions?.can_manage_staff}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create dialog */}
      <OrganizerFormDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
      />

      {/* Edit dialog */}
      {editOrganizer && (
        <OrganizerFormDialog
          open={!!editOrganizer}
          onClose={() => { setEditOrganizer(null); refresh(); }}
          organizerId={editOrganizer.id}
          initialData={editOrganizer}
        />
      )}

      {/* Member management sheet */}
      <Dialog open={!!membersOrganizer} onOpenChange={v => { if (!v) setMembersOrganizer(null); }}>
        <DialogContent className="sm:max-w-lg glass border-border/40 max-h-[85vh] overflow-y-auto">
          {membersOrganizer && <MemberPanel organizer={membersOrganizer} onClose={() => setMembersOrganizer(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
