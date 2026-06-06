import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Film, Image, X, Loader2, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadClipFile, uploadThumbnail, createClip, type UploadProgress } from '@/lib/clips/clipsService';
import { awardXpAndNotify } from '@/hooks/useLevelUp';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function ClipUpload(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [gameId, setGameId]         = useState('');
  const [games, setGames]           = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [clipFile, setClipFile]     = useState<File | null>(null);
  const [thumbFile, setThumbFile]   = useState<File | null>(null);
  const [thumbPreview, setThumbPrev] = useState<string | null>(null);
  const [progress, setProgress]     = useState<UploadProgress | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError]           = useState('');

  const clipInputRef  = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (supabase as any).from('games').select('id, name, icon').order('name').then(({ data }: { data: typeof games }) => {
      setGames(data ?? []);
    });
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) navigate('/signin');
  }, [isAuthenticated, navigate]);

  const handleClipChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error('Max file size is 100 MB'); return; }
    setClipFile(file);
  }, []);

  const handleThumbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPrev(URL.createObjectURL(file));
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) { setError('Title is required'); return; }
    if (!clipFile) { setError('Please select a video file'); return; }
    setError('');
    setUploadState('uploading');

    try {
      const objectKey = await uploadClipFile(user.id, clipFile, setProgress);
      const thumbnailKey = thumbFile ? await uploadThumbnail(user.id, thumbFile) : null;

      await createClip({
        userId:       user.id,
        title:        title.trim(),
        description:  description.trim(),
        objectKey,
        thumbnailKey,
        durationSecs: 0,
        gameId:       gameId || null,
        tournamentId: null,
      });

      await awardXpAndNotify(user.id, 'clip_uploaded', { title });

      setUploadState('success');
      setTimeout(() => navigate('/clips'), 1500);
    } catch (e) {
      setError((e as Error).message || 'Upload failed. Please try again.');
      setUploadState('error');
    }
  };

  if (uploadState === 'success') {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="gaming-card p-10 text-center max-w-sm w-full">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Clip Uploaded!</h2>
          <p className="text-muted-foreground text-sm">+10 GamerCred awarded. Redirecting…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/clips')}
          className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Clips
        </button>

        <div className="gaming-card p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="font-orbitron text-2xl font-bold mb-1">Upload a Clip</h1>
            <p className="text-muted-foreground text-sm">Share your best gaming moments with the community</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Video file */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Video File *</label>
            <input ref={clipInputRef} type="file" accept="video/mp4,video/webm,video/quicktime"
              className="hidden" onChange={handleClipChange} />
            {clipFile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Film className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{clipFile.name}</span>
                <button onClick={() => setClipFile(null)} className="text-muted-foreground hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => clipInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-white/20 hover:border-cyan-500/50 transition-colors text-muted-foreground hover:text-white">
                <Upload className="w-8 h-8" />
                <div className="text-sm">Click to select video (MP4, WebM, MOV • max 100 MB)</div>
              </button>
            )}
          </div>

          {/* Thumbnail */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Thumbnail (optional)</label>
            <input ref={thumbInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleThumbChange} />
            {thumbPreview ? (
              <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-white/10">
                <img src={thumbPreview} alt="thumbnail" className="w-full h-full object-cover" />
                <button onClick={() => { setThumbFile(null); setThumbPrev(null); }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 hover:border-white/30 text-sm text-muted-foreground hover:text-white transition-colors">
                <Image className="w-4 h-4" />Add thumbnail
              </button>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Insane 1v4 clutch in CODM ranked…" maxLength={120} />
            <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</label>
            <Textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="What happened in this clip?" rows={3} maxLength={500} />
          </div>

          {/* Game */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Game</label>
            <select value={gameId} onChange={e => setGameId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500">
              <option value="">— Select game —</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
              ))}
            </select>
          </div>

          {/* Upload progress */}
          {uploadState === 'uploading' && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading…</span><span>{progress.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all"
                  style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}

          <Button onClick={handleSubmit}
            disabled={uploadState === 'uploading' || !clipFile || !title.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-11">
            {uploadState === 'uploading'
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading…</>
              : 'Upload Clip +10 GamerCred →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
