import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Tag, Plus, Trash2, RefreshCw, Copy, CheckCircle,
  AlertCircle, Loader2, Users, Calendar, Gift,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type RewardType = 'points' | 'discount' | 'free_entry';

type LoyaltyCode = {
  id: string;
  code: string;
  description: string | null;
  reward_type: RewardType;
  reward_value: number;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

const emptyForm = {
  code: '', description: '', reward_type: 'points' as RewardType,
  reward_value: 100, max_uses: 1, expires_at: '',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'PULSE-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function rewardLabel(type: RewardType, value: number): string {
  if (type === 'points')     return `+${value} Points`;
  if (type === 'discount')   return `${value}% Off`;
  if (type === 'free_entry') return 'Free Entry';
  return String(value);
}

function rewardColor(type: RewardType): string {
  if (type === 'points')     return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  if (type === 'discount')   return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  if (type === 'free_entry') return 'bg-green-500/20 text-green-400 border-green-500/30';
  return 'bg-white/10 text-white/60';
}

export function AdminLoyalty(): React.ReactElement {
  const { profile } = useAuth();
  const [codes, setCodes]   = useState<LoyaltyCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]     = useState(emptyForm);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('loyalty_codes') as any)
      .select('*')
      .order('created_at', { ascending: false });
    setCodes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const setF = (k: keyof typeof emptyForm, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error('Code is required.'); return; }
    setIsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('loyalty_codes') as any).insert({
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      reward_type: form.reward_type,
      reward_value: form.reward_value,
      max_uses: form.max_uses,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      created_by: profile?.id ?? null,
    });
    if (error) {
      if (error.code === '23505') toast.error('Code already exists.');
      else toast.error('Failed: ' + error.message);
    } else {
      toast.success('Loyalty code created!');
      setIsOpen(false);
      setForm(emptyForm);
      load();
    }
    setIsSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('loyalty_codes') as any).update({ is_active: !current }).eq('id', id);
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
    toast.success(!current ? 'Code activated' : 'Code deactivated');
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('loyalty_codes') as any).delete().eq('id', id);
    setCodes(prev => prev.filter(c => c.id !== id));
    setDeleteId(null);
    toast.success('Code deleted.');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const totalUses = codes.reduce((s, c) => s + c.uses_count, 0);
  const activeCodes = codes.filter(c => c.is_active).length;

  return (
    <div className="p-5 sm:p-7 max-w-7xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1">Loyalty Codes</h1>
          <p className="text-white/35 text-sm">Create and manage promotional codes for players</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}
            className="text-white/40 hover:text-white hover:bg-white/8 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => { setForm({ ...emptyForm, code: generateCode() }); setIsOpen(true); }}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2 font-bold text-sm">
            <Plus className="w-4 h-4" />New Code
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Codes', val: codes.length, Icon: Tag, cls: 'text-cyan-400' },
          { label: 'Active', val: activeCodes, Icon: CheckCircle, cls: 'text-green-400' },
          { label: 'Total Redemptions', val: totalUses, Icon: Users, cls: 'text-purple-400' },
        ].map(({ label, val, Icon, cls }) => (
          <div key={label} className="p-4 rounded-2xl bg-white/4 border border-white/8 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${cls} flex-shrink-0`} />
            <div>
              <div className="font-orbitron text-xl font-black text-white">{val}</div>
              <div className="text-[10px] text-white/35">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Codes list */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-20">
          <Gift className="w-12 h-12 text-white/15 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No loyalty codes yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map((c, i) => {
            const pct = c.max_uses > 0 ? Math.round((c.uses_count / c.max_uses) * 100) : 0;
            const exhausted = c.uses_count >= c.max_uses;
            const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8 flex-wrap">
                {/* Code */}
                <div className="flex items-center gap-2 min-w-[160px]">
                  <code className="font-mono font-bold text-sm text-white bg-white/8 px-2 py-1 rounded-lg">
                    {c.code}
                  </code>
                  <button onClick={() => copyCode(c.code)}
                    className="text-white/30 hover:text-cyan-400 transition-colors">
                    {copied === c.code
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-[120px]">
                  <div className="text-xs text-white/60 truncate">{c.description ?? '—'}</div>
                  {c.expires_at && (
                    <div className={`text-[10px] flex items-center gap-1 mt-0.5 ${expired ? 'text-red-400' : 'text-white/30'}`}>
                      <Calendar className="w-2.5 h-2.5" />
                      {expired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(c.expires_at), { addSuffix: true })}`}
                    </div>
                  )}
                </div>

                {/* Reward */}
                <Badge className={`text-[10px] ${rewardColor(c.reward_type)}`}>
                  {rewardLabel(c.reward_type, c.reward_value)}
                </Badge>

                {/* Usage */}
                <div className="text-xs text-white/40 whitespace-nowrap">
                  {c.uses_count}/{c.max_uses} uses
                  <div className="w-20 h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {exhausted && <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/25">Exhausted</Badge>}
                  {expired && !exhausted && <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/25">Expired</Badge>}
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">{c.is_active ? 'Active' : 'Off'}</span>
                  <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)}
                    className="scale-75" />
                </div>

                {/* Delete */}
                <button onClick={() => setDeleteId(c.id)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/25 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron">New Loyalty Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Code *</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.code} onChange={e => setF('code', e.target.value.toUpperCase())}
                  className="font-mono uppercase" placeholder="PULSE-XXXXXX" />
                <Button size="sm" variant="outline" onClick={() => setF('code', generateCode())}
                  className="whitespace-nowrap text-xs border-white/15 text-white/50 hover:text-white">
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setF('description', e.target.value)}
                className="mt-1" placeholder="Weekend promo code" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Reward Type</Label>
                <Select value={form.reward_type} onValueChange={v => setF('reward_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="discount">Discount %</SelectItem>
                    <SelectItem value="free_entry">Free Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  {form.reward_type === 'points' ? 'Points Amount' : form.reward_type === 'discount' ? 'Discount %' : 'Value'}
                </Label>
                <Input type="number" value={form.reward_value}
                  onChange={e => setF('reward_value', Number(e.target.value))}
                  className="mt-1" min={1} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Max Uses</Label>
                <Input type="number" value={form.max_uses}
                  onChange={e => setF('max_uses', Number(e.target.value))}
                  className="mt-1" min={1} />
              </div>
              <div>
                <Label className="text-xs">Expires At (optional)</Label>
                <Input type="datetime-local" value={form.expires_at}
                  onChange={e => setF('expires_at', e.target.value)}
                  className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 gap-1.5">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />Delete Code
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently delete the loyalty code and all its redemption history.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}