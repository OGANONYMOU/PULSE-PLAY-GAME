// ═══════════════════════════════════════════════════════════════════════════════
// PulsePlay Database Types
// Generated types for Supabase tables
// ═══════════════════════════════════════════════════════════════════════════════

export type Database = {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          game_id: string;
          format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
          status: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled';
          max_participants: number;
          registration_start: string | null;
          registration_end: string | null;
          start_date: string;
          end_date: string | null;
          organizer_id: string;
          winner_id: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          is_public: boolean;
          requires_approval: boolean;
          has_check_in: boolean;
          check_in_window: number;
          rules: string | null;
          prize_pool: number | null;
          ruleset_id: string | null;
          allow_scrims: boolean;
          bracket_type: string | null;
          manual_seeding: boolean;
          registration_questions: Json | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          game_id: string;
          format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
          status?: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled';
          max_participants?: number;
          registration_start?: string | null;
          registration_end?: string | null;
          start_date: string;
          end_date?: string | null;
          organizer_id: string;
          winner_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_public?: boolean;
          requires_approval?: boolean;
          has_check_in?: boolean;
          check_in_window?: number;
          rules?: string | null;
          prize_pool?: number | null;
          ruleset_id?: string | null;
          allow_scrims?: boolean;
          bracket_type?: string | null;
          manual_seeding?: boolean;
          registration_questions?: Json | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          game_id?: string;
          format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
          status?: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled';
          max_participants?: number;
          registration_start?: string | null;
          registration_end?: string | null;
          start_date?: string;
          end_date?: string | null;
          organizer_id?: string;
          winner_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_public?: boolean;
          requires_approval?: boolean;
          has_check_in?: boolean;
          check_in_window?: number;
          rules?: string | null;
          prize_pool?: number | null;
          ruleset_id?: string | null;
          allow_scrims?: boolean;
          bracket_type?: string | null;
          manual_seeding?: boolean;
          registration_questions?: Json | null;
        };
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          round: number;
          match_number: number;
          bracket_type: 'winners' | 'losers' | 'finals';
          player1_id: string | null;
          player2_id: string | null;
          winner_id: string | null;
          score_player1: number | null;
          score_player2: number | null;
          status: 'pending' | 'in_progress' | 'completed' | 'disputed';
          scheduled_at: string | null;
          completed_at: string | null;
          next_match_id: string | null;
          next_match_position: string | null;
          created_at: string;
          updated_at: string;
          is_bye: boolean;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          round: number;
          match_number: number;
          bracket_type?: 'winners' | 'losers' | 'finals';
          player1_id?: string | null;
          player2_id?: string | null;
          winner_id?: string | null;
          score_player1?: number | null;
          score_player2?: number | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'disputed';
          scheduled_at?: string | null;
          completed_at?: string | null;
          next_match_id?: string | null;
          next_match_position?: string | null;
          created_at?: string;
          updated_at?: string;
          is_bye?: boolean;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          round?: number;
          match_number?: number;
          bracket_type?: 'winners' | 'losers' | 'finals';
          player1_id?: string | null;
          player2_id?: string | null;
          winner_id?: string | null;
          score_player1?: number | null;
          score_player2?: number | null;
          status?: 'pending' | 'in_progress' | 'completed' | 'disputed';
          scheduled_at?: string | null;
          completed_at?: string | null;
          next_match_id?: string | null;
          next_match_position?: string | null;
          created_at?: string;
          updated_at?: string;
          is_bye?: boolean;
        };
      };
      fraud_flags: {
        Row: {
          id: string;
          tournament_id: string;
          match_id: string | null;
          user_id: string | null;
          flag_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          status: 'open' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved';
          evidence: Json | null;
          notes: string | null;
          confidence_score: number;
          detected_at: string;
          investigated_by: string | null;
          investigated_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          match_id?: string | null;
          user_id?: string | null;
          flag_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          status?: 'open' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved';
          evidence?: Json | null;
          notes?: string | null;
          confidence_score: number;
          detected_at?: string;
          investigated_by?: string | null;
          investigated_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          match_id?: string | null;
          user_id?: string | null;
          flag_type?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          status?: 'open' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved';
          evidence?: Json | null;
          notes?: string | null;
          confidence_score?: number;
          detected_at?: string;
          investigated_by?: string | null;
          investigated_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          actor_role: string;
          action: string;
          category: string;
          target_type: string;
          target_id: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          context: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          actor_role: string;
          action: string;
          category: string;
          target_type: string;
          target_id: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          context?: Json | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          role: 'user' | 'moderator' | 'admin' | 'superadmin';
          avatar_url: string | null;
          gamertag: string | null;
          is_active: boolean;
          email_verified: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          media_url: string | null;
          media_type: string | null;
          status: 'active' | 'hidden' | 'removed' | 'featured' | 'pinned';
          type: 'post' | 'clip' | 'comment';
          views: number;
          shares: number;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
