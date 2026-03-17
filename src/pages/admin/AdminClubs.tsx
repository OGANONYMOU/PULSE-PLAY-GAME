import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, RefreshCw, Shield, Crown, Globe, Lock,
  Trash2, Loader2, AlertCircle, Trophy, Star, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Club = {
  id: string; name: string; tag: string; description: string;
  is_public: boolean; member_count: number; wins: number; losses: number; points: number; created_at: string;
  games: { name: string; icon: string } | null;
  creator: { username: string } | null;
};

function DeleteConfirm(p: { club: Club; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from('clubs').delete().eq('id', p.club.id);
    if (error) { toast.error(error.message); setDeleting(false); }
    else { toast.success('Club deleted.'); p.onDeleted(); p.onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div><h3 className="font-orbitron font-bold text-sm text-white">Delete Club</h3><p className="text-xs text-white/40">This removes all members and data</p></div>
        </div>
        <p className="text-sm text-white/60 mb-6">Delete <span className="font-bold text-white">[{p.club.tag}] {p.club.name}</span>?</p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={p.onClose} className="flex-1 border border-white/10 text-white/50 text-xs">Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold gap-2">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function AdminClubs(): React.ReactElement {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clubs')
      .select('*, games(name, icon), creator:profiles!created_by(username)')
      .order('created_at', { ascending: false });
    if (error) { console.error(error.message); }
    else setClubs((data as Club[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clubs.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q) || (c.creator?.username ?? '').toLowerCase().includes(q);
  });

  const totalMembers = clubs.reduce((s, c) => s + c.member_count, 0);

  return (
    <div className="p-5 sm:p-7 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Clubs</h1>
          <p className="text-white/35 text-sm">{clubs.length} clubs · {totalMembers} total members</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clubs…"
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm w-44" />
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-white/40 hover:text-white h-9 w-9 p-0">
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          </Button>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Clubs',   val: clubs.length,                   color: 'text-cyan-400' },
          { label: 'Public',        val: clubs.filter(c => c.is_public).length,  color: 'text-green-400' },
          { label: 'Total Members', val: totalMembers,                   color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white/4 border border-white/8 text-center">
            <p className={'font-orbitron font-black text-xl ' + s.color}>{s.val}</p>
            <p className="text-[11px] text-white/35">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 mx-auto text-white/15 mb-4" />
          <p className="text-white/35 text-sm">{search ? 'No clubs match.' : 'No clubs yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-base flex-shrink-0">
                {c.games?.icon ?? <Users className="w-4 h-4 text-white/25" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-white">{c.name}</span>
                  <span className="text-[10px] font-mono text-white/30">[{c.tag}]</span>
                  {c.is_public ? <Globe className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-white/30" />}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/30">
                  <span><Users className="w-3 h-3 inline mr-1" />{c.member_count}</span>
                  <span><Trophy className="w-3 h-3 inline mr-1" />{c.wins}W {c.losses}L</span>
                  <span><Star className="w-3 h-3 inline mr-1" />{c.points} pts</span>
                  <span>by @{c.creator?.username ?? '—'}</span>
                </div>
              </div>
              <button onClick={() => setDeleteTarget(c)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm club={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
      )}
    </div>
  );
}
