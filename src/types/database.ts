export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          discord_username: string | null;
          twitter_username: string | null;
          role: 'USER' | 'ADMIN' | 'MODERATOR';
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          discord_username?: string | null;
          twitter_username?: string | null;
          role?: 'USER' | 'ADMIN' | 'MODERATOR';
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          discord_username?: string | null;
          twitter_username?: string | null;
          role?: 'USER' | 'ADMIN' | 'MODERATOR';
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          badge: string | null;
          player_count: number;
          tournament_count: number;
          category: string;
          featured: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          icon: string;
          badge?: string | null;
          player_count?: number;
          tournament_count?: number;
          category: string;
          featured?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          icon?: string;
          badge?: string | null;
          player_count?: number;
          tournament_count?: number;
          category?: string;
          featured?: boolean;
          created_at?: string;
        };
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          game_id: string;
          status: 'upcoming' | 'ongoing' | 'completed';
          date: string;
          prize_pool: string;
          max_players: number;
          current_players: number;
          duration: string;
          winner: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          game_id: string;
          status: 'upcoming' | 'ongoing' | 'completed';
          date: string;
          prize_pool: string;
          max_players: number;
          current_players?: number;
          duration: string;
          winner?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          game_id?: string;
          status?: 'upcoming' | 'ongoing' | 'completed';
          date?: string;
          prize_pool?: string;
          max_players?: number;
          current_players?: number;
          duration?: string;
          winner?: string | null;
          created_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          tag: 'general' | 'tournament' | 'tips' | 'clips';
          likes: number;
          comments: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content: string;
          tag: 'general' | 'tournament' | 'tips' | 'clips';
          likes?: number;
          comments?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          content?: string;
          tag?: 'general' | 'tournament' | 'tips' | 'clips';
          likes?: number;
          comments?: number;
          created_at?: string;
        };
      };
      live_updates: {
        Row: {
          id: string;
          tournament_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          message?: string;
          created_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          type: 'info' | 'warning' | 'success' | 'event';
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          type?: 'info' | 'warning' | 'success' | 'event';
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          type?: 'info' | 'warning' | 'success' | 'event';
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
  };
}

export type GameRow = Database['public']['Tables']['games']['Row'];
export type TournamentRow = Database['public']['Tables']['tournaments']['Row'];
export type PostRow = Database['public']['Tables']['posts']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];