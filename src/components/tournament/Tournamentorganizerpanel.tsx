// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay — Tournament Organizer Panel
// Injected as a tab inside TournamentDetail for users with staff access.
// Covers: participants, staff management, fixture control, lifecycle actions.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Swords, Trophy, AlertTriangle, CheckCircle2,
  Play, Square, Trash2, Plus,
  Loader2, Shield, UserCheck, UserX, Crown, MoreHorizontal,
  Flag, RefreshCw, Search, XCircle, Zap, Settings2,
  Edit2, Save, X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { writeAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { FixtureResultModal, type Fixture, type StaffRole } from './Fixtureresultmodal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  max_players: number;
  current_players: number;
  tournament_family: string | null;
  tournament_type: string | null;
  requires_check_in: boolean;
  description: string | null;
  rules: string | null;
  prize_pool: string | null;
  entry_fee: number | null;
  date: string | null;
  end_date: string | null;
  banner_url: string | null;
  created_by: string | null;
}

interface Participant {
  id: string;
  user_id: string;
  status: 'joined' | 'checked_in' | 'dropped';
  joined_at: string;
  checked_in_at: string | null;
  seed: number | null;
  in_game_username: string | null;
  final_placement: number | null;
  profiles: { username: string; avatar_url: string | null; gamercred: number | null } | null;
}

interface StaffMember {
  id: string;
  user_id: string;
  role: StaffRole;
  added_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

interface OpenDispute {
  id: string;
  fixture_id: string | null;
  raised_by: string;
  reason: string;
  notes: string | null;
  state: string;
  due_by: string | null;
  created_at: string;
  profiles: { username: string } | null;
}

interface OrgPanelProps {
  tournament: Tournament;
  /** Current user's staff role (null = viewer-only / no access) */
  myRole: StaffRole | null;
  isAdmin: boolean;
  fixtures: Fixture[];
  onFixturesUpdated: () => void;
  onTournamentStatusChange: (status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled') => void;
  onTournamentDeleted?: () => void;
  onTournamentEdited?: () => void;
}

interface EditForm {
  name: string;
  description: string;
  rules: string;
  prize_pool: string;
  entry_fee: string;
  max_players: string;
  date: string;
  end_date: string;
  banner_url: string;
}

type PanelTab = 'participants' | 'staff' | 'fixtures' | 'disputes' | 'lifecycle';

const STAFF_ROLES: { value: StaffRole; label: string; desc: string }[] = [
  { value: 'host',            label: 'Host',            desc: 'Full control' },
  { value: 'manager',         label: 'Manager',         desc: 'Edit setup, manage registrations' },
  { value: 'bracket_manager', label: 'Bracket Manager', desc: 'Manage brackets, seeding, scores' },
  { value: 'reporter',        label: 'Reporter',        desc: 'Report match results' },
  { value: 'referee',         label: 'Referee',         desc: 'Attest / confirm results' },
  { value: 'observer',        label: 'Observer',        desc: 'Read-only access' },
];

const PARTICIPANT_STATUS_STYLE: Record<string, string> = {
  joined:     'text-cyan-400 bg-cyan-500/12 border-cyan-500/25',
  checked_in: 'text-green-400 bg-green-500/12 border-green-500/25',
  dropped:    'text-white/25 bg-white/5 border-white/10',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({ title, count, action }: {
  title: string; count?: number;
  action?: { label: string; onClick: () => void; loading?: boolean };
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="font-orbitron font-bold text-sm text-white">{title}</h3>
        {typeof count === 'number' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/40 font-bold">{count}</span>
        )}
      </div>
      {action && (
        <Button
          size="sm"
          onClick={action.onClick}
          disabled={action.loading}
          className="h-7 px-3 text-[11px] bg-white/8 hover:bg-white/14 text-white border border-white/12"
        >
          {action.loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

function EmptySlate({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-white/20">
      {icon}
      <p className="text-xs">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function TournamentOrganizerPanel({
  tournament,
  myRole,
  isAdmin,
  fixtures,
  onFixturesUpdated,
  onTournamentStatusChange,
  onTournamentDeleted,
  onTournamentEdited,
}: OrgPanelProps): React.ReactElement {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<PanelTab>('participants');
  const [participants, setParticipants]   = useState<Participant[]>([]);
  const [staff, setStaff]                 = useState<StaffMember[]>([]);
  const [disputes, setDisputes]           = useState<OpenDispute[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');

  // Fixture result modal state
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

  // Staff invite state
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole]         = useState<StaffRole>('reporter');
  const [inviting, setInviting]             = useState(false);

  // Lifecycle action state
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editLoading, setEditLoading]   = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name:        tournament.name ?? '',
    description: tournament.description ?? '',
    rules:       tournament.rules ?? '',
    prize_pool:  tournament.prize_pool ?? '',
    entry_fee:   tournament.entry_fee?.toString() ?? '0',
    max_players: tournament.max_players?.toString() ?? '',
    date:        tournament.date ? tournament.date.slice(0, 16) : '',
    end_date:    tournament.end_date ? tournament.end_date.slice(0, 16) : '',
    banner_url:  tournament.banner_url ?? '',
  });

  const canManageParticipants = isAdmin || ['host', 'manager'].includes(myRole ?? '');
  const canManageStaff        = isAdmin || myRole === 'host';
  const canRecordResults      = isAdmin || ['host', 'manager', 'bracket_manager', 'reporter', 'referee'].includes(myRole ?? '');
  const canManageLifecycle    = isAdmin || myRole === 'host';

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes, dRes] = await Promise.all([
      supabase
        .from('tournament_participants')
        .select('id, user_id, status, joined_at, checked_in_at, seed, in_game_username, final_placement, profiles(username, avatar_url, gamercred)')
        .eq('tournament_id', tournament.id)
        .order('joined_at'),

      supabase
        .from('tournament_staff')
        .select('id, user_id, role, added_at, profiles(username, avatar_url)')
        .eq('tournament_id', tournament.id)
        .order('added_at'),

      supabase
        .from('disputes')
        .select('id, fixture_id, raised_by, reason, notes, state, due_by, created_at, profiles:raised_by(username)')
        .eq('tournament_id', tournament.id)
        .eq('state', 'open')
        .order('due_by'),
    ]);

    setParticipants((pRes.data ?? []) as unknown as Participant[]);
    setStaff((sRes.data ?? []) as unknown as StaffMember[]);
    setDisputes((dRes.data ?? []) as unknown as OpenDispute[]);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Participant actions ─────────────────────────────────────────────────────
  const handleCheckIn = async (p: Participant) => {
    if (!canManageParticipants) return;
    await supabase.from('tournament_participants')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() } as never)
      .eq('id', p.id);
    setParticipants(prev => prev.map(x =>
      x.id === p.id ? { ...x, status: 'checked_in', checked_in_at: new Date().toISOString() } : x
    ));
    toast.success(`${p.profiles?.username} checked in`);
  };

  const handleDrop = async (p: Participant) => {
    if (!canManageParticipants) return;
    const ok = window.confirm(`Remove ${p.profiles?.username} from the tournament?`);
    if (!ok) return;
    await supabase.from('tournament_participants')
      .update({ status: 'dropped' } as never).eq('id', p.id);
    await writeAuditLog({
      actor_id: user!.id,
      action: 'tournament.participant_dropped',
      entity_type: 'tournament',
      entity_id: tournament.id,
      data: { participant_user_id: p.user_id, username: p.profiles?.username },
    });
    setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, status: 'dropped' } : x));
    toast.success(`${p.profiles?.username} removed`);
  };

  const handleSetSeed = async (p: Participant, seed: number) => {
    if (!canManageParticipants) return;
    await supabase.from('tournament_participants').update({ seed } as never).eq('id', p.id);
    setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, seed } : x));
    toast.success(`Seed #${seed} set for ${p.profiles?.username}`);
  };

  const handleCheckInAll = async () => {
    if (!canManageParticipants) return;
    const joined = participants.filter(p => p.status === 'joined');
    if (!joined.length) { toast.info('All participants already checked in'); return; }
    const ids = joined.map(p => p.id);
    await supabase.from('tournament_participants')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() } as never)
      .in('id', ids);
    setParticipants(prev => prev.map(x =>
      ids.includes(x.id) ? { ...x, status: 'checked_in', checked_in_at: new Date().toISOString() } : x
    ));
    toast.success(`${ids.length} participants checked in`);
  };

  // ── Staff actions ───────────────────────────────────────────────────────────
  const handleInviteStaff = async () => {
    if (!canManageStaff || !user || !inviteUsername.trim()) return;
    setInviting(true);
    try {
      const { data: target } = await supabase
        .from('profiles').select('id, username')
        .ilike('username', inviteUsername.trim())
        .single<{ id: string; username: string }>();

      if (!target) { toast.error('User not found'); setInviting(false); return; }

      const { error } = await supabase.from('tournament_staff').insert({
        tournament_id: tournament.id,
        user_id: target.id,
        role: inviteRole,
        added_by: user.id,
      } as never);

      if (error?.code === '23505') { toast.error(`${target.username} is already on the staff`); setInviting(false); return; }
      if (error) { toast.error(error.message); setInviting(false); return; }

      await writeAuditLog({
        actor_id: user.id,
        action: 'tournament.staff_added',
        entity_type: 'tournament',
        entity_id: tournament.id,
        data: { staff_user_id: target.id, role: inviteRole },
      });

      toast.success(`${target.username} added as ${inviteRole}`);
      setInviteUsername('');
      loadAll();
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveStaff = async (s: StaffMember) => {
    if (!canManageStaff || !user) return;
    await supabase.from('tournament_staff').delete().eq('id', s.id);
    await writeAuditLog({
      actor_id: user.id,
      action: 'tournament.staff_removed',
      entity_type: 'tournament',
      entity_id: tournament.id,
      data: { staff_user_id: s.user_id, role: s.role },
    });
    toast.success(`${s.profiles?.username} removed from staff`);
    setStaff(prev => prev.filter(x => x.id !== s.id));
  };

  // ── Dispute actions ─────────────────────────────────────────────────────────
  const handleResolveDispute = async (d: OpenDispute, resolution: 'uphold' | 'dismiss') => {
    if (!isAdmin && myRole !== 'host') { toast.error('Only admins can resolve disputes'); return; }
    await supabase.from('disputes').update({
      state: 'resolved',
      resolution: resolution === 'uphold' ? 'Result stands' : 'Dispute dismissed',
      resolved_by: user!.id,
      resolved_at: new Date().toISOString(),
    } as never).eq('id', d.id);
    toast.success(`Dispute ${resolution === 'uphold' ? 'upheld' : 'dismissed'}`);
    setDisputes(prev => prev.filter(x => x.id !== d.id));
  };

  // ── Tournament lifecycle ────────────────────────────────────────────────────
  const handleLifecycleAction = async (action: 'start' | 'complete' | 'cancel') => {
    if (!canManageLifecycle || !user) return;

    const LABEL = { start: 'Start Tournament', complete: 'End Tournament', cancel: 'Cancel Tournament' };
    const ok = window.confirm(`${LABEL[action]}? This action will be logged.`);
    if (!ok) return;

    setLifecycleLoading(true);
    try {
      const newStatus = action === 'start' ? 'ongoing'
                      : action === 'cancel' ? 'cancelled'
                      : 'completed';
      const { error } = await supabase.from('tournaments')
        .update({
          status: newStatus,
          ...(action === 'complete' || action === 'cancel' ? { completed_at: new Date().toISOString() } : {}),
        } as never)
        .eq('id', tournament.id);

      if (error) { toast.error(error.message); return; }

      await writeAuditLog({
        actor_id: user.id,
        action: action === 'start' ? 'tournament.started'
               : action === 'cancel' ? 'tournament.cancelled'
               : 'tournament.completed',
        entity_type: 'tournament',
        entity_id: tournament.id,
        data: { previous_status: tournament.status, new_status: newStatus },
      });

      onTournamentStatusChange(newStatus);
      toast.success(`Tournament ${action === 'start' ? 'started' : action === 'complete' ? 'completed' : 'cancelled'}!`);
    } finally {
      setLifecycleLoading(false);
    }
  };

  // ── Delete tournament ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!canManageLifecycle || !user) return;
    if (confirmDeleteText !== tournament.name) {
      toast.error('Tournament name does not match.');
      return;
    }
    setDeleteLoading(true);
    try {
      await writeAuditLog({
        actor_id: user.id,
        action: 'tournament.deleted',
        entity_type: 'tournament',
        entity_id: tournament.id,
        data: { name: tournament.name, status: tournament.status },
      });
      const { error } = await supabase.from('tournaments').delete().eq('id', tournament.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Tournament deleted.');
      onTournamentDeleted?.();
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setConfirmDeleteText('');
    }
  };

  // ── Edit tournament ─────────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (!canManageLifecycle || !user) return;
    if (!editForm.name.trim()) { toast.error('Tournament name is required.'); return; }
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name:        editForm.name.trim(),
        description: editForm.description.trim() || null,
        rules:       editForm.rules.trim() || null,
        prize_pool:  editForm.prize_pool.trim() || null,
        banner_url:  editForm.banner_url.trim() || null,
      };
      // Fields restricted once tournament has started
      if (tournament.status === 'upcoming') {
        payload.entry_fee   = parseFloat(editForm.entry_fee) || 0;
        payload.max_players = parseInt(editForm.max_players, 10) || tournament.max_players;
        if (editForm.date)     payload.date     = new Date(editForm.date).toISOString();
        if (editForm.end_date) payload.end_date = new Date(editForm.end_date).toISOString();
      }
      const { error } = await supabase.from('tournaments').update(payload as never).eq('id', tournament.id);
      if (error) { toast.error(error.message); return; }
      await writeAuditLog({
        actor_id: user.id,
        action: 'tournament.edited',
        entity_type: 'tournament',
        entity_id: tournament.id,
        data: { fields_changed: Object.keys(payload) },
      });
      toast.success('Tournament updated!');
      setShowEditForm(false);
      onTournamentEdited?.();
    } finally {
      setEditLoading(false);
    }
  };

  // ── Filtered participants ───────────────────────────────────────────────────
  const filteredParticipants = participants.filter(p =>
    !searchQuery || p.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.in_game_username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkedIn = participants.filter(p => p.status === 'checked_in').length;
  const TABS: { id: PanelTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'participants', label: 'Players',  icon: <Users className="w-3.5 h-3.5" />, count: participants.length },
    { id: 'fixtures',     label: 'Fixtures', icon: <Swords className="w-3.5 h-3.5" />, count: fixtures.length },
    { id: 'disputes',     label: 'Disputes', icon: <Flag className="w-3.5 h-3.5" />,   count: disputes.length },
    ...(canManageStaff ? [{ id: 'staff' as PanelTab, label: 'Staff', icon: <Shield className="w-3.5 h-3.5" />, count: staff.length }] : []),
    ...(canManageLifecycle ? [{ id: 'lifecycle' as PanelTab, label: 'Controls', icon: <Settings2 className="w-3.5 h-3.5" /> }] : []),
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-0">
      {/* Organizer panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="font-orbitron font-bold text-xs text-white">Organizer Panel</span>
            <span className="ml-2 text-[9px] text-amber-400 bg-amber-500/12 border border-amber-500/22 px-1.5 py-0.5 rounded-full uppercase font-bold">
              {myRole ?? (isAdmin ? 'admin' : 'view')}
            </span>
          </div>
        </div>
        <button onClick={loadAll} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/12 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 overflow-x-auto scrollbar-none border-b border-white/8 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-bold whitespace-nowrap transition-all border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-white/35 hover:text-white/60',
            )}
          >
            {tab.icon}{tab.label}
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span className={cn(
                'text-[8px] px-1.5 py-0.5 rounded-full font-black ml-0.5',
                activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : 'bg-white/8 text-white/30',
                tab.id === 'disputes' && tab.count > 0 && activeTab !== tab.id && 'bg-red-500/20 text-red-400',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/4 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >

            {/* ── PARTICIPANTS ──────────────────────────────────────────────── */}
            {activeTab === 'participants' && (
              <div>
                <SectionHeader
                  title="Participants"
                  count={participants.length}
                  action={canManageParticipants && tournament.requires_check_in && tournament.status === 'upcoming'
                    ? { label: 'Check In All', onClick: handleCheckInAll }
                    : undefined
                  }
                />

                {/* Stats pills */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[
                    { label: 'Registered', val: participants.filter(p => p.status !== 'dropped').length, cls: 'text-white/60' },
                    { label: 'Checked In', val: checkedIn,                                                cls: 'text-green-400' },
                    { label: 'Dropped',    val: participants.filter(p => p.status === 'dropped').length,  cls: 'text-red-400/70' },
                    { label: 'Capacity',   val: `${tournament.current_players}/${tournament.max_players}`, cls: 'text-cyan-400' },
                  ].map(s => (
                    <div key={s.label} className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/8">
                      <span className={s.cls}>{s.val}</span>
                      <span className="text-white/25 ml-1">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search players…"
                    className="pl-8 h-9 text-xs bg-white/4 border-white/10 text-white placeholder:text-white/25"
                  />
                </div>

                {filteredParticipants.length === 0 ? (
                  <EmptySlate icon={<Users className="w-10 h-10" />} text="No participants yet" />
                ) : (
                  <div className="space-y-1.5">
                    {filteredParticipants.map((p, idx) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                          p.status === 'dropped' ? 'opacity-40 bg-white/[0.01] border-white/5' : 'bg-white/[0.02] border-white/7 hover:border-white/14',
                        )}
                      >
                        {/* Rank / seed */}
                        <div className="w-5 text-center text-[10px] text-white/25 font-mono flex-shrink-0">
                          {p.seed ?? (idx + 1)}
                        </div>

                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={p.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px] font-bold">
                            {p.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{p.profiles?.username ?? 'Unknown'}</div>
                          {p.in_game_username && (
                            <div className="text-[10px] text-white/30 truncate">IGN: {p.in_game_username}</div>
                          )}
                        </div>

                        <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-bold capitalize flex-shrink-0', PARTICIPANT_STATUS_STYLE[p.status])}>
                          {p.status === 'checked_in' ? '✓ In' : p.status}
                        </span>

                        {canManageParticipants && p.status !== 'dropped' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/12 transition-colors flex-shrink-0">
                                <MoreHorizontal className="w-3.5 h-3.5 text-white/40" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0d0d1e] border-white/12 text-white w-44">
                              {p.status === 'joined' && tournament.requires_check_in && (
                                <DropdownMenuItem onClick={() => handleCheckIn(p)} className="text-xs">
                                  <UserCheck className="w-3.5 h-3.5 mr-2 text-green-400" />Check In
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  const seed = parseInt(window.prompt(`Set seed for ${p.profiles?.username}:`, String(p.seed ?? '')) ?? '');
                                  if (!isNaN(seed) && seed > 0) handleSetSeed(p, seed);
                                }}
                                className="text-xs"
                              >
                                <Zap className="w-3.5 h-3.5 mr-2 text-yellow-400" />Set Seed
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/8" />
                              <DropdownMenuItem onClick={() => handleDrop(p)} className="text-xs text-red-400">
                                <UserX className="w-3.5 h-3.5 mr-2" />Drop Player
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FIXTURES ─────────────────────────────────────────────────── */}
            {activeTab === 'fixtures' && (
              <div>
                <SectionHeader title="Fixtures" count={fixtures.length} />

                {fixtures.length === 0 ? (
                  <EmptySlate icon={<Swords className="w-10 h-10" />} text="No fixtures generated yet" />
                ) : (
                  <div className="space-y-2">
                    {fixtures.map((f, idx) => {
                      const STATUS_STYLE = {
                        scheduled:   'text-white/40 bg-white/5 border-white/10',
                        in_progress: 'text-cyan-400 bg-cyan-500/12 border-cyan-500/25 animate-pulse',
                        completed:   'text-green-400 bg-green-500/10 border-green-500/18',
                        postponed:   'text-amber-400 bg-amber-500/10 border-amber-500/18',
                        cancelled:   'text-white/20 bg-white/3 border-white/7',
                      };

                      return (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/7 hover:border-white/14 transition-colors"
                        >
                          {/* Round badge */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
                            <span className="text-[10px] text-white/50 font-bold">{f.round_number}</span>
                          </div>

                          {/* Players */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-semibold text-white truncate max-w-[90px]">
                                {f.home_participant?.username ?? 'TBD'}
                              </span>
                              <span className="text-white/20 flex-shrink-0">vs</span>
                              <span className="font-semibold text-white truncate max-w-[90px]">
                                {f.away_participant?.username ?? 'TBD'}
                              </span>
                            </div>
                            {f.status === 'completed' && f.home_score !== null && (
                              <div className="text-[10px] text-white/30 mt-0.5">
                                Score: {f.home_score} – {f.away_score}
                              </div>
                            )}
                            {f.scheduled_at && (
                              <div className="text-[10px] text-white/20 mt-0.5">
                                {format(new Date(f.scheduled_at), 'MMM d, HH:mm')}
                              </div>
                            )}
                          </div>

                          {/* Status */}
                          <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-bold flex-shrink-0 capitalize', STATUS_STYLE[f.status])}>
                            {f.status === 'in_progress' ? '● Live' : f.status}
                          </span>

                          {/* Open result modal */}
                          {canRecordResults && f.status !== 'cancelled' && (
                            <button
                              onClick={() => setSelectedFixture(f)}
                              className="flex-shrink-0 h-7 px-2.5 rounded-lg bg-white/6 border border-white/10 hover:bg-white/12 hover:border-white/25 transition-all text-[10px] text-white/50 hover:text-white"
                            >
                              {f.status === 'completed' ? 'Edit' : 'Record'}
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── DISPUTES ─────────────────────────────────────────────────── */}
            {activeTab === 'disputes' && (
              <div>
                <SectionHeader title="Open Disputes" count={disputes.length} />

                {disputes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <CheckCircle2 className="w-10 h-10 text-green-400/30" />
                    <p className="text-xs text-white/25">No open disputes — all clear!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map(d => {
                      const isOverdue = d.due_by && new Date(d.due_by) < new Date();
                      return (
                        <div
                          key={d.id}
                          className={cn(
                            'rounded-2xl border p-4 space-y-2.5 transition-colors',
                            isOverdue ? 'bg-red-500/6 border-red-500/20' : 'bg-amber-500/5 border-amber-500/15',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {isOverdue && (
                                  <span className="text-[9px] text-red-400 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                    Overdue
                                  </span>
                                )}
                                <span className="text-[9px] text-white/30">
                                  by {d.profiles?.username ?? 'Unknown'} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-white">{d.reason}</div>
                              {d.notes && <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{d.notes}</p>}
                            </div>
                            {d.due_by && (
                              <div className="text-right flex-shrink-0">
                                <div className="text-[9px] text-white/25">Due</div>
                                <div className={cn('text-[10px] font-bold', isOverdue ? 'text-red-400' : 'text-amber-400')}>
                                  {format(new Date(d.due_by), 'MMM d HH:mm')}
                                </div>
                              </div>
                            )}
                          </div>
                          {(isAdmin || myRole === 'host') && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleResolveDispute(d, 'dismiss')}
                                className="flex-1 h-8 rounded-lg text-[11px] font-bold border border-white/12 bg-white/4 text-white/40 hover:bg-white/8 hover:text-white/70 transition-all"
                              >
                                <XCircle className="w-3 h-3 inline mr-1" />Dismiss
                              </button>
                              <button
                                onClick={() => handleResolveDispute(d, 'uphold')}
                                className="flex-1 h-8 rounded-lg text-[11px] font-bold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/18 transition-all"
                              >
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />Uphold & Close
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── STAFF ────────────────────────────────────────────────────── */}
            {activeTab === 'staff' && canManageStaff && (
              <div>
                <SectionHeader title="Tournament Staff" count={staff.length} />

                {/* Invite form */}
                <div className="rounded-2xl bg-white/[0.025] border border-white/8 p-4 mb-4 space-y-3">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Add Staff Member</div>
                  <Input
                    value={inviteUsername}
                    onChange={e => setInviteUsername(e.target.value)}
                    placeholder="Username…"
                    className="h-9 text-xs bg-white/4 border-white/10 text-white placeholder:text-white/25"
                    onKeyDown={e => e.key === 'Enter' && handleInviteStaff()}
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as StaffRole)}
                        className="w-full h-9 text-xs bg-white/4 border border-white/10 text-white rounded-lg px-2 outline-none"
                      >
                        {STAFF_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={handleInviteStaff}
                      disabled={inviting || !inviteUsername.trim()}
                      size="sm"
                      className="h-9 px-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                    </Button>
                  </div>
                </div>

                {staff.length === 0 ? (
                  <EmptySlate icon={<Shield className="w-10 h-10" />} text="No staff assigned" />
                ) : (
                  <div className="space-y-1.5">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/7">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={s.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[9px] font-bold">
                            {s.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{s.profiles?.username ?? 'Unknown'}</div>
                          <div className="text-[10px] text-white/25">
                            Added {formatDistanceToNow(new Date(s.added_at), { addSuffix: true })}
                          </div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/22 font-bold capitalize flex-shrink-0">
                          {s.role.replace('_', ' ')}
                        </span>
                        {s.user_id !== user?.id && (
                          <button
                            onClick={() => handleRemoveStaff(s)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/12 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3 text-white/25 hover:text-red-400 transition-colors" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── LIFECYCLE ────────────────────────────────────────────────── */}
            {activeTab === 'lifecycle' && canManageLifecycle && (
              <div className="space-y-3">
                <SectionHeader title="Tournament Controls" />

                {/* Status display */}
                <div className="rounded-2xl bg-white/[0.025] border border-white/8 p-4">
                  <div className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Current Status</div>
                  <div className={cn(
                    'text-sm font-bold capitalize',
                    tournament.status === 'ongoing' ? 'text-green-400' :
                    tournament.status === 'upcoming' ? 'text-cyan-400' :
                    'text-white/40',
                  )}>
                    {tournament.status === 'ongoing' ? '● Live' : tournament.status}
                  </div>
                </div>

                {/* Edit Tournament */}
                <div className="rounded-2xl bg-white/[0.025] border border-white/8 overflow-hidden">
                  <button
                    onClick={() => setShowEditForm(v => !v)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <Edit2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <div className="text-sm font-bold text-cyan-400">Edit Tournament</div>
                      <div className="text-[10px] text-white/30">Update details, dates, rules, prize info</div>
                    </div>
                    <XIcon className={cn('w-4 h-4 text-white/25 transition-transform', showEditForm ? 'rotate-0' : 'rotate-45')} />
                  </button>

                  <AnimatePresence>
                    {showEditForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
                          {/* Name */}
                          <div>
                            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Tournament Name *</label>
                            <Input
                              value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="h-9 bg-white/5 border-white/10 text-white text-xs"
                              placeholder="Tournament name"
                            />
                          </div>
                          {/* Description */}
                          <div>
                            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Description</label>
                            <textarea
                              value={editForm.description}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              rows={2}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50 resize-none"
                              placeholder="Tournament description"
                            />
                          </div>
                          {/* Rules */}
                          <div>
                            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Rules</label>
                            <textarea
                              value={editForm.rules}
                              onChange={e => setEditForm(f => ({ ...f, rules: e.target.value }))}
                              rows={3}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50 resize-none"
                              placeholder="Tournament rules"
                            />
                          </div>
                          {/* Prize + Entry fee */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Prize Pool</label>
                              <Input
                                value={editForm.prize_pool}
                                onChange={e => setEditForm(f => ({ ...f, prize_pool: e.target.value }))}
                                className="h-9 bg-white/5 border-white/10 text-white text-xs"
                                placeholder="₦50,000"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Entry Fee (PP)</label>
                              <Input
                                type="number"
                                min="0"
                                value={editForm.entry_fee}
                                onChange={e => setEditForm(f => ({ ...f, entry_fee: e.target.value }))}
                                disabled={tournament.status !== 'upcoming'}
                                className="h-9 bg-white/5 border-white/10 text-white text-xs disabled:opacity-40"
                              />
                            </div>
                          </div>
                          {/* Max players + Banner */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Max Players</label>
                              <Input
                                type="number"
                                min="2"
                                value={editForm.max_players}
                                onChange={e => setEditForm(f => ({ ...f, max_players: e.target.value }))}
                                disabled={tournament.status !== 'upcoming'}
                                className="h-9 bg-white/5 border-white/10 text-white text-xs disabled:opacity-40"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Banner URL</label>
                              <Input
                                value={editForm.banner_url}
                                onChange={e => setEditForm(f => ({ ...f, banner_url: e.target.value }))}
                                className="h-9 bg-white/5 border-white/10 text-white text-xs"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                          {/* Dates — only upcoming */}
                          {tournament.status === 'upcoming' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Start Date</label>
                                <Input
                                  type="datetime-local"
                                  value={editForm.date}
                                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                  className="h-9 bg-white/5 border-white/10 text-white text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">End Date</label>
                                <Input
                                  type="datetime-local"
                                  value={editForm.end_date}
                                  onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                                  className="h-9 bg-white/5 border-white/10 text-white text-xs"
                                />
                              </div>
                            </div>
                          )}
                          {tournament.status !== 'upcoming' && (
                            <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Dates, entry fee, and max players are locked once a tournament has started.
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button
                              onClick={handleEditSave}
                              disabled={editLoading || !editForm.name.trim()}
                              size="sm"
                              className="flex-1 h-9 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold"
                            >
                              {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                              Save Changes
                            </Button>
                            <Button
                              onClick={() => setShowEditForm(false)}
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-white/40 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {tournament.status === 'upcoming' && (
                    <button
                      onClick={() => handleLifecycleAction('start')}
                      disabled={lifecycleLoading || participants.filter(p => p.status !== 'dropped').length < 2}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-green-500/8 border border-green-500/20
                                 hover:bg-green-500/14 hover:border-green-500/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {lifecycleLoading ? <Loader2 className="w-5 h-5 animate-spin text-green-400" /> : <Play className="w-5 h-5 text-green-400" />}
                      <div className="text-left">
                        <div className="text-sm font-bold text-green-400">Start Tournament</div>
                        <div className="text-[10px] text-white/30">Sets status to ongoing, locks registrations</div>
                      </div>
                    </button>
                  )}

                  {tournament.status === 'ongoing' && (
                    <button
                      onClick={() => handleLifecycleAction('complete')}
                      disabled={lifecycleLoading}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-purple-500/8 border border-purple-500/20
                                 hover:bg-purple-500/14 hover:border-purple-500/35 transition-all disabled:opacity-40"
                    >
                      {lifecycleLoading ? <Loader2 className="w-5 h-5 animate-spin text-purple-400" /> : <Trophy className="w-5 h-5 text-purple-400" />}
                      <div className="text-left">
                        <div className="text-sm font-bold text-purple-400">End Tournament</div>
                        <div className="text-[10px] text-white/30">Marks tournament as completed</div>
                      </div>
                    </button>
                  )}

                  {tournament.status !== 'completed' && (
                    <button
                      onClick={() => handleLifecycleAction('cancel')}
                      disabled={lifecycleLoading}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/15
                                 hover:bg-red-500/10 hover:border-red-500/25 transition-all disabled:opacity-40"
                    >
                      {lifecycleLoading ? <Loader2 className="w-5 h-5 animate-spin text-red-400" /> : <Square className="w-5 h-5 text-red-400" />}
                      <div className="text-left">
                        <div className="text-sm font-bold text-red-400">Cancel Tournament</div>
                        <div className="text-[10px] text-white/30">Cannot be undone. Audit trail preserved.</div>
                      </div>
                    </button>
                  )}

                  {tournament.status === 'completed' && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="text-sm font-bold text-white/50">Tournament Concluded</div>
                        <div className="text-[10px] text-white/25">No further lifecycle actions available.</div>
                      </div>
                    </div>
                  )}

                  {/* Delete Tournament */}
                  {(isAdmin || (tournament.status in { upcoming: 1, cancelled: 1 })) && (
                    <div className="pt-2 border-t border-white/8">
                      {!showDeleteConfirm ? (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-900/10 border border-red-900/20
                                     hover:bg-red-900/20 hover:border-red-900/35 transition-all"
                        >
                          <Trash2 className="w-5 h-5 text-red-500/70 flex-shrink-0" />
                          <div className="text-left">
                            <div className="text-sm font-bold text-red-500/70">Delete Tournament</div>
                            <div className="text-[10px] text-white/25">Permanently remove this tournament and all its data.</div>
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl bg-red-900/10 border border-red-500/25 space-y-3">
                          <p className="text-xs text-red-400 font-semibold">This cannot be undone.</p>
                          <p className="text-[10px] text-white/40">
                            Type <span className="text-white/70 font-mono">{tournament.name}</span> to confirm deletion.
                          </p>
                          <Input
                            value={confirmDeleteText}
                            onChange={e => setConfirmDeleteText(e.target.value)}
                            className="h-9 bg-white/5 border-red-500/30 text-white text-xs"
                            placeholder={tournament.name}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={handleDelete}
                              disabled={deleteLoading || confirmDeleteText !== tournament.name}
                              size="sm"
                              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40"
                            >
                              {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                              Delete Forever
                            </Button>
                            <Button
                              onClick={() => { setShowDeleteConfirm(false); setConfirmDeleteText(''); }}
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-white/40 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Participant count warning */}
                {tournament.status === 'upcoming' && participants.filter(p => p.status !== 'dropped').length < 2 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/18">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-300/80">
                      Need at least 2 registered participants to start the tournament.
                    </p>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      )}

      {/* Fixture Result Modal */}
      {selectedFixture && (
        <FixtureResultModal
          fixture={selectedFixture}
          staffRole={myRole}
          isAdmin={isAdmin}
          open={!!selectedFixture}
          onClose={() => setSelectedFixture(null)}
          onSaved={() => {
            setSelectedFixture(null);
            onFixturesUpdated();
          }}
        />
      )}
    </div>
  );
}