-- WatchMarks Database Schema
-- Complete schema for Phase 1-4 implementation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Public Profiles (accessible info about users)
CREATE TABLE public_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'Africa/Gaborone',
  default_reminder_offset_minutes INTEGER DEFAULT 30,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Bookmarks (core content)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('movie', 'series', 'episode', 'video', 'doc', 'other')),
  provider TEXT NOT NULL CHECK (provider IN ('youtube', 'imdb', 'netflix', 'instagram', 'facebook', 'x', 'generic')),
  source_url TEXT,
  canonical_url TEXT,
  platform_label TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'scheduled', 'watching', 'done', 'dropped')),
  runtime_minutes INTEGER,
  release_year INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  tags TEXT[] DEFAULT '{}',
  mood_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments (storage references)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Scheduling System
-- ============================================================================

-- Schedules (one-time and recurring rules)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  reminder_offset_minutes INTEGER DEFAULT 30,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fired', 'snoozed', 'cancelled')),
  recurrence_rule TEXT, -- RRULE format for recurring schedules
  recurrence_type TEXT CHECK (recurrence_type IN ('once', 'daily', 'weekly', 'monthly', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule Occurrences (generated instances)
CREATE TABLE schedule_occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  occurrence_date TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'completed', 'skipped', 'cancelled')),
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Notifications
-- ============================================================================

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('schedule_reminder', 'plan_suggestion', 'social_follow', 'social_share', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Watch Plans
-- ============================================================================

-- Watch Plans
CREATE TABLE watch_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  preferred_days INTEGER[] DEFAULT '{}', -- 0=Sunday, 6=Saturday
  time_windows JSONB DEFAULT '[]', -- [{start: "19:00", end: "22:00"}]
  max_runtime_minutes INTEGER,
  mood_tags TEXT[] DEFAULT '{}',
  platforms_allowed TEXT[] DEFAULT '{}',
  auto_suggest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watch Plan Bookmarks (junction table)
CREATE TABLE watch_plan_bookmarks (
  plan_id UUID NOT NULL REFERENCES watch_plans(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (plan_id, bookmark_id)
);

-- ============================================================================
-- Social Features
-- ============================================================================

-- User Follows (social graph)
CREATE TABLE user_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Sharing Links (public share tokens)
CREATE TABLE sharing_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('bookmark', 'plan', 'profile')),
  resource_id UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Optional Tables (for enhanced features)
-- ============================================================================

-- Bookmark Events (audit trail)
CREATE TABLE bookmark_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'status_changed', 'deleted')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrichment Cache (URL metadata cache)
CREATE TABLE enrich_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url_hash TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  metadata JSONB NOT NULL,
  provider TEXT NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Bookmark Show History (for Tonight pick anti-repeat)
CREATE TABLE bookmark_show_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  shown_in TEXT NOT NULL -- 'tonight_pick', 'dashboard_hero', etc.
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Bookmarks indexes
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_user_status ON bookmarks(user_id, status);
CREATE INDEX idx_bookmarks_user_provider ON bookmarks(user_id, provider);
CREATE INDEX idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_bookmarks_runtime ON bookmarks(runtime_minutes) WHERE runtime_minutes IS NOT NULL;
CREATE INDEX idx_bookmarks_scheduled ON bookmarks(user_id) WHERE status = 'scheduled';

-- Full-text search index for bookmarks
CREATE INDEX idx_bookmarks_search ON bookmarks USING GIN (to_tsvector('english', title || ' ' || COALESCE(notes, '')));

-- Schedules indexes
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_bookmark_id ON schedules(bookmark_id);
CREATE INDEX idx_schedules_scheduled_for ON schedules(scheduled_for);
CREATE INDEX idx_schedules_user_upcoming ON schedules(user_id, scheduled_for) WHERE state = 'scheduled';

-- Schedule Occurrences indexes
CREATE INDEX idx_occurrences_schedule_id ON schedule_occurrences(schedule_id);
CREATE INDEX idx_occurrences_user_date ON schedule_occurrences(user_id, occurrence_date);
CREATE INDEX idx_occurrences_pending ON schedule_occurrences(user_id, occurrence_date) WHERE state = 'pending';

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- Attachments indexes
CREATE INDEX idx_attachments_bookmark_id ON attachments(bookmark_id);
CREATE INDEX idx_attachments_user_id ON attachments(user_id);

-- Watch Plans indexes
CREATE INDEX idx_watch_plans_user_id ON watch_plans(user_id);

-- Watch Plan Bookmarks indexes
CREATE INDEX idx_plan_bookmarks_plan ON watch_plan_bookmarks(plan_id);
CREATE INDEX idx_plan_bookmarks_bookmark ON watch_plan_bookmarks(bookmark_id);

-- Social indexes
CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);
CREATE INDEX idx_sharing_token ON sharing_links(token);
CREATE INDEX idx_sharing_user ON sharing_links(user_id, resource_type);

-- Cache indexes
CREATE INDEX idx_enrich_cache_expires ON enrich_cache(expires_at);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_plan_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmark_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrich_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmark_show_history ENABLE ROW LEVEL SECURITY;

-- Public Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public_profiles FOR SELECT
  USING (is_public = true OR id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public_profiles FOR UPDATE
  USING (id = auth.uid());

-- Bookmarks policies
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- Bookmarks can be viewed via sharing links (separate query, not RLS)

-- Attachments policies
CREATE POLICY "Users can view their own attachments"
  ON attachments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own attachments"
  ON attachments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own attachments"
  ON attachments FOR DELETE
  USING (user_id = auth.uid());

-- Schedules policies
CREATE POLICY "Users can view their own schedules"
  ON schedules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own schedules"
  ON schedules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own schedules"
  ON schedules FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own schedules"
  ON schedules FOR DELETE
  USING (user_id = auth.uid());

-- Schedule Occurrences policies
CREATE POLICY "Users can view their own occurrences"
  ON schedule_occurrences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own occurrences"
  ON schedule_occurrences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own occurrences"
  ON schedule_occurrences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own occurrences"
  ON schedule_occurrences FOR DELETE
  USING (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Service role will handle this

-- Watch Plans policies
CREATE POLICY "Users can view their own plans"
  ON watch_plans FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own plans"
  ON watch_plans FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own plans"
  ON watch_plans FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own plans"
  ON watch_plans FOR DELETE
  USING (user_id = auth.uid());

-- Watch Plan Bookmarks policies
CREATE POLICY "Users can view their own plan bookmarks"
  ON watch_plan_bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own plan bookmarks"
  ON watch_plan_bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own plan bookmarks"
  ON watch_plan_bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- User Follows policies
CREATE POLICY "Users can view all follows"
  ON user_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON user_follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow others"
  ON user_follows FOR DELETE
  USING (follower_id = auth.uid());

-- Sharing Links policies
CREATE POLICY "Users can view their own sharing links"
  ON sharing_links FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create sharing links"
  ON sharing_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sharing links"
  ON sharing_links FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sharing links"
  ON sharing_links FOR DELETE
  USING (user_id = auth.uid());

-- Bookmark Events policies
CREATE POLICY "Users can view their own bookmark events"
  ON bookmark_events FOR SELECT
  USING (user_id = auth.uid());

-- Enrich Cache policies (read by all authenticated users, write by service)
CREATE POLICY "Authenticated users can read cache"
  ON enrich_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can write cache"
  ON enrich_cache FOR INSERT
  WITH CHECK (true);

-- Bookmark Show History policies
CREATE POLICY "Users can view their own show history"
  ON bookmark_show_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own show history"
  ON bookmark_show_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_bookmarks_updated_at BEFORE UPDATE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_public_profiles_updated_at BEFORE UPDATE ON public_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watch_plans_updated_at BEFORE UPDATE ON watch_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Storage Buckets (to be created via Supabase Dashboard or API)
-- ============================================================================

-- Bucket: attachments (for user-uploaded files)
-- Bucket: avatars (for profile pictures)
-- Bucket: posters (for custom poster uploads)

-- Storage policies will need to be set up to ensure:
-- - Users can only upload to their own user_id folder
-- - Files are accessible based on bookmark/profile visibility
