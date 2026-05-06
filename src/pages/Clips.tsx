import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Play, ThumbsUp, Share2, Clock, Trophy, Flame,
  ChevronLeft, TrendingUp, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Types
interface Clip {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  author_id: string;
  author: { username: string; avatar_url: string | null };
  game_id: string | null;
  game: { name: string; icon: string } | null;
  week_start: string;
  votes: number;
  views: number;
  created_at: string;
  voted_by_me?: boolean;
}

type ClipTab = 'this-week' | 'previous' | 'all-time';

// Sample clips data for demo
const SAMPLE_CLIPS: Clip[] = [
  {
    id: '1',
    title: 'Insane 1v4 Clutch in CODM Ranked',
    description: 'Last round, 1v4 situation, managed to clutch it with a knife kill at the end!',
    video_url: 'https://example.com/clip1.mp4',
    thumbnail_url: null,
    author_id: 'user1',
    author: { username: 'ProGamer_X', avatar_url: null },
    game_id: 'codm',
    game: { name: 'Call of Duty Mobile', icon: '🔫' },
    week_start: new Date().toISOString(),
    votes: 156,
    views: 1205,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'eFootball 2026 - Epic Free Kick Goal',
    description: '35 meters out, curled it right into the top corner!',
    video_url: 'https://example.com/clip2.mp4',
    thumbnail_url: null,
    author_id: 'user2',
    author: { username: 'FootballKing', avatar_url: null },
    game_id: 'efootball',
    game: { name: 'eFootball 2026', icon: '⚽' },
    week_start: new Date().toISOString(),
    votes: 142,
    views: 892,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    title: 'Mobile Legends - Savage with Fanny',
    description: 'Cable plays that defy gravity!',
    video_url: 'https://example.com/clip3.mp4',
    thumbnail_url: null,
    author_id: 'user3',
    author: { username: 'ML_Elite', avatar_url: null },
    game_id: 'mlbb',
    game: { name: 'Mobile Legends', icon: '⚔️' },
    week_start: new Date().toISOString(),
    votes: 203,
    views: 1567,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '4',
    title: 'PUBG Mobile - 200m Snipe Through Smoke',
    description: 'Pure luck or pure skill? You decide!',
    video_url: 'https://example.com/clip4.mp4',
    thumbnail_url: null,
    author_id: 'user4',
    author: { username: 'SniperElite', avatar_url: null },
    game_id: 'pubgm',
    game: { name: 'PUBG Mobile', icon: '🎯' },
    week_start: new Date(Date.now() - 604800000).toISOString(),
    votes: 89,
    views: 654,
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: '5',
    title: 'Free Fire - Booyah with 20 Kills',
    description: 'Solo vs Squad dominance!',
    video_url: 'https://example.com/clip5.mp4',
    thumbnail_url: null,
    author_id: 'user5',
    author: { username: 'FF_Champion', avatar_url: null },
    game_id: 'freefire',
    game: { name: 'Free Fire', icon: '🔥' },
    week_start: new Date(Date.now() - 604800000).toISOString(),
    votes: 76,
    views: 543,
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: '6',
    title: 'CODM - Triple Collateral with Sniper',
    description: 'One bullet, three enemies down!',
    video_url: 'https://example.com/clip6.mp4',
    thumbnail_url: null,
    author_id: 'user6',
    author: { username: 'QuickScopez', avatar_url: null },
    game_id: 'codm',
    game: { name: 'Call of Duty Mobile', icon: '🔫' },
    week_start: new Date(Date.now() - 1209600000).toISOString(),
    votes: 312,
    views: 2103,
    created_at: new Date(Date.now() - 1209600000).toISOString(),
  },
];

// Helper functions
function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isThisWeek(date: string): boolean {
  const weekStart = getCurrentWeekStart();
  const clipDate = new Date(date);
  return clipDate >= weekStart;
}

// Clip Card Component
function ClipCard({ clip, index, onVote, onClick }: { 
  clip: Clip; 
  index: number; 
  onVote: (id: string) => void;
  onClick: (clip: Clip) => void;
}): React.ReactElement {
  const { isAuthenticated } = useAuth();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="gaming-card overflow-hidden group"
    >
      {/* Thumbnail / Video Preview */}
      <div 
        className="relative aspect-video bg-gradient-to-br from-cyan-500/20 to-purple-500/20 cursor-pointer overflow-hidden"
        onClick={() => onClick(clip)}
      >
        {clip.thumbnail_url ? (
          <img 
            src={clip.thumbnail_url} 
            alt={clip.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">{clip.game?.icon || '🎮'}</span>
          </div>
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white font-medium">
          <Clock className="w-3 h-3 inline mr-1" />
          0:30
        </div>
        
        {/* Game badge */}
        {clip.game && (
          <Badge className="absolute top-2 left-2 bg-black/60 text-white border-0 text-xs">
            {clip.game.icon} {clip.game.name}
          </Badge>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-orbitron font-bold text-sm leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors cursor-pointer"
              onClick={() => onClick(clip)}>
            {clip.title}
          </h3>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {clip.description}
        </p>
        
        {/* Author */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold">
            {clip.author.username[0]?.toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground">{clip.author.username}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}
          </span>
        </div>
        
        {/* Stats & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {clip.views.toLocaleString()} views
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onVote(clip.id)}
              disabled={!isAuthenticated}
              className={cn(
                "h-8 px-2 text-xs",
                clip.voted_by_me 
                  ? "text-cyan-400 hover:text-cyan-300" 
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <ThumbsUp className={cn("w-4 h-4 mr-1", clip.voted_by_me && "fill-current")} />
              {clip.votes}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/clips?clip=${clip.id}`;
                navigator.clipboard.writeText(url);
                toast.success('Link copied!');
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-white"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Clip Detail Dialog
function ClipDetailDialog({ 
  clip, 
  open, 
  onClose, 
  onVote 
}: { 
  clip: Clip | null; 
  open: boolean; 
  onClose: () => void;
  onVote: (id: string) => void;
}): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  
  if (!clip) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl glass border-border/40 max-h-[90vh] overflow-y-auto p-0">
        {/* Video Player Area */}
        <div className="relative aspect-video bg-black">
          {clip.thumbnail_url ? (
            <img 
              src={clip.thumbnail_url} 
              alt={clip.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <span className="text-8xl">{clip.game?.icon || '🎮'}</span>
            </div>
          )}
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-10 h-10 text-white fill-white" />
            </button>
          </div>
          
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-orbitron text-xl">{clip.title}</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold">
              {clip.author.username[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{clip.author.username}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(clip.created_at), 'MMM d, yyyy')} • {clip.game?.name || 'Mobile Gaming'}
              </div>
            </div>
          </div>
          
          <p className="text-sm text-white/80 mb-4">{clip.description}</p>
          
          <div className="flex items-center gap-4 py-4 border-y border-white/10">
            <Button
              onClick={() => onVote(clip.id)}
              disabled={!isAuthenticated}
              className={cn(
                "flex items-center gap-2",
                clip.voted_by_me 
                  ? "bg-cyan-500 text-white hover:bg-cyan-400" 
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <ThumbsUp className={cn("w-5 h-5", clip.voted_by_me && "fill-current")} />
              {clip.votes} votes
            </Button>
            
            <span className="text-sm text-muted-foreground">
              {clip.views.toLocaleString()} views
            </span>
            
            <Button
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/clips?clip=${clip.id}`;
                navigator.clipboard.writeText(url);
                toast.success('Link copied to clipboard!');
              }}
              className="ml-auto"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
          
          {/* Weekly Stats */}
          <div className="mt-4 p-4 rounded-xl bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="font-bold text-sm">Weekly Competition</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This clip is competing for Clip of the Week! Voting ends every Sunday at midnight.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export function Clips(): React.ReactElement {
  const [clips, setClips] = useState<Clip[]>(SAMPLE_CLIPS);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [activeTab, setActiveTab] = useState<ClipTab>('this-week');
  const [isLoading] = useState(false);
  const { isAuthenticated, profile } = useAuth();

  // Filter clips based on active tab
  const filteredClips = useCallback(() => {
    switch (activeTab) {
      case 'this-week':
        return clips.filter(c => isThisWeek(c.week_start)).sort((a, b) => b.votes - a.votes);
      case 'previous':
        return clips.filter(c => !isThisWeek(c.week_start)).sort((a, b) => b.votes - a.votes);
      case 'all-time':
      default:
        return [...clips].sort((a, b) => b.votes - a.votes);
    }
  }, [clips, activeTab]);

  // Handle vote
  const handleVote = (clipId: string) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to vote');
      return;
    }
    if (profile?.is_banned) {
      toast.error('Your account is restricted.');
      return;
    }
    
    setClips(prev => prev.map(clip => {
      if (clip.id === clipId) {
        const voted = !clip.voted_by_me;
        return {
          ...clip,
          voted_by_me: voted,
          votes: voted ? clip.votes + 1 : clip.votes - 1
        };
      }
      return clip;
    }));
    
    toast.success('Vote recorded!');
  };

  // Get winner of the week
  const thisWeekClips = clips.filter(c => isThisWeek(c.week_start));
  const currentWinner = thisWeekClips.length > 0 
    ? thisWeekClips.reduce((prev, current) => (prev.votes > current.votes) ? prev : current)
    : null;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-10"
      >
        <div className="gaming-card p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
              <Flame className="w-3 h-3 mr-1" />
              Weekly Competition
            </Badge>
            <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Clip of the <span className="gradient-text">Week</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Vote for the best gaming clips from our community. Winners get featured and earn exclusive badges!
            </p>
            
            {currentWinner && (
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div className="text-left">
                  <div className="text-xs text-yellow-400">Current Leader</div>
                  <div className="font-bold">{currentWinner.title}</div>
                  <div className="text-xs text-muted-foreground">by {currentWinner.author.username}</div>
                </div>
                <Badge className="ml-2 bg-yellow-500 text-white">
                  {currentWinner.votes} votes
                </Badge>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClipTab)}>
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="this-week" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              This Week
            </TabsTrigger>
            <TabsTrigger value="previous" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Previous Weeks
            </TabsTrigger>
            <TabsTrigger value="all-time" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              All Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="gaming-card h-64 animate-pulse bg-white/5" />
                ))}
              </div>
            ) : filteredClips().length === 0 ? (
              <div className="gaming-card p-12 text-center">
                <Play className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-orbitron font-bold text-lg mb-2">No clips yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {activeTab === 'this-week' 
                    ? 'Be the first to submit a clip this week!' 
                    : 'No clips found for this period.'}
                </p>
                <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                  <Link to="/community">Submit a Clip</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClips().map((clip, index) => (
                  <ClipCard 
                    key={clip.id} 
                    clip={clip} 
                    index={index}
                    onVote={handleVote}
                    onClick={setSelectedClip}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* How it Works */}
      <div className="max-w-7xl mx-auto">
        <div className="gaming-card p-6">
          <h2 className="font-orbitron font-bold text-lg mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Submit', desc: 'Share your best gaming moments in the community' },
              { step: '2', title: 'Vote', desc: 'Community votes on their favorite clips all week' },
              { step: '3', title: 'Win', desc: 'Top clip wins weekly recognition and exclusive badges' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step}
                </div>
                <div>
                  <div className="font-bold text-sm">{title}</div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <ClipDetailDialog
        clip={selectedClip}
        open={!!selectedClip}
        onClose={() => setSelectedClip(null)}
        onVote={handleVote}
      />
    </div>
  );
}
