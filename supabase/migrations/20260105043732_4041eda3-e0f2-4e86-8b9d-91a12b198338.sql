-- Create bookmarks table
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'movie' CHECK (type IN ('movie', 'series', 'episode', 'video', 'doc', 'other')),
  provider TEXT NOT NULL DEFAULT 'generic' CHECK (provider IN ('youtube', 'imdb', 'netflix', 'instagram', 'facebook', 'x', 'generic')),
  source_url TEXT,
  canonical_url TEXT,
  platform_label TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'scheduled', 'watching', 'done', 'dropped')),
  runtime_minutes INTEGER,
  release_year INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  mood_tags TEXT[] DEFAULT '{}'::TEXT[],
  notes TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  last_shown_at TIMESTAMPTZ,
  shown_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  reminder_offset_minutes INTEGER DEFAULT 60,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fired', 'snoozed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create watch_plans table
CREATE TABLE public.watch_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  preferred_days INTEGER[] DEFAULT '{}'::INTEGER[],
  time_windows JSONB DEFAULT '[]'::JSONB,
  max_runtime_minutes INTEGER,
  mood_tags TEXT[] DEFAULT '{}'::TEXT[],
  platforms_allowed TEXT[] DEFAULT '{}'::TEXT[],
  auto_suggest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create watch_plan_bookmarks junction table
CREATE TABLE public.watch_plan_bookmarks (
  plan_id UUID NOT NULL REFERENCES public.watch_plans(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  PRIMARY KEY (plan_id, bookmark_id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_watch_plans_updated_at
  BEFORE UPDATE ON public.watch_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_plan_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for attachments
CREATE POLICY "Users can view own attachments" ON public.attachments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own attachments" ON public.attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own attachments" ON public.attachments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for schedules
CREATE POLICY "Users can view own schedules" ON public.schedules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own schedules" ON public.schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.schedules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.schedules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for watch_plans
CREATE POLICY "Users can view own watch_plans" ON public.watch_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own watch_plans" ON public.watch_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watch_plans" ON public.watch_plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watch_plans" ON public.watch_plans
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for watch_plan_bookmarks
CREATE POLICY "Users can view own watch_plan_bookmarks" ON public.watch_plan_bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own watch_plan_bookmarks" ON public.watch_plan_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watch_plan_bookmarks" ON public.watch_plan_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX idx_bookmarks_status ON public.bookmarks(status);
CREATE INDEX idx_bookmarks_type ON public.bookmarks(type);
CREATE INDEX idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX idx_schedules_scheduled_for ON public.schedules(scheduled_for);
CREATE INDEX idx_schedules_state ON public.schedules(state);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read_at ON public.notifications(read_at);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

-- Storage RLS policies
CREATE POLICY "Users can view own attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);