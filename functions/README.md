# Firebase Cloud Functions

This directory contains Firebase Cloud Functions for the WatchMarks application.

## Overview

### Enrichment Function (`enrich`)

The enrichment function fetch metadata for links pasted by users. It replaces the previous Supabase-based enrichment service.

**Capabilities:**
- **YouTube** videos: Extracts title, description, thumbnail, and duration
- **TMDB Integration**: Enriches Netflix, IMDB, and generic movie/TV links with posters, backdrops, and release dates
- **Provider Detection**: Automatically detects the source platform
- **CORS Support**: Handles cross-origin requests from the web app

## Setup

### Prerequisites

- Node.js 22 or higher
- Firebase CLI (`npm install -g firebase-tools`)
- Access to YouTube API and TMDB API credentials

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Set Environment Variables

Set the following environment variables in Firebase Console (Project Settings → Cloud Functions environment variables):

```
YOUTUBE_API_KEY=your_youtube_api_key
TMDB_API_KEY=your_tmdb_api_key
```

Or use the Firebase CLI:

```bash
# For YouTube API
firebase functions:config:set youtube.api_key="YOUR_YOUTUBE_API_KEY"

# For TMDB API
firebase functions:config:set tmdb.api_key="YOUR_TMDB_API_KEY"
```

### 3. Get API Keys

**YouTube Data API:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create an API key in Credentials
5. Copy the API key

**TMDB API:**
1. Go to [TMDB](https://www.themoviedb.org/settings/api)
2. Request an API key
3. Copy the API key

### 4. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:enrich

# Deploy with local functions emulator (for testing)
firebase emulators:start --only functions
```

## Usage

### Local Testing

Set the `VITE_ENRICH_URL` to the local emulator endpoint:

```env
VITE_ENRICH_URL=http://localhost:5001/watch-wonders/us-central1/enrich
```

### Production

Update `VITE_ENRICH_URL` in `.env` with the deployed function URL:

```env
VITE_ENRICH_URL=https://us-central1-watch-wonders.cloudfunctions.net/enrich
```

### API Endpoint

**POST** `/enrich`

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "title": "Video Title",
  "description": "Video Description",
  "posterUrl": "https://...",
  "backdropUrl": "https://...",
  "runtimeMinutes": 120,
  "releaseYear": 2023,
  "provider": "youtube"
}
```

## Development

### Build

```bash
npm run build
```

### Watch for Changes

```bash
npm run watch
```

### View Logs

```bash
npm run logs
```

Or use the Firebase CLI:

```bash
firebase functions:log --follow
```

## File Structure

```
functions/
├── src/
│   ├── index.ts      # Function exports
│   └── enrich.ts     # Enrichment function implementation
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript configuration
└── lib/              # Compiled output (generated)
```

## Migration from Supabase

This Firebase Cloud Function replaces the Supabase Edge Function (`https://gpsdrlxkauyrapwehlca.supabase.co/functions/v1/enrich`). No code changes are needed in the frontend—just update the `VITE_ENRICH_URL` environment variable.

### Benefits of Firebase Functions

- ✅ No external dependencies (all under Firebase)
- ✅ Same Google Cloud infrastructure as Firebase Firestore
- ✅ Integrated logging and monitoring
- ✅ Automatic scaling
- ✅ Generous free tier (125k invocations/month)
- ✅ Lower latency with co-located compute and database

## Troubleshooting

### Function timeout

Increase `timeoutSeconds` in `functions/src/enrich.ts` if needed.

### CORS errors

The CORS handler is configured to accept requests from any origin. For production, restrict to specific domains:

```typescript
const corsHandler = cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com']
});
```

### Missing environment variables

Ensure API keys are set in Firebase Console under Cloud Functions environment variables.

### Rate limiting

YouTube and TMDB may rate limit requests. Monitor usage in their respective dashboards.
