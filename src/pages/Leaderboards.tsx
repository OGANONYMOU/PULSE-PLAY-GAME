import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Users, RefreshCw, Zap, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
type PlayerRow = {
  user_id: string;
  score: number;
  wins: number;
  losses: number;
  tournaments_played: number;
  verified_badge: boolean;
  profiles: { username: string; avatar_url: string | null } | null;
};

type PulseRow = {
  user_id: string;
  balance: number;
  profiles: { username: string; avatar_url: string | null } | null;
};

type ClubRow = {
  id: string;
  name: string;
  tag: string;
  points: number;
  wins: number;
  losses: number;
  member_count: number;
  games: { name: string; icon: string } | null;
};

// ── Rank badge ────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }): React.ReactElement {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="font-orbitron font-black text-sm text-white/40">{rank}</span>;
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function PlayerAvatar({ username, url }: { username: string; url: string | null }): React.ReactElement {
  return url ? (
    <img src={url} alt={username} className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white/10" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-orbitron font-black text-sm flex-shrink-0">
      {username[0]?.toUpperCase() ?? 'U'}
    </div>
  );
}

// ── GamerCred leaderboard ─────────────────────────────────────────────────
function GamerCredBoard({ data, loading }: { data: PlayerRow[]; loading: boolean }): React.ReactElement {
  return (
    <div className="space-y-2">
      {loading ? (
        Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)
      ) : data.map((p, i) => {
        const winRate = p.wins + p.losses > 0 ? Math.round(p.wins / (p.wins + p.losses) * 100) : 0;
        const isTop3 = i < 3;
        return (
          <motion.div key={p.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={'flex items-center gap-4 p-3.5 rounded-xl border transition-all ' +
              (isTop3 ? 'bg-gradient-to-r from-white/5 to-white/2 border-white/12' : 'bg-white/3 border-white/7')}>
            <div className="w-8 flex items-center justify-center flex-shrink-0"><RankBadge rank={i + 1} /></div>
            <PlayerAvatar username={p.profiles?.username ?? '?'} url={p.profiles?.avatar_url ?? null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white truncate">{p.profiles?.username ?? '—'}</span>
                {p.verified_badge && <Shield className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-white/35">{p.tournaments_played} tournaments · {winRate}% win rate</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-orbitron font-black text-base text-cyan-400">{p.score.toLocaleString()}</p>
              <p className="text-[9px] text-white/25">GamerCred</p>
            </div>
          </motion.div>
        );
      })}
      {!loading && data.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">No rankings yet. Play some tournaments!</div>
      )}
    </div>
  );
}

// ── PulsePoints leaderboard ───────────────────────────────────────────────
function PulsePointsBoard({ data, loading }: { data: PulseRow[]; loading: boolean }): React.ReactElement {
  return (
    <div className="space-y-2">
      {loading ? (
        Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)
      ) : data.map((p, i) => (
        <motion.div key={p.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className={'flex items-center gap-4 p-3.5 rounded-xl border ' +
            (i < 3 ? 'bg-gradient-to-r from-purple-500/8 to-transparent border-purple-500/15' : 'bg-white/3 border-white/7')}>
          <div className="w-8 flex items-center justify-center flex-shrink-0"><RankBadge rank={i + 1} /></div>
          <PlayerAvatar username={p.profiles?.username ?? '?'} url={p.profiles?.avatar_url ?? null} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white truncate max-w-[100px] sm:max-w-none">{p.profiles?.username ?? '—'}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-orbitron font-black text-base text-purple-400">{p.balance.toLocaleString()}</p>
            <p className="text-[9px] text-white/25">PP</p>
          </div>
        </motion.div>
      ))}
      {!loading && data.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">No points earned yet.</div>
      )}
    </div>
  );
}

// ── Clubs leaderboard ─────────────────────────────────────────────────────
function ClubsBoard({ data, loading }: { data: ClubRow[]; loading: boolean }): React.ReactElement {
  return (
    <div className="space-y-2">
      {loading ? (
        Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)
      ) : data.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className={'flex items-center gap-4 p-3.5 rounded-xl border ' +
            (i < 3 ? 'bg-gradient-to-r from-yellow-500/8 to-transparent border-yellow-500/15' : 'bg-white/3 border-white/7')}>
          <div className="w-8 flex items-center justify-center flex-shrink-0"><RankBadge rank={i + 1} /></div>
          <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-base flex-shrink-0">
            {c.games?.icon ?? <Users className="w-4 h-4 text-white/20" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white truncate">{c.name}</span>
              <span className="text-[10px] font-mono text-white/30">[{c.tag}]</span>
            </div>
            <p className="text-[11px] text-white/35">{c.member_count} members · {c.wins}W {c.losses}L</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-orbitron font-black text-base text-yellow-400">{c.points.toLocaleString()}</p>
            <p className="text-[9px] text-white/25">pts</p>
          </div>
        </motion.div>
      ))}
      {!loading && data.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">No clubs ranked yet.</div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function Leaderboards(): React.ReactElement {
  const [tab, setTab] = useState<'gamercred' | 'pulsepoints' | 'clubs'>('gamercred');
  const [gcData, setGcData] = useState<PlayerRow[]>([]);
  const [ppData, setPpData] = useState<PulseRow[]>([]);
  const [clData, setClData] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('gamercred_scores')
        .select('*, profiles(username, avatar_url)')
        .order('score', { ascending: false }).limit(50),
      supabase.from('pulsepoints_balances')
        .select('user_id, balance').order('balance', { ascending: false }).limit(50)
        .then(async (res) => {
          if (res.error || !res.data) return { data: [], error: res.error };
          const ids = res.data.map((r: { user_id: string }) => r.user_id);
          if (ids.length === 0) return { data: [], error: null };
          const prof = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
          const profMap = new Map((prof.data ?? []).map((p: { id: string; username: string; avatar_url: string | null }) => [p.id, p]));
          return { data: res.data.map((r: { user_id: string; balance: number }) => ({ ...r, profiles: profMap.get(r.user_id) ?? null })), error: null };
        }),
      supabase.from('clubs')
        .select('id, name, tag, points, wins, losses, member_count, games(name, icon)')
        .order('points', { ascending: false }).limit(50),
    ]).then(([gc, pp, cl]) => {
      if (!gc.error) setGcData((gc.data as PlayerRow[]) ?? []);
      if (!(pp as { error: unknown }).error) setPpData(((pp as { data: PulseRow[] }).data) ?? []);
      if (!cl.error) setClData((cl.data as ClubRow[]) ?? []);
      setLoading(false);
    });
  }, [lastRefresh]);

  const TABS = [
    { id: 'gamercred',   label: 'GamerCred',   icon: Shield,   color: 'text-cyan-400',   desc: 'Skill & reputation ranking' },
    { id: 'pulsepoints', label: 'PulsePoints',  icon: Zap,      color: 'text-purple-400', desc: 'Activity & engagement score' },
    { id: 'clubs',       label: 'Clubs',        icon: Users,    color: 'text-yellow-400', desc: 'Top clubs by tournament points' },
  ] as const;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-300 text-xs font-semibold mb-4">
            <Trophy className="w-3.5 h-3.5" />Global Rankings
          </div>
          <h1 className="font-orbitron text-3xl sm:text-4xl font-black text-white mb-3">
            <span className="gradient-text">Leaderboards</span>
          </h1>
          <p className="text-white/45 text-sm">See who's dominating the PulsePlay arena</p>
        </motion.div>

        {/* Tab pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap justify-center">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={'flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all border ' +
                (tab === t.id
                  ? 'bg-white/12 border-white/20 text-white'
                  : 'border-white/8 text-white/40 hover:border-white/15 hover:text-white/70')}>
              <t.icon className={'w-3.5 h-3.5 ' + (tab === t.id ? t.color : '')} />
              {t.label}
            </button>
          ))}
          <button onClick={() => setLastRefresh(Date.now())} disabled={loading}
            className="ml-auto p-2 rounded-full border border-white/8 text-white/30 hover:text-white hover:border-white/20 transition-all">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>

        {/* Active tab description */}
        <p className="text-center text-xs text-white/25 mb-5">
          {TABS.find(t => t.id === tab)?.desc}
        </p>

        {/* Boards */}
        {tab === 'gamercred'   && <GamerCredBoard   data={gcData} loading={loading} />}
        {tab === 'pulsepoints' && <PulsePointsBoard data={ppData} loading={loading} />}
        {tab === 'clubs'       && <ClubsBoard       data={clData} loading={loading} />}
      </div>
    </div>
  );
}
