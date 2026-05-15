import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Users, Play, CheckCircle, RefreshCw,
  Loader2, UserX, UserCheck, Layers,
  Flag, Crown, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';

type Tournament = {
  id: string; name: string; status: string; bracket_generated: boolean;
  total_rounds: number | null; current_round: number; max_players: number;
  entry_fee: number; prize_amount: number; easy_mode: boolean;
  games: { name: string; icon: string } | null;
};
type Participant = {
  id: string; user_id: string; status: string; seed: number | null;
  in_game_username: string | null; eliminated_round: number | null;
  profiles: { username: string; avatar_url: string | null } | null;
};
type Match = {
  id: string; round: number; status: string; match_number: number | null;
  player1_id: string | null; player2_id: string | null; winner_id: string | null;
  is_bye: boolean;
  player1: { username: string } | null;
  player2: { username: string } | null;
};
type Dispute = {
  id: string; match_id: string; reason: string; state: string;
  created_at: string; due_by: string | null;
  opened_by_profile: { username: string } | null;
};

export function AdminTournamentControl() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview'|'participants'|'matches'|'disputes'>('overview');
  const [generatingBracket, setGeneratingBracket] = useState(false);
  const [advancingMatch, setAdvancingMatch] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [tRes, pRes, mRes, dRes] = await Promise.all([
      supabase.from('tournaments').select('*, games(name, icon)').eq('id', id).single(),
      supabase.from('tournament_participants')
        .select('*, profiles(username, avatar_url)')
        .eq('tournament_id', id).order('joined_at'),
      supabase.from('matches')
        .select('id, round, status, match_number, player1_id, player2_id, winner_id, is_bye, player1:profiles!player1_id(username), player2:profiles!player2_id(username)')
        .eq('tournament_id', id).order('match_number'),
      supabase.from('disputes')
        .select('*, opened_by_profile:profiles!opened_by(username)')
        .in('match_id', (await supabase.from('matches').select('id').eq('tournament_id', id)).data?.map((m: never) => m.id) ?? [])
        .order('created_at', { ascending: false }),
    ]);
    if (!tRes.error) setTournament(tRes.data as Tournament);
    if (!pRes.error) setParticipants((pRes.data as Participant[]) ?? []);
    if (!mRes.error) setMatches((mRes.data as Match[]) ?? []);
    if (!dRes.error) setDisputes((dRes.data as Dispute[]) ?? []);
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const generateBracket = async () => {
    if (!id || !user) return;
    setGeneratingBracket(true);
    const { error } = await (supabase as never).rpc('generate_bracket', { p_tournament_id: id });
    if (error) toast.error(error.message);
    else { toast.success('Bracket generated! 🏆'); load(); }
    setGeneratingBracket(false);
  };

  const forceAdvance = async (matchId: string, winnerId: string) => {
    setAdvancingMatch(matchId);
    const { error } = await (supabase as never).rpc('advance_match_winner', {
      p_match_id: matchId, p_winner_id: winnerId,
    });
    if (error) toast.error(error.message);
    else {
      await writeAuditLog({ actor_id: user?.id, action: 'match.status_change', entity_type: 'match', entity_id: matchId, data: { forced_winner: winnerId } });
      toast.success('Winner advanced.');
      load();
    }
    setAdvancingMatch(null);
  };

  const toggleCheckIn = async (p: Participant) => {
    const newStatus = p.status === 'checked_in' ? 'joined' : 'checked_in';
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'checked_in') update.checked_in_at = new Date().toISOString();
    const { error } = await supabase.from('tournament_participants').update(update as never).eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success(`${p.profiles?.username} ${newStatus === 'checked_in' ? 'checked in' : 'unchecked'}`); load(); }
  };

  const eliminatePlayer = async (p: Participant) => {
    const { error } = await supabase.from('tournament_participants').update({ status: 'dropped' } as never).eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success(`${p.profiles?.username} removed from bracket.`); load(); }
  };

  const resolveDispute = async (disputeId: string, winnerId: string, matchId: string) => {
    await supabase.from('disputes').update({
      state: 'resolved', resolved_by: user?.id, resolved_at: new Date().toISOString(),
      resolution: 'Admin forced result',
    } as never).eq('id', disputeId);
    await (supabase as never).rpc('advance_match_winner', { p_match_id: matchId, p_winner_id: winnerId });
    await writeAuditLog({ actor_id: user?.id, action: 'dispute.resolve', entity_type: 'dispute', entity_id: disputeId, data: { forced_winner: winnerId, match_id: matchId } });
    toast.success('Dispute resolved. Winner advanced.');
    load();
  };

  const statusColor: Record<string, string> = {
    upcoming: 'text-blue-400', ongoing: 'text-green-400', completed: 'text-white/40',
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
  );
  if (!tournament) return <div className="p-8 text-white/40">Tournament not found.</div>;

  const checkedIn = participants.filter(p => p.status === 'checked_in').length;
  const activeDisputes = disputes.filter(d => d.state === 'open').length;
  const pendingMatches = matches.filter(m => ['scheduled','in_progress','awaiting_proof','disputed'].includes(m.status) && !m.is_bye).length;

  const TABS = [
    { id: 'overview',     label: 'Overview',   icon: Trophy    },
    { id: 'participants', label: `Players (${participants.length})`, icon: Users },
    { id: 'matches',      label: `Matches (${pendingMatches} active)`, icon: Layers },
    { id: 'disputes',     label: `Disputes${activeDisputes > 0 ? ` (${activeDisputes})` : ''}`, icon: Flag },
  ] as const;

  return (
    <div className="p-5 sm:p-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-6 h-6 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="font-orbitron text-xl font-black text-white">{tournament.name}</h1>
            <span className={`text-xs font-bold capitalize ${statusColor[tournament.status] ?? 'text-white/40'}`}>• {tournament.status}</span>
            {tournament.easy_mode && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 font-bold">⚡ Easy Mode</span>}
          </div>
          <p className="text-sm text-white/40">{tournament.games?.icon} {tournament.games?.name} · {participants.length}/{tournament.max_players} players</p>
        </div>
        <Link to={`/tournaments/${id}`} target="_blank"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/12 text-white/50 text-xs hover:bg-white/5 transition-all">
          <Eye className="w-3.5 h-3.5" />View Page
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Checked In', val: `${checkedIn}/${participants.length}`, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/15' },
          { label: 'Active Matches', val: pendingMatches, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/15' },
          { label: 'Open Disputes', val: activeDisputes, color: activeDisputes > 0 ? 'text-red-400' : 'text-white/35', bg: activeDisputes > 0 ? 'bg-red-500/10 border-red-500/15' : 'bg-white/5 border-white/8' },
          { label: 'Round', val: tournament.bracket_generated ? `${tournament.current_round}/${tournament.total_rounds}` : 'Not started', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/15' },
        ].map(s => (
          <div key={s.label} className={`p-3.5 rounded-xl border text-center ${s.bg}`}>
            <p className={`font-orbitron font-black text-xl ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Generate bracket button */}
      {!tournament.bracket_generated && tournament.status !== 'completed' && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/8 to-purple-500/8 border border-cyan-500/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-orbitron font-bold text-sm text-white">Ready to Generate Bracket?</p>
              <p className="text-xs text-white/40 mt-0.5">{checkedIn} players checked in · {participants.filter(p => p.status === 'joined').length} still registered</p>
            </div>
            <button onClick={generateBracket} disabled={generatingBracket || checkedIn < 2}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50">
              {generatingBracket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Generate Bracket
            </button>
          </div>
          {checkedIn < 2 && <p className="text-[10px] text-yellow-400 mt-2">⚠ Need at least 2 checked-in players to generate bracket.</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/8 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
              tab === t.id ? 'text-cyan-400 border-cyan-400' : 'text-white/40 border-transparent hover:text-white/60'
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <button onClick={load} disabled={loading} className="text-white/30 hover:text-white/60 transition-colors p-2">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Entry Fee', `${tournament.entry_fee} PP`],
              ['Prize Pool', `${tournament.prize_amount} PP`],
              ['Bracket', tournament.bracket_generated ? '✓ Generated' : 'Pending'],
              ['Format', tournament.easy_mode ? '⚡ Easy Mode' : 'Standard'],
            ].map(([k, v]) => (
              <div key={k} className="p-3.5 rounded-xl bg-white/4 border border-white/8">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">{k}</p>
                <p className="font-semibold text-white mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'participants' && (
        <div className="space-y-2">
          {participants.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all group ${
                p.status === 'checked_in' ? 'bg-green-500/5 border-green-500/15' :
                p.status === 'dropped' ? 'bg-white/2 border-white/6 opacity-60' :
                'bg-white/3 border-white/8'
              }`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-orbitron font-black flex-shrink-0">
                {p.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white">{p.profiles?.username}</p>
                  {p.in_game_username && <span className="text-[10px] text-white/30">({p.in_game_username})</span>}
                </div>
                <p className="text-[10px] text-white/30 capitalize">{p.status}</p>
              </div>
              {p.seed && <span className="text-[10px] font-mono text-white/25">Seed #{p.seed}</span>}
              {p.status !== 'dropped' && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleCheckIn(p)} title={p.status === 'checked_in' ? 'Undo check-in' : 'Force check-in'}
                    className={`p-1.5 rounded-lg transition-all ${p.status === 'checked_in' ? 'hover:bg-yellow-500/20 text-yellow-400' : 'hover:bg-green-500/20 text-white/30 hover:text-green-400'}`}>
                    <UserCheck className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => eliminatePlayer(p)} title="Eliminate / Remove"
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-all">
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {tab === 'matches' && (
        <div className="space-y-2">
          {matches.filter(m => !m.is_bye).map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-white/3 border border-white/8 group">
              <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center flex-shrink-0 text-xs font-mono text-white/40">
                #{m.match_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className={`font-semibold ${m.winner_id === m.player1_id ? 'text-green-400' : 'text-white/70'}`}>{m.player1?.username ?? 'TBD'}</span>
                  <span className="text-white/20">vs</span>
                  <span className={`font-semibold ${m.winner_id === m.player2_id ? 'text-green-400' : 'text-white/70'}`}>{m.player2?.username ?? 'TBD'}</span>
                </div>
                <span className={`text-[10px] capitalize font-mono ${
                  m.status === 'disputed' ? 'text-red-400' :
                  m.status === 'awaiting_proof' ? 'text-yellow-400' :
                  m.status === 'settled' || m.status === 'verified' ? 'text-green-400/60' :
                  'text-white/30'
                }`}>Round {m.round} · {m.status.replace('_', ' ')}</span>
              </div>
              {/* Force advance if match is stuck */}
              {['scheduled','in_progress','awaiting_proof','disputed'].includes(m.status) && m.player1_id && m.player2_id && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {[{ id: m.player1_id, label: m.player1?.username ?? 'P1' }, { id: m.player2_id, label: m.player2?.username ?? 'P2' }].map(p => (
                    <button key={p.id} onClick={() => forceAdvance(m.id, p.id)} disabled={advancingMatch === m.id}
                      title={`Force win for ${p.label}`}
                      className="px-2 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-[10px] font-bold hover:bg-yellow-500/25 transition-all flex items-center gap-1">
                      {advancingMatch === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown className="w-3 h-3" />}
                      {p.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          {matches.filter(m => !m.is_bye).length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">No matches yet — generate bracket first.</div>
          )}
        </div>
      )}

      {tab === 'disputes' && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-10 h-10 mx-auto text-white/15 mb-3" />
              <p className="text-white/30 text-sm">No disputes — the tournament is clean!</p>
            </div>
          ) : disputes.map((d, i) => {
            const match = matches.find(m => m.id === d.match_id);
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`p-4 rounded-xl border ${d.state === 'open' ? 'bg-red-500/6 border-red-500/20' : 'bg-white/3 border-white/8'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${d.state === 'open' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/8 text-white/35 border-white/15'}`}>{d.state}</span>
                      {match && <span className="text-[10px] text-white/30">Match #{match.match_number}</span>}
                    </div>
                    <p className="text-sm text-white/70">{d.reason}</p>
                    <p className="text-[10px] text-white/30 mt-1">by @{d.opened_by_profile?.username ?? '—'}</p>
                  </div>
                  {d.state === 'open' && match && match.player1_id && match.player2_id && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <p className="text-[9px] text-white/25 text-center">Force win for:</p>
                      {[{ id: match.player1_id, label: match.player1?.username }, { id: match.player2_id, label: match.player2?.username }].map(p => (
                        <button key={p.id} onClick={() => resolveDispute(d.id, p.id, d.match_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-[10px] font-bold hover:bg-yellow-500/25 transition-all">
                          {p.label ?? p.id.slice(0, 6)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
