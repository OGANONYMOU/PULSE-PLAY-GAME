export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined }
  | Json[];

type TournamentStatus   = 'upcoming' | 'ongoing' | 'completed';
type ParticipantStatus  = 'registered' | 'checked_in' | 'eliminated' | 'winner' | 'withdrawn';
type PostTag            = 'general' | 'tournament' | 'tips' | 'clips';
type UserRole           = 'USER' | 'ADMIN' | 'MODERATOR';

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
        };
        Insert: {
          actor_id?: string | null; action: string; target_type?: string | null;
          target_id?: string | null; meta?: Json | null;
        };
        Update: Record<string, never>;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
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