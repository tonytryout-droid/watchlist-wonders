# Supabase to Firebase Migration Guide

## Overview

This document outlines the migration from Supabase to Firebase for the WatchMarks application. The app previously used Firebase for the main database and auth, with only the metadata enrichment function hosted on Supabase. This has now been migrated to Firebase Cloud Functions.

## What Changed

### Before (Supabase)
- **Database**: Firebase Firestore ✓
- **Auth**: Firebase Auth ✓
- **Storage**: Firebase Storage ✓
- **Metadata Enrichment**: Supabase Edge Functions ✗ → Now Firebase Cloud Functions ✓

### After (Firebase Only)
Everything is now consolidated under Firebase:
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth
- **Storage**: Firebase Storage
- **Metadata Enrichment**: Firebase Cloud Functions

## Changes Made

### 1. **Frontend Changes**
- Updated `QuickAddBar.tsx` to use local enrichment as a fallback (YouTube and TMDB APIs)
- When remote enrichment fails, the app gracefully falls back to local processing
- No breaking changes to the API response format

### 2. **Backend Changes**
- Created `functions/` directory with Firebase Cloud Functions
- **New functions**:
  - `enrich()`: Replaces Supabase Edge Function
    - Fetches YouTube video metadata (title, duration, thumbnail)
    - Uses TMDB API for movie/show enrichment
    - Handles provider detection
    - Supports CORS

### 3. **Environment Variables**
- **Before**: `VITE_ENRICH_URL=https://gpsdrlxkauyrapwehlca.supabase.co/functions/v1/enrich`
- **After**: `VITE_ENRICH_URL=https://us-central1-watch-wonders.cloudfunctions.net/enrich`

### 4. **Configuration Files**
- Updated `firebase.json` to include functions configuration
- Created `functions/package.json`, `functions/tsconfig.json`
- Created `functions/src/enrich.ts` with enrichment logic

## Deployment Steps

### Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### Step 2: Authenticate with Firebase

```bash
firebase login
```

### Step 3: Set Environment Variables in Firebase Console

Go to [Firebase Console](https://console.firebase.google.com/) → watch-wonders project:

1. **Sidebar**: Cloud Functions
2. **Click on the `enrich` function (or create it)**
3. **Runtime settings**:
   - Add environment variable:
     ```
     YOUTUBE_API_KEY: your_youtube_api_key
     TMDB_API_KEY: your_tmdb_api_key
     ```

Alternatively, use Firebase CLI:

```bash
# Set YouTube API key
firebase functions:config:set youtube.api_key="YOUR_KEY"

# Set TMDB API key
firebase functions:config:set tmdb.api_key="YOUR_KEY"
```

### Step 4: Deploy Firebase Cloud Functions

```bash
cd functions
npm install  # if not already done
npm run build
cd ..
firebase deploy --only functions
```

### Step 5: Update Environment Variables

After deployment, update `.env`:

```env
VITE_ENRICH_URL=https://us-central1-watch-wonders.cloudfunctions.net/enrich
```

If deploying to a different region, use that region instead of `us-central1`.

### Step 6: Rebuild and Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

## Verification

### Test the Enrichment Function

**Local testing** (using emulator):
```bash
firebase emulators:start --only functions
```

Then update `.env`:
```env
VITE_ENRICH_URL=http://localhost:5001/watch-wonders/us-central1/enrich
```

**Production testing**:
1. Paste a YouTube URL in the app
2. Should fetch title, thumbnail, and duration
3. Paste a Netflix or IMDB URL
4. Should attempt TMDB enrichment if available

### View Logs

```bash
firebase functions:log --follow
```

Or in Firebase Console → Cloud Functions → Logs.

## API Keys

### YouTube Data API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select project: `watch-wonders`
3. Enable API: YouTube Data API v3
4. Create API Key in **Credentials**
5. Copy the key and set in Firebase

**Quota**: 10,000 requests/day (free tier)

### TMDB API

1. Go to [TMDB Settings](https://www.themoviedb.org/settings/api)
2. Sign in or create account
3. Request API key
4. Copy the key and set in Firebase

**Quota**: Generous free tier (40 requests/second)

## Rollback Plan

If needed, revert to Supabase:

1. Update `.env`:
   ```env
   VITE_ENRICH_URL=https://gpsdrlxkauyrapwehlca.supabase.co/functions/v1/enrich
   ```

2. Rebuild and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## Benefits of Migration

✅ **Single Platform**: Everything under Firebase (simpler to manage)
✅ **Better Integration**: Cloud Functions co-located with Firestore
✅ **No External Dependencies**: Reduced complexity and vendor lock-in
✅ **Integrated Monitoring**: Logs and metrics in Firebase Console
✅ **Generous Free Tier**: 125K Cloud Function invocations/month
✅ **Better Latency**: Compute and database in same infrastructure
✅ **Scalability**: Auto-scaling handled by Firebase

## Files Changed/Created

### Created
- `functions/src/enrich.ts` - Main enrichment function
- `functions/src/index.ts` - Function exports
- `functions/package.json` - Dependencies
- `functions/tsconfig.json` - TypeScript config
- `functions/README.md` - Functions documentation
- `functions/.gitignore` - Git ignore rules
- `functions/.eslintignore` - ESLint ignore rules
- `MIGRATION.md` - This file

### Modified
- `.env` - Updated VITE_ENRICH_URL
- `.env.example` - Updated VITE_ENRICH_URL
- `firebase.json` - Added functions configuration
- `src/components/QuickAddBar.tsx` - Enhanced with local enrichment fallback

### Unchanged (but now Firebase-only)
- `src/services/enrichment.ts` - Still used for local fallbacks
- `src/lib/utils.ts` - Provider detection logic

## Troubleshooting

### Function not deploying

```bash
# Check if you're in the right directory
cd c:\path\to\watchlist-wonders

# Check Firebase configuration
firebase use watch-wonders

# Rebuild functions
cd functions
npm run build
cd ..

# Deploy with verbose output
firebase deploy --only functions --debug
```

### API keys not working

1. Verify API key is set:
   ```bash
   firebase functions:config:get
   ```

2. Check Firebase Console → Cloud Functions → Runtime settings

3. Ensure YouTube API is enabled in Google Cloud Console

4. Ensure TMDB API key is valid

### CORS errors

The function has CORS enabled for all origins. If you need to restrict:

Edit `functions/src/enrich.ts`:
```typescript
const corsHandler = cors({
  origin: ['https://yourdomain.com']
});
```

### Function times out

Increase timeout in `functions/src/enrich.ts` (currently 30 seconds).

### Out of quota

Monitor API usage in Google Cloud Console (YouTube) and TMDB dashboard.

## Next Steps

1. ✅ Migrate enrichment to Firebase Cloud Functions
2. ✅ Update environment variables
3. ✅ Deploy functions
4. ✅ Test with real URLs
5. ⏳ Monitor logs and usage
6. ⏳ Consider caching metadata responses to save quota
7. ⏳ Add rate limiting if needed

## Support

For Firebase Cloud Functions documentation:
- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Quickstart: Write and Deploy Your First Functions](https://firebase.google.com/docs/functions/get-started)

For this project:
- Check `functions/README.md` for detailed setup
- View logs: `firebase functions:log --follow`
- Report issues in project repository
