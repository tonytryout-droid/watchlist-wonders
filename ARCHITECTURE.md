# WatchMarks — Architecture Document

This document describes system layers, data flow, domain boundaries, service responsibilities, and Cloud Function triggers.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│   React SPA → React Query → Optimistic Updates → UI         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     Application Layer                        │
│   Service Modules → Domain Logic → Cache Coordination        │
└──────┬────────────────────┬────────────────────┬────────────┘
       │                    │                    │
┌──────▼──────┐   ┌─────────▼──────┐   ┌────────▼───────────┐
│  Firestore  │   │ Cloud Functions │   │   Firebase Storage  │
│ Persistence │   │ Async Workers   │   │    Attachments      │
└─────────────┘   └────────┬───────┘   └────────────────────-┘
                           │
              ┌────────────▼────────────┐
              │  External Integration   │
              │  YouTube / TMDB /       │
              │  TikTok / Instagram /   │
              │  X API / Microlink      │
              └─────────────────────────┘
```

---

## Layer Responsibilities

### Client Layer

- Renders the React SPA
- Manages UI state (forms, modals, selections)
- Performs optimistic updates via React Query mutations
- Runs client-side search and filtering (Phase 1)
- Displays analytics computed from cached data

### Application Layer

Service modules live in `src/services/` and `src/domains/*/services/`. They:

- Compose Firestore reads and writes
- Dispatch enrichment job creation
- Coordinate React Query cache invalidation
- Enforce business rules before persistence

### Backend Layer

**Firestore**
- Primary persistence for all user data
- Real-time listeners for notifications and feed
- Security Rules enforce strict user isolation

**Cloud Functions**
- Async metadata enrichment triggered by Firestore writes
- Feed fan-out on social activity
- Notification dispatch via FCM
- Aggregated stats updates on bookmark status change

**Firebase Storage**
- User attachments stored under `attachments/{uid}/{bookmarkId}/`
- Avatars stored under `avatars/{uid}/`
- Posters stored under `posters/{uid}/`

**FCM**
- Push notifications for schedule reminders
- Notification for friend activity

---

## Data Flow

### Bookmark Creation

```
1. User submits URL in UI
2. React mutation calls bookmarks.create()
3. Bookmark document written to Firestore
4. Firestore trigger fires Cloud Function
5. Cloud Function creates enrichmentJob document
6. Enrichment worker:
   a. detectProvider(url)
   b. Call appropriate API (YouTube / TikTok / TMDB / Microlink)
   c. Write metadata back to bookmark document
   d. Write to metadataCache/{urlHash} (TTL 24 hours)
7. React Query listener detects document update
8. UI re-renders with enriched metadata
```

### Schedule Reminder

```
1. User creates schedule with reminder time
2. Schedule document written to Firestore
3. Cloud Function scheduled job runs at reminder time
4. Notification document created in Firestore
5. FCM push notification dispatched to user device
6. UI notification badge updates via real-time listener
```

### Social Activity Feed

```
1. User completes or shares a bookmark
2. bookmark_event document written to Firestore
3. Cloud Function triggers feed fan-out
4. Activity written to feed/{uid}/items/{id} for each follower
5. Follower UI updates via real-time listener
```

### Tonight Pick

```
1. User opens Tonight Pick
2. Client queries backlog bookmarks
3. Scoring function applied:
   - runtimeFit (≤90min scores higher)
   - moodMatch (current mood tag alignment)
   - popularityWeight (TMDB rating)
   - userRatingBoost
   - repetitionPenalty (recently shown items)
   - randomnessFactor
4. Top scored item returned
5. Recommendation event stored in show_history
```

---

## Domain Boundaries

| Domain | Responsibility |
|---|---|
| bookmarks | CRUD, status transitions, attachment management, enrichment jobs |
| schedules | One-time and recurring schedule management, occurrence generation |
| plans | Watch plan creation, item ordering, adaptive plan constraints |
| notifications | Notification creation, preferences, read/unread state |
| social | Profiles, follows, feed, sharing links, recommendations |
| analytics | Stats aggregation, streak tracking, provider distribution |
| enrichment | Provider detection, API calls, caching, retry logic |

---

## Enrichment Pipeline Detail

```
URL input
  │
  ▼
normalizeUrl()           # Resolve mobile redirects, normalise x.com → twitter.com
  │
  ▼
detectProvider()         # Match URL pattern to provider name
  │
  ├─ youtube    → enrichYouTube()     # YouTube Data API
  ├─ tiktok     → enrichTikTok()      # TikTok oEmbed
  ├─ instagram  → enrichInstagram()   # Instagram oEmbed / Graph API
  ├─ twitter    → enrichTwitter()     # X API v2
  ├─ imdb       → enrichOpenGraph()   # OpenGraph scrape
  ├─ netflix    → enrichOpenGraph()   # OpenGraph scrape
  └─ *          → enrichMicrolink()   # Microlink universal fallback
                    │
                    └─ final fallback → enrichOpenGraph()
  │
  ▼
writeToCache()           # metadataCache/{urlHash}, TTL 24h
  │
  ▼
updateBookmark()         # Write metadata fields back to bookmark document
```

### Provider Detection Rules

```ts
if url includes "youtube.com" or "youtu.be"  → "youtube"
if url includes "tiktok.com"                  → "tiktok"
if url includes "instagram.com"               → "instagram"
if url includes "twitter.com" or "x.com"      → "twitter"
if url includes "imdb.com/title"              → "imdb"
if url includes "netflix.com/title"           → "netflix"
default                                       → null (use Microlink)
```

---

## Firestore Document Shapes

### bookmarks/{uid}/items/{id}

```ts
{
  id: string
  url: string
  title: string
  description: string
  thumbnail: string
  provider: "youtube" | "netflix" | "tiktok" | "instagram" | "twitter" | "imdb" | "other"
  platform: string
  status: "backlog" | "scheduled" | "watching" | "done" | "dropped"
  mood_tags: string[]
  runtime_minutes: number
  ai_tags: string[]
  available_on: string[]
  tmdb_id: string | null
  youtube_id: string | null
  season: number | null
  episode: number | null
  episodes_watched: number | null
  total_episodes: number | null
  user_rating: number | null
  created_at: Timestamp
  updated_at: Timestamp
  enriched_at: Timestamp | null
}
```

### schedules/{uid}/items/{id}

```ts
{
  id: string
  bookmark_id: string
  title: string
  type: "once" | "daily" | "weekly" | "monthly"
  scheduled_for: Timestamp
  recurrence_rule: string | null
  snooze_until: Timestamp | null
  state: "pending" | "notified" | "done" | "snoozed"
  created_at: Timestamp
}
```

### users/{uid}/stats

```ts
{
  total_watch_time: number      // minutes
  completed_items: number
  streak_days: number
  last_watched_at: Timestamp
  provider_distribution: Record<string, number>
  mood_distribution: Record<string, number>
}
```

### metadataCache/{urlHash}

```ts
{
  url: string
  url_hash: string
  title: string
  description: string
  thumbnail: string
  provider: string
  cached_at: Timestamp
  expires_at: Timestamp         // cached_at + 24 hours
}
```

### enrichmentJobs/{id}

```ts
{
  bookmark_id: string
  uid: string
  url: string
  status: "queued" | "processing" | "done" | "failed"
  attempts: number
  last_error: string | null
  created_at: Timestamp
  processed_at: Timestamp | null
}
```

---

## Cloud Function Triggers

| Function | Trigger | Purpose |
|---|---|---|
| `onBookmarkCreate` | `bookmarks/{uid}/items/{id}` onCreate | Queue enrichment job |
| `processEnrichmentJob` | `enrichmentJobs/{id}` onCreate | Execute enrichment pipeline |
| `onBookmarkStatusChange` | `bookmarks/{uid}/items/{id}` onUpdate | Update `users/{uid}/stats`, write bookmark_event |
| `onBookmarkEvent` | `bookmark_events/{id}` onCreate | Fan-out to follower feeds |
| `sendScheduledReminder` | Cloud Scheduler (every minute) | Check pending schedules, dispatch FCM |
| `onFollowCreate` | `user_follows/{id}` onCreate | Backfill follower feed with recent activity |

---

## Composite Indexes (Required)

```
bookmarks/{uid}/items
  - status ASC, created_at DESC
  - provider ASC, status ASC
  - scheduled_for ASC, state ASC
  - mood_tags ARRAY, status ASC
  - available_on ARRAY, status ASC
```

---

## Caching Strategy

| Layer | Mechanism | TTL |
|---|---|---|
| Client query cache | React Query staleTime | 2–5 minutes |
| Firestore real-time | Active listeners override query cache | Live |
| Metadata cache | `metadataCache/{urlHash}` in Firestore | 24 hours |
| Static assets | Firebase Hosting CDN | 1 year (content-hashed) |

---

## Security Model

### Firestore Rules Pattern

All collections follow the pattern:

```
allow read, write: if request.auth.uid == resource.data.uid
                   || request.auth.uid == userId  // path-based
```

Public profiles and sharing links have read-only public access.

### Cloud Function Security

- CORS restricted to allowed origins
- URL validation rejects non-HTTP(S) schemes and known malicious domains
- Attachment uploads: 10MB max, MIME type allowlist
- Rate limiting: max 60 bookmark creations per hour per user

### Environment Isolation

| Environment | Firebase Project | Rules |
|---|---|---|
| Development | Local emulator | Permissive for development |
| Staging | Separate Firebase project | Production rules, test data |
| Production | Live Firebase project | Full security rules enforced |

---

## Search Architecture

| Phase | Approach | Limit |
|---|---|---|
| 1 (current) | Client-side JavaScript filter | ~1000 items |
| 2 | Firestore composite indexed queries | ~100k items |
| 3 | Algolia / Typesense / Meilisearch | Unlimited, full-text |

---

## Known Architectural Debt

| Item | Impact | Priority |
|---|---|---|
| `enrich.ts` monolith (1300+ LOC) | Hard to test and maintain | High |
| No automated tests | Regressions caught late | High |
| UI-centric (not domain-centric) file structure | Cross-domain coupling grows | Medium |
| Fan-out feed model | Expensive at scale (1000+ followers) | Low (current user scale) |
| Client-side search | Slow for large collections | Medium |

---

## Next Architecture Steps

1. Decompose `enrich.ts` into the enrichment pipeline module structure
2. Introduce the domain-oriented folder structure
3. Add Playwright end-to-end tests for critical user flows
4. Instrument Cloud Functions with structured logging
5. Generate a visual system diagram (Client → Firebase → Enrichment → External APIs)
