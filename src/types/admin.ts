// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Admin System - Core Types
// Professional esports operations console type definitions
// ═══════════════════════════════════════════════════════════════════════════════


// ── RBAC System ───────────────────────────────────────────────────────────────

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'TOURNAMENT_HOST' | 'CLUB_LEADER';

export type PermissionScope = 'global' | 'organizer' | 'tournament' | 'community';

export type AdminPermission =
  // User Management
  | 'users.view' | 'users.manage' | 'users.ban' | 'users.suspend'
  // Game Management
  | 'games.view' | 'games.manage' | 'games.create' | 'games.delete'
  // Tournament Management
  | 'tournaments.view' | 'tournaments.create' | 'tournaments.edit' | 'tournaments.delete'
  | 'tournaments.approve' | 'tournaments.override_results'
  // Community Management
  | 'community.view' | 'community.moderate' | 'community.feature' | 'community.delete'
  // Moderation
  | 'moderation.view' | 'moderation.resolve' | 'moderation.escalate' | 'moderation.ban'
  // Permissions
  | 'permissions.view' | 'permissions.grant' | 'permissions.revoke'
  // Analytics
  | 'analytics.view' | 'analytics.export'
  // System
  | 'system.view' | 'system.configure' | 'system.audit';

export interface RoleDefinition {
  role: AdminRole;
  name: string;
  description: string;
  permissions: AdminPermission[];
  color: string;
  icon: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission: AdminPermission;
  scope_type: PermissionScope;
  scope_id: string | null;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
}

// ── User Risk & Profile ──────────────────────────────────────────────────────

export interface UserRiskProfile {
  user_id: string;
  risk_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: RiskFlag[];
  last_assessed: string;
  factors: RiskFactor[];
}

export interface RiskFlag {
  id: string;
  type: 'suspicious_activity' | 'multiple_reports' | 'ban_evasion' | 'fraud' | 'harassment' | 'spam';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface RiskFactor {
  type: string;
  weight: number;
  description: string;
  evidence: Record<string, unknown>;
}

export interface UserDeviceInfo {
  fingerprint: string;
  user_agent: string;
  ip_hash: string; // Hashed for privacy
  last_seen: string;
  is_suspicious: boolean;
}

export interface UserModerationHistory {
  user_id: string;
  total_reports_received: number;
  total_reports_filed: number;
  warnings_count: number;
  mutes_count: number;
  bans_count: number;
  last_action_at: string | null;
  action_history: ModerationAction[];
}

export interface ModerationAction {
  id: string;
  action_type: 'warn' | 'mute' | 'ban' | 'unban' | 'delete_content';
  reason: string;
  duration?: number; // minutes, null = permanent
  moderator_id: string;
  moderator_name: string;
  created_at: string;
  evidence: string | null;
}

export interface EsportsPassport {
  user_id: string;
  gamercred_score: number;
  rank: string;
  tournaments_played: number;
  tournaments_won: number;
  matches_played: number;
  win_rate: number;
  favorite_games: string[];
  teams: string[];
  achievements: UserAchievement[];
  reputation: UserReputation;
}

export interface UserAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserReputation {
  overall: number; // 0-100
  sportsmanship: number;
  skill: number;
  activity: number;
  community: number;
}

// ── Tournament Health & Management ────────────────────────────────────────────

export type TournamentHealthStatus = 'healthy' | 'warning' | 'critical' | 'suspended';
export type TournamentDisputeStatus = 'none' | 'pending' | 'resolved';
export type FraudRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface TournamentHealth {
  tournament_id: string;
  status: TournamentHealthStatus;
  participant_fill_rate: number; // 0-100
  check_in_rate: number; // 0-100
  dispute_count: number;
  pending_reports: number;
  fraud_risk: FraudRiskLevel;
  last_assessed: string;
  indicators: HealthIndicator[];
}

export interface HealthIndicator {
  type: 'participation' | 'engagement' | 'disputes' | 'fraud' | 'timing';
  status: 'good' | 'warning' | 'critical';
  message: string;
  value: number;
}

export interface TournamentDispute {
  id: string;
  tournament_id: string;
  match_id: string | null;
  reporter_id: string;
  reporter_name: string;
  reported_id: string | null;
  type: 'cheating' | 'harassment' | 'no_show' | 'disputed_result' | 'other';
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  evidence: string[];
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ── Content Management ───────────────────────────────────────────────────────

export type ContentType = 'post' | 'clip' | 'comment' | 'discussion';
export type ContentStatus = 'active' | 'hidden' | 'deleted' | 'featured' | 'pinned';

export interface ContentItem {
  id: string;
  type: ContentType;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  media_url: string | null;
  status: ContentStatus;
  engagement: ContentEngagement;
  moderation: ContentModeration;
  created_at: string;
  updated_at: string;
}

export interface ContentEngagement {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface ContentModeration {
  is_flagged: boolean;
  flag_reason: string | null;
  toxicity_score: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface TrendingControl {
  content_id: string;
  is_manually_featured: boolean;
  featured_by: string | null;
  featured_at: string | null;
  featured_until: string | null;
  boost_factor: number; // 1.0 = normal, >1.0 = boosted
}

// ── Moderation System ─────────────────────────────────────────────────────────

export type ReportType = 'user' | 'content' | 'clip' | 'match' | 'tournament';
export type ReportReason = 
  | 'harassment' | 'cheating' | 'spam' | 'inappropriate_content' 
  | 'hate_speech' | 'impersonation' | 'scam' | 'other';
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';
export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Report {
  id: string;
  type: ReportType;
  reason: ReportReason;
  status: ReportStatus;
  priority: ReportPriority;
  reporter: ReportUser;
  target: ReportTarget;
  description: string;
  evidence: string[];
  assigned_to: string | null;
  resolution: ReportResolution | null;
  created_at: string;
  updated_at: string;
}

export interface ReportUser {
  id: string;
  username: string;
  avatar_url: string | null;
  risk_level: UserRiskProfile['risk_level'];
}

export interface ReportTarget {
  id: string;
  type: ReportType;
  title: string;
  content: string | null;
  author: ReportUser;
}

export interface ReportResolution {
  action: 'warn' | 'mute' | 'ban' | 'delete_content' | 'dismiss' | 'escalate';
  reason: string;
  moderator_id: string;
  moderator_name: string;
  created_at: string;
  duration?: number; // minutes for mute/ban
}

export interface ToxicityAnalysis {
  content_id: string;
  toxicity_score: number; // 0-100
  severity: 'none' | 'low' | 'medium' | 'high' | 'severe';
  flagged_words: string[];
  categories: ToxicityCategory[];
  ai_confidence: number;
}

export interface ToxicityCategory {
  name: 'hate' | 'harassment' | 'spam' | 'sexual' | 'violence' | 'self_harm';
  score: number;
}

export interface RepeatOffender {
  user_id: string;
  username: string;
  report_count: number;
  warning_count: number;
  mute_count: number;
  ban_count: number;
  last_offense_at: string;
  offense_trend: 'improving' | 'stable' | 'worsening';
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  users: UserMetrics;
  tournaments: TournamentMetrics;
  community: CommunityMetrics;
  moderation: ModerationMetrics;
  system: SystemMetrics;
}

export interface UserMetrics {
  total: number;
  active_today: number;
  active_this_week: number;
  new_today: number;
  new_this_week: number;
  retention_rate: number;
  top_regions: RegionMetric[];
  growth_trend: TrendData[];
}

export interface TournamentMetrics {
  total_active: number;
  live_now: number;
  pending_approval: number;
  completed_this_week: number;
  total_participants: number;
  avg_participants: number;
  top_games: GameMetric[];
  fill_rates: TrendData[];
}

export interface CommunityMetrics {
  posts_today: number;
  clips_today: number;
  comments_today: number;
  total_content: number;
  engagement_rate: number;
  trending_topics: string[];
  top_creators: CreatorMetric[];
}

export interface ModerationMetrics {
  pending_reports: number;
  resolved_today: number;
  avg_resolution_time: number; // minutes
  escalation_rate: number;
  repeat_offenders: number;
  toxicity_trend: TrendData[];
}

export interface SystemMetrics {
  uptime: number; // percentage
  response_time: number; // ms
  error_rate: number;
  active_connections: number;
  queue_depth: number;
}

export interface RegionMetric {
  region: string;
  user_count: number;
  tournament_count: number;
  engagement_score: number;
}

export interface GameMetric {
  game_id: string;
  game_name: string;
  tournament_count: number;
  participant_count: number;
  popularity_score: number;
}

export interface CreatorMetric {
  user_id: string;
  username: string;
  content_count: number;
  engagement_score: number;
  follower_count: number;
}

export interface TrendData {
  date: string;
  value: number;
  change_percent: number;
}

// ── Audit Log ──────────────────────────────────────────────────────────────────

export type AuditActionCategory = 
  | 'user' | 'game' | 'tournament' | 'community' | 'moderation' 
  | 'permission' | 'system' | 'auth';

export type AuditActionSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: AuditActor;
  action: AuditAction;
  target: AuditTarget;
  changes: AuditChange[];
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditActor {
  id: string;
  username: string;
  role: AdminRole;
  session_id: string | null;
}

export interface AuditAction {
  category: AuditActionCategory;
  type: string;
  description: string;
  severity: AuditActionSeverity;
}

export interface AuditTarget {
  type: string;
  id: string;
  name: string;
}

export interface AuditChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface AuditFilter {
  categories?: AuditActionCategory[];
  severity?: AuditActionSeverity[];
  actor_id?: string;
  target_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// ── Activity & Notifications ─────────────────────────────────────────────────

export interface AdminActivity {
  id: string;
  type: 'user_report' | 'tournament_created' | 'dispute_filed' | 'moderation_action' | 'system_alert';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actor: ReportUser | null;
  target: ReportTarget | null;
  created_at: string;
  is_read: boolean;
}

export interface SystemAlert {
  id: string;
  type: 'performance' | 'security' | 'error_spike' | 'suspicious_activity' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  permission: AdminPermission;
  href?: string;
  action?: () => void;
  shortcut?: string;
}

// ── Global Search ─────────────────────────────────────────────────────────────

export type SearchResultType = 'user' | 'tournament' | 'post' | 'clip' | 'game' | 'report' | 'team' | 'club';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  image_url: string | null;
  status: string | null;
  metadata: Record<string, string | number>;
  updated_at: string;
}

export interface SearchFilters {
  types?: SearchResultType[];
  status?: string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  target_roles: AdminRole[];
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

// ── Game Management ───────────────────────────────────────────────────────────

export interface GameDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  category: 'esports' | 'football' | 'mobile' | 'console' | 'pc';
  supported_formats: TournamentFormat[];
  is_active: boolean;
  popularity_rank: number;
  tournament_count: number;
  player_count: number;
  created_at: string;
  updated_at: string;
}

export interface TournamentFormat {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_enabled: boolean;
  max_players: number;
  min_players: number;
  duration_estimate: string;
}
