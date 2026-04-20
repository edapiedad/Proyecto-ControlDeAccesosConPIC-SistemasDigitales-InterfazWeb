// ============================================
// Database type definitions for Supabase tables
// ============================================

export type AccessStatus = 'GRANTED' | 'DENIED' | 'ANOMALY';

export interface User {
  id: string;
  name: string;
  rfid_tag: string;
  role: string;
  created_at: string;
}

export interface AccessLog {
  id: string;
  user_id: string | null;
  rfid_tag_used: string;
  timestamp: string;
  status: AccessStatus;
  // Joined field (optional, from queries with joins)
  users?: Pick<User, 'name'> | null;
}

export interface TelegramAuthorizedUser {
  id: string;
  telegram_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

// API request/response types
export interface AccessRequest {
  rfid_tag: string;
}

export interface AccessResponse {
  status: AccessStatus;
  user_name: string | null;
  timestamp: string;
}

// Database schema type for Supabase client
// Matches the expected shape for @supabase/supabase-js v2 generics
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          rfid_tag: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          rfid_tag: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          rfid_tag?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      access_logs: {
        Row: {
          id: string;
          user_id: string | null;
          rfid_tag_used: string;
          timestamp: string;
          status: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          rfid_tag_used: string;
          timestamp?: string;
          status: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          rfid_tag_used?: string;
          timestamp?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'access_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      telegram_authorized_users: {
        Row: {
          id: string;
          telegram_id: number;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          telegram_id: number;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          telegram_id?: number;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          telegram_id: number | null;
          full_name: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          telegram_id?: number | null;
          full_name?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          telegram_id?: number | null;
          full_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      invitations: {
        Row: {
          id: string;
          token: string;
          is_used: boolean;
          expires_at: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          token: string;
          is_used?: boolean;
          expires_at?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          token?: string;
          is_used?: boolean;
          expires_at?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
