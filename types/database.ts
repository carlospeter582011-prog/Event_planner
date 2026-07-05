// ====================================================================
// Supabase Database Type Definitions
// ====================================================================
// Describes the shape of our Supabase PostgreSQL database for full
// type-safety with the Supabase client. Mirrors the schema defined in
// supabase/schema.sql.
// ====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "HOST" | "EDITOR" | "VIEWER";
export type ActivityStatus = "PROPOSED" | "CONFIRMED" | "CANCELLED";
export type PollStatus = "OPEN" | "CLOSED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          total_budget_cap: number;
          host_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          total_budget_cap?: number;
          host_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          total_budget_cap?: number;
          host_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      room_participants: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          role: Role;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          role?: Role;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          role?: Role;
          joined_at?: string;
        };
        Relationships: [];
      };
      days: {
        Row: {
          id: string;
          room_id: string;
          date: string;
          title: string;
          sequence_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          date: string;
          title?: string;
          sequence_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          date?: string;
          title?: string;
          sequence_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_blocks: {
        Row: {
          id: string;
          day_id: string;
          title: string;
          description: string | null;
          start_time: string | null;
          end_time: string | null;
          cost: number;
          location: string | null;
          status: ActivityStatus;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_id: string;
          title: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          cost?: number;
          location?: string | null;
          status?: ActivityStatus;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          day_id?: string;
          title?: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          cost?: number;
          location?: string | null;
          status?: ActivityStatus;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          activity_block_id: string;
          question: string;
          status: PollStatus;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          activity_block_id: string;
          question?: string;
          status?: PollStatus;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          activity_block_id?: string;
          question?: string;
          status?: PollStatus;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          option_text: string;
          sequence: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          option_text: string;
          sequence?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          option_text?: string;
          sequence?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          poll_option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          poll_option_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          room_id: string;
          activity_block_id: string | null;
          title: string;
          due_date: string | null;
          priority: TaskPriority;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          activity_block_id?: string | null;
          title: string;
          due_date?: string | null;
          priority?: TaskPriority;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          activity_block_id?: string | null;
          title?: string;
          due_date?: string | null;
          priority?: TaskPriority;
          is_completed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
