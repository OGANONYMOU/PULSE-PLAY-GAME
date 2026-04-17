export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined }
  | Json[];

type TournamentStatus   = 'upcoming' | 'ongoing' | 'completed';
type ParticipantStatus  = 'registered' | 'checked_in' | 'eliminated' | 'winner' | 'withdrawn';
type PostTag            = 'general' | 'tournament' | 'tips' | 'clips';
type UserRole           = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; username: string; email: string;
          first_name: string | null; last_name: string | null; phone: string | null;
          avatar_url: string | null; banner_url: string | null; bio: string | null;
          discord_username: string | null; twitter_username: string | null;
          role: UserRole; is_banned: boolean; ban_reason: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id: string; username: string; email: string;
          first_name?: string | null; last_name?: string | null; phone?: string | null;
          avatar_url?: string | null; banner_url?: string | null; bio?: string | null;
          discord_username?: string | null; twitter_username?: string | null;
          role?: UserRole; is_banned?: boolean; ban_reason?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          username?: string; email?: string; first_name?: string | null; last_name?: string | null;
          phone?: string | null; avatar_url?: string | null; banner_url?: string | null;
          bio?: string | null; discord_username?: string | null; twitter_username?: string | null;
          role?: UserRole; is_banned?: boolean; ban_reason?: string | null;
        };
      };
      games: {
        Row: {
          id: string; name: string; description: string; icon: string; image_url: string | null;
          badge: string | null; player_count: number; tournament_count: number;
          category: string; featured: boolean; created_at: string;
        };
        Insert: {
          id?: string; name: string; description: string; icon: string; image_url?: string | null;
          badge?: string | null; player_count?: number; tournament_count?: number;
          category: string; featured?: boolean;
        };
        Update: {
          name?: string; description?: string; icon?: string; image_url?: string | null;
          badge?: string | null; player_count?: number; tournament_count?: number;
          category?: string; featured?: boolean;
        };
      };
      tournaments: {
        Row: {
          id: string; name: string; game_id: string; status: TournamentStatus; date: string;
          prize_pool: string; max_players: number; current_players: number; duration: string;
          winner: string | null; description: string | null; rules: string | null;
          entry_fee: string | null; created_at: string;
        };
        Insert: {
          id?: string; name: string; game_id: string; status?: TournamentStatus; date: string;
          prize_pool: string; max_players: number; current_players?: number; duration: string;
          winner?: string | null; description?: string | null; rules?: string | null;
          entry_fee?: string | null;
        };
        Update: {
          name?: string; game_id?: string; status?: TournamentStatus; date?: string;
          prize_pool?: string; max_players?: number; current_players?: number; duration?: string;
          winner?: string | null; description?: string | null; rules?: string | null;
          entry_fee?: string | null;
        };
      };
      tournament_participants: {
        Row: {
          id: string; tournament_id: string; user_id: string; checked_in: boolean;
          checked_in_at: string | null; seed: number | null; status: ParticipantStatus;
          registered_at: string;
        };
        Insert: {
          id?: string; tournament_id: string; user_id: string; checked_in?: boolean;
          seed?: number | null; status?: ParticipantStatus;
        };
        Update: {
          checked_in?: boolean; checked_in_at?: string | null;
          seed?: number | null; status?: ParticipantStatus;
        };
      };
      posts: {
        Row: {
          id: string; author_id: string; title: string; content: string;
          tag: PostTag; likes: number; comments: number; created_at: string;
        };
        Insert: {
          id?: string; author_id: string; title: string; content: string;
          tag: PostTag; likes?: number; comments?: number;
        };
        Update: { title?: string; content?: string; tag?: PostTag; likes?: number; comments?: number };
      };
      post_likes: {
        Row: { id: string; post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string };
        Update: Record<string, never>;
      };
      post_comments: {
        Row: {
          id: string; post_id: string; author_id: string; content: string;
          created_at: string; updated_at: string;
        };
        Insert: { post_id: string; author_id: string; content: string };
        Update: { content?: string };
      };
      live_updates: {
        Row: { id: string; tournament_id: string; message: string; created_at: string };
        Insert: { tournament_id: string; message: string };
        Update: Record<string, never>;
      };
      audit_logs: {
        Row: {
          id: string; actor_id: string | null; action: string;
          target_type: string | null; target_id: string | null;
          meta: Json | null; created_at: string;
          ip_address: string | null; user_agent: string | null;
          severity: 'debug' | 'info' | 'warning' | 'critical';
          change_type: string | null; previous_value: Json | null; new_value: Json | null;
        };
        Insert: {
          actor_id?: string | null; action: string; target_type?: string | null;
          target_id?: string | null; meta?: Json | null;
          ip_address?: string | null; user_agent?: string | null;
          severity?: 'debug' | 'info' | 'warning' | 'critical';
          change_type?: string | null; previous_value?: Json | null; new_value?: Json | null;
        };
        Update: Record<string, never>;
      };
      organizers: {
        Row: {
          id: string; name: string; slug: string; description: string | null;
          avatar_url: string | null; banner_url: string | null; owner_id: string;
          visibility: 'public' | 'private' | 'unlisted';
          verified_status: 'unverified' | 'pending' | 'verified' | 'featured';
          website_url: string | null; twitter_url: string | null; discord_url: string | null;
          youtube_url: string | null; twitch_url: string | null;
          tournament_count: number; follower_count: number; total_prize_pool: number;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; name: string; slug: string; description?: string | null;
          avatar_url?: string | null; banner_url?: string | null; owner_id: string;
          visibility?: 'public' | 'private' | 'unlisted';
          verified_status?: 'unverified' | 'pending' | 'verified' | 'featured';
          website_url?: string | null; twitter_url?: string | null; discord_url?: string | null;
          youtube_url?: string | null; twitch_url?: string | null;
          tournament_count?: number; follower_count?: number; total_prize_pool?: number;
          created_at?: string; updated_at?: string;
        };
        Update: {
          name?: string; slug?: string; description?: string | null;
          avatar_url?: string | null; banner_url?: string | null;
          visibility?: 'public' | 'private' | 'unlisted';
          verified_status?: 'unverified' | 'pending' | 'verified' | 'featured';
          website_url?: string | null; twitter_url?: string | null; discord_url?: string | null;
          youtube_url?: string | null; twitch_url?: string | null;
          tournament_count?: number; follower_count?: number; total_prize_pool?: number;
          updated_at?: string;
        };
      };
      organizer_members: {
        Row: {
          id: string; organizer_id: string; user_id: string;
          role: 'member' | 'moderator' | 'manager' | 'co_host';
          can_host_tournaments: boolean; can_manage_staff: boolean; can_edit_branding: boolean;
          added_by: string | null; added_at: string;
        };
        Insert: {
          id?: string; organizer_id: string; user_id: string;
          role?: 'member' | 'moderator' | 'manager' | 'co_host';
          can_host_tournaments?: boolean; can_manage_staff?: boolean; can_edit_branding?: boolean;
          added_by?: string | null; added_at?: string;
        };
        Update: {
          role?: 'member' | 'moderator' | 'manager' | 'co_host';
          can_host_tournaments?: boolean; can_manage_staff?: boolean; can_edit_branding?: boolean;
        };
      };
      global_permissions: {
        Row: {
          id: string; user_id: string; granted_by: string;
          permission: 'host_tournaments' | 'moderate_content' | 'review_disputes' | 'manage_users' | 'access_audit_logs' | 'featured_host';
          scope_type: 'global' | 'organizer' | 'tournament';
          scope_id: string | null; is_active: boolean;
          granted_at: string; revoked_at: string | null; revoked_by: string | null; notes: string | null;
        };
        Insert: {
          id?: string; user_id: string; granted_by: string;
          permission: 'host_tournaments' | 'moderate_content' | 'review_disputes' | 'manage_users' | 'access_audit_logs' | 'featured_host';
          scope_type?: 'global' | 'organizer' | 'tournament';
          scope_id?: string | null; is_active?: boolean;
          granted_at?: string; revoked_at?: string | null; revoked_by?: string | null; notes?: string | null;
        };
        Update: {
          is_active?: boolean; revoked_at?: string | null; revoked_by?: string | null; notes?: string | null;
        };
      };
      tournament_staff: {
        Row: {
          id: string; tournament_id: string; user_id: string;
          role: 'host' | 'manager' | 'bracket_manager' | 'reporter' | 'referee' | 'streamer' | 'observer';
          added_by: string | null; added_at: string;
        };
        Insert: {
          id?: string; tournament_id: string; user_id: string;
          role: 'host' | 'manager' | 'bracket_manager' | 'reporter' | 'referee' | 'streamer' | 'observer';
          added_by?: string | null; added_at?: string;
        };
        Update: {
          role?: 'host' | 'manager' | 'bracket_manager' | 'reporter' | 'referee' | 'streamer' | 'observer';
        };
      };
      fixtures: {
        Row: {
          id: string; tournament_id: string; round_number: number; group_id: string | null;
          home_participant_id: string | null; away_participant_id: string | null;
          home_score: number | null; away_score: number | null;
          home_forfeit: boolean; away_forfeit: boolean;
          scheduled_at: string | null; played_at: string | null; venue: string | null;
          status: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
          notes: string | null; created_at: string;
        };
        Insert: {
          id?: string; tournament_id: string; round_number: number; group_id?: string | null;
          home_participant_id?: string | null; away_participant_id?: string | null;
          home_score?: number | null; away_score?: number | null;
          home_forfeit?: boolean; away_forfeit?: boolean;
          scheduled_at?: string | null; played_at?: string | null; venue?: string | null;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
          notes?: string | null; created_at?: string;
        };
        Update: {
          home_score?: number | null; away_score?: number | null;
          home_forfeit?: boolean; away_forfeit?: boolean;
          scheduled_at?: string | null; played_at?: string | null; venue?: string | null;
          status?: 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';
          notes?: string | null;
        };
      };
      player_stats: {
        Row: {
          id: string; tournament_id: string; user_id: string;
          matches_played: number; goals: number; assists: number; clean_sheets: number;
          yellow_cards: number; red_cards: number; mvp_count: number; updated_at: string;
        };
        Insert: {
          id?: string; tournament_id: string; user_id: string;
          matches_played?: number; goals?: number; assists?: number; clean_sheets?: number;
          yellow_cards?: number; red_cards?: number; mvp_count?: number; updated_at?: string;
        };
        Update: {
          matches_played?: number; goals?: number; assists?: number; clean_sheets?: number;
          yellow_cards?: number; red_cards?: number; mvp_count?: number; updated_at?: string;
        };
      };
      standings_snapshots: {
        Row: {
          id: string; tournament_id: string; group_id: string | null; round_number: number;
          user_id: string; position: number; played: number; wins: number; draws: number; losses: number;
          goals_for: number; goals_against: number; goal_difference: number; points: number;
          clean_sheets: number; form: string[] | null; snapshot_at: string;
        };
        Insert: {
          id?: string; tournament_id: string; group_id?: string | null; round_number: number;
          user_id: string; position: number; played?: number; wins?: number; draws?: number; losses?: number;
          goals_for?: number; goals_against?: number; goal_difference?: number; points?: number;
          clean_sheets?: number; form?: string[] | null; snapshot_at?: string;
        };
        Update: {
          position?: number; played?: number; wins?: number; draws?: number; losses?: number;
          goals_for?: number; goals_against?: number; goal_difference?: number; points?: number;
          clean_sheets?: number; form?: string[] | null;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      has_global_permission: {
        Args: { p_user_id: string; p_permission: string; p_scope_type?: string; p_scope_id?: string };
        Returns: boolean;
      };
      can_host_for_organizer: {
        Args: { p_user_id: string; p_organizer_id: string };
        Returns: boolean;
      };
      get_tournament_role: {
        Args: { p_user_id: string; p_tournament_id: string };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
  };
}

export type AnnouncementRow = {
  id: string; title: string; content: string; author_id: string | null; pinned: boolean;
  type: 'info' | 'warning' | 'success' | 'event'; is_active: boolean;
  created_at: string; updated_at: string;
};

export type Profile               = Database['public']['Tables']['profiles']['Row'];
export type Game                  = Database['public']['Tables']['games']['Row'];
export type Tournament            = Database['public']['Tables']['tournaments']['Row'];
export type TournamentParticipant = Database['public']['Tables']['tournament_participants']['Row'];
export type Post                  = Database['public']['Tables']['posts']['Row'];
export type PostLike              = Database['public']['Tables']['post_likes']['Row'];
export type PostComment           = Database['public']['Tables']['post_comments']['Row'];
export type AuditLog              = Database['public']['Tables']['audit_logs']['Row'];