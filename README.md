# WatchMarks — Personal Media Operating System

Capture content from anywhere, plan what to watch, discover through social signals, and track consumption. Built with React, TypeScript, Firebase, and shadcn/ui.

---

## Project Identity

| Property | Value |
|---|---|
| App Name | WatchMarks |
| Repository | watchlist-wonders |
| Package | @watchmarks/web |

> **Note:** The repository name `watchlist-wonders` and product name `WatchMarks` differ. Aligning these across CI/CD, analytics, and documentation is recommended to reduce confusion during onboarding and deployment.

---

## Design System

- Dark-first design system
- Tailwind tokens for color and spacing scale
- shadcn component layer
- Radix accessibility primitives

---

## System Architecture

### Layers

**Client Layer**
React SPA responsible for UI rendering, optimistic updates, client-side search, and analytics display.

**Application Layer**
Service modules that coordinate Firestore queries, enrichment requests, and caching via React Query.

**Backend Layer**
Firebase services:
- Firestore for persistence
- Cloud Functions for async enrichment and feed writes
- FCM for push notifications
- Storage for attachments

**External Integration Layer**
Third-party APIs for metadata extraction:
- YouTube Data API
- TMDB API
- TikTok oEmbed
- Instagram oEmbed (requires Meta app approval)
- X (Twitter) API v2
- Microlink as universal fallback

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Component model, type safety, fast builds |
| UI Components | shadcn/ui + Radix UI | Accessible primitives, composable design |
| Styling | Tailwind CSS | Utility-first, dark-first token system |
| State / Cache | React Query v5 (TanStack Query) | Server state, optimistic updates, cache control |
| Routing | React Router v7 | Lightweight client routing for SPA + Firebase hosting without SSR |
| Backend | Firebase (Firestore + Auth + Storage + Hosting + Cloud Functions) | Managed backend, real-time, scales to zero |
| Package Manager | Bun | Faster installs and scripts |

### Data Fetching Strategy

Query keys are namespaced by domain:

```
bookmarks:list
bookmarks:detail
schedules:today
plans:list
notifications:unread
```

Cache policy:
- `staleTime`: 2–5 minutes for most queries
- Firestore real-time listeners override React Query cache when active
- Cloud Function metadata cached in Firestore with 24-hour TTL

---

## Features

### Status Pipeline

```
backlog → scheduled → watching → done / dropped
```

This mirrors Kanban workflow patterns. Each transition triggers downstream effects (notifications, analytics, feed events).

### Scheduling System

- One-time and recurring schedules (daily, weekly, monthly)
- Snooze logic for missed occurrences
- Calendar views (month, week, day)
- Reminder notifications via FCM

### Tonight Pick — Smart Decision Engine

Solves the "what should I watch tonight" problem.

**Algorithm:**

```
score =
  runtimeFit        // items ≤ 90 min score higher
+ moodMatch         // matches current mood tag
+ popularityWeight  // TMDB rating boost
+ userRatingBoost   // user's own rating
- repetitionPenalty // penalise recently shown items
+ randomnessFactor  // prevent stale top results
```

**Variants:**
- Tonight Pick (default)
- Weekend Pick (longer runtimes allowed)
- Short Break Pick (≤ 30 minutes)

Recommendation history is stored per user to avoid repetition.

### Series Progress Tracking

```
season
episode
episodes_watched
total_episodes
```

Progress bar rendered per show. Example: `Breaking Bad — S3 E4 / 13`.

### Streaming Availability

Provider availability pulled from TMDB / JustWatch:

```json
"available_on": ["netflix", "prime", "apple_tv"]
```

Filter: "Only show things I can watch right now."

### Watch Plans

- Manual playlists (current)
- Adaptive plans with constraints: runtime, genre, mood
- Collaborative plans with group voting (roadmap)

### Social Features

- Public profiles
- Follow / unfollow users
- Activity feed
- Share bookmarks and plans via public links
- Friend recommendations
- Watch Together (roadmap)

### Analytics Dashboard

- Average watch session length
- Favourite mood
- Most watched provider
- Weekly watch time graph
- Streak tracking

### Gamification

- Achievements: first 10 movies, 7-day streak, 100 hours watched
- Profile badges

### Capture Layer

- Manual URL paste with instant metadata preview
- Web Share Target API (PWA) for saving directly from other apps
- Auto provider detection on paste

```json
// manifest.json share_target
{
  "action": "/share",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

---

## Project Structure

### Current

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── bookmarks/          # Bookmark components
│   ├── layout/             # TopNav, HeroBanner
│   └── search/             # Search components
├── contexts/
│   └── AuthContext.tsx
├── hooks/
├── lib/
│   ├── firebase.ts
│   └── utils.ts
├── pages/
│   ├── Auth.tsx
│   ├── Dashboard.tsx
│   ├── NewBookmark.tsx
│   └── ...
├── services/
│   ├── auth.ts
│   ├── bookmarks.ts
│   ├── schedules.ts
│   ├── notifications.ts
│   └── watchPlans.ts
└── types/
    └── database.ts

functions/
├── src/
│   ├── enrich.ts           # Metadata enrichment (1300+ LOC — needs decomposition)
│   └── index.ts
└── README.md
```

> **Warning:** `enrich.ts` at 1300+ lines is a maintenance liability. Anything over ~600 LOC in a service layer becomes difficult to test and evolve independently.

### Target — Domain-Oriented Structure

```
src/
├── domains/
│   ├── bookmarks/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   ├── schedules/
│   ├── plans/
│   ├── notifications/
│   └── social/
├── shared/
│   ├── ui/
│   ├── hooks/
│   └── lib/
└── ...
```

### Target — Enrichment Service Decomposition

```
services/enrichment/
├── detectProvider.ts       # URL → provider name
├── enrichYouTube.ts
├── enrichTMDB.ts
├── enrichOpenGraph.ts
├── enrichTikTok.ts         # oEmbed
├── enrichInstagram.ts      # oEmbed / Graph API
├── enrichTwitter.ts        # X API v2
├── normalizeUrl.ts         # Mobile redirect normalisation
├── retry.ts
├── cache.ts
└── index.ts
```

---

## Metadata Enrichment Pipeline

### Provider Detection

```
detectProvider(url)
  if youtube.com / youtu.be   → YouTube API
  if tiktok.com               → TikTok oEmbed
  if instagram.com            → Instagram oEmbed
  if twitter.com / x.com      → X API v2
  if imdb.com/title           → IMDb (OpenGraph)
  if netflix.com/title        → Netflix (OpenGraph)
  else                        → Microlink fallback
  final fallback              → OpenGraph scrape
```

### Platform Strategies

| Platform | Method | Notes |
|---|---|---|
| YouTube | YouTube Data API | Structured data, high reliability |
| TikTok | oEmbed (`tiktok.com/oembed`) | Free, no auth required |
| Instagram | Instagram oEmbed Graph API | Requires Meta developer app |
| X / Twitter | X API v2 (tweet ID extraction) | Requires paid access |
| Generic | Microlink API | Universal fallback, paid tiers |
| Final fallback | OpenGraph HTTP scrape | Unreliable on social platforms |

### Common Fix: User-Agent Header

Many platforms block server requests without a browser user-agent:

```ts
headers: {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}
```

### URL Normalisation

Mobile share URLs need normalisation before enrichment:

```ts
normalizeUrl(url)
  .replace("mobile.twitter.com", "twitter.com")
  .replace("x.com", "twitter.com")
  // TikTok mobile redirect resolution
  // Instagram reels URL normalisation
```

### Rate Limit Handling

YouTube and TMDB enforce quotas. Expected behaviour:

1. Queue enrichment jobs in Firestore (`enrichmentJobs` collection)
2. Exponential backoff after quota errors
3. Cache metadata in `metadataCache/{urlHash}` with 24-hour TTL to avoid repeat calls

### Background Job Architecture

Enrichment runs asynchronously rather than blocking bookmark creation:

```
Bookmark created
  → Firestore trigger fires
  → Job queued: enrichmentJobs/{id}
  → Worker Cloud Function picks up job
  → Metadata written back to bookmark document
  → Cache updated: metadataCache/{urlHash}
```

Benefits: retries, rate-limit protection, monitoring.

### Duplicate Detection

Before creating a new bookmark, check for duplicates by:

- Normalised URL
- TMDB ID
- YouTube video ID

If duplicate found: prompt "Already saved. Add to plan instead?"

---

## Database Schema

### Collections

| Collection | Purpose |
|---|---|
| `bookmarks` | Core content storage |
| `attachments` | File attachments |
| `schedules` | One-time and recurring schedules |
| `schedule_occurrences` | Generated schedule instances |
| `notifications` | User notifications |
| `watch_plans` | Watch planning |
| `watch_plan_bookmarks` | Plan ↔ bookmark junction |
| `public_profiles` | User profile information |
| `user_follows` | Social graph |
| `sharing_links` | Public sharing functionality |
| `enrich_cache` | URL metadata cache |
| `enrichmentJobs` | Async enrichment job queue |
| `bookmark_events` | Audit log for status changes |
| `users/{uid}/stats` | Aggregated analytics |

### Scaling Considerations

**Composite indexes** required for large bookmark sets (10k+ items):

- `status + created_at`
- `provider + status`
- `scheduled_for + state`

**Feed fan-out** concern: current `feed/{uid}/items/{id}` model becomes expensive at thousands of followers.

Future-proof alternative:

```
activities/{id}          # write once
followers/{uid}/sources/{actorUid}  # read-time fan-in
```

**Analytics aggregation** — avoid client-side computation at scale. Cloud Functions update `users/{uid}/stats` on bookmark status change:

```
total_watch_time
completed_items
streak_days
provider_distribution
```

---

## Security

### Current

- Firestore Security Rules enforce user isolation
- Firebase Auth (email/password)
- Storage policies scoped to user folders
- Type-safe queries with TypeScript
- Cloud Functions with CORS and validation

### Recommended Additions

- Rate limits on Cloud Functions (prevent spam bookmark creation)
- URL validation before enrichment (reject invalid or malicious domains)
- File size limit: 10MB max for attachments
- MIME type allowlist for uploads
- Structured logging for security events

---

## Testing

### Current State

Two test files exist. The system primarily relies on manual testing.

### Recommended Test Layers

**Unit Tests**
- Enrichment providers (each in isolation)
- Schedule recurrence logic
- Tonight Pick scoring model
- URL normalisation and provider detection

**Integration Tests**
- Firestore write + read round-trips
- Notification trigger flows

**End-to-End (Playwright)**
- Create bookmark
- Schedule reminder
- Share bookmark link
- Tonight Pick returns a result

---

## Observability

### Recommended

**Logging**
Structured logs in all Cloud Functions. Log provider detection result, API success/failure, and fallback usage per URL.

**Monitoring**
- Firebase Crashlytics + Performance Monitoring
- Track enrichment success rate
- Track API quota usage
- Track notification delivery rate

**Error Tracking**
Sentry for frontend errors.

---

## Search

### Evolution Path

| Phase | Approach |
|---|---|
| 1 (current) | Client-side filtering |
| 2 | Firestore composite indexed queries |
| 3 | Dedicated search engine (Algolia, Typesense, or Meilisearch) |

Client-side search becomes inefficient beyond ~1000 items.

---

## Build and Deployment

### Environment Separation

| Environment | Backend |
|---|---|
| Development | Local Firebase emulator |
| Staging | Pre-production Firebase project |
| Production | Live Firebase project |

Use `.env.local`, `.env.staging`, `.env.production`.

### Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ENRICH_URL=https://us-central1-your-project-id.cloudfunctions.net/enrich
VITE_YOUTUBE_API_KEY=
VITE_TMDB_API_KEY=
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# Recommended pipeline steps
1. Install dependencies
2. TypeScript type check
3. Run ESLint
4. Run tests
5. Build production bundle
6. Deploy to Firebase Hosting
```

Optional: preview deployments per pull request.

### Setup

```bash
# Clone and install
git clone <repository-url>
cd watchlist-wonders
bun install

# Configure environment
cp .env.example .env
# Edit .env with your Firebase credentials

# Start development server
bun run dev
```

Visit `http://localhost:5173`

### Available Scripts

```bash
bun run dev       # Development server
bun run build     # Production build
bun run preview   # Preview production build
bun run lint      # ESLint
bun run typecheck # TypeScript check
```

---

## Documentation

| Document | Status | Purpose |
|---|---|---|
| README.md | ✅ | Project overview, architecture, setup |
| ARCHITECTURE.md | ✅ | Data flow, domain boundaries, service responsibilities |
| functions/README.md | ✅ | Cloud Functions setup and API reference |
| MIGRATION.md | ✅ | Supabase → Firebase migration guide |
| CONTRIBUTING.md | Missing | Development workflow, PR rules |
| API_CONTRACTS.md | Missing | Firestore document shapes, service interfaces |

---

## Roadmap

### Phase 3: Complete Bookmark Management

- [ ] Bookmark status transitions (Backlog → Watching → Done)
- [ ] Search and filtering by multiple criteria
- [ ] Attachment upload functionality
- [ ] Bulk actions
- [ ] Duplicate detection on URL paste

### Phase 4: Scheduling System

- [ ] One-time scheduling
- [ ] Recurring schedules (daily, weekly, monthly)
- [ ] Calendar views (month, week, day)
- [ ] Reminder notifications

### Phase 5: Notifications

- [ ] Real-time notification system
- [ ] Notification preferences
- [ ] Push notifications via FCM

### Phase 6: Watch Plans

- [ ] Create and manage watch plans
- [ ] Plan suggestions based on mood and time
- [ ] Adaptive plans with genre/runtime constraints
- [ ] Auto-scheduling from plans

### Phase 7: Metadata Enrichment

- [ ] YouTube Data API integration
- [ ] TMDB API integration
- [ ] TikTok oEmbed
- [ ] Instagram oEmbed
- [ ] X API v2
- [ ] Microlink fallback
- [ ] URL normalisation
- [ ] Background job queue
- [ ] Enrichment cache (24-hour TTL)
- [ ] Enrichment service decomposition

### Phase 8: Social Features

- [ ] Public profiles
- [ ] Follow / unfollow users
- [ ] Share bookmarks and plans
- [ ] Activity feed
- [ ] Friend recommendations
- [ ] Watch Together (synchronized sessions)

### Phase 9: Decision Engine

- [ ] Tonight Pick with full scoring model
- [ ] Weekend Pick and Short Break Pick variants
- [ ] Mood-based discovery
- [ ] Series episode progress tracking
- [ ] Streaming availability detection

### Phase 10: Production Maturity

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] Playwright end-to-end tests
- [ ] Sentry error tracking
- [ ] Cloud Function structured logging
- [ ] Enrichment service observability
- [ ] CONTRIBUTING.md
- [ ] API_CONTRACTS.md
- [ ] Domain-oriented project structure refactor
- [ ] Enrichment service decomposition

### Future

- [ ] Progressive Web App with offline support
- [ ] Web Share Target API for frictionless capture
- [ ] AI metadata tagging (genre, tone, themes from description)
- [ ] Gamification (achievements, streaks, badges)
- [ ] Collaborative watch plans with group voting
- [ ] Content lifecycle management (archive stale backlog items)
- [ ] Monetisation: premium tier, affiliate streaming links

---

## Engineering Scale

| Metric | Estimate |
|---|---|
| Codebase size | ~20k–35k LOC |
| Solo build time | ~3–5 months |
| Maintenance team | 1–2 engineers |

The system is already structured well enough to evolve into a full social watchlist platform, a recommendation engine, or a media discovery network.

---

## Known Technical Debt

| Issue | Severity | Resolution |
|---|---|---|
| `enrich.ts` is 1300+ LOC | High | Decompose into enrichment pipeline modules |
| No automated tests | High | Add unit, integration, and e2e layers |
| Client-side search | Medium | Migrate to Firestore indexes, then dedicated engine |
| Tonight Pick algorithm undocumented | Medium | Implement scoring model (see Phase 9) |
| Fan-out feed model | Low | Migrate to read-time fan-in for scale |
| Repo name ≠ product name | Low | Align `watchlist-wonders` → `watchmarks` |

---

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) — UI Component Library
- [TanStack Query](https://tanstack.com/query) — Data Fetching and Caching
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Firebase](https://firebase.google.com/) — Backend Infrastructure
- [Radix UI](https://www.radix-ui.com/) — Accessible Primitives

---

MIT License
