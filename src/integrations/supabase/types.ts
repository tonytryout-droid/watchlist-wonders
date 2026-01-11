export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          bookmark_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          size: number | null
          user_id: string
        }
        Insert: {
          bookmark_id: string
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          size?: number | null
          user_id: string
        }
        Update: {
          bookmark_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          size?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_bookmark_id_fkey"
            columns: ["bookmark_id"]
            isOneToOne: false
            referencedRelation: "bookmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          backdrop_url: string | null
          canonical_url: string | null
          created_at: string
          id: string
          last_shown_at: string | null
          metadata: Json | null
          mood_tags: string[] | null
          notes: string | null
          platform_label: string | null
          poster_url: string | null
          provider: string
          release_year: number | null
          runtime_minutes: number | null
          shown_count: number | null
          source_url: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backdrop_url?: string | null
          canonical_url?: string | null
          created_at?: string
          id?: string
          last_shown_at?: string | null
          metadata?: Json | null
          mood_tags?: string[] | null
          notes?: string | null
          platform_label?: string | null
          poster_url?: string | null
          provider?: string
          release_year?: number | null
          runtime_minutes?: number | null
          shown_count?: number | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backdrop_url?: string | null
          canonical_url?: string | null
          created_at?: string
          id?: string
          last_shown_at?: string | null
          metadata?: Json | null
          mood_tags?: string[] | null
          notes?: string | null
          platform_label?: string | null
          poster_url?: string | null
          provider?: string
          release_year?: number | null
          runtime_minutes?: number | null
          shown_count?: number | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_connections: {
        Row: {
          access_token: string
          account_name: string | null
          account_username: string | null
          created_at: string
          id: string
          meta_user_id: string
          platform: string
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          account_username?: string | null
          created_at?: string
          id?: string
          meta_user_id: string
          platform: string
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          account_username?: string | null
          created_at?: string
          id?: string
          meta_user_id?: string
          platform?: string
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          bookmark_id: string | null
          created_at: string
          id: string
          read_at: string | null
          schedule_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          bookmark_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          schedule_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          bookmark_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          schedule_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_bookmark_id_fkey"
            columns: ["bookmark_id"]
            isOneToOne: false
            referencedRelation: "bookmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          bookmark_id: string
          created_at: string
          id: string
          reminder_offset_minutes: number | null
          scheduled_for: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bookmark_id: string
          created_at?: string
          id?: string
          reminder_offset_minutes?: number | null
          scheduled_for: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bookmark_id?: string
          created_at?: string
          id?: string
          reminder_offset_minutes?: number | null
          scheduled_for?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_bookmark_id_fkey"
            columns: ["bookmark_id"]
            isOneToOne: false
            referencedRelation: "bookmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_plan_bookmarks: {
        Row: {
          bookmark_id: string
          plan_id: string
          position: number | null
          user_id: string
        }
        Insert: {
          bookmark_id: string
          plan_id: string
          position?: number | null
          user_id: string
        }
        Update: {
          bookmark_id?: string
          plan_id?: string
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_plan_bookmarks_bookmark_id_fkey"
            columns: ["bookmark_id"]
            isOneToOne: false
            referencedRelation: "bookmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_plan_bookmarks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "watch_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_plans: {
        Row: {
          auto_suggest: boolean | null
          created_at: string
          description: string | null
          id: string
          max_runtime_minutes: number | null
          mood_tags: string[] | null
          name: string
          platforms_allowed: string[] | null
          preferred_days: number[] | null
          time_windows: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_suggest?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          max_runtime_minutes?: number | null
          mood_tags?: string[] | null
          name: string
          platforms_allowed?: string[] | null
          preferred_days?: number[] | null
          time_windows?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_suggest?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          max_runtime_minutes?: number | null
          mood_tags?: string[] | null
          name?: string
          platforms_allowed?: string[] | null
          preferred_days?: number[] | null
          time_windows?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      meta_connections_safe: {
        Row: {
          account_name: string | null
          account_username: string | null
          created_at: string | null
          id: string | null
          meta_user_id: string | null
          platform: string | null
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_username?: string | null
          created_at?: string | null
          id?: string | null
          meta_user_id?: string | null
          platform?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_username?: string | null
          created_at?: string | null
          id?: string | null
          meta_user_id?: string | null
          platform?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_meta_access_token: {
        Args: { connection_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
