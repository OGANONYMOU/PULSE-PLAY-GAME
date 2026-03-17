import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageSquare, Repeat2, Share2, Play, Pause, Volume2, VolumeX,
  MoreHorizontal, Flag, Eye, Loader2, Send, X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
import { Link } from 'react-router-dom';

export type Clip = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  object_key: string;
  thumbnail_key: string | null;
  duration_secs: number;
  likes_count: number;
  reposts_count: number;
  views_count: number;
  comments_count: number;
  tournament_id: string | null;
  created_at: string;
  games: { name: string; icon: string } | null;
  profiles: { username: string; avatar_url: string | null } | null;
  tournaments?: { name: string } | null;
};

// ── Mini video player ──────────────────────────────────────────────────────
function VideoPlayer({ objectKey, thumbnailKey, title }: { objectKey: string; thumbnailKey: string | null; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageBase = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars`;

  const isVideo = objectKey.match(/\.(mp4|mov|webm|avi)$/i);
  const thumbnailUrl = thumbnailKey ? `${storageBase}/${thumbnailKey}` : null;
  const videoUrl = `${storageBase}/${objectKey}`;

  const toggle = () => {
    if (!videoRef.current || !isVideo) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { setLoading(true); videoRef.current.play().then(() => { setPlaying(true); setLoading(false); }).catch(() => setLoading(false)); }
  };

  return (
    <div className="relative aspect-video bg-gradient-to-br from-[#0a0a18] to-[#0d0d20] overflow-hidden rounded-t-2xl cursor-pointer group" onClick={toggle}>
      {isVideo ? (
        <video ref={videoRef} src={videoUrl} poster={thumbnailUrl ?? undefined} muted={muted}
          className="w-full h-full object-cover" playsInline preload="metadata"
          onEnded={() => setPlaying(false)} />
      ) : (
        thumbnailUrl ? <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Play className="w-16 h-16 text-white/15" /></div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Play/pause overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" />
            : playing ? <Pause className="w-6 h-6 text-white" />
            : <Play className="w-6 h-6 text-white fill-white ml-1" />}
        </div>
      </div>

      {/* Controls */}
      {isVideo && (
        <button onClick={e => { e.stopPropagation(); setMuted(v => !v); }}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-all">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// ── Clip comments ──────────────────────────────────────────────────────────
function ClipComments({ clipId, count }: { clipId: string; count: number }) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }>>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('clip_comments')
      .select('id, content, created_at, profiles(username, avatar_url)')
      .eq('clip_id', clipId).is('parent_id', null)
      .order('created_at', { ascending: false }).limit(20);
    setComments((data as typeof comments) ?? []);
    setLoading(false);
  };

  React.useEffect(() => { load(); }, [clipId]);

  const submit = async () => {
    if (!text.trim() || !user) return;
    setBusy(true);
    await supabase.from('clip_comments').insert({ clip_id: clipId, author_id: user.id, content: text.trim() } as never);
    await supabase.from('clips').update({ comments_count: count + 1 } as never).eq('id', clipId);
    setText(''); load();
    setBusy(false);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-white/6">
      {loading ? <div className="h-8 bg-white/5 rounded-lg animate-pulse" /> :
        comments.slice(0, 5).map(c => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white text-[9px] font-bold">
                {c.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
              <span className="text-[11px] font-semibold text-white/70">{c.profiles?.username}</span>
              <span className="text-[11px] text-white/55 ml-2">{c.content}</span>
            </div>
          </div>
        ))}
      {isAuthenticated && (
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Add a comment…"
            className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500/40 placeholder:text-white/25" />
          <button onClick={submit} disabled={busy || !text.trim()}
            className="px-3 py-2 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 hover:bg-pink-500/30 transition-all disabled:opacity-40">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ClipCard ──────────────────────────────────────────────────────────
interface ClipCardProps {
  clip: Clip;
  index?: number;
  onRefresh?: () => void;
}

export function ClipCard({ clip, index = 0, onRefresh }: ClipCardProps) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(clip.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLike = async () => {
    if (!isAuthenticated || !user) { toast.error('Sign in to like clips'); return; }
    if (liked) return;
    setLiked(true); setLikes(l => l + 1);
    await supabase.from('clip_interactions').insert({ clip_id: clip.id, user_id: user.id, type: 'like' } as never);
    await supabase.from('clips').update({ likes_count: likes + 1 } as never).eq('id', clip.id);
  };

  const handleDelete = async () => {
    if (!isAdmin && user?.id !== clip.user_id) return;
    await supabase.from('clips').delete().eq('id', clip.id);
    toast.success('Clip removed');
    onRefresh?.();
  };

  const shareUrl = `${window.location.origin}/clips/${clip.id}`;
  const fmt = (s: number) => s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null;

  return (
    <>
      <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="rounded-2xl bg-white/3 border border-white/8 hover:border-white/14 overflow-hidden transition-all">

        <VideoPlayer objectKey={clip.object_key} thumbnailKey={clip.thumbnail_key} title={clip.title} />

        <div className="p-3.5">
          {/* Game + tournament tags */}
          <div className="flex items-center gap-2 mb-2.5">
            {clip.games && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-semibold">{clip.games.icon} {clip.games.name}</span>}
            {clip.tournaments && (
              <Link to="/tournaments" className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-400 font-semibold hover:bg-purple-500/25 transition-all">
                🏆 {clip.tournaments.name}
              </Link>
            )}
            {fmt(clip.duration_secs) && <span className="ml-auto text-[10px] font-mono text-white/30">{fmt(clip.duration_secs)}</span>}
          </div>

          {/* Author + title */}
          <div className="flex items-start gap-2.5 mb-3">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={clip.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white text-[9px] font-bold">
                {clip.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate leading-tight">{clip.title}</p>
              <p className="text-[11px] text-white/35 mt-0.5">
                <a href={`/profile/${clip.profiles?.username}`} className="hover:text-cyan-400 transition-colors">@{clip.profiles?.username ?? '—'}</a>
                {' · '}{formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 rounded-full hover:bg-white/8 flex items-center justify-center text-white/25 hover:text-white/60 transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-8 z-20 w-36 bg-[#0d0d1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <button onClick={() => { setShowReport(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-all">
                      <Flag className="w-3.5 h-3.5" />Report
                    </button>
                    {(isAdmin || user?.id === clip.user_id) && (
                      <button onClick={handleDelete}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-all">
                        <X className="w-3.5 h-3.5" />Delete
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button onClick={handleLike}
              className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ' +
                (liked ? 'text-red-400 bg-red-500/10' : 'text-white/40 hover:text-red-400 hover:bg-white/5')}>
              <Heart className={'w-3.5 h-3.5 ' + (liked ? 'fill-red-400' : '')} /><span>{likes > 0 ? likes : ''}</span>
            </button>
            <button onClick={() => setShowComments(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
              <MessageSquare className="w-3.5 h-3.5" /><span>{clip.comments_count > 0 ? clip.comments_count : 'Comment'}</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white/40 hover:text-cyan-400 hover:bg-white/5 transition-all">
              <Repeat2 className="w-3.5 h-3.5" /><span>{clip.reposts_count > 0 ? clip.reposts_count : ''}</span>
            </button>
            <button onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-white/40 hover:text-purple-400 hover:bg-white/5 transition-all">
              <Share2 className="w-3.5 h-3.5" /><span>Share</span>
            </button>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-white/25">
              <Eye className="w-3 h-3" />{clip.views_count}
            </div>
          </div>

          {/* Comments */}
          <AnimatePresence>
            {showComments && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <ClipComments clipId={clip.id} count={clip.comments_count} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.article>

      <AnimatePresence>
        {showShare && <ShareModal key="share" title={clip.title} url={shareUrl} authorUsername={clip.profiles?.username ?? 'user'} type="clip" onClose={() => setShowShare(false)} />}
        {showReport && <ReportModal key="report" contentType="clip" contentId={clip.id} onClose={() => setShowReport(false)} />}
      </AnimatePresence>
    </>
  );
}
