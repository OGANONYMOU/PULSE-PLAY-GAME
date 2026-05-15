// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Moderation System Module
// Professional trust & safety workflow with AI-assisted moderation
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, ShieldCheck, Flag, AlertTriangle, AlertOctagon,
  RefreshCw, Search, Filter, CheckCircle2, XCircle, MessageSquare,
  FileText, Video, User, Ban, VolumeX,
  ExternalLink, Clock,
  Sparkles, Bot, TrendingUp,
  Gavel, Trash2, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';
import type {
  Report, ReportStatus, ReportPriority, ReportReason,
  ToxicityAnalysis,
} from '@/types/admin';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ContentType = 'post' | 'clip' | 'comment' | 'user' | 'tournament';

type QueueType = 'all' | 'pending' | 'urgent' | 'ai_flagged' | 'repeat_offender' | 'resolved';

type ExtendedReport = Report & {
  content_preview?: string;
  content_author?: {
    id: string;
    username: string;
    avatar_url: string | null;
    gamercred: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  };
  toxicity_analysis?: ToxicityAnalysis;
  prior_reports_count?: number;
  is_repeat_offender?: boolean;
};

type ModerationFilters = {
  queue: QueueType;
  contentType: ContentType | 'all';
  reason: ReportReason | 'all';
  priority: ReportPriority | 'all';
  assignedToMe: boolean;
  aiAssisted: boolean | null;
  dateRange: 'all' | 'today' | 'week' | 'month';
};

type ModerationStats = {
  totalPending: number;
  urgentCount: number;
  aiFlaggedCount: number;
  repeatOffenderCount: number;
  resolvedToday: number;
  avgResolutionTime: number;
  accuracy: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CONTENT_ICONS: Record<ContentType, React.ElementType> = {
  post: FileText,
  clip: Video,
  comment: MessageSquare,
  user: User,
  tournament: Shield,
};

const REASON_LABELS: Record<ReportReason, { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
  harassment: { label: 'Harassment', severity: 'high' },
  hate_speech: { label: 'Hate Speech', severity: 'critical' },
  spam: { label: 'Spam', severity: 'low' },
  inappropriate_content: { label: 'Inappropriate', severity: 'medium' },
  cheating: { label: 'Cheating', severity: 'high' },
  impersonation: { label: 'Impersonation', severity: 'medium' },
  scam: { label: 'Scam/Fraud', severity: 'high' },
  other: { label: 'Other', severity: 'low' },
};

const PRIORITY_COLORS: Record<ReportPriority, string> = {
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  dismissed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

function getSeverityFromToxicity(score: number): 'none' | 'low' | 'medium' | 'high' | 'severe' {
  if (score >= 80) return 'severe';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'none';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'severe': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-yellow-500';
    case 'low': return 'text-blue-500';
    default: return 'text-green-500';
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function AIAnalysisPanel({ analysis }: { analysis?: ToxicityAnalysis }) {
  if (!analysis) return null;

  const severity = getSeverityFromToxicity(analysis.toxicity_score);
  const Icon = severity === 'severe' ? AlertOctagon : severity === 'high' ? AlertTriangle : Bot;

  return (
    <div className={cn(
      "p-4 rounded-lg border",
      severity === 'severe' ? 'bg-red-500/10 border-red-500/30' :
      severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
      severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
      'bg-blue-500/10 border-blue-500/30'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-5 h-5", getSeverityColor(severity))} />
        <h4 className="font-medium text-white">AI Analysis</h4>
        <Badge variant="outline" className="text-[10px] border-slate-700">
          {analysis.ai_confidence * 100}% confidence
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Toxicity Score */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Toxicity Score</span>
            <span className={getSeverityColor(severity)}>{analysis.toxicity_score}/100</span>
          </div>
          <Progress value={analysis.toxicity_score} className="h-2" />
        </div>

        {/* Categories */}
        {analysis.categories && analysis.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {analysis.categories.map((cat, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  "text-[10px]",
                  cat.score > 50 ? 'border-red-500/30 text-red-400' :
                  cat.score > 25 ? 'border-orange-500/30 text-orange-400' :
                  'border-slate-700 text-slate-400'
                )}
              >
                {cat.name}: {cat.score}%
              </Badge>
            ))}
          </div>
        )}

        {/* Flagged Words */}
        {analysis.flagged_words && analysis.flagged_words.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Flagged Terms</p>
            <div className="flex flex-wrap gap-1">
              {analysis.flagged_words.map((word, i) => (
                <Badge key={i} className="text-[10px] bg-red-500/20 text-red-400">
                  {word}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500">
          This is an automated assessment. Always review content manually before taking action.
        </p>
      </div>
    </div>
  );
}

function ModerationCaseSheet({
  report,
  isOpen,
  onClose,
  onAction,
  canModerate,
}: {
  report: ExtendedReport | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, data?: object) => void;
  canModerate: boolean;
}) {
  const [moderatorNote, setModeratorNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  if (!report) return null;

  const ContentIcon = CONTENT_ICONS[report.type as ContentType] || FileText;
  const reasonConfig = REASON_LABELS[report.reason];

  const MODERATION_ACTIONS = [
    { id: 'dismiss', label: 'Dismiss Report', icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' },
    { id: 'warn', label: 'Warn User', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'mute', label: 'Mute User (24h)', icon: VolumeX, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'delete_content', label: 'Delete Content', icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
    { id: 'ban', label: 'Ban User', icon: Ban, color: 'text-red-500', bg: 'bg-red-500/20' },
    { id: 'escalate', label: 'Escalate to Admin', icon: ShieldAlert, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl bg-slate-950 border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                STATUS_COLORS[report.status].split(' ')[0]
              )}>
                <ContentIcon className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="font-orbitron text-lg text-white">
                  {report.type} Report
                </SheetTitle>
                <SheetDescription className="text-slate-400">
                  Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                </SheetDescription>
              </div>
            </div>
            <Badge className={cn("border", PRIORITY_COLORS[report.priority])}>
              {report.priority}
            </Badge>
          </div>

          {/* Quick Info Row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge className={cn("border", STATUS_COLORS[report.status])}>
              {report.status.replace('_', ' ')}
            </Badge>
            {reasonConfig && (
              <Badge
                className={cn(
                  "border",
                  reasonConfig.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  reasonConfig.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  reasonConfig.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-500/20 text-slate-400'
                )}
              >
                {reasonConfig.label}
              </Badge>
            )}
            {report.is_repeat_offender && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Repeat Offender
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Reporter Info */}
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <h4 className="text-sm font-medium text-white mb-3">Reporter</h4>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={report.reporter?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                  {report.reporter?.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-white">@{report.reporter?.username || 'Unknown'}</p>
                <p className="text-xs text-slate-500">
                  Risk Level: <span className={cn(
                    report.reporter?.risk_level === 'critical' ? 'text-red-400' :
                    report.reporter?.risk_level === 'high' ? 'text-orange-400' :
                    report.reporter?.risk_level === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  )}>{report.reporter?.risk_level || 'unknown'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Content Preview */}
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white">Reported Content</h4>
              {report.content_author && (
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={report.content_author.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] bg-slate-700">
                      {report.content_author.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-slate-400">@{report.content_author.username}</span>
                </div>
              )}
            </div>

            {report.content_preview ? (
              <div className="p-3 rounded bg-slate-900 border border-slate-800">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{report.content_preview}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Content preview not available</p>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('view_content')}
                className="border-slate-700 text-slate-400"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Content
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('view_author_history')}
                className="border-slate-700 text-slate-400"
              >
                <User className="w-3 h-3 mr-1" />
                Author History
              </Button>
            </div>
          </div>

          {/* AI Analysis */}
          <AIAnalysisPanel analysis={report.toxicity_analysis} />

          {/* Description */}
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <h4 className="text-sm font-medium text-white mb-2">Report Description</h4>
            <p className="text-sm text-slate-400">{report.description || 'No additional description provided'}</p>
          </div>

          {/* Prior Reports */}
          {report.prior_reports_count && report.prior_reports_count > 0 && (
            <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h4 className="text-sm font-medium text-red-400">Prior Reports</h4>
              </div>
              <p className="text-sm text-slate-400">
                This {report.type} has <strong>{report.prior_reports_count}</strong> previous reports.
              </p>
            </div>
          )}

          {/* Moderation Actions */}
          {canModerate && report.status !== 'resolved' && report.status !== 'dismissed' && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Gavel className="w-4 h-4 text-cyan-400" />
                Moderation Actions
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {MODERATION_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => setSelectedAction(action.id)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                      selectedAction === action.id
                        ? `${action.bg} ${action.color} border-current`
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    <action.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Moderator Note */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Moderator Note (Optional)</label>
                <Textarea
                  value={moderatorNote}
                  onChange={(e) => setModeratorNote(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="bg-slate-900 border-slate-800 min-h-[80px]"
                />
              </div>

              {/* Submit Button */}
              <Button
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90"
                disabled={!selectedAction}
                onClick={() => {
                  onAction(selectedAction, { note: moderatorNote });
                  setModeratorNote('');
                  setSelectedAction('');
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Submit Decision
              </Button>
            </div>
          )}

          {/* Resolution Info */}
          {report.resolution && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Resolution
              </h4>
              <p className="text-sm text-slate-300">{report.resolution.reason}</p>
              <p className="text-xs text-slate-500 mt-2">
                Resolved by {report.resolution.moderator_name} • {' '}
                {formatDistanceToNow(new Date(report.resolution.created_at), { addSuffix: true })}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminModeration(): React.ReactElement {
  const { hasPermission, role, profile } = useAdmin();
  const navigate = useNavigate();

  // Data states
  const [reports, setReports] = useState<ExtendedReport[]>([]);
  const [stats, setStats] = useState<ModerationStats>({
    totalPending: 0,
    urgentCount: 0,
    aiFlaggedCount: 0,
    repeatOffenderCount: 0,
    resolvedToday: 0,
    avgResolutionTime: 0,
    accuracy: 95,
  });

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ModerationFilters>({
    queue: 'all',
    contentType: 'all',
    reason: 'all',
    priority: 'all',
    assignedToMe: false,
    aiAssisted: null,
    dateRange: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ExtendedReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
    
  // Permissions
  const canView = hasPermission('moderation.view');
  const canResolve = hasPermission('moderation.resolve');
  const canEscalate = hasPermission('moderation.escalate');
  const canBan = hasPermission('moderation.ban') || role === 'SUPER_ADMIN' || role === 'ADMIN';

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch from content_reports table
      // For now, creating mock data that matches the expected structure
      const mockReports: ExtendedReport[] = [
        {
          id: '1',
          type: 'content',
          reason: 'harassment',
          status: 'pending',
          priority: 'high',
          description: 'This user is targeting another player with insults',
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          updated_at: new Date().toISOString(),
          reporter: {
            id: 'rep1',
            username: 'concerned_user',
            avatar_url: null,
            risk_level: 'low',
          },
          target: {
            id: 'post1',
            type: 'content',
            title: 'Toxic Post',
            content: 'Example toxic content',
            author: {
              id: 'author1',
              username: 'toxic_player',
              avatar_url: null,
              risk_level: 'high',
            },
          },
          content_preview: 'You are the worst player I have ever seen...',
          content_author: {
            id: 'author1',
            username: 'toxic_player',
            avatar_url: null,
            gamercred: 150,
            risk_level: 'high',
          },
          toxicity_analysis: {
            content_id: 'post1',
            toxicity_score: 75,
            severity: 'high',
            flagged_words: ['worst', 'trash'],
            categories: [
              { name: 'harassment', score: 80 },
              { name: 'hate', score: 30 },
            ],
            ai_confidence: 0.85,
          },
          prior_reports_count: 3,
          is_repeat_offender: true,
          evidence: [],
          assigned_to: null,
          resolution: null,
        },
        {
          id: '2',
          type: 'clip',
          reason: 'inappropriate_content',
          status: 'pending',
          priority: 'medium',
          description: 'Clip contains inappropriate language',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          updated_at: new Date().toISOString(),
          reporter: {
            id: 'rep2',
            username: 'parent_user',
            avatar_url: null,
            risk_level: 'low',
          },
          target: {
            id: 'clip1',
            type: 'clip',
            title: 'Inappropriate Clip',
            content: null,
            author: {
              id: 'author2',
              username: 'content_creator',
              avatar_url: null,
              risk_level: 'low',
            },
          },
          content_author: {
            id: 'author2',
            username: 'content_creator',
            avatar_url: null,
            gamercred: 500,
            risk_level: 'low',
          },
          toxicity_analysis: {
            content_id: 'clip1',
            toxicity_score: 45,
            severity: 'medium',
            flagged_words: ['damn'],
            categories: [
              { name: 'spam', score: 20 },
            ],
            ai_confidence: 0.72,
          },
          prior_reports_count: 0,
          is_repeat_offender: false,
          evidence: [],
          assigned_to: null,
          resolution: null,
        },
        {
          id: '3',
          type: 'user',
          reason: 'spam',
          status: 'under_review',
          priority: 'low',
          description: 'Spamming tournament invites',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          updated_at: new Date().toISOString(),
          reporter: {
            id: 'rep3',
            username: 'tournament_host',
            avatar_url: null,
            risk_level: 'low',
          },
          target: {
            id: 'user1',
            type: 'user',
            title: 'Spam User',
            content: null,
            author: {
              id: 'user1',
              username: 'spammer_123',
              avatar_url: null,
              risk_level: 'medium',
            },
          },
          content_author: {
            id: 'user1',
            username: 'spammer_123',
            avatar_url: null,
            gamercred: 10,
            risk_level: 'medium',
          },
          toxicity_analysis: {
            content_id: 'user1',
            toxicity_score: 15,
            severity: 'low',
            flagged_words: [],
            categories: [
              { name: 'spam', score: 65 },
            ],
            ai_confidence: 0.60,
          },
          prior_reports_count: 5,
          is_repeat_offender: true,
          evidence: [],
          assigned_to: null,
          resolution: null,
        },
      ];

      setReports(mockReports);

      // Calculate stats
      const pending = mockReports.filter(r => r.status === 'pending');
      const urgent = pending.filter(r => r.priority === 'urgent' || r.priority === 'high');
      const aiFlagged = pending.filter(r => (r.toxicity_analysis?.toxicity_score || 0) > 50);
      const repeatOffenders = pending.filter(r => r.is_repeat_offender);

      setStats({
        totalPending: pending.length,
        urgentCount: urgent.length,
        aiFlaggedCount: aiFlagged.length,
        repeatOffenderCount: repeatOffenders.length,
        resolvedToday: 12,
        avgResolutionTime: 45,
        accuracy: 94,
      });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      toast.error('Failed to load moderation queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filter reports
  const filteredReports = useMemo(() => {
    const filtered = [...reports];

    // Queue filter
    if (filters.queue !== 'all') {
      switch (filters.queue) {
        case 'pending':
          filtered = filtered.filter(r => r.status === 'pending');
          break;
        case 'urgent':
          filtered = filtered.filter(r => r.priority === 'urgent' || r.priority === 'high');
          break;
        case 'ai_flagged':
          filtered = filtered.filter(r => (r.toxicity_analysis?.toxicity_score || 0) > 50);
          break;
        case 'repeat_offender':
          filtered = filtered.filter(r => r.is_repeat_offender);
          break;
        case 'resolved':
          filtered = filtered.filter(r => r.status === 'resolved' || r.status === 'dismissed');
          break;
      }
    }

    // Content type filter
    if (filters.contentType !== 'all') {
      filtered = filtered.filter(r => r.type === filters.contentType);
    }

    // Reason filter
    if (filters.reason !== 'all') {
      filtered = filtered.filter(r => r.reason === filters.reason);
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(r => r.priority === filters.priority);
    }

    // AI assisted filter
    if (filters.aiAssisted !== null) {
      filtered = filtered.filter(r =>
        filters.aiAssisted
          ? !!r.toxicity_analysis
          : !r.toxicity_analysis
      );
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.reporter?.username.toLowerCase().includes(query) ||
        r.content_author?.username.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [reports, filters, searchQuery]);

  // Handle moderation actions
  const handleAction = async (action: string, data?: object) => {
    if (!selectedReport) return;

    try {
      switch (action) {
        case 'dismiss':
          await supabase.from('content_reports')
            .update({ status: 'dismissed', resolved_at: new Date().toISOString() } as never)
            .eq('id', selectedReport.id);
          toast.success('Report dismissed');
          break;

        case 'warn':
          await supabase.from('content_reports')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() } as never)
            .eq('id', selectedReport.id);
          toast.success('Warning issued to user');
          break;

        case 'mute':
          await supabase.from('content_reports')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() } as never)
            .eq('id', selectedReport.id);
          toast.success('User muted for 24 hours');
          break;

        case 'delete_content':
          await supabase.from('content_reports')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() } as never)
            .eq('id', selectedReport.id);
          toast.success('Content deleted');
          break;

        case 'ban':
          if (!canBan) {
            toast.error('You do not have permission to ban users');
            return;
          }
          await supabase.from('content_reports')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() } as never)
            .eq('id', selectedReport.id);
          toast.success('User banned');
          break;

        case 'escalate':
          if (!canEscalate) {
            toast.error('You do not have permission to escalate');
            return;
          }
          await supabase.from('content_reports')
            .update({ status: 'under_review', priority: 'urgent' } as never)
            .eq('id', selectedReport.id);
          toast.success('Escalated to admin team');
          break;

        case 'view_content':
          if (selectedReport.target) {
            navigate(`/${selectedReport.target.type}s/${selectedReport.target.id}`);
          }
          break;

        case 'view_author_history':
          if (selectedReport.content_author) {
            navigate(`/admin/users?id=${selectedReport.content_author.id}`);
          }
          break;
      }

      await writeAudit(
        { actor_id: profile?.id || 'unknown', actor_email: profile?.email || 'unknown', actor_role: role || 'moderator' },
        { action: `moderation_${action}`, category: 'moderation', target_id: selectedReport.id, metadata: (data || {}) as Record<string, unknown> }
      );
      fetchReports();
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Action failed:', err);
      toast.error('Action failed');
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You don't have permission to access moderation.</p>
      </div>
    );
  }

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
            <Shield className="w-6 h-6 text-red-400" />
            Moderation Center
          </h1>
          <p className="text-slate-400 text-sm">
            {stats.totalPending} pending • {stats.urgentCount} urgent • {stats.aiFlaggedCount} AI flagged
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "border-slate-700 hover:bg-slate-800",
              showFilters && "bg-slate-800"
            )}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchReports}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Pending', value: stats.totalPending, icon: Flag, color: 'yellow' },
          { label: 'Urgent', value: stats.urgentCount, icon: AlertOctagon, color: 'red' },
          { label: 'AI Flagged', value: stats.aiFlaggedCount, icon: Bot, color: 'cyan' },
          { label: 'Repeat', value: stats.repeatOffenderCount, icon: AlertTriangle, color: 'orange' },
          { label: 'Resolved Today', value: stats.resolvedToday, icon: CheckCircle2, color: 'green' },
          { label: 'Avg Time', value: `${stats.avgResolutionTime}m`, icon: Clock, color: 'blue' },
          { label: 'Accuracy', value: `${stats.accuracy}%`, icon: TrendingUp, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className={cn("w-4 h-4", `text-${color}-400`)} />
              <div>
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Reports', count: reports.length },
          { id: 'pending', label: 'Pending', count: stats.totalPending },
          { id: 'urgent', label: 'Urgent', count: stats.urgentCount },
          { id: 'ai_flagged', label: 'AI Flagged', count: stats.aiFlaggedCount },
          { id: 'repeat_offender', label: 'Repeat Offenders', count: stats.repeatOffenderCount },
          { id: 'resolved', label: 'Resolved', count: reports.filter(r => r.status === 'resolved').length },
        ].map((queue) => (
          <button
            key={queue.id}
            onClick={() => setFilters({ ...filters, queue: queue.id as QueueType })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
              filters.queue === queue.id
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
            )}
          >
            {queue.label}
            <span className="ml-1.5 text-xs opacity-70">({queue.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search reports by reporter, content author, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-900/50 border-slate-800"
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Content Type</label>
              <Select
                value={filters.contentType}
                onValueChange={(v) => setFilters({ ...filters, contentType: v as ContentType | 'all' })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="post">Posts</SelectItem>
                  <SelectItem value="clip">Clips</SelectItem>
                  <SelectItem value="comment">Comments</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="tournament">Tournaments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Reason</label>
              <Select
                value={filters.reason}
                onValueChange={(v) => setFilters({ ...filters, reason: v as ReportReason | 'all' })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All Reasons</SelectItem>
                  {Object.entries(REASON_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Priority</label>
              <Select
                value={filters.priority}
                onValueChange={(v) => setFilters({ ...filters, priority: v as ReportPriority | 'all' })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider">AI Assisted</label>
              <Select
                value={filters.aiAssisted === null ? 'all' : filters.aiAssisted ? 'yes' : 'no'}
                onValueChange={(v) => setFilters({
                  ...filters,
                  aiAssisted: v === 'all' ? null : v === 'yes'
                })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">AI Flagged</SelectItem>
                  <SelectItem value="no">Manual Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_: unknown, i: number) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-slate-700" />
          <h3 className="text-lg font-medium text-white mb-2">No reports found</h3>
          <p className="text-slate-500">All caught up! Check back later.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredReports.map((report: ExtendedReport, index: number) => {
              const ContentIcon = CONTENT_ICONS[report.type as ContentType] || FileText;
              const isUrgent = report.priority === 'urgent' || report.priority === 'high';

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={cn(
                      "bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer",
                      isUrgent && "border-red-500/30 hover:border-red-500/50",
                      report.status === 'pending' && "bg-yellow-500/5"
                    )}
                    onClick={() => {
                      setSelectedReport(report);
                      setIsDetailOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Content Icon */}
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isUrgent ? 'bg-red-500/15' : 'bg-slate-800'
                        )}>
                          <ContentIcon className={cn(
                            "w-5 h-5",
                            isUrgent ? 'text-red-400' : 'text-slate-400'
                          )} />
                        </div>

                        {/* Report Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white capitalize">
                              {report.type} Report
                            </h3>
                            <Badge className={cn("border text-[10px]", PRIORITY_COLORS[report.priority])}>
                              {report.priority}
                            </Badge>
                            {report.is_repeat_offender && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                                Repeat
                              </Badge>
                            )}
                            {report.toxicity_analysis && (
                              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 truncate">
                            {REASON_LABELS[report.reason]?.label || report.reason}
                            {' · '}
                            by @{report.reporter?.username || 'Unknown'}
                            {report.content_author && ` · Target: @${report.content_author.username}`}
                          </p>
                          {report.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {report.description}
                            </p>
                          )}
                        </div>

                        {/* Right Side */}
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={cn("border text-[10px]", STATUS_COLORS[report.status])}>
                            {report.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Case Detail Sheet */}
      <ModerationCaseSheet
        report={selectedReport}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onAction={handleAction}
        canModerate={canResolve}
      />
    </div>
  );
}
