import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, Clock, Trophy, Flame, Calendar, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ClipCard } from '@/components/community/ClipCard';
import { useClips, type ClipTab } from '@/hooks/useClips';
import { ClipsSEO } from '@/components/SEO';

export function Clips(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ClipTab>('this-week');
  const { isAuthenticated } = useAuth();
  const { clips, loading, error, likedIds, refresh } = useClips(activeTab);

  const currentLeader = clips[0] ?? null;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <ClipsSEO />

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-10">
        <div className="gaming-card p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative z-10">
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
              <Flame className="w-3 h-3 mr-1" />Weekly Competition
            </Badge>
            <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Clip of the <span className="gradient-text">Week</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Vote for the best gaming clips from our community. Winners get featured and earn exclusive badges!
            </p>

            {currentLeader && (
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div className="text-left">
                  <div className="text-xs text-yellow-400">Current Leader</div>
                  <div className="font-bold">{currentLeader.title}</div>
                  <div className="text-xs text-muted-foreground">by @{currentLeader.profiles?.username}</div>
                </div>
                <Badge className="ml-2 bg-yellow-500 text-white">{currentLeader.likes_count} likes</Badge>
              </div>
            )}

            {isAuthenticated ? (
              <div className="flex justify-center">
                <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 text-white gap-2">
                  <Link to="/clips/upload"><Upload className="w-4 h-4" />Upload Your Clip</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link to="/signin" className="text-cyan-400 hover:underline">Sign in</Link> to upload your clips and compete!
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs + grid */}
      <div className="max-w-7xl mx-auto mb-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClipTab)}>
          <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
            <TabsTrigger value="this-week"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />This Week
            </TabsTrigger>
            <TabsTrigger value="previous"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />Previous Weeks
            </TabsTrigger>
            <TabsTrigger value="all-time"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />All Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {error && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                <button onClick={refresh} className="ml-auto underline text-xs">Retry</button>
              </div>
            )}

            {loading ? (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="gaming-card h-72 animate-pulse bg-white/5 break-inside-avoid" />
                ))}
              </div>
            ) : clips.length === 0 ? (
              <div className="gaming-card p-12 text-center">
                <Play className="w-12 h-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-orbitron font-bold text-lg mb-2">No clips yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {activeTab === 'this-week'
                    ? 'Be the first to submit a clip this week!'
                    : 'No clips found for this period.'}
                </p>
                {isAuthenticated && (
                  <Button asChild className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                    <Link to="/clips/upload"><Upload className="w-4 h-4 mr-2" />Upload First Clip</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
                {clips.map((clip, index) => (
                  <div key={clip.id} className="break-inside-avoid">
                    <ClipCard
                      clip={{ ...clip, likes_count: likedIds.has(clip.id) ? clip.likes_count : clip.likes_count }}
                      index={index}
                      onRefresh={refresh}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* How it works */}
      <div className="max-w-7xl mx-auto">
        <div className="gaming-card p-6">
          <h2 className="font-orbitron font-bold text-lg mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Upload', desc: 'Share your best gaming moments — earn 10 GamerCred instantly' },
              { step: '2', title: 'Vote', desc: 'Community votes on their favourite clips all week' },
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
    </div>
  );
}
