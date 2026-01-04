// Generated types for Supabase schema
// These types are manually maintained to match the database schema in supabase/migrations/001_initial_schema.sql
// For production use, consider auto-generating with: `supabase gen types typescript --local > src/types/supabase.ts`
// Note: Keep this file in sync with any database schema changes

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      public_profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          timezone: string
          default_reminder_offset_minutes: number
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          timezone?: string
          default_reminder_offset_minutes?: number
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          timezone?: string
          default_reminder_offset_minutes?: number
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          title: string
          type: 'movie' | 'series' | 'episode' | 'video' | 'doc' | 'other'
          provider: 'youtube' | 'imdb' | 'netflix' | 'instagram' | 'facebook' | 'x' | 'generic'
          source_url: string | null
          canonical_url: string | null
          platform_label: string | null
          status: 'backlog' | 'scheduled' | 'watching' | 'done' | 'dropped'
          runtime_minutes: number | null
          release_year: number | null
          poster_url: string | null
          backdrop_url: string | null
          tags: string[]
          mood_tags: string[]
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          type: 'movie' | 'series' | 'episode' | 'video' | 'doc' | 'other'
          provider: 'youtube' | 'imdb' | 'netflix' | 'instagram' | 'facebook' | 'x' | 'generic'
          source_url?: string | null
          canonical_url?: string | null
          platform_label?: string | null
          status?: 'backlog' | 'scheduled' | 'watching' | 'done' | 'dropped'
          runtime_minutes?: number | null
          release_year?: number | null
          poster_url?: string | null
          backdrop_url?: string | null
          tags?: string[]
          mood_tags?: string[]
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          type?: 'movie' | 'series' | 'episode' | 'video' | 'doc' | 'other'
          provider?: 'youtube' | 'imdb' | 'netflix' | 'instagram' | 'facebook' | 'x' | 'generic'
          source_url?: string | null
          canonical_url?: string | null
          platform_label?: string | null
          status?: 'backlog' | 'scheduled' | 'watching' | 'done' | 'dropped'
          runtime_minutes?: number | null
          release_year?: number | null
          poster_url?: string | null
          backdrop_url?: string | null
          tags?: string[]
          mood_tags?: string[]
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          bookmark_id: string
          file_url: string
          file_type: string
          file_name: string
          size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bookmark_id: string
          file_url: string
          file_type: string
          file_name: string
          size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bookmark_id?: string
          file_url?: string
          file_type?: string
          file_name?: string
          size?: number | null
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          user_id: string
          bookmark_id: string
          scheduled_for: string
          reminder_offset_minutes: number
          state: 'scheduled' | 'fired' | 'snoozed' | 'cancelled'
          recurrence_rule: string | null
          recurrence_type: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bookmark_id: string
          scheduled_for: string
          reminder_offset_minutes?: number
          state?: 'scheduled' | 'fired' | 'snoozed' | 'cancelled'
          recurrence_rule?: string | null
          recurrence_type?: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bookmark_id?: string
          scheduled_for?: string
          reminder_offset_minutes?: number
          state?: 'scheduled' | 'fired' | 'snoozed' | 'cancelled'
          recurrence_rule?: string | null
          recurrence_type?: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' | null
          created_at?: string
          updated_at?: string
        }
      }
      schedule_occurrences: {
        Row: {
          id: string
          schedule_id: string
          user_id: string
          bookmark_id: string
          occurrence_date: string
          state: 'pending' | 'completed' | 'skipped' | 'cancelled'
          skipped_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          user_id: string
          bookmark_id: string
          occurrence_date: string
          state?: 'pending' | 'completed' | 'skipped' | 'cancelled'
          skipped_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          user_id?: string
          bookmark_id?: string
          occurrence_date?: string
          state?: 'pending' | 'completed' | 'skipped' | 'cancelled'
          skipped_at?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          bookmark_id: string | null
          schedule_id: string | null
          type: 'schedule_reminder' | 'plan_suggestion' | 'social_follow' | 'social_share' | 'system'
          title: string
          body: string
          action_url: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bookmark_id?: string | null
          schedule_id?: string | null
          type: 'schedule_reminder' | 'plan_suggestion' | 'social_follow' | 'social_share' | 'system'
          title: string
          body: string
          action_url?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bookmark_id?: string | null
          schedule_id?: string | null
          type?: 'schedule_reminder' | 'plan_suggestion' | 'social_follow' | 'social_share' | 'system'
          title?: string
          body?: string
          action_url?: string | null
          read_at?: string | null
          created_at?: string
        }
      }
      watch_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          preferred_days: number[]
          time_windows: Json
          max_runtime_minutes: number | null
          mood_tags: string[]
          platforms_allowed: string[]
          auto_suggest: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          preferred_days?: number[]
          time_windows?: Json
          max_runtime_minutes?: number | null
          mood_tags?: string[]
          platforms_allowed?: string[]
          auto_suggest?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          preferred_days?: number[]
          time_windows?: Json
          max_runtime_minutes?: number | null
          mood_tags?: string[]
          platforms_allowed?: string[]
          auto_suggest?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      watch_plan_bookmarks: {
        Row: {
          plan_id: string
          bookmark_id: string
          user_id: string
          position: number
          added_at: string
        }
        Insert: {
          plan_id: string
          bookmark_id: string
          user_id: string
          position?: number
          added_at?: string
        }
        Update: {
          plan_id?: string
          bookmark_id?: string
          user_id?: string
          position?: number
          added_at?: string
        }
      }
      user_follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      sharing_links: {
        Row: {
          id: string
          user_id: string
          token: string
          resource_type: 'bookmark' | 'plan' | 'profile'
          resource_id: string
          expires_at: string | null
          view_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token?: string
          resource_type: 'bookmark' | 'plan' | 'profile'
          resource_id: string
          expires_at?: string | null
          view_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          resource_type?: 'bookmark' | 'plan' | 'profile'
          resource_id?: string
          expires_at?: string | null
          view_count?: number
          created_at?: string
        }
      }
      bookmark_events: {
        Row: {
          id: string
          bookmark_id: string
          user_id: string
          event_type: 'created' | 'updated' | 'status_changed' | 'deleted'
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          bookmark_id: string
          user_id: string
          event_type: 'created' | 'updated' | 'status_changed' | 'deleted'
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          bookmark_id?: string
          user_id?: string
          event_type?: 'created' | 'updated' | 'status_changed' | 'deleted'
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
      }
      enrich_cache: {
        Row: {
          id: string
          url_hash: string
          url: string
          metadata: Json
          provider: string
          cached_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          url_hash: string
          url: string
          metadata: Json
          provider: string
          cached_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          url_hash?: string
          url?: string
          metadata?: Json
          provider?: string
          cached_at?: string
          expires_at?: string
        }
      }
      bookmark_show_history: {
        Row: {
          id: string
          user_id: string
          bookmark_id: string
          shown_at: string
          shown_in: string
        }
        Insert: {
          id?: string
          user_id: string
          bookmark_id: string
          shown_at?: string
          shown_in: string
        }
        Update: {
          id?: string
          user_id?: string
          bookmark_id?: string
          shown_at?: string
          shown_in?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
