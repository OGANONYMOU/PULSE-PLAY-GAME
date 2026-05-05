import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import {
  Gamepad2, Trophy, Users, ArrowLeft, Share2, Heart,
  Target, Shield, Zap, Flame, Calendar, ChevronRight,
  Star, TrendingUp, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types
interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  image_url: string | null;
  badge: string | null;
  player_count: number;
  tournament_count: number;
  category: string;
  featured: boolean;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  date: string;
  prize_pool: string;
  max_players: number;
  current_players: number;
  entry_fee: string | null;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string; avatar_url: string | null };
  tag: string;
  likes: number;
  comments: number;
  created_at: string;
}

const BADGE_COLORS: Record<string, string> = {
  'Most Popular': 'bg-purple-500',
  Trending: 'bg-cyan-500',
  New: 'bg-pink-500',
  Featured: 'bg-yellow-500',
  Hot: 'bg-red-500',
};

const CATEGORY_INFO: Record<string, { icon: React.ReactNode; description: string }> = {
  fps: { icon: <Target className="w-5 h-5" />, description: 'First-person shooter games' },
  'battle-royale': { icon: <Shield className="w-5 h-5" />, description: 'Last player standing format' },
  moba: { icon: <Zap className="w-5 h-5" />, description: 'Multiplayer online battle arena' },
  sports: { icon: <Trophy className="w-5 h-5" />, description: 'Competitive sports simulation' },
  fighting: { icon: <Flame className="w-5 h-5" />, description: 'One-on-one combat games' },
};

// Loading skeleton
function GameDetailSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-32 bg-white/10 rounded animate-pulse mb-6" />
        <div className="gaming-card p-8 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-12 w-3/4 bg-white/10 rounded animate-pulse" />
              <div className="h-6 w-1/2 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="h-48 bg-white/10 rounded-2xl animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="gaming-card p-6 h-48 bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Tournament card
function TournamentCard({ tournament, game }: { tournament: Tournament; game: Game }): React.ReactElement {
  const statusConfig = {
    upcoming: { color: 'bg-blue-500', label: 'Upcoming', textColor: 'text-blue-400' },
    ongoing: { color: 'bg-green-500', label: 'Live Now', textColor: 'text-green-400' },
    completed: { color: 'bg-gray-500', label: 'Completed', textColor: 'text-gray-400' },
  };

  const status = statusConfig[tournament.status];
  const filled = Math.round((tournament.current_players / tournament.max_players) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gaming-card p-5 flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className={cn(status.color, 'text-white text-xs')}>
          {status.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(tournament.date), 'MMM d, yyyy')}
        </span>
      </div>

      <h3 className="font-orbitron font-bold text-lg mb-2 leading-tight">{tournament.name}</h3>
      
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Gamepad2 className="w-4 h-4" />
        <span>{game.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="font-orbitron font-bold text-cyan-400">{tournament.prize_pool}</div>
          <div className="text-xs text-muted-foreground">Prize Pool</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="font-orbitron font-bold text-purple-400">
            {tournament.entry_fee || 'Free'}
          </div>
          <div className="text-xs text-muted-foreground">Entry</div>
        </div>
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {tournament.current_players}/{tournament.max_players}
          </span>
          <span className={filled >= 90 ? 'text-red-400' : 'text-green-400'}>
            {filled}%
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
          <div
            className={cn('h-full rounded-full transition-all', filled >= 90 ? 'bg-red-500' : 'bg-cyan-500')}
            style={{ width: `${filled}%` }}
          />
        </div>
        <Button asChild className="w-full" variant="outline">
          <Link to={`/tournaments?id=${tournament.id}`}>
            View Details <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// Community post card
function PostCard({ post }: { post: Post }): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gaming-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} alt={post.author.username} className="w-full h-full rounded-xl object-cover" />
          ) : (
            <span className="text-sm font-bold">{post.author.username[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{post.author.username}</span>
            <Badge variant="outline" className="text-xs">{post.tag}</Badge>
          </div>
          <h4 className="font-medium text-sm mb-1 line-clamp-2">{post.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.content}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" /> {post.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {post.comments}
            </span>
            <span>{format(new Date(post.created_at), 'MMM d')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function GameDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('No game ID provided');
      setLoading(false);
      return;
    }

    async function loadGame() {
      try {
        // Load game details
        const gameId = id as string;
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;
        if (!gameData) {
          setError('Game not found');
          setLoading(false);
          return;
        }

        const typedGame = gameData as Game;
        setGame(typedGame);

        // Load tournaments for this game
        const { data: tournamentData } = await supabase
          .from('tournaments')
          .select('id, name, status, date, prize_pool, max_players, current_players, entry_fee')
          .eq('game_id', gameId)
          .order('date', { ascending: true })
          .limit(6);

        setTournaments((tournamentData || []) as Tournament[]);

        // Load community posts for this game
        const { data: postData } = await supabase
          .from('posts')
          .select(`
            id, title, content, tag, likes, comments, created_at,
            author:profiles(username, avatar_url)
          `)
          .or(`tag.eq.${typedGame.name.toLowerCase().replace(/\s+/g, '_')},tag.eq.general`)
          .order('created_at', { ascending: false })
          .limit(5);

        // Transform posts data
        const transformedPosts = (postData || []).map((p: unknown) => {
          const post = p as { id: string; title: string; content: string; tag: string; likes: number; comments: number; created_at: string; author: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] };
          return {
            ...post,
            author: Array.isArray(post.author) ? post.author[0] : post.author,
          };
        });

        setPosts(transformedPosts as Post[]);
      } catch (err) {
        console.error('Error loading game:', err);
        setError('Failed to load game details');
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [id]);

  const handleShare = async () => {
    if (!game) return;
    
    const url = `${window.location.origin}/games/${game.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${game.name} on PulsePlay`,
          text: game.description,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  if (loading) return <GameDetailSkeleton />;

  if (error || !game) {
    return (
      <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
        <div className="max-w-2xl mx-auto text-center py-20">
          <Gamepad2 className="w-16 h-16 mx-auto text-white/20 mb-4" />
          <h1 className="font-orbitron text-2xl font-bold mb-2">
            {error || 'Game not found'}
          </h1>
          <p className="text-muted-foreground mb-6">
            The game you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/games">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const category = CATEGORY_INFO[game.category] || { icon: <Gamepad2 className="w-5 h-5" />, description: 'Mobile gaming' };
  const badgeColor = game.badge ? (BADGE_COLORS[game.badge] ?? 'bg-purple-500') : '';
  const players = game.player_count >= 1000 ? (game.player_count / 1000).toFixed(1) + 'K' : String(game.player_count);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-white">
            <Link to="/games">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
            </Link>
          </Button>
        </motion.div>

        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gaming-card p-6 sm:p-10 mb-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                {game.badge && (
                  <Badge className={cn(badgeColor, 'text-white')}>
                    <Star className="w-3 h-3 mr-1" />{game.badge}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  {category.icon}
                  {game.category}
                </Badge>
              </div>

              <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                {game.name}
              </h1>

              <p className="text-muted-foreground text-lg mb-6 max-w-2xl">
                {game.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-orbitron font-bold">{players}</div>
                    <div className="text-xs text-muted-foreground">Active Players</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-orbitron font-bold">{game.tournament_count}</div>
                    <div className="text-xs text-muted-foreground">Tournaments</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="font-orbitron font-bold text-green-400">Active</div>
                    <div className="text-xs text-muted-foreground">Status</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                  <Link to={`/tournaments?game=${game.id}`}>
                    <Trophy className="w-4 h-4 mr-2" /> View Tournaments
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-sm mx-auto rounded-3xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                {game.image_url ? (
                  <img src={game.image_url} alt={game.name} className="w-48 h-48 object-contain drop-shadow-2xl" />
                ) : (
                  <span className="text-9xl">{game.icon}</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs for Tournaments and Community */}
        <Tabs defaultValue="tournaments" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="tournaments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" /> Tournaments
            </TabsTrigger>
            <TabsTrigger value="community" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" /> Community
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tournaments" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron text-xl font-bold">Active Tournaments</h2>
              <Button asChild variant="outline" size="sm">
                <Link to={`/tournaments?game=${game.id}`}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>

            {tournaments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} game={game} />
                ))}
              </div>
            ) : (
              <div className="gaming-card p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-orbitron font-bold text-lg mb-2">No tournaments yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  There are no active tournaments for {game.name} at the moment.
                </p>
                <Button asChild variant="outline">
                  <Link to="/tournaments">Browse All Tournaments</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron text-xl font-bold">Community Discussions</h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/community">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>

            {posts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="gaming-card p-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-orbitron font-bold text-lg mb-2">No discussions yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Be the first to start a discussion about {game.name}!
                </p>
                <Button asChild variant="outline">
                  <Link to="/community">Go to Community</Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
