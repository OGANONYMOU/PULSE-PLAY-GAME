import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  title: string;
  url: string;
  authorUsername: string;
  type?: 'post' | 'clip' | 'tournament';
  onClose: () => void;
}

const watermark = (username: string) => `\nShared via PulsePlay.gg | @${username}`;

const PLATFORMS = [
  { name: 'WhatsApp', emoji: '💬', color: 'bg-green-500/15 border-green-500/25 hover:bg-green-500/25 text-green-400',
    getUrl: (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}` },
  { name: 'Twitter / X', emoji: '🐦', color: 'bg-sky-500/15 border-sky-500/25 hover:bg-sky-500/25 text-sky-400',
    getUrl: (text: string, url: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { name: 'TikTok', emoji: '🎵', color: 'bg-pink-500/15 border-pink-500/25 hover:bg-pink-500/25 text-pink-400',
    getUrl: null },
  { name: 'Instagram', emoji: '📸', color: 'bg-purple-500/15 border-purple-500/25 hover:bg-purple-500/25 text-purple-400',
    getUrl: null },
];

export function ShareModal({ title, url, authorUsername, type = 'post', onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const icon = type === 'clip' ? '🎬' : type === 'tournament' ? '🏆' : '💬';
  const shareText = `${icon} "${title}"${watermark(authorUsername)}`;

  const handlePlatform = (p: typeof PLATFORMS[0]) => {
    if (p.getUrl) window.open(p.getUrl(shareText, url), '_blank', 'noopener,noreferrer');
    else { navigator.clipboard.writeText(shareText + '\n' + url); toast.success(`Copied for ${p.name}! Open the app and paste.`); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url); setCopied(true);
    setTimeout(() => setCopied(false), 2000); toast.success('Link copied!');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-sm bg-[#0d0d1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-orbitron font-bold text-sm text-white">Share</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          <div className="p-3 rounded-xl bg-white/4 border border-white/8 mb-4">
            <p className="text-xs text-white/60 font-medium truncate">{title}</p>
            <p className="text-[10px] text-white/30 mt-0.5">by @{authorUsername} · PulsePlay.gg</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PLATFORMS.map(p => (
              <button key={p.name} onClick={() => handlePlatform(p)}
                className={'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ' + p.color}>
                <span className="text-lg">{p.emoji}</span>{p.name}
              </button>
            ))}
          </div>
          <button onClick={copyLink}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/6 border border-white/10 hover:bg-white/10 transition-all">
            <span className="text-xs text-white/50 font-mono truncate mr-3">{url.replace('https://', '')}</span>
            {copied ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <Copy className="w-4 h-4 text-white/40 flex-shrink-0" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
