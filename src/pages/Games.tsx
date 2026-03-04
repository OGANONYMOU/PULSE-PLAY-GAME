import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Gamepad2, Users, Trophy, Star, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';

type Game = {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: string;
  featured: boolean;
  created_at: string;
};

const CATEGORIES = [
  { value: 'all', label: 'All Games' },
  { value: 'fps', label: 'FPS' },
  { value: 'battle-royale', label: 'Battle Royale' },
  { value: 'moba', label: 'MOBA' },
  { value: 'sports', label: 'Sports' },
  { value: 'fighting', label: 'Fighting' },
];

const BADGE_COLORS: Record<string, string> = {
  'Most Popular': 'bg-purple-500',
  Trending:       'bg-cyan-500',
  New:            'bg-pink-500',
  Featured:       'bg-yellow-500',
  Hot:            'bg-red-500',
};

function GameSkeleton(): React.ReactElement {
  return (
    <div className="gaming-card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
        <div className="w-20 h-6 rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="h-5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-white/10 rounded w-full animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-5/6 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-4/6 animate-pulse" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
      </div>
      <div className="h-9 bg-white/10 rounded-xl animate-pulse" />
    </div>
  );
}

function FeaturedBanner(p: { game: Game }): React.ReactElement {
  const g = p.game;
  const players = g.player_count >= 1000 ? (g.player_count / 1000).toFixed(1) + 'K' : String(g.player_count);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="max-w-7xl mx-auto mb-12">
      <div className="gaming-card p-8 md:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-cyan-500/10" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500">
              <Star className="w-3 h-3 mr-1" />Featured Game of the Month
            </Badge>
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold mb-4">{g.name}</h2>
            <p className="text-muted-foreground text-lg mb-6">{g.description}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="font-orbitron text-2xl font-bold gradient-text">{players}</div>
                <div className="text-xs text-muted-foreground">Active Players</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="font-orbitron text-2xl font-bold gradient-text">&#x20A6;10M</div>
                <div className="text-xs text-muted-foreground">Prize Pool</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="font-orbitron text-2xl font-bold gradient-text">{g.tournament_count}+</div>
                <div className="text-xs text-muted-foreground">Tournaments</div>
              </div>
            </div>
            <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
              <Link to="/tournaments">View Tournaments <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
          <div className="relative">
            <div className="aspect-square max-w-sm mx-auto rounded-3xl bg-gradient-to-br from-yellow-500/20 via-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <span className="text-9xl">{g.icon}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GameCard(p: { game: Game; index: number }): React.ReactElement {
  const g = p.game;
  const badgeColor = g.badge ? (BADGE_COLORS[g.badge] ?? 'bg-purple-500') : '';
  const players = g.player_count >= 1000 ? (g.player_count / 1000).toFixed(1) + 'K' : String(g.player_count);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: p.index * 0.07 }}>
      <div className="gaming-card p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-3xl flex-shrink-0">
            {g.icon}
          </div>
          {g.badge ? (
            <Badge className={badgeColor + ' text-white text-xs'}>
              <Sparkles className="w-3 h-3 mr-1" />{g.badge}
            </Badge>
          ) : null}
        </div>
        <h3 className="font-orbitron text-lg font-bold mb-2 leading-snug">{g.name}</h3>
        <p className="text-muted-foreground text-sm mb-4 flex-1 leading-relaxed line-clamp-3">{g.description}</p>
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-cyan-400" /><span>{players}</span></div>
          <div className="flex items-center gap-1.5"><Trophy className="w-4 h-4 text-purple-400" /><span>{g.tournament_count} events</span></div>
        </div>
        <Button asChild variant="outline" className="w-full border-purple-500/40 hover:bg-purple-500/10 text-sm">
          <Link to="/tournaments">
            <Gamepad2 className="mr-2 w-4 h-4" />View Tournaments
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

function EmptyGames(p: { isFiltered: boolean; onClear: () => void }): React.ReactElement {
  return (
    <div className="text-center py-20 col-span-3">
      <Gamepad2 className="w-16 h-16 mx-auto text-white/20 mb-4" />
      <h3 className="font-orbitron text-xl font-bold text-white mb-2">No games found</h3>
      <p className="text-white/40 text-sm mb-6">
        {p.isFiltered ? 'Try a different category or search term.' : 'No games have been added yet.'}
      </p>
      {p.isFiltered ? (
        <Button onClick={p.onClear} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          Clear Filters
        </Button>
      ) : null}
    </div>
  );
}

export function Games(): React.ReactElement {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('featured', { ascending: false })
      .order('player_count', { ascending: false });
    if (error) {
      console.error('[Games] fetch error:', error.message);
      setFetchError(error.message);
    } else {
      setAllGames((data as Game[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const featured = allGames.find((g) => g.featured);
  const isFiltered = search.trim() !== '' || category !== 'all';

  const filtered = allGames.filter((g) => {
    if (g.featured && !isFiltered) return false;
    const q = search.toLowerCase();
    const matchSearch = g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    const matchCat = category === 'all' || g.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen pt-24 px-4 sm:px-6 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto text-center mb-10">
        <h1 className="font-orbitron text-4xl md:text-5xl font-bold mb-4">
          Trending <span className="gradient-text">Mobile Games</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Stay updated on the hottest mobile games, tips, and tournaments
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-4xl mx-auto mb-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                size="sm"
                onClick={() => setCategory(c.value)}
                className={
                  'rounded-full flex-shrink-0 text-xs h-9 ' +
                  (category === c.value
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white')
                }
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {fetchError ? (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <Button onClick={load} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          </div>
        </div>
      ) : loading ? (
        <>
          <div className="max-w-7xl mx-auto mb-12">
            <div className="gaming-card p-8 h-64 animate-pulse bg-white/5" />
          </div>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => <GameSkeleton key={i} />)}
          </div>
        </>
      ) : (
        <>
          {featured && !isFiltered ? <FeaturedBanner game={featured} /> : null}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.length > 0
                ? filtered.map((g, i) => <GameCard key={g.id} game={g} index={i} />)
                : <EmptyGames isFiltered={isFiltered} onClear={() => { setSearch(''); setCategory('all'); }} />
              }
            </div>
            {!loading && allGames.length > 0 ? (
              <p className="text-center text-white/30 text-xs mt-8">
                {filtered.length} game{filtered.length !== 1 ? 's' : ''} shown
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}