import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sword, Trophy, TrendingUp, MessageSquare, Share2, Users, ArrowLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShareModal } from '@/components/community/ShareModal';
import { AnimatePresence } from 'framer-motion';

type RivalProfile = { id: string; username: string; avatar_url: string | null; matches_played: number; matches_won: number; gamercred_scores: { score: number } | null };
type Rivalry = { id: string; player_a: string; player_b: string; wins_a: number; wins_b: number; matches: number; game_id: string | null; last_match: string | null; games: { name: string; icon: string } | null };

export function RivalryPage() {
  const { playerA, playerB } = useParams<{ playerA: string; playerB: string }>();
  const [rivalry, setRivalry] = useState<Rivalry | null>(null);
  const [profA, setProfA] = useState<RivalProfile | null>(null);
  const [profB, setProfB] = useState<RivalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ra, rb] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, matches_played, matches_won, gamercred_scores(score)').eq('username', playerA).maybeSingle(),
        supabase.from('profiles').select('id, username, avatar_url, matches_played, matches_won, gamercred_scores(score)').eq('username', playerB).maybeSingle(),
      ]);
      if (ra.data) setProfA(ra.data as RivalProfile);
      if (rb.data) setProfB(rb.data as RivalProfile);

      if (ra.data && rb.data) {
        const { data: riv } = await supabase.from('rivalries')
          .select('*, games(name, icon)')
          .or(`and(player_a.eq.${ra.data.id},player_b.eq.${rb.data.id}),and(player_a.eq.${rb.data.id},player_b.eq.${ra.data.id})`)
          .maybeSingle();
        if (riv) {
          // normalise so profA is always player_a
          const normalised = riv.player_a === ra.data.id ? riv : { ...riv, player_a: riv.player_b, player_b: riv.player_a, wins_a: riv.wins_b, wins_b: riv.wins_a };
          setRivalry(normalised as Rivalry);
        }
      }
      setLoading(false);
    };
    if (playerA && playerB) load();
  }, [playerA, playerB]);

  if (loading) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
    </div>
  );

  if (!profA || !profB) return (
    <div className="min-h-screen pt-24 flex items-center justify-center px-6">
      <div className="text-center"><p className="text-white/40 text-lg mb-4">Players not found.</p>
        <Link to="/community" className="text-cyan-400 hover:underline text-sm">← Back to Community</Link></div>
    </div>
  );

  const winsA = rivalry?.wins_a ?? 0;
  const winsB = rivalry?.wins_b ?? 0;
  const total = rivalry?.matches ?? 0;
  const pctA = total > 0 ? Math.round(winsA / total * 100) : 50;
  const leader = winsA > winsB ? profA : winsB > winsA ? profB : null;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-3xl mx-auto">
        <Link to="/community" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Community
        </Link>

        {/* Hero card */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 mb-8"
          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(10,10,30,0.95) 40%, rgba(236,72,153,0.08) 100%)' }}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <Sword className="w-64 h-64 text-white" />
          </div>

          <div className="relative p-6 sm:p-10">
            {rivalry?.games && (
              <div className="flex justify-center mb-6">
                <span className="px-4 py-1.5 rounded-full bg-white/8 border border-white/12 text-sm font-semibold text-white/60">
                  {rivalry.games.icon} {rivalry.games.name}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Player A */}
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-cyan-500/40">
                  <AvatarImage src={profA.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-orbitron font-black text-xl">
                    {profA.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Link to={`/profile/${profA.username}`} className="font-orbitron font-black text-lg text-white hover:text-cyan-400 transition-colors block">{profA.username}</Link>
                {(profA.gamercred_scores as { score: number } | null)?.score && (
                  <p className="text-xs text-cyan-400 font-mono mt-1">⚡ {(profA.gamercred_scores as { score: number }).score.toLocaleString()} GC</p>
                )}
              </div>

              {/* Score */}
              <div className="text-center">
                <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-2">Rivalry Record</div>
                <div className="font-orbitron font-black text-4xl sm:text-5xl text-white">
                  <span className="text-cyan-400">{winsA}</span>
                  <span className="text-white/20 mx-2">–</span>
                  <span className="text-pink-400">{winsB}</span>
                </div>
                <p className="text-xs text-white/35 mt-2">{total} matches played</p>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <Sword className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">vs</span>
                </div>
              </div>

              {/* Player B */}
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-pink-500/40">
                  <AvatarImage src={profB.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white font-orbitron font-black text-xl">
                    {profB.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Link to={`/profile/${profB.username}`} className="font-orbitron font-black text-lg text-white hover:text-pink-400 transition-colors block">{profB.username}</Link>
                {(profB.gamercred_scores as { score: number } | null)?.score && (
                  <p className="text-xs text-pink-400 font-mono mt-1">⚡ {(profB.gamercred_scores as { score: number }).score.toLocaleString()} GC</p>
                )}
              </div>
            </div>

            {/* Win bar */}
            {total > 0 && (
              <div className="mt-6">
                <div className="flex h-3 rounded-full overflow-hidden bg-white/8">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pctA}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${100 - pctA}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500" />
                </div>
                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                  <span>{pctA}%</span><span>{100 - pctA}%</span>
                </div>
              </div>
            )}

            {leader && (
              <div className="mt-5 text-center">
                <span className="px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-xs font-bold">
                  👑 {leader.username} leads this rivalry
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Win Rate', a: profA.matches_played > 0 ? `${Math.round(profA.matches_won / profA.matches_played * 100)}%` : '—', b: profB.matches_played > 0 ? `${Math.round(profB.matches_won / profB.matches_played * 100)}%` : '—' },
            { label: 'Total Matches', a: profA.matches_played.toString(), b: profB.matches_played.toString() },
            { label: 'Total Wins', a: profA.matches_won.toString(), b: profB.matches_won.toString() },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl bg-white/4 border border-white/8 text-center">
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-mono mb-3">{s.label}</p>
              <div className="flex items-center justify-around">
                <span className="font-orbitron font-black text-xl text-cyan-400">{s.a}</span>
                <span className="text-white/20 text-xs">vs</span>
                <span className="font-orbitron font-black text-xl text-pink-400">{s.b}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          {rivalry ? (
            <button onClick={() => setShowShare(true)}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-2xl bg-white/6 border border-white/12 hover:bg-white/10 transition-all text-sm text-white/60 hover:text-white">
              <Share2 className="w-4 h-4" />Share this rivalry
            </button>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-white/12 text-center">
              <Sword className="w-10 h-10 mx-auto text-white/15 mb-3" />
              <p className="text-white/40 text-sm">No recorded matches yet.</p>
              <p className="text-white/25 text-xs mt-1">Play against each other in tournaments to start this rivalry.</p>
              <Link to="/tournaments" className="inline-flex items-center gap-1.5 mt-4 text-xs text-cyan-400 hover:underline">
                Browse Tournaments <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showShare && profA && profB && (
          <ShareModal
            title={`${profA.username} vs ${profB.username} Rivalry`}
            url={window.location.href}
            authorUsername={profA.username}
            type="tournament"
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
