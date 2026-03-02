import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, AlertCircle, Loader2, Megaphone, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { AnnouncementRow } from '@/types/database';

const typeColors: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  event: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const emptyForm = { title: '', content: '', type: 'info' as AnnouncementRow['type'] };

export function AdminAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements((data as AnnouncementRow[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const handleSave = async () => {
    if (!form.title || !form.content) {
      toast.error('Title and content are required.');
      return;
    }
    setIsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('announcements') as any).insert({
      ...form,
      created_by: user?.id,
    });
    if (error) {
      toast.error('Failed to create announcement.');
    } else {
      toast.success('Announcement published!');
      setIsOpen(false);
      setForm(emptyForm);
      fetchAnnouncements();
    }
    setIsSaving(false);
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('announcements') as any).update({ is_active: !current }).eq('id', id);
    setAnnouncements((prev) =>
      prev.map((a) => a.id === id ? { ...a, is_active: !current } : a)
    );
    toast.success(current ? 'Announcement hidden.' : 'Announcement shown.');
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('announcements') as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete.');
    } else {
      toast.success('Deleted.');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
    setDeleteId(null);
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              <span className="gradient-text">Announcements</span>
            </h1>
            <p className="text-muted-foreground">Broadcast messages to all users</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> New Announcement
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`gaming-card p-5 ${!a.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={typeColors[a.type]}>{a.type}</Badge>
                      {!a.is_active && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="font-orbitron font-bold mb-1">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">{a.content}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-cyan-400"
                      onClick={() => handleToggleActive(a.id, a.is_active)}
                    >
                      {a.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(a.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}

            {announcements.length === 0 && (
              <div className="text-center py-16">
                <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No announcements yet.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-orbitron">New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Info</SelectItem>
                  <SelectItem value="warning">⚠️ Warning</SelectItem>
                  <SelectItem value="success">✅ Success</SelectItem>
                  <SelectItem value="event">🎮 Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" placeholder="Announcement title" />
            </div>
            <div>
              <Label className="text-xs">Content *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1 resize-none" rows={4} placeholder="Full announcement text..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Delete Announcement
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}