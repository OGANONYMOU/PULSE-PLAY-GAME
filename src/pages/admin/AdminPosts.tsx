import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, AlertCircle, MessageSquare, Flame, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type Post = {
  id: string;
  title: string;
  content: string;
  tag: string;
  likes: number;
  comments: number;
  created_at: string;
  profiles: { username: string } | null;
};

const tagColors: Record<string, string> = {
  general: 'bg-blue-500/20 text-blue-400',
  tournament: 'bg-purple-500/20 text-purple-400',
  tips: 'bg-green-500/20 text-green-400',
  clips: 'bg-pink-500/20 text-pink-400',
};

export function AdminPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filtered, setFiltered] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });
    setPosts((data as Post[]) ?? []);
    setFiltered((data as Post[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(posts.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      (p.profiles?.username ?? '').toLowerCase().includes(q)
    ));
  }, [search, posts]);

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('posts') as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete post.');
    } else {
      toast.success('Post deleted.');
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteId(null);
  };

  return (
    <div className="p-8 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-orbitron text-3xl font-bold mb-1">
              Moderate <span className="gradient-text">Posts</span>
            </h1>
            <p className="text-muted-foreground">{posts.length} community posts</p>
          </div>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="gaming-card p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-cyan-400">
                        {post.profiles?.username ?? 'Unknown'}
                      </span>
                      <Badge className={tagColors[post.tag] ?? 'bg-muted text-muted-foreground'}>
                        {post.tag}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="font-orbitron font-bold text-sm mb-1 truncate">{post.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{post.likes}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comments}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8 flex-shrink-0"
                    onClick={() => setDeleteId(post.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No posts found.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Delete Post
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This will permanently delete the post. This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}