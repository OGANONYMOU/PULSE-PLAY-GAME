// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Community Content Management Module
// Comprehensive content moderation for posts, comments, clips, discussions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import {
  MessageSquare, Eye, Pin, Trash2, AlertCircle, Search, Filter,
  FileText, Play, MessageCircle, ThumbsUp, Flag, MoreHorizontal,
  EyeOff, Crown, Clock, CheckCircle2, RefreshCw,
  ShieldAlert, TrendingUp, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ContentType = 'post' | 'comment' | 'clip' | 'discussion';
type ContentStatus = 'active' | 'hidden' | 'featured' | 'pinned' | 'deleted';

interface ContentItem {
  id: string;
  type: ContentType;
  title?: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  likes: number;
  comments: number;
  views: number;
  status: ContentStatus;
  flags?: number;
  tag?: string;
  created_at: string;
  updated_at?: string;
  media_url?: string;
}

interface ContentStats {
  total: number;
  posts: number;
  comments: number;
  clips: number;
  discussions: number;
  pendingReview: number;
  reported: number;
  featured: number;
  dailyEngagement: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-green-400', icon: CheckCircle2 },
  hidden: { label: 'Hidden', color: 'text-slate-400', icon: EyeOff },
  featured: { label: 'Featured', color: 'text-yellow-400', icon: Crown },
  pinned: { label: 'Pinned', color: 'text-cyan-400', icon: Pin },
  deleted: { label: 'Deleted', color: 'text-red-400', icon: Trash2 },
};

const TYPE_CONFIG: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  post: { label: 'Post', icon: FileText, color: 'text-blue-400' },
  comment: { label: 'Comment', icon: MessageCircle, color: 'text-green-400' },
  clip: { label: 'Clip', icon: Play, color: 'text-pink-400' },
  discussion: { label: 'Discussion', icon: MessageSquare, color: 'text-purple-400' },
};

const TAG_COLORS: Record<string, string> = {
  general: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tournament: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tips: 'bg-green-500/20 text-green-400 border-green-500/30',
  clips: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  news: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  guide: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ title, value, change, icon: Icon, color }: {
  title: string;
  value: number;
  change?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
            {change && <p className="text-xs text-green-400 mt-1">{change}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentCard({ item, onStatusChange, onDelete, onView }: {
  item: ContentItem;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onDelete: (id: string) => void;
  onView: (item: ContentItem) => void;
}) {
  const statusConfig = STATUS_CONFIG[item.status];
  const typeConfig = TYPE_CONFIG[item.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar / Type Icon */}
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0', typeConfig.color.replace('text-', 'bg-').replace('400', '500/20'), 'border-slate-700')}>
            <TypeIcon className={cn('w-5 h-5', typeConfig.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-medium text-cyan-400">{item.author.username}</span>
              <Badge className={cn('border', statusConfig.bg, statusConfig.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {item.tag && (
                <Badge className={cn('border', TAG_COLORS[item.tag] || 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>
                  {item.tag}
                </Badge>
              )}
              {item.flags && item.flags > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                  <Flag className="w-3 h-3 mr-1" />
                  {item.flags} reports
                </Badge>
              )}
            </div>

            {item.title && (
              <h4 className="font-orbitron font-bold text-sm text-white mb-1 truncate">{item.title}</h4>
            )}

            <p className="text-sm text-slate-400 line-clamp-2">{item.content}</p>

            {/* Media Preview */}
            {item.media_url && item.type === 'clip' && (
              <div className="mt-2 aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                <video src={item.media_url} className="w-full h-full object-cover" poster={item.media_url} />
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {item.likes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {item.comments}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {item.views}
              </span>
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onView(item)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-all"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-800">
                <DropdownMenuItem
                  onClick={() => onStatusChange(item.id, 'featured')}
                  className="text-yellow-400 focus:bg-yellow-500/10"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Feature
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange(item.id, 'pinned')}
                  className="text-cyan-400 focus:bg-cyan-500/10"
                >
                  <Pin className="w-4 h-4 mr-2" />
                  Pin
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange(item.id, item.status === 'hidden' ? 'active' : 'hidden')}
                  className="text-slate-400 focus:bg-slate-500/10"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  {item.status === 'hidden' ? 'Unhide' : 'Hide'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="text-red-400 focus:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ContentDetailModal({ item, onClose, onStatusChange, onDelete }: {
  item: ContentItem;
  onClose: () => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onDelete: (id: string) => void;
}) {
  const statusConfig = STATUS_CONFIG[item.status];
  const typeConfig = TYPE_CONFIG[item.type];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-white flex items-center gap-2">
            <typeConfig.icon className={cn('w-5 h-5', typeConfig.color)} />
            {item.title || `${typeConfig.label} Detail`}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Posted by {item.author.username} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Badge className={cn('border', statusConfig.color.replace('text-', 'bg-').replace('400', '500/20'), statusConfig.color)}>
              <statusConfig.icon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {item.tag && (
              <Badge className={cn('border', TAG_COLORS[item.tag])}>
                {item.tag}
              </Badge>
            )}
          </div>

          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.content}</p>
          </div>

          {item.media_url && (
            <div className="rounded-xl overflow-hidden border border-slate-800">
              {item.type === 'clip' ? (
                <video src={item.media_url} controls className="w-full" />
              ) : (
                <img src={item.media_url} alt="Content" className="w-full" />
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500 mb-1">Likes</p>
              <p className="text-xl font-bold text-white">{item.likes}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500 mb-1">Comments</p>
              <p className="text-xl font-bold text-white">{item.comments}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500 mb-1">Views</p>
              <p className="text-xl font-bold text-white">{item.views}</p>
            </div>
          </div>

          {item.flags && item.flags > 0 && (
            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <Flag className="w-4 h-4" />
                <span className="font-medium">Reported {item.flags} times</span>
              </div>
              <p className="text-xs text-slate-400">This content has been flagged by users for review.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => onStatusChange(item.id, item.status === 'hidden' ? 'active' : 'hidden')}
            className="border-slate-700"
          >
            <EyeOff className="w-4 h-4 mr-1" />
            {item.status === 'hidden' ? 'Unhide' : 'Hide'}
          </Button>
          <Button
            onClick={() => onStatusChange(item.id, 'featured')}
            className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"
          >
            <Crown className="w-4 h-4 mr-1" />
            Feature
          </Button>
          <Button
            onClick={() => onDelete(item.id)}
            className="bg-red-500 hover:bg-red-600"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({ content, onClose, onConfirm }: {
  content: ContentItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="font-orbitron text-white">Delete Content</DialogTitle>
              <DialogDescription className="text-slate-400">This cannot be undone</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-slate-400 mb-4">
          Are you sure you want to delete this {content.type} by <span className="font-bold text-white">{content.author.username}</span>?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            Cancel
          </Button>
          <Button onClick={confirm} disabled={deleting} className="bg-red-500 hover:bg-red-600">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminPosts(): React.ReactElement {
  const { hasPermission } = useAdmin();
  const canManageContent = hasPermission('content.manage') || hasPermission('system.admin_access');
  const canDelete = hasPermission('content.delete') || hasPermission('system.admin_access');

  const [content, setContent] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats>({
    total: 0, posts: 0, comments: 0, clips: 0, discussions: 0,
    pendingReview: 0, reported: 0, featured: 0, dailyEngagement: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ContentType | 'all' | 'reported' | 'featured'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);

  // Mock data
  useEffect(() => {
    const mockContent: ContentItem[] = [
      {
        id: '1',
        type: 'post',
        title: 'Best strategies for Battle Royale beginners',
        content: 'After playing for 500+ hours, here are my top tips for anyone just starting out in battle royale games...',
        author: { id: 'u1', username: 'ProGamer_99', avatar: '' },
        likes: 245,
        comments: 67,
        views: 1845,
        status: 'featured',
        tag: 'tips',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '2',
        type: 'clip',
        title: 'Insane 1v4 clutch in ranked',
        content: 'Watch me clutch this impossible situation',
        author: { id: 'u2', username: 'ClipMaster', avatar: '' },
        likes: 892,
        comments: 156,
        views: 5234,
        status: 'active',
        tag: 'clips',
        media_url: 'https://example.com/clip1.mp4',
        created_at: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: '3',
        type: 'discussion',
        title: 'What do you think about the new update?',
        content: 'The latest patch changed the meta significantly. Let\'s discuss the implications...',
        author: { id: 'u3', username: 'TheoryCrafter', avatar: '' },
        likes: 45,
        comments: 234,
        views: 567,
        status: 'active',
        tag: 'general',
        created_at: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: '4',
        type: 'post',
        title: 'Upcoming tournament announcement',
        content: 'Get ready for the biggest tournament of the season with $10,000 prize pool!',
        author: { id: 'u4', username: 'EventHost', avatar: '' },
        likes: 567,
        comments: 89,
        views: 2341,
        status: 'pinned',
        tag: 'tournament',
        created_at: new Date(Date.now() - 259200000).toISOString(),
      },
      {
        id: '5',
        type: 'comment',
        content: 'This is toxic behavior, please ban this user',
        author: { id: 'u5', username: 'Reporter123', avatar: '' },
        likes: 2,
        comments: 0,
        views: 15,
        status: 'hidden',
        flags: 3,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '6',
        type: 'clip',
        title: 'Pro player settings revealed',
        content: 'Check out the sensitivity settings of top players',
        author: { id: 'u6', username: 'SettingsGuide', avatar: '' },
        likes: 1234,
        comments: 345,
        views: 8902,
        status: 'active',
        tag: 'guide',
        flags: 1,
        created_at: new Date(Date.now() - 345600000).toISOString(),
      },
      {
        id: '7',
        type: 'post',
        title: 'Server maintenance notice',
        content: 'Servers will be down for 2 hours tonight for maintenance.',
        author: { id: 'u7', username: 'Admin', avatar: '' },
        likes: 89,
        comments: 45,
        views: 4567,
        status: 'active',
        tag: 'news',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    setContent(mockContent);

    setStats({
      total: mockContent.length,
      posts: mockContent.filter(c => c.type === 'post').length,
      comments: mockContent.filter(c => c.type === 'comment').length,
      clips: mockContent.filter(c => c.type === 'clip').length,
      discussions: mockContent.filter(c => c.type === 'discussion').length,
      pendingReview: mockContent.filter(c => c.flags && c.flags > 0).length,
      reported: mockContent.filter(c => c.flags && c.flags > 0).length,
      featured: mockContent.filter(c => c.status === 'featured').length,
      dailyEngagement: 1234,
    });

    setIsLoading(false);
  }, []);

  const filteredContent = useMemo(() => {
    let filtered = [...content];

    // Filter by tab
    if (activeTab === 'reported') {
      filtered = filtered.filter(c => c.flags && c.flags > 0);
    } else if (activeTab === 'featured') {
      filtered = filtered.filter(c => c.status === 'featured' || c.status === 'pinned');
    } else if (activeTab !== 'all') {
      filtered = filtered.filter(c => c.type === activeTab);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.title?.toLowerCase().includes(q) || false) ||
        c.content.toLowerCase().includes(q) ||
        c.author.username.toLowerCase().includes(q) ||
        (c.tag?.toLowerCase().includes(q) || false)
      );
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [content, activeTab, statusFilter, searchQuery]);

  const handleStatusChange = async (id: string, status: ContentStatus) => {
    if (!canManageContent) {
      toast.error('You do not have permission to manage content');
      return;
    }

    setContent(prev => prev.map(item =>
      item.id === id ? { ...item, status } : item
    ));

    await writeAudit('unknown', 'content_status_change', id, { newStatus: status });
    toast.success(`Content ${status}`);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error('You do not have permission to delete content');
      return;
    }

    setContent(prev => prev.filter(item => item.id !== id));

    await writeAudit('unknown', 'content_delete', id, {});
    toast.success('Content deleted');
    setDeleteTarget(null);
  };

  return (
    <div className="p-5 sm:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-orbitron text-2xl font-black text-white mb-1 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-cyan-400" />
            Community Content
          </h1>
          <p className="text-slate-400 text-sm">
            {stats.total} items • {stats.reported} reported • {stats.featured} featured
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Content"
          value={stats.total}
          icon={FileText}
          color="bg-blue-500/20"
        />
        <StatCard
          title="Daily Engagement"
          value={stats.dailyEngagement}
          change="+15% today"
          icon={TrendingUp}
          color="bg-green-500/20"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingReview}
          icon={ShieldAlert}
          color="bg-yellow-500/20"
        />
        <StatCard
          title="Featured"
          value={stats.featured}
          icon={Sparkles}
          color="bg-purple-500/20"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search content by title, content, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContentStatus | 'all')}>
          <SelectTrigger className="w-40 bg-slate-900/50 border-slate-800">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="pinned">Pinned</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-slate-900/50 border border-slate-800 flex-wrap h-auto">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-800">
            All
          </TabsTrigger>
          <TabsTrigger value="post" className="data-[state=active]:bg-slate-800">
            <FileText className="w-3 h-3 mr-1" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="clip" className="data-[state=active]:bg-slate-800">
            <Play className="w-3 h-3 mr-1" />
            Clips
          </TabsTrigger>
          <TabsTrigger value="discussion" className="data-[state=active]:bg-slate-800">
            <MessageSquare className="w-3 h-3 mr-1" />
            Discussions
          </TabsTrigger>
          <TabsTrigger value="comment" className="data-[state=active]:bg-slate-800">
            <MessageCircle className="w-3 h-3 mr-1" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="reported" className="data-[state=active]:bg-slate-800 text-red-400">
            <Flag className="w-3 h-3 mr-1" />
            Reported
          </TabsTrigger>
          <TabsTrigger value="featured" className="data-[state=active]:bg-slate-800">
            <Crown className="w-3 h-3 mr-1" />
            Featured
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <h3 className="text-lg font-medium text-white mb-2">No content found</h3>
              <p className="text-slate-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredContent.map((item: ContentItem) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={canDelete ? (id) => setDeleteTarget(content.find(c => c.id === id) || null) : () => {}}
                    onView={setSelectedItem}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          onDelete={canDelete ? () => setDeleteTarget(selectedItem) : () => {}}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          content={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}