import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, Trophy, Sword, Star, Crown,
  Lock, Globe, X, Loader2, Copy, CheckCircle, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { ClubsSEO } from '@/components/SEO';

// ── Types ──────────────────────────────────────────────────────────────────
type Club = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logo_url: string | null;
  game_id: string | null;
  is_public: boolean;
  invite_code: string;
  member_count: number;
  wins: number;
  losses: number;
  points: number;
  created_at: string;
  games: { name: string; icon: string } | null;
  my_membership?: { role: string } | null;
};

type Game = { id: string; name: string; icon: string };

// ── Create club modal ──────────────────────────────────────────────────────
function CreateClubModal(p: { games: Game[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', tag: '', description: '', game_id: '', is_public: true });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Club name is required'); return; }
    if (!form.tag.trim() || form.tag.length > 5) { toast.error('Tag must be 2–5 characters'); return; }
    if (!user) { toast.error('Sign in first'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('clubs').insert({
      name: form.name.trim(),
      tag: form.tag.toUpperCase().trim(),
      description: form.description.trim(),
      game_id: form.game_id || null,
      is_public: form.is_public,
      created_by: user.id,
    } as never).select('id').single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    const clubId = (data as { id: string }).id;
    // Auto-join as owner
    await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'owner' } as never);
    await writeAuditLog({ actor_id: user.id, action: 'game.create', entity_type: 'club', entity_id: clubId, data: { name: form.name } });
    toast.success('Club created! 🎉');
    p.onCreated(clubId);
    p.onClose();
    setSaving(false);
  };

  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 h-9 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="dialog-mobile w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="font-orbitron font-bold text-sm text-white">Create Club</h2>
          </div>
          <button onClick={p.onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">Club Name *</label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PulsePlay FC" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Tag * (2–5)</label>
              <Input value={form.tag} onChange={e => set('tag', e.target.value.toUpperCase())} maxLength={5} placeholder="PPFC" className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="What's your club about?"
              className="bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 text-sm w-full rounded-lg px-3 py-2 resize-none focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Primary Game</label>
            <select value={form.game_id} onChange={e => set('game_id', e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-lg px-3 h-9 text-sm focus:outline-none focus:border-cyan-500/50">
              <option value="" className="bg-card text-white/40">Any game</option>
              {p.games.map(g => <option key={g.id} value={g.id} className="bg-card">{g.icon} {g.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
            <button onClick={() => set('is_public', !form.is_public)}
              className={'w-10 h-5 rounded-full transition-all relative flex-shrink-0 ' + (form.is_public ? 'bg-gradient-to-r from-cyan-500 to-purple-600' : 'bg-white/15')}>
              <span className={'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ' + (form.is_public ? 'left-5' : 'left-0.5')} />
            </button>
            <div>
              <p className="text-sm font-semibold text-white">{form.is_public ? 'Public Club' : 'Private Club'}</p>
              <p className="text-xs text-white/35">{form.is_public ? 'Anyone can join' : 'Invite only'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create Club
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Club card ──────────────────────────────────────────────────────────────
function ClubCard({ club, index, onJoin, joining }: {
  club: Club; index: number;
  onJoin: (c: Club) => void;
  joining: string | null;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const isMember = !!club.my_membership;
  const winRate = club.wins + club.losses > 0 ? Math.round(club.wins / (club.wins + club.losses) * 100) : 0;

  const copyInvite = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(`${window.location.origin}/clubs?invite=${club.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-white/18 hover:bg-white/5 transition-all cursor-pointer">

      {/* Top row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Club logo / placeholder */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center flex-shrink-0 text-2xl font-black font-orbitron text-white/30 overflow-hidden">
          {club.logo_url
            ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
            : club.games?.icon ?? <Users className="w-6 h-6 text-white/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-orbitron font-black text-base text-white truncate">{club.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40 font-mono font-bold flex-shrink-0">[{club.tag}]</span>
            {!club.is_public && <Lock className="w-3 h-3 text-white/30 flex-shrink-0" />}
            {isMember && club.my_membership?.role === 'owner' && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-white/40 truncate mb-1">{club.description || 'No description'}</p>
          {club.games && <span className="text-[10px] text-white/30">{club.games.icon} {club.games.name}</span>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-1.5 mb-4 sm:grid-cols-4">
        {[
          { icon: Users, val: club.member_count, label: 'Members', color: 'text-cyan-400' },
          { icon: Trophy, val: club.wins, label: 'Wins', color: 'text-green-400' },
          { icon: TrendingUp, val: `${winRate}%`, label: 'Win Rate', color: 'text-yellow-400' },
          { icon: Star, val: club.points, label: 'Points', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center p-2 rounded-xl bg-white/4">
            <s.icon className={'w-3 h-3 mb-1 ' + s.color} />
            <span className="font-orbitron font-black text-sm text-white">{s.val}</span>
            <span className="text-[9px] text-white/30">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isMember ? (
          <>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />Member
            </button>
            <button onClick={copyInvite}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-white/50 hover:text-white text-xs font-semibold transition-all">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Invite'}
            </button>
          </>
        ) : (
          <Button size="sm" onClick={() => onJoin(club)} disabled={joining === club.id || !club.is_public}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-1.5 h-9">
            {joining === club.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {club.is_public ? 'Join Club' : 'Invite Only'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Leaderboard table ──────────────────────────────────────────────────────
function ClubLeaderboard({ clubs }: { clubs: Club[] }): React.ReactElement {
  const sorted = [...clubs].sort((a, b) => b.points - a.points).slice(0, 10);
  return (
    <div className="space-y-2">
      {sorted.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
          <div className={'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-orbitron font-black text-xs ' +
            (i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-white/15 text-white/60' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/30')}>
            {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/15 to-purple-500/15 flex items-center justify-center text-sm flex-shrink-0">
            {c.games?.icon ?? <Users className="w-3.5 h-3.5 text-white/30" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white truncate">{c.name}</span>
              <span className="text-[10px] text-white/30 font-mono">[{c.tag}]</span>
            </div>
            <p className="text-[11px] text-white/30">{c.member_count} members · {c.wins}W {c.losses}L</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-orbitron font-black text-sm text-purple-400">{c.points.toLocaleString()}</p>
            <p className="text-[9px] text-white/25">pts</p>
          </div>
        </motion.div>
      ))}
      {sorted.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-10 h-10 mx-auto text-white/15 mb-3" />
          <p className="text-white/30 text-sm">No clubs yet — be the first!</p>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function Clubs(): React.ReactElement {
  const { isAuthenticated, user, profile } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'browse' | 'mine' | 'leaderboard'>('browse');
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, gRes] = await Promise.all([
      supabase.from('clubs').select('*, games(name, icon)').order('points', { ascending: false }),
      supabase.from('games').select('id, name, icon').order('name'),
    ]);
    if (!cRes.error) {
      let rows = (cRes.data as Club[]) ?? [];
      // Annotate with my_membership
      if (user) {
        const { data: mems } = await supabase.from('club_members').select('club_id, role').eq('user_id', user.id);
        const memMap = new Map((mems ?? []).map((m: { club_id: string; role: string }) => [m.club_id, m]));
        rows = rows.map(c => ({ ...c, my_membership: memMap.get(c.id) ?? null }));
      }
      setClubs(rows);
    }
    if (!gRes.error) setGames((gRes.data as Game[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (c: Club) => {
    if (!isAuthenticated || !user) { toast.error('Sign in to join clubs'); return; }
    if (profile?.is_banned) { toast.error('Your account is restricted.'); return; }
    if (!c.is_public) { toast.error('This club is invite-only'); return; }
    setJoining(c.id);
    const { error } = await supabase.from('club_members').insert({ club_id: c.id, user_id: user.id, role: 'member' } as never);
    if (error?.code === '23505') {
      toast.info("You're already a member!");
    } else if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Joined [${c.tag}] ${c.name}! 🎉`);
      load();
    }
    setJoining(null);
  };

  const filtered = clubs.filter(c => {
    if (tab === 'mine' && !c.my_membership) return false;
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q);
  });

  const TABS = [
    { id: 'browse', label: 'Browse', icon: Globe },
    { id: 'mine', label: 'My Clubs', icon: Users },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ] as const;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16">
      <ClubsSEO />
      <div className="page-shell max-w-6xl">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-semibold mb-4">
            <Sword className="w-3.5 h-3.5" />Compete Together
          </div>
          <h1 className="font-orbitron text-3xl sm:text-4xl font-black text-white mb-3">
            <span className="gradient-text">Clubs</span> & Squads
          </h1>
          <p className="text-white/45 text-sm max-w-xl mx-auto">
            Form a crew, dominate the leaderboards, and challenge rivals together.
          </p>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="pill-scroll w-full rounded-xl bg-white/5 border border-white/8 p-1 sm:w-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ' +
                  (tab === t.id ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white/70')}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
                {t.id === 'mine' && clubs.filter(c => c.my_membership).length > 0 && (
                  <span className="ml-1 text-[9px] px-1.5 rounded-full bg-cyan-500/25 text-cyan-400 font-bold">
                    {clubs.filter(c => c.my_membership).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {tab !== 'leaderboard' && (
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clubs…"
                  className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-full sm:w-48" />
              </div>
            )}
            {isAuthenticated && !profile?.is_banned && (
              <Button size="sm" onClick={() => setShowCreate(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold h-9 gap-1.5 flex-shrink-0 sm:w-auto">
                <Plus className="w-3.5 h-3.5" />New Club
              </Button>
            )}
            {profile?.is_banned && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                Account restricted
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        ) : tab === 'leaderboard' ? (
          <ClubLeaderboard clubs={clubs} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Users className="w-14 h-14 mx-auto text-white/15 mb-4" />
            <p className="text-white/35 text-sm mb-4">
              {tab === 'mine' ? 'You haven\'t joined any clubs yet.' : 'No clubs found.'}
            </p>
            {isAuthenticated && (
              <Button size="sm" onClick={() => setShowCreate(true)}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold gap-1.5">
                <Plus className="w-3.5 h-3.5" />Create the first club
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <ClubCard key={c.id} club={c} index={i} onJoin={handleJoin} joining={joining} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateClubModal key="create" games={games} onClose={() => setShowCreate(false)} onCreated={() => load()} />
        )}
      </AnimatePresence>
    </div>
  );
}
