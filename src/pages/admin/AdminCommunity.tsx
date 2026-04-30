// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Community Content Management Module
// Comprehensive management for posts, clips, comments, and discussions
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { subscriptionManager } from '@/lib/realtime/subscriptionManager';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  MessageSquare, Play, FileText, MessageCircle, Filter,
  Search, RefreshCw, Eye, EyeOff, Pin,
  Trash2, Flag, CheckCircle2, AlertTriangle,
  Clock, ThumbsUp, Share2,
  Sparkles, Shield, Video,
  Gavel,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ContentType = 'post' | 'clip' | 'comment' | 'discussion';
type ContentStatus = 'active' | 'hidden' | 'deleted' | 'featured' | 'pinned';
type SortOption = 'newest' | 'oldest' | 'most_liked' | 'most_viewed' | 'most_reported';

interface ContentItem {
  id: string;
  type: ContentType;
  author: {
    id: string;
    username: string;
    avatar_url: string | null;
    role: string;
  };
  title?: string;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  status: ContentStatus;
  engagement: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  moderation: {
    is_flagged: boolean;
    flag_reason?: string;
    report_count: number;
    toxicity_score?: number;
    moderated_by?: string;
    moderated_at?: string;
  };
  tags: string[];
  created_at: string;
  updated_at: string;
  featured_until?: string;
  pinned_at?: string;
}

interface ContentFilters {
  type: ContentType | 'all';
  status: ContentStatus | 'all';
  search: string;
  sortBy: SortOption;
  flaggedOnly: boolean;
  featuredOnly: boolean;
  dateRange: 'all' | 'today' | 'week' | 'month';
  authorRole: 'all' | 'user' | 'moderator' | 'admin';
}

interface ContentStats {
  totalPosts: number;
  totalClips: number;
  totalComments: number;
  pendingReview: number;
  featuredContent: number;
  reportedContent: number;
  trendingToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS (additional)
// ═══════════════════════════════════════════════════════════════════════════════

import { writeAudit } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  post: { label: 'Post', icon: FileText, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  clip: { label: 'Clip', icon: Play, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  comment: { label: 'Comment', icon: MessageCircle, color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  discussion: { label: 'Discussion', icon: MessageSquare, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-green-400 bg-green-500/10 border-green-500/30', icon: CheckCircle2 },
  hidden: { label: 'Hidden', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: EyeOff },
  deleted: { label: 'Deleted', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: Trash2 },
  featured: { label: 'Featured', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30', icon: Sparkles },
  pinned: { label: 'Pinned', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: Pin },
};

function getToxicityColor(score: number): string {
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-green-500';
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ContentCard({
  item,
  onSelect,
  onAction,
}: {
  item: ContentItem;
  onSelect: () => void;
  onAction: (action: string, data?: object) => void;
}) {
  const TypeConfig = CONTENT_TYPE_CONFIG[item.type];
  const StatusConfig = STATUS_CONFIG[item.status];
  const TypeIcon = TypeConfig.icon;
  const StatusIcon = StatusConfig.icon;

  const isFlagged = item.moderation.is_flagged || item.moderation.report_count > 0;
  const hasToxicity = item.moderation.toxicity_score && item.moderation.toxicity_score > 40;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative p-4 rounded-xl border transition-all cursor-pointer",
        "hover:border-slate-600 hover:bg-slate-800/30",
        isFlagged ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-800 bg-slate-900/50',
        item.status === 'deleted' && 'opacity-60'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-10 h-10 border-2 border-slate-700">
          <AvatarImage src={item.author.avatar_url || ''} />
          <AvatarFallback className="bg-slate-700 text-slate-300">
            {item.author.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-200">{item.author.username}</span>
            <Badge variant="outline" className={cn("text-[10px]", TypeConfig.color)}>
              <TypeIcon className="w-3 h-3 mr-1" />
              {TypeConfig.label}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", StatusConfig.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {StatusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            {item.status === 'featured' && item.featured_until && (
              <>
                <span className="text-slate-600">•</span>
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Featured until {format(new Date(item.featured_until), 'MMM d')}
              </>
            )}
          </div>
        </div>

        {/* Warning Indicators */}
        <div className="flex items-center gap-1">
          {isFlagged && (
            <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400" title="Flagged for review">
              <Flag className="w-4 h-4" />
            </div>
          )}
          {hasToxicity && (
            <div className={cn("p-1.5 rounded-lg bg-red-500/10", getToxicityColor(item.moderation.toxicity_score!))} title={`Toxicity: ${item.moderation.toxicity_score}%`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {item.title && (
          <h4 className="font-medium text-slate-200 line-clamp-2">{item.title}</h4>
        )}
        <p className="text-sm text-slate-400 line-clamp-3">{item.content}</p>

        {/* Media Preview */}
        {item.media_url && (
          <div className="mt-3 relative rounded-lg overflow-hidden bg-slate-800 aspect-video max-h-40">
            {item.media_type === 'video' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="w-8 h-8 text-slate-600" />
              </div>
            ) : (
              <img src={item.media_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {item.tags.map((tag, i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-slate-700 text-slate-500">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Engagement Stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Eye className="w-3.5 h-3.5" />
          {item.engagement.views.toLocaleString()}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <ThumbsUp className="w-3.5 h-3.5" />
          {item.engagement.likes.toLocaleString()}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MessageCircle className="w-3.5 h-3.5" />
          {item.engagement.comments.toLocaleString()}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Share2 className="w-3.5 h-3.5" />
          {item.engagement.shares.toLocaleString()}
        </div>
        {item.moderation.report_count > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <Flag className="w-3.5 h-3.5" />
            {item.moderation.report_count} reports
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ContentDetailSheet({
  item,
  isOpen,
  onClose,
  onAction,
  currentUserId: _currentUserId,
}: {
  item: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, data?: object) => Promise<void>;
  currentUserId: string;
}) {
  const [moderatorNote, setModeratorNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!item) return null;

  const TypeConfig = CONTENT_TYPE_CONFIG[item.type];
  const StatusConfig = STATUS_CONFIG[item.status];
  const TypeIcon = TypeConfig.icon;

  const handleAction = async (action: string) => {
    setIsProcessing(true);
    try {
      await onAction(action, { note: moderatorNote });
      setModeratorNote('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl bg-slate-950 border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", TypeConfig.color)}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-white">{TypeConfig.label} Details</SheetTitle>
              <SheetDescription className="text-slate-400">
                Posted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Author Info */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <Avatar className="w-12 h-12">
              <AvatarImage src={item.author.avatar_url || ''} />
              <AvatarFallback className="bg-slate-700 text-slate-300">
                {item.author.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-slate-200">{item.author.username}</p>
              <p className="text-sm text-slate-500 capitalize">{item.author.role}</p>
            </div>
            <Badge className={cn("border", StatusConfig.color)}>
              {StatusConfig.label}
            </Badge>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {item.title && (
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            )}
            <p className="text-slate-300 whitespace-pre-wrap">{item.content}</p>

            {item.media_url && (
              <div className="rounded-lg overflow-hidden border border-slate-800">
                {item.media_type === 'video' ? (
                  <video src={item.media_url} controls className="w-full max-h-64 object-cover" />
                ) : (
                  <img src={item.media_url} alt="" className="w-full max-h-64 object-cover" />
                )}
              </div>
            )}
          </div>

          {/* Moderation Info */}
          {(item.moderation.is_flagged || item.moderation.report_count > 0) && (
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
              <h4 className="font-medium text-yellow-400 flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
                Moderation Status
              </h4>
              <div className="space-y-2 text-sm">
                {item.moderation.report_count > 0 && (
                  <p className="text-slate-300">
                    <span className="text-slate-500">Reports:</span>{' '}
                    <span className="text-red-400 font-medium">{item.moderation.report_count}</span>
                  </p>
                )}
                {item.moderation.flag_reason && (
                  <p className="text-slate-300">
                    <span className="text-slate-500">Flag Reason:</span>{' '}
                    {item.moderation.flag_reason}
                  </p>
                )}
                {item.moderation.toxicity_score !== undefined && (
                  <p className="text-slate-300">
                    <span className="text-slate-500">Toxicity Score:</span>{' '}
                    <span className={getToxicityColor(item.moderation.toxicity_score)}>
                      {item.moderation.toxicity_score}%
                    </span>
                  </p>
                )}
                {item.moderation.moderated_by && (
                  <p className="text-slate-300">
                    <span className="text-slate-500">Last Action By:</span>{' '}
                    {item.moderation.moderated_by}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Engagement Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <Eye className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-semibold text-white">{item.engagement.views.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Views</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <ThumbsUp className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-semibold text-white">{item.engagement.likes.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Likes</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <MessageCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-semibold text-white">{item.engagement.comments.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Comments</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
              <Share2 className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-semibold text-white">{item.engagement.shares.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Shares</p>
            </div>
          </div>

          {/* Moderator Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Moderator Note</label>
            <Textarea
              value={moderatorNote}
              onChange={(e) => setModeratorNote(e.target.value)}
              placeholder="Add a note about this action..."
              className="bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-600"
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              {item.status !== 'active' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('restore')}
                  disabled={isProcessing}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Restore Content
                </Button>
              )}
              {item.status === 'active' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('hide')}
                  disabled={isProcessing}
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Content
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleAction('feature')}
                disabled={isProcessing}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {item.status === 'featured' ? 'Unfeature' : 'Feature'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction('pin')}
                disabled={isProcessing}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Pin className="w-4 h-4 mr-2" />
                {item.status === 'pinned' ? 'Unpin' : 'Pin'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction('delete')}
                disabled={isProcessing}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Content
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction('warn_author')}
                disabled={isProcessing}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <Gavel className="w-4 h-4 mr-2" />
                Warn Author
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminCommunity(): React.JSX.Element {
  const _navigate = useNavigate();
  const [_searchParams] = useSearchParams();
  const { profile } = useAdmin();

  const [content, setContent] = useState<ContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [_totalPages, _setTotalPages] = useState(1);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [filters, setFilters] = useState<ContentFilters>({
    type: 'all',
    status: 'all',
    search: '',
    sortBy: 'newest',
    flaggedOnly: false,
    featuredOnly: false,
    dateRange: 'all',
    authorRole: 'all',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, _setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch content from Supabase
  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build base query for posts, clips, and comments
      let postsQuery = supabase
        .from('posts')
        .select('*, profiles!user_id(username, avatar_url, role), post_likes(count), post_comments(count), post_reports!inner(*)')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.type !== 'all' && filters.type !== 'comment') {
        postsQuery = postsQuery.eq('type', filters.type);
      }
      if (filters.status !== 'all') {
        postsQuery = postsQuery.eq('status', filters.status);
      }
      if (filters.flaggedOnly) {
        postsQuery = postsQuery.not('post_reports', 'is', null);
      }
      if (filters.search) {
        postsQuery = postsQuery.ilike('content', `%${filters.search}%`);
      }

      // Pagination: Get count first for total pages
    const { count: totalCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });
    
    const pageSize = 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: postsData, error: postsError } = await postsQuery
      .range(from, to)
      .limit(pageSize);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        toast.error('Failed to load content');
      }

      // Transform posts to ContentItem format
      const transformedContent: ContentItem[] = (postsData || []).map((p: Record<string, unknown>) => {
        const reportCount = (p.post_reports as unknown[])?.length ?? 0;
        return {
          id: p.id as string,
          type: (p.type as string) || 'post',
          author: {
            id: p.user_id as string,
            username: (p.profiles as { username: string })?.username || 'Unknown',
            avatar_url: (p.profiles as { avatar_url: string | null })?.avatar_url || null,
            role: (p.profiles as { role: string })?.role || 'user',
          },
          title: p.title as string | undefined,
          content: p.content as string,
          media_url: p.media_url as string | null,
          media_type: p.media_type as 'image' | 'video' | null,
          status: (p.status as ContentStatus) || 'active',
          engagement: {
            views: (p.views as number) || 0,
            likes: (p.post_likes as unknown[])?.length ?? 0,
            comments: (p.post_comments as unknown[])?.length ?? 0,
            shares: (p.shares as number) || 0,
          },
          moderation: {
            is_flagged: reportCount > 0,
            flag_reason: reportCount > 0 ? 'Reported by users' : undefined,
            report_count: reportCount,
            toxicity_score: undefined,
          },
          tags: (p.tags as string[]) || [],
          created_at: p.created_at as string,
          updated_at: p.updated_at as string,
          featured_until: p.featured_until as string | undefined,
          pinned_at: p.pinned_at as string | undefined,
        };
      });

      // Apply local filters (author role, date range)
      let filtered = transformedContent;
      if (filters.authorRole !== 'all') {
        filtered = filtered.filter(c => c.author.role === filters.authorRole);
      }

      setContent(filtered);
      setTotalPages(Math.ceil((totalCount || filtered.length) / pageSize));

      // Fetch stats separately
      const { data: statsData } = await supabase.rpc('get_community_stats');
      setStats(statsData || {
        totalPosts: filtered.filter(c => c.type === 'post').length,
        totalClips: filtered.filter(c => c.type === 'clip').length,
        totalComments: filtered.filter(c => c.type === 'comment').length,
        pendingReview: filtered.filter(c => c.moderation.report_count > 0).length,
        featuredContent: filtered.filter(c => c.status === 'featured' || c.status === 'pinned').length,
        reportedContent: filtered.filter(c => c.moderation.report_count > 0).length,
        trendingToday: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Real-time subscriptions for moderation queue
  useEffect(() => {
    // Subscribe to new posts
    const postsChannel = subscriptionManager.subscribe({
      table: 'posts',
      event: 'INSERT',
      callback: () => {
        toast.info('New content posted');
        fetchContent();
      },
    });
    
    // Subscribe to post reports
    const reportsChannel = subscriptionManager.subscribe({
      table: 'post_reports',
      event: 'INSERT',
      callback: () => {
        toast.warning('New content report received');
        fetchContent();
      },
    });
    
    return () => {
      subscriptionManager.unsubscribe(postsChannel);
      subscriptionManager.unsubscribe(reportsChannel);
    };
  }, [fetchContent]);

  // Handle content action
  const handleContentAction = async (action: string, data?: object) => {
    if (!selectedItem || !profile) return;

    try {
      // Update local state
      setContent(prev => prev.map(item => {
        if (item.id !== selectedItem.id) return item;

        const updates: Partial<ContentItem> = {};
        switch (action) {
          case 'restore':
            updates.status = 'active';
            break;
          case 'hide':
            updates.status = 'hidden';
            break;
          case 'delete':
            updates.status = 'deleted';
            break;
          case 'feature':
            updates.status = item.status === 'featured' ? 'active' : 'featured';
            updates.featured_until = updates.status === 'featured'
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              : undefined;
            break;
          case 'pin':
            updates.status = item.status === 'pinned' ? 'active' : 'pinned';
            updates.pinned_at = updates.status === 'pinned' ? new Date().toISOString() : undefined;
            break;
        }

        return { ...item, ...updates };
      }));

      // Write audit log
      await writeAudit(profile.id, `content.${action}`, selectedItem.id, { note: (data as { note?: string })?.note });

      toast.success(`Content ${action.replace('_', ' ')} successful`);
      setIsDetailOpen(false);
    } catch (error) {
      toast.error('Action failed');
    }
  };

  // Stats cards
  const statCards = [
    { label: 'Total Posts', value: stats?.totalPosts ?? 0, icon: FileText, color: 'blue' },
    { label: 'Total Clips', value: stats?.totalClips ?? 0, icon: Play, color: 'pink' },
    { label: 'Comments', value: stats?.totalComments ?? 0, icon: MessageCircle, color: 'green' },
    { label: 'Pending Review', value: stats?.pendingReview ?? 0, icon: AlertTriangle, color: 'yellow' },
    { label: 'Featured', value: stats?.featuredContent ?? 0, icon: Sparkles, color: 'cyan' },
    { label: 'Reported', value: stats?.reportedContent ?? 0, icon: Flag, color: 'red' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Community Management</h1>
          <p className="text-slate-400 mt-1">Manage posts, clips, comments, and discussions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchContent} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${stat.color}-500/10 text-${stat.color}-400`)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search content..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-slate-200"
                />
              </div>
            </div>
            <Select value={filters.type} onValueChange={(v) => setFilters(f => ({ ...f, type: v as any }))}>
              <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 text-slate-200">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="clip">Clips</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
                <SelectItem value="discussion">Discussions</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v as any }))}>
              <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 text-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="pinned">Pinned</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sortBy} onValueChange={(v) => setFilters(f => ({ ...f, sortBy: v as any }))}>
              <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700 text-slate-200">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="most_liked">Most Liked</SelectItem>
                <SelectItem value="most_viewed">Most Viewed</SelectItem>
                <SelectItem value="most_reported">Most Reported</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-800">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <Switch
                checked={filters.flaggedOnly}
                onCheckedChange={(v) => setFilters(f => ({ ...f, flaggedOnly: v }))}
              />
              Flagged Only
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <Switch
                checked={filters.featuredOnly}
                onCheckedChange={(v) => setFilters(f => ({ ...f, featuredOnly: v }))}
              />
              Featured Only
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : content.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-8 text-center">
            <p className="text-slate-400">No content found</p>
            <p className="text-sm text-slate-500 mt-2">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {content.map((item) => (
            <Card key={item.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    {item.author?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{item.author?.username || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{item.type}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">{item.content}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span>{formatDistanceToNow(new Date(item.created_at))} ago</span>
                  {item.moderation?.report_count > 0 && (
                    <span className="text-red-400">{item.moderation.report_count} reports</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
    <ContentDetailSheet
      item={selectedItem}
      isOpen={isDetailOpen}
      onClose={() => setIsDetailOpen(false)}
      onAction={handleContentAction}
      currentUserId={profile?.id || ''}
    />
  </div>
);
}

export default AdminCommunity;
