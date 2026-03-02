import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Calendar, Users, Clock, ArrowRight, Flame,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTournaments, type TournamentWithGame } from '@/hooks/useTournaments';
import { formatDistanceToNow } from 'date-fns';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Live' },
  { value: 'completed', label: 'Completed' },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ongoing':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse">
          <Flame className="w-3 h-3 mr-1" /> Live Now
        </Badge>
      );
    case 'upcoming':
      return (
        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
          <Calendar className="w-3 h-3 mr-1" /> Upcoming
        </Badge>
      );
    case 'completed':
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
          <CheckCircle className="w-3 h-3 mr-1" /> Completed
        </Badge>
      );
    default:
      return null;
  }
}

function TournamentModal({
  tournament,
  onClose,
}: {
  tournament: TournamentWithGame | null;
  onClose: () => void;
}) {
  if (!tournament) return null;
  const fillPercent = Math.round(
    (tournament.current_players / tournament.max_players) * 100
  );

  return (
    <Dialog open={!!tournament} onOpenChange={onClose}>
      <DialogContent className="max-w-lg glass border-border/50">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-2xl flex items-center gap-3">
            <span className="text-3xl">{tournament.games?.icon}</span>
            {tournament.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <StatusBadge status={tournament.status} />
            <Badge variant="outline">{tournament.games?.name}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Prize Pool', value: tournament.prize_pool, icon: Trophy },
              { label: 'Duration', value: tournament.duration, icon: Clock },
              { label: 'Max Players', value: tournament.max_players, icon: Users },
              {
                label: 'Date',
                value: formatDistanceToNow(new Date(tournament.date), { addSuffix: true }),
                icon: Calendar,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="w-3 h-3" />
                  {label}
                </div>
                <div className="font-orbitron font-bold">{String(value)}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Player Slots</span>
              <span className="font-medium">
                {tournament.current_players} / {tournament.max_players}
              </span>
            </div>
            <Progress value={fillPercent} className="h-2" />
          </div>

          {tournament.winner && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="text-xs text-muted-foreground">Winner</div>
                <div className="font-orbitron font-bold text-yellow-400">{tournament.winner}</div>
              </div>
            </div>
          )}

          {tournament.status === 'upcoming' && (
            <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-bold">
              Register Now
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Tournaments() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithGame | null>(null);
  const { tournaments, isLoading, error } = useTournaments();

  const filteredTournaments = tournaments.filter(
    (t) => activeFilter === 'all' || t.status === activeFilter
  );

  const counts = {
    all: tournaments.length,
    upcoming: tournaments.filter((t) => t.status === 'upcoming').length,
    ongoing: tournaments.filter((t) => t.status === 'ongoing').length,
    completed: tournaments.filter((t) => t.status === 'completed').length,
  };

  return (
    <div className="min-h-screen pt-24 px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto text-center mb-12"
      >
        <h1 className="font-orbitron text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Tournaments</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Compete in exciting mobile gaming tournaments and win real cash prizes
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? 'default' : 'outline'}
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full whitespace-nowrap ${
                activeFilter === filter.value
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600'
                  : 'border-border/50'
              }`}
            >
              {filter.label}
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/10 text-xs">
                {counts[filter.value as keyof typeof counts]}
              </span>
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto mb-8 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>Failed to load tournaments: {error}</p>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Tournament Grid */}
      {!isLoading && (
        <div className="max-w-7xl mx-auto pb-24">
          <AnimatePresence mode="wait">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament, index) => {
                const fillPercent = Math.round(
                  (tournament.current_players / tournament.max_players) * 100
                );
                return (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <div
                      className="gaming-card p-6 h-full flex flex-col cursor-pointer group"
                      onClick={() => setSelectedTournament(tournament)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-2xl">
                            {tournament.games?.icon ?? '🎮'}
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {tournament.games?.name}
                            </div>
                            <div className="font-medium text-sm">
                              {formatDistanceToNow(new Date(tournament.date), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={tournament.status} />
                      </div>

                      {/* Name */}
                      <h3 className="font-orbitron text-lg font-bold mb-3 group-hover:text-cyan-400 transition-colors">
                        {tournament.name}
                      </h3>

                      {/* Prize & Duration */}
                      <div className="flex items-center gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-1.5 text-yellow-400">
                          <Trophy className="w-4 h-4" />
                          <span className="font-bold">{tournament.prize_pool}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {tournament.duration}
                        </div>
                      </div>

                      {/* Player Progress */}
                      <div className="mt-auto">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Players
                          </span>
                          <span>
                            {tournament.current_players} / {tournament.max_players}
                          </span>
                        </div>
                        <Progress value={fillPercent} className="h-1.5" />
                      </div>

                      {tournament.winner && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                          <Trophy className="w-3 h-3" />
                          Winner: {tournament.winner}
                        </div>
                      )}

                      <div className="mt-4 flex items-center text-sm text-purple-400 font-medium group-hover:text-cyan-400 transition-colors">
                        View Details
                        <ArrowRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filteredTournaments.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-orbitron text-xl font-bold mb-2">No tournaments found</h3>
                <p className="text-muted-foreground">Check back soon for new events</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <TournamentModal
        tournament={selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </div>
  );
}
