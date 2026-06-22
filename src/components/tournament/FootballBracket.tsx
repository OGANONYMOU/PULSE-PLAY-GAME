// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay — Football Copa-Style Tournament Bracket
// Single-elimination bracket with SVG connector lines, Copa round naming,
// and live score display. Inspired by Copa América / Copa del Rey style.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Trophy, Zap, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BracketRound {
  id: string;
  round_number: number;
  round_name: string;
  total_matches: number;
  completed_matches: number;
  status: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  round_id: string;
  match_number: number | null;
  status: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  is_bye: boolean;
  next_match_id: string | null;
  next_match_slot: number | null;
  player1: { username: string; avatar_url: string | null } | null;
  player2: { username: string; avatar_url: string | null } | null;
  winner: { username: string } | null;
}

interface FootballBracketProps {
  rounds: BracketRound[];
  matches: BracketMatch[];
  myId: string | null;
  onOpenMatch: (match: BracketMatch) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATCH_H = 108;    // height of a match card (px)
const MATCH_W = 208;    // width of a match card (px)
const MATCH_GAP = 12;   // gap between matches in same round (px)
const CONNECTOR_W = 44; // width of connector column between rounds (px)
const ROUND_COL_GAP = 0; // gap between round col and connector col (already 0)

// ── Copa round name mapping ───────────────────────────────────────────────────

function getCopaRoundName(roundNumber: number, totalRounds: number): string {
  const stepsFromEnd = totalRounds - roundNumber;
  if (stepsFromEnd === 0) return 'Final';
  if (stepsFromEnd === 1) return 'Semi-finals';
  if (stepsFromEnd === 2) return 'Quarter-finals';
  const matchesInRound = Math.pow(2, stepsFromEnd - 1);
  const totalInRound = matchesInRound * 2;
  if (totalInRound <= 64) return `Round of ${totalInRound}`;
  return `Round ${roundNumber}`;
}

// ── Player slot inside a match card ──────────────────────────────────────────

function PlayerSlot({
  player,
  score,
  isWinner,
  isBye,
  isMyPlayer,
}: {
  player: { username: string; avatar_url: string | null } | null;
  score: number | null;
  isWinner: boolean;
  isBye?: boolean;
  isMyPlayer: boolean;
}) {
  if (isBye) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3">
        <div className="w-6 h-6 rounded-full bg-white/8 flex-shrink-0" />
        <span className="text-[11px] text-white/25 italic font-medium">BYE</span>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3">
        <div className="w-6 h-6 rounded-full border border-dashed border-white/15 flex-shrink-0" />
        <span className="text-[11px] text-white/30 italic">TBD</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
      isWinner
        ? 'bg-green-500/15 border border-green-500/30'
        : 'bg-white/3 border border-transparent'
    } ${isMyPlayer ? 'ring-1 ring-cyan-500/40' : ''}`}>
      <Avatar className="w-6 h-6 flex-shrink-0">
        <AvatarImage src={player.avatar_url ?? undefined} />
        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-bold text-[9px]">
          {player.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className={`text-[11px] font-semibold truncate flex-1 ${
        isWinner ? 'text-green-400' : 'text-white/80'
      }`}>
        {player.username}
        {isWinner && <span className="ml-1">👑</span>}
      </span>
      {score !== null && (
        <span className={`font-orbitron font-black text-sm flex-shrink-0 ${
          isWinner ? 'text-green-400' : 'text-white/60'
        }`}>
          {score}
        </span>
      )}
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────

function CopaBracketMatchCard({
  match,
  myId,
  onOpenMatch,
}: {
  match: BracketMatch;
  myId: string | null;
  onOpenMatch: (m: BracketMatch) => void;
}) {
  const isMyMatch = myId && (match.player1_id === myId || match.player2_id === myId);
  const isClickable = !match.is_bye && match.status !== 'settled';

  const statusConfig: Record<string, { border: string; badge: string; label: string }> = {
    in_progress:    { border: 'border-cyan-500/50',   badge: 'bg-cyan-500/20 text-cyan-400',   label: '● Live'        },
    awaiting_proof: { border: 'border-yellow-500/40', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Proof Needed' },
    disputed:       { border: 'border-red-500/40',    badge: 'bg-red-500/20 text-red-400',     label: 'Disputed'      },
    completed:      { border: 'border-green-500/20',  badge: '', label: '' },
    verified:       { border: 'border-green-500/20',  badge: '', label: '' },
    settled:        { border: 'border-white/8',       badge: '', label: '' },
  };

  const cfg = statusConfig[match.status] ?? { border: 'border-white/10', badge: '', label: '' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => isClickable && isMyMatch ? onOpenMatch(match) : undefined}
      style={{ width: MATCH_W, height: MATCH_H }}
      className={`relative rounded-xl border ${cfg.border} bg-[#0d0d1e]/90 backdrop-blur-sm flex flex-col justify-between p-2 gap-1 ${
        isClickable && isMyMatch ? 'cursor-pointer hover:border-cyan-500/60 hover:bg-[#0f1020]' : ''
      } transition-all shadow-lg`}
    >
      {/* Match number tag */}
      {match.match_number !== null && (
        <span className="absolute top-1.5 left-2 text-[9px] font-mono text-white/20">
          #{match.match_number}
        </span>
      )}

      {/* Player 1 */}
      <PlayerSlot
        player={match.player1}
        score={match.player1_score}
        isWinner={match.winner_id === match.player1_id && !!match.player1_id}
        isMyPlayer={myId === match.player1_id}
      />

      {/* Divider with VS */}
      <div className="flex items-center gap-1.5 px-3">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[8px] font-mono text-white/20">VS</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Player 2 */}
      <PlayerSlot
        player={match.player2}
        score={match.player2_score}
        isWinner={match.winner_id === match.player2_id && !!match.player2_id}
        isBye={match.is_bye}
        isMyPlayer={myId === match.player2_id}
      />

      {/* Status badge */}
      {cfg.badge && (
        <div className={`absolute bottom-1.5 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.label}
        </div>
      )}

      {/* My match pulse indicator */}
      {isMyMatch && ['in_progress', 'awaiting_proof'].includes(match.status) && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
      )}
    </motion.div>
  );
}

// ── SVG connector between two consecutive rounds ──────────────────────────────

function BracketConnector({
  numPairs,
  spacingCurrent,
  totalHeight,
}: {
  numPairs: number;
  spacingCurrent: number; // spacing between match centers in current (left) round
  totalHeight: number;
}) {
  const midX = CONNECTOR_W / 2;
  const strokeColor = 'rgba(255,255,255,0.12)';
  const strokeW = 1.5;

  const lines: React.ReactNode[] = [];

  for (let j = 0; j < numPairs; j++) {
    // Centers in the left round
    const topCY = spacingCurrent * (2 * j) + spacingCurrent / 2;
    const botCY = spacingCurrent * (2 * j + 1) + spacingCurrent / 2;
    const midY = (topCY + botCY) / 2;

    lines.push(
      <g key={j}>
        {/* Horizontal right arm from top match */}
        <line x1={0} y1={topCY} x2={midX} y2={topCY} stroke={strokeColor} strokeWidth={strokeW} />
        {/* Vertical bar connecting the pair */}
        <line x1={midX} y1={topCY} x2={midX} y2={botCY} stroke={strokeColor} strokeWidth={strokeW} />
        {/* Horizontal right arm from bottom match */}
        <line x1={0} y1={botCY} x2={midX} y2={botCY} stroke={strokeColor} strokeWidth={strokeW} />
        {/* Horizontal arm to parent match (goes to right edge) */}
        <line x1={midX} y1={midY} x2={CONNECTOR_W} y2={midY} stroke={strokeColor} strokeWidth={strokeW} />
      </g>
    );
  }

  return (
    <svg
      width={CONNECTOR_W}
      height={totalHeight}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {lines}
    </svg>
  );
}

// ── Round header card ─────────────────────────────────────────────────────────

function RoundHeader({
  round,
  roundNumber,
  totalRounds,
}: {
  round: BracketRound;
  roundNumber: number;
  totalRounds: number;
}) {
  const name = getCopaRoundName(roundNumber, totalRounds);
  const isActive = round.status === 'active';
  const isDone = round.completed_matches === round.total_matches && round.total_matches > 0;

  return (
    <div className={`text-center px-3 py-2.5 rounded-xl mb-3 border ${
      isDone
        ? 'bg-green-500/8 border-green-500/15'
        : isActive
          ? 'bg-cyan-500/12 border-cyan-500/25'
          : 'bg-white/4 border-white/8'
    }`} style={{ width: MATCH_W }}>
      <p className={`font-orbitron font-black text-xs tracking-wide ${
        isDone ? 'text-green-400' : isActive ? 'text-cyan-400' : 'text-white'
      }`}>
        {name}
      </p>
      <p className="text-[10px] text-white/30 mt-0.5">
        {round.completed_matches}/{round.total_matches} matches
        {isActive && <span className="ml-1.5 text-cyan-400 animate-pulse">● Live</span>}
        {isDone && <span className="ml-1.5 text-green-400">✓</span>}
      </p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function BracketEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative">
        <Trophy className="w-16 h-16 text-white/10" />
        <div className="absolute -top-1 -right-1">
          <Zap className="w-6 h-6 text-cyan-500/30" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-white/35 text-sm font-semibold">Bracket not generated yet</p>
        <p className="text-white/20 text-xs mt-1">Waiting for check-in phase to complete</p>
      </div>
    </div>
  );
}

// ── Main bracket component ────────────────────────────────────────────────────

export function FootballBracket({ rounds, matches, myId, onOpenMatch }: FootballBracketProps) {
  if (rounds.length === 0 || matches.length === 0) {
    return <BracketEmpty />;
  }

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);
  const totalRounds = sortedRounds.length;

  // Pre-sort matches by match_number for each round
  const matchesByRound = sortedRounds.map(r =>
    matches
      .filter(m => m.round === r.round_number)
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
  );

  const firstRoundCount = matchesByRound[0]?.length ?? 0;
  if (firstRoundCount === 0) return <BracketEmpty />;

  const baseUnit = MATCH_H + MATCH_GAP;
  const totalHeight = firstRoundCount * baseUnit;

  // Header area height (round header card + gap)
  const HEADER_H = 56; // approx height of RoundHeader + mb-3

  return (
    <div className="w-full">
      {/* Copa bracket legend */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
          <span className="text-[10px] text-white/40">Winner / Advancing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/50" />
          <span className="text-[10px] text-white/40">Live match</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-white/20" />
          <span className="text-[10px] text-white/40">Your match highlighted with ring</span>
        </div>
      </div>

      {/* Scrollable bracket */}
      <div className="overflow-x-auto pb-6 -mx-4 px-4 sm:-mx-0 sm:px-0">
        <div
          className="flex items-start"
          style={{ minWidth: 'fit-content', gap: 0 }}
        >
          {sortedRounds.map((round, ri) => {
            const roundMatches = matchesByRound[ri];
            const numMatches = roundMatches.length;
            const isLastRound = ri === totalRounds - 1;

            // Spacing between match centers in this round
            const spacing = baseUnit * Math.pow(2, ri);

            // Number of pairs connecting to next round
            const numPairs = Math.floor(numMatches / 2);

            return (
              <div
                key={round.id}
                className="flex items-start"
                style={{ gap: 0 }}
              >
                {/* Round column */}
                <div style={{ width: MATCH_W, flexShrink: 0 }}>
                  <RoundHeader
                    round={round}
                    roundNumber={round.round_number}
                    totalRounds={totalRounds}
                  />

                  {/* Matches positioned absolutely within a fixed-height container */}
                  <div
                    style={{
                      position: 'relative',
                      height: totalHeight,
                      width: MATCH_W,
                    }}
                  >
                    {roundMatches.map((match, mi) => {
                      const topOffset = spacing * mi + (spacing - MATCH_H) / 2;
                      return (
                        <div
                          key={match.id}
                          style={{
                            position: 'absolute',
                            top: topOffset,
                            left: 0,
                            width: MATCH_W,
                          }}
                        >
                          <CopaBracketMatchCard
                            match={match}
                            myId={myId}
                            onOpenMatch={onOpenMatch}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SVG connector to next round */}
                {!isLastRound && numPairs > 0 && (
                  <div
                    style={{
                      flexShrink: 0,
                      width: CONNECTOR_W,
                      marginTop: HEADER_H,
                    }}
                  >
                    <BracketConnector
                      numPairs={numPairs}
                      spacingCurrent={spacing}
                      totalHeight={totalHeight}
                    />
                  </div>
                )}

                {/* Small gap between connector and next round column */}
                {!isLastRound && (
                  <div style={{ width: ROUND_COL_GAP, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
