import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const REASONS = [
  { value: 'spam',          label: '🚫 Spam or scam' },
  { value: 'hate_speech',   label: '🤬 Hate speech' },
  { value: 'harassment',    label: '👊 Harassment or bullying' },
  { value: 'misinformation',label: '❌ Misinformation' },
  { value: 'adult_content', label: '🔞 Adult content' },
  { value: 'violence',      label: '⚠️ Violence or threats' },
  { value: 'cheating',      label: '🎭 Cheating / match fixing' },
  { value: 'other',         label: '📝 Other' },
] as const;

type ContentType = 'post' | 'clip' | 'comment' | 'profile';

interface ReportModalProps {
  contentType: ContentType;
  contentId: string;
  onClose: () => void;
}

export function ReportModal({ contentType, contentId, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<typeof REASONS[number]['value'] | ''>('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason || !user) return;
    setSending(true);
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id, content_type: contentType, content_id: contentId, reason, description: description.trim() || null,
    } as never);
    if (error) toast.error('Failed to submit report');
    else { toast.success('Report submitted. Thank you for keeping PulsePlay safe.'); onClose(); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-sm bg-[#0d0d1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="font-orbitron font-bold text-sm text-white">Report {contentType}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-white/40">Why are you reporting this {contentType}?</p>
          <div className="space-y-1.5">
            {REASONS.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)}
                className={'w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ' +
                  (reason === r.value ? 'bg-red-500/15 border-red-500/30 text-white' : 'border-white/8 text-white/55 hover:border-white/18 hover:text-white/80')}>
                {r.label}
              </button>
            ))}
          </div>
          {reason === 'other' && (
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Describe the issue…"
              className="w-full bg-white/5 border border-white/10 text-white/80 text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-red-500/40 placeholder:text-white/25" />
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!reason || sending}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}Submit Report
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
