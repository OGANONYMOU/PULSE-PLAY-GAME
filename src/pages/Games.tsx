import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Gamepad2, Users, Trophy, ArrowRight, Star, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGames } from '@/hooks/useGames';

const categories = [
  { value: 'all', label: 'All Games' },
  { value: 'fps', label: 'FPS' },
  { value: 'battle-royale', label: 'Battle Royale' },
  { value: 'moba', label: 'MOBA' },
  { value: 'sports', label: 'Sports' },
];

function formatPlayerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M+`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function Games() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { games, isLoading, error } = useGames();

  const filteredGames = games.filter((game) => {
    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || game.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredGame = games.find((g) => g.featured);

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
          Trending <span className="gradient-text">Mobile Games</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Stay updated on the most popular mobile games, tips, and tournaments
        </p>
      </motion.div>

      {/* Search and Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-4xl mx-auto mb-12"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-muted/50 border-border/50 rounded-xl"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className={`rounded-full whitespace-nowrap ${
                  selectedCategory === cat.value
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600'
                    : 'border-border/50 hover:bg-muted'
                }`}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto mb-8 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>Failed to load games: {error}</p>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-64 rounded-2xl mb-16" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {/* Featured Game */}
      {!isLoading && featuredGame && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-7xl mx-auto mb-16"
        >
          <div className="gaming-card p-8 md:p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-cyan-500/10" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500">
                  <Star className="w-3 h-3 mr-1" />
                  Featured Game of the Month
                </Badge>
                <h2 className="font-orbitron text-3xl md:text-4xl font-bold mb-4">
                  {featuredGame.name}
                </h2>
                <p className="text-muted-foreground text-lg mb-6">
                  {featuredGame.description}
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <div className="font-orbitron text-2xl font-bold gradient-text">
                      {formatPlayerCount(featuredGame.player_count)}
                    </div>
                    <div className="text-xs text-muted-foreground">Active Players</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <div className="font-orbitron text-2xl font-bold gradient-text">
                      {featuredGame.tournament_count}+
                    </div>
                    <div className="text-xs text-muted-foreground">Tournaments</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <div className="font-orbitron text-2xl font-bold gradient-text capitalize">
                      {featuredGame.category}
                    </div>
                    <div className="text-xs text-muted-foreground">Genre</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square max-w-sm mx-auto rounded-3xl bg-gradient-to-br from-yellow-500/20 via-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <span className="text-9xl">{featuredGame.icon}</span>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-pulse">
                  <Flame className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Games Grid */}
      {!isLoading && (
        <div className="max-w-7xl mx-auto pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames
              .filter((g) => !g.featured)
              .map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                >
                  <div className="gaming-card p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-3xl">
                        {game.icon}
                      </div>
                      {game.badge && (
                        <Badge className="bg-purple-500 text-white">
                          <Sparkles className="w-3 h-3 mr-1" />
                          {game.badge}
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-orbitron text-xl font-bold mb-2">{game.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4 flex-1">{game.description}</p>

                    <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {formatPlayerCount(game.player_count)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {game.tournament_count}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full border-purple-500/50 hover:bg-purple-500/10"
                    >
                      <Gamepad2 className="mr-2 w-4 h-4" />
                      View Updates
                      <ArrowRight className="ml-auto w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
          </div>

          {filteredGames.filter((g) => !g.featured).length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Gamepad2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-orbitron text-xl font-bold mb-2">No games found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filter</p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
