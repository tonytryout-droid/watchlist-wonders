# Supabase Setup Guide for WatchMarks

This guide will help you set up Supabase for the WatchMarks application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the project details:
   - Name: `watchmarks` (or your preferred name)
   - Database Password: Generate a secure password
   - Region: Choose the closest region to your users
4. Click "Create new project"

## Step 2: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Apply the migration:
   ```bash
   supabase db push
   ```

### Option B: Manual SQL Execution

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor and run the query

## Step 3: Create Storage Buckets

1. Go to Storage in your Supabase dashboard
2. Create the following buckets:

### Attachments Bucket
- Name: `attachments`
- Public: No
- File size limit: 50MB
- Allowed MIME types: `image/*,application/pdf`

**Storage Policies for attachments:**
```sql
-- Insert policy
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Select policy
CREATE POLICY "Users can view their own attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Delete policy
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Avatars Bucket
- Name: `avatars`
- Public: Yes
- File size limit: 5MB
- Allowed MIME types: `image/*`

**Storage Policies for avatars:**
```sql
-- Insert policy
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Update policy
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Select policy
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Delete policy
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Posters Bucket (Optional)
- Name: `posters`
- Public: Yes
- File size limit: 5MB
- Allowed MIME types: `image/*`

## Step 4: Configure Authentication

1. Go to Authentication > Providers in your Supabase dashboard
2. Enable Email provider
3. Configure email templates (optional):
   - Confirmation email
   - Password reset email
   - Magic link email

### Enable Email Verification (Optional)
1. Go to Authentication > Settings
2. Enable "Enable email confirmations"

## Step 5: Set Up Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Supabase credentials:
   - Go to Settings > API in your Supabase dashboard
   - Copy the Project URL
   - Copy the `anon` public key

3. Update `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Step 6: (Optional) Set Up External API Keys for Enrichment

For metadata enrichment features, you'll need API keys from:

### TMDB (The Movie Database)
1. Sign up at https://www.themoviedb.org/
2. Go to Settings > API
3. Request an API key
4. Add to `.env`:
   ```env
   VITE_TMDB_API_KEY=your-tmdb-api-key
   ```

### YouTube Data API
1. Go to Google Cloud Console
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Add to `.env`:
   ```env
   VITE_YOUTUBE_API_KEY=your-youtube-api-key
   ```

## Step 7: Test the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/auth` and try signing up
3. Check your Supabase dashboard to see if:
   - User was created in Authentication
   - Profile was created in `public_profiles` table

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env` file exists and contains valid Supabase URL and anon key
- Restart your development server after adding environment variables

### Authentication not working
- Check that RLS policies are enabled on all tables
- Verify that the auth trigger `on_auth_user_created` is active
- Check browser console for specific error messages

### Storage upload fails
- Verify storage buckets are created
- Check storage policies are correctly set up
- Ensure file paths follow the pattern: `user_id/filename`

## Next Steps

After completing the setup:

1. Create your first bookmark to test the system
2. Explore the dashboard rails
3. Try the search functionality
4. Set up your first watch schedule

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
