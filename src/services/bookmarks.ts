import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  runTransaction,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db, fbFunctions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Bookmark } from '@/types/database';
import { buildLifecycleUpdate, deriveLifecycleState } from "@/engine/lifecycle";
import { normalizeBookmark } from '@/services/bookmarkNormalizer';
import { inferBookmarkEnrichmentState } from '@/lib/tmdbEnrichment';
import {
  DEFAULT_WATCH_REGION,
  resolveAndFetchAvailability,
  toAvailabilityMetadataUpdate,
} from "@/services/watchAvailability";
import { getPreferredRegionFromBrowser } from "@/lib/localeRegion";
import {
  validateBookmarkCreateVisibility,
  validateBookmarkUpdateVisibility,
} from "@/services/bookmarkVisibility";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

export interface SemanticSearchResult {
  id: string;
  title: string;
  poster_url: string | null;
  type: string;
  provider: string;
  tags: string[];
  auto_tags: string[];
  canonical_entity: unknown;
  cluster_id: string | null;
  score: number;
  breakdown: { semantic: number; recency: number; engagement: number; importance: number };
  reason: string;
}

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function bookmarksCol(uid: string) {
  return collection(db, 'users', uid, 'bookmarks');
}

function buildCanonicalEntityFromTmdb(
  draft: Partial<Bookmark> & { title: string },
  now: string,
): Bookmark["canonical_entity"] | null {
  const tmdb = draft.tmdb;
  const metadata = draft.metadata ?? {};
  if (!tmdb) return null;
  return {
    source: "tmdb",
    id: String(tmdb.tmdbId),
    type: tmdb.mediaType,
    title: tmdb.title || draft.title,
    year: tmdb.releaseYear,
    genres: tmdb.genres,
    runtime: tmdb.runtimeMinutes,
    poster: tmdb.posterUrl,
    confidence:
      typeof metadata.resolution_confidence === "number"
        ? metadata.resolution_confidence
        : metadata.match_confidence === "high"
          ? 1
          : 0,
    matched_at: now,
    suggested: metadata.resolution_status !== "matched",
  };
}

function docToBookmark(snap: { id: string; data(): Record<string, unknown> }): Bookmark {
  return normalizeBookmark(snap.id, snap.data());
}

async function prefetchAvailabilityForBookmark(params: {
  uid: string;
  bookmarkId: string;
  title: string;
  type: Bookmark["type"];
  provider: Bookmark["provider"];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { uid, bookmarkId, title, type, provider, metadata } = params;
  if (!title.trim()) return;

  try {
    const preferredRegion = getPreferredRegionFromBrowser() ?? DEFAULT_WATCH_REGION;
    const { availability, tmdbId } = await resolveAndFetchAvailability(
      { title, type, provider, metadata },
      preferredRegion,
    );
    const ref = doc(db, 'users', uid, 'bookmarks', bookmarkId);
    const metadataUpdate = toAvailabilityMetadataUpdate(metadata, availability, tmdbId);
    const fetchedAt = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return;

      const currentMetadataRaw = snapshot.data().metadata;
      const currentMetadata =
        currentMetadataRaw && typeof currentMetadataRaw === "object" && !Array.isArray(currentMetadataRaw)
          ? (currentMetadataRaw as Record<string, unknown>)
          : {};

      const payload: Record<string, unknown> = {
        availability,
        "metadata.availability": metadataUpdate.availability,
        availability_fetched_at: fetchedAt,
      };

      if (
        metadataUpdate.tmdb_id &&
        !metadata?.tmdb_id &&
        !metadata?.tmdbId &&
        !currentMetadata.tmdb_id &&
        !currentMetadata.tmdbId
      ) {
        payload["metadata.tmdb_id"] = metadataUpdate.tmdb_id;
      }

      transaction.update(ref, payload);
    });
  } catch (error) {
    console.warn("[bookmarkService] availability prefetch failed", error);
  }
}

export const bookmarkService = {
  /**
   * Get bookmarks for the current user, capped at safetyLimit to avoid
   * unbounded reads. Use getBookmarksPage() for cursor-based pagination.
   */
  async getBookmarks(safetyLimit = 500): Promise<Bookmark[]> {
    const uid = getUid();
    try {
      const q = query(bookmarksCol(uid), orderBy('created_at', 'desc'), limit(safetyLimit));
      const snap = await getDocs(q);
      return snap.docs.map(docToBookmark);
    } catch (error) {
      console.error('[bookmarkService] getBookmarks failed', error);
      throw error;
    }
  },

  /**
   * Cursor-based paginated fetch. Returns bookmarks and an opaque cursor
   * for the next page (undefined when the last page has been reached).
   */
  async getBookmarksPage(
    pageSize = 50,
    cursor?: QueryDocumentSnapshot,
  ): Promise<{ bookmarks: Bookmark[]; nextCursor?: QueryDocumentSnapshot }> {
    const uid = getUid();
    try {
      const constraints = cursor
        ? [orderBy('created_at', 'desc'), limit(pageSize), startAfter(cursor)]
        : [orderBy('created_at', 'desc'), limit(pageSize)];
      const q = query(bookmarksCol(uid), ...constraints);
      const snap = await getDocs(q);
      const bookmarks = snap.docs.map(docToBookmark);
      const nextCursor =
        snap.docs.length === pageSize
          ? (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot)
          : undefined;
      return { bookmarks, nextCursor };
    } catch (error) {
      console.error('[bookmarkService] getBookmarksPage failed', error);
      throw error;
    }
  },

  /**
   * Get bookmarks by status
   */
  async getBookmarksByStatus(status: Bookmark['status']): Promise<Bookmark[]> {
    const uid = getUid();
    try {
      const q = query(
        bookmarksCol(uid),
        where('status', '==', status),
        orderBy('created_at', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToBookmark);
    } catch (error) {
      console.error('[bookmarkService] getBookmarksByStatus failed', { status, error });
      throw error;
    }
  },

  /**
   * Get a single bookmark by ID
   */
  async getBookmark(id: string): Promise<Bookmark> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'bookmarks', id));
    if (!snap.exists()) throw new Error('Bookmark not found');
    return docToBookmark(snap);
  },

  /**
   * Create a new bookmark
   */
  async createBookmark(bookmark: Partial<Bookmark> & { title: string }): Promise<Bookmark> {
    const uid = getUid();
    const now = new Date().toISOString();
    const baseMetadata = bookmark.metadata || {};
    const initialStatus = bookmark.status || "backlog";
    const initialQueueStatus = bookmark.queue_status ?? "queued";
    const inferredEnrichment = inferBookmarkEnrichmentState(
      {
        ...bookmark,
        title: bookmark.title,
        type: bookmark.type || "movie",
        provider: bookmark.provider || "generic",
        metadata: baseMetadata,
        canonical_url: bookmark.canonical_url ?? null,
        runtime_minutes: bookmark.runtime_minutes ?? null,
        release_year: bookmark.release_year ?? null,
        poster_url: bookmark.poster_url ?? null,
        backdrop_url: bookmark.backdrop_url ?? null,
      },
      now,
    );
    const canonicalEntity = buildCanonicalEntityFromTmdb(
      { ...bookmark, title: bookmark.title, tmdb: inferredEnrichment.tmdb ?? null },
      now,
    );
    validateBookmarkCreateVisibility({
      is_vaulted: bookmark.is_vaulted,
      is_public: bookmark.is_public,
    });
    const lifecycleSeed = deriveLifecycleState({
      id: bookmark.id ?? "pending-create",
      user_id: uid,
      title: bookmark.title,
      type: bookmark.type || "movie",
      provider: bookmark.provider || "generic",
      source_url: bookmark.source_url ?? null,
      canonical_url: bookmark.canonical_url ?? null,
      platform_label: bookmark.platform_label ?? null,
      status: initialStatus,
      runtime_minutes: bookmark.runtime_minutes ?? null,
      release_year: bookmark.release_year ?? null,
      poster_url: bookmark.poster_url ?? null,
      backdrop_url: bookmark.backdrop_url ?? null,
      tags: bookmark.tags || [],
      mood_tags: bookmark.mood_tags || [],
      notes: bookmark.notes ?? null,
      metadata: baseMetadata,
      last_shown_at: null,
      shown_count: 0,
      created_at: now,
      updated_at: now,
      is_public: bookmark.is_public ?? false,
      is_vaulted: bookmark.is_vaulted ?? false,
      priority: bookmark.priority ?? 100,
      queue_status: initialQueueStatus,
      progress_percent: bookmark.progress_percent ?? 0,
    });
    const data = {
      title: bookmark.title,
      type: bookmark.type || 'movie',
      provider: bookmark.provider || 'generic',
      source_url: bookmark.source_url ?? null,
      canonical_url: bookmark.canonical_url ?? null,
      platform_label: bookmark.platform_label ?? null,
      status: bookmark.status || 'backlog',
      runtime_minutes: bookmark.runtime_minutes ?? null,
      release_year: bookmark.release_year ?? null,
      poster_url: bookmark.poster_url ?? null,
      backdrop_url: bookmark.backdrop_url ?? null,
      tags: bookmark.tags || [],
      mood_tags: bookmark.mood_tags || [],
      notes: bookmark.notes ?? null,
      metadata: {
        ...baseMetadata,
        lifecycle_state: lifecycleSeed,
        lifecycle_updated_at: now,
      },
      user_id: uid,
      is_public: bookmark.is_public ?? false,
      last_shown_at: null,
      shown_count: 0,
      is_vaulted: bookmark.is_vaulted ?? false,
      // Queue engine defaults
      priority: bookmark.priority ?? 100,
      queue_status: initialQueueStatus,
      progress_percent: bookmark.progress_percent ?? 0,
      availability: bookmark.availability ?? null,
      enriched: inferredEnrichment.enriched,
      enriched_at: inferredEnrichment.enriched_at,
      enrich_fail_reason: inferredEnrichment.enrich_fail_reason,
      tmdb: inferredEnrichment.tmdb,
      canonical_entity: canonicalEntity,
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(bookmarksCol(uid), data);
    void prefetchAvailabilityForBookmark({
      uid,
      bookmarkId: ref.id,
      title: data.title,
      type: data.type,
      provider: data.provider,
      metadata: data.metadata,
    });
    return { id: ref.id, ...data } as Bookmark;
  },

  /**
   * Update an existing bookmark
   */
  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<Bookmark> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    const { metadata, availability, ...restUpdates } = updates;

    const allowedUpdateFields = new Set<string>([
      'title', 'type', 'provider', 'source_url', 'canonical_url',
      'platform_label', 'status', 'runtime_minutes', 'release_year',
      'poster_url', 'backdrop_url', 'tags', 'mood_tags', 'notes',
      'last_shown_at', 'shown_count', 'user_rating', 'user_review',
      'watched_at', 'is_public', 'is_vaulted', 'priority',
      'queue_status', 'progress_percent',
    ]);

    const filteredUpdates = Object.entries(restUpdates)
      .filter(([key]) => allowedUpdateFields.has(key))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    const nextUpdates: Record<string, unknown> = {
      ...filteredUpdates,
      updated_at: new Date().toISOString(),
    };
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      for (const [key, value] of Object.entries(metadata)) {
        nextUpdates[`metadata.${key}`] = value;
      }
    }
    if (availability !== undefined) {
      nextUpdates.availability = availability;
      nextUpdates["metadata.availability"] = availability;
    }

    const needsVisibilityCheck = updates.is_vaulted !== undefined || updates.is_public !== undefined;

    if (needsVisibilityCheck) {
      // Read + validate + write atomically so concurrent edits can't slip an
      // invalid visibility state (e.g. is_vaulted=true AND is_public=true) past
      // the check between the getDoc and updateDoc calls.
      await runTransaction(db, async (transaction) => {
        const currentSnap = await transaction.get(ref);
        if (!currentSnap.exists()) throw new Error('Bookmark not found');
        const currentData = normalizeBookmark(currentSnap.id, currentSnap.data());
        validateBookmarkUpdateVisibility(
          { is_vaulted: currentData.is_vaulted, is_public: currentData.is_public },
          { is_vaulted: updates.is_vaulted, is_public: updates.is_public },
        );
        transaction.update(ref, nextUpdates);
      });
    } else {
      await updateDoc(ref, nextUpdates);
    }

    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Bookmark not found after update');
    return docToBookmark(snap);
  },

  async selectResolutionCandidate(
    id: string,
    candidate: EnrichmentMatchCandidate,
  ): Promise<Bookmark> {
    const callable = httpsCallable<
      { bookmarkId: string; action: "selected"; candidate: EnrichmentMatchCandidate },
      { ok: boolean }
    >(fbFunctions, "selectResolutionCandidate");
    await callable({ bookmarkId: id, action: "selected", candidate });
    return this.getBookmark(id);
  },

  async skipResolutionSelection(id: string): Promise<void> {
    const callable = httpsCallable<
      { bookmarkId: string; action: "skipped" },
      { ok: boolean }
    >(fbFunctions, "selectResolutionCandidate");
    await callable({ bookmarkId: id, action: "skipped" });
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', id));
  },

  /**
   * Update bookmark status, setting watched_at when first marked done
   */
  async updateStatus(id: string, status: Bookmark['status']): Promise<Bookmark> {
    const current = await this.getBookmark(id);
    const updates = buildLifecycleUpdate(current, status, new Date());
    return this.updateBookmark(id, updates);
  },

  /**
   * Rate a bookmark (1–5 stars) with optional personal review
   */
  async rateBookmark(id: string, rating: number | null, review?: string | null): Promise<Bookmark> {
    // Validate rating: must be null or an integer between 1 and 5
    if (rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be null or an integer between 1 and 5');
      }
    }
    return this.updateBookmark(id, {
      user_rating: rating,
      ...(review !== undefined ? { user_review: review } : {}),
    });
  },

  /**
   * Search bookmarks by title or notes (client-side filtering — legacy fallback)
   */
  async searchBookmarks(queryStr: string): Promise<Bookmark[]> {
    const bookmarks = await this.getBookmarks();
    const lower = queryStr.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        (b.notes && b.notes.toLowerCase().includes(lower)),
    );
  },

  /**
   * Semantic + ranked search via Cloud Function. Falls back to client-side
   * keyword filter when the callable is unavailable (offline, missing config).
   */
  async semanticSearch(
    queryStr: string,
    opts?: { topK?: number; mode?: 'auto' | 'semantic' | 'keyword' | 'temporal' | 'context' },
  ): Promise<SemanticSearchResult[]> {
    try {
      const callable = httpsCallable<
        { query: string; topK?: number; mode?: string },
        { results: SemanticSearchResult[] }
      >(fbFunctions, 'searchBookmarks');
      const result = await callable({
        query: queryStr,
        topK: opts?.topK ?? 20,
        mode: opts?.mode ?? 'auto',
      });
      return result.data.results ?? [];
    } catch (err) {
      console.warn('[bookmarkService] semanticSearch fallback to client filter', err);
      const bookmarks = await this.searchBookmarks(queryStr);
      return bookmarks.slice(0, opts?.topK ?? 20).map((b) => ({
        id: b.id,
        title: b.title,
        poster_url: b.poster_url ?? null,
        type: b.type,
        provider: b.provider,
        tags: b.tags ?? [],
        auto_tags: (b as Bookmark & { auto_tags?: string[] }).auto_tags ?? [],
        canonical_entity: (b as Bookmark & { canonical_entity?: unknown }).canonical_entity ?? null,
        cluster_id: (b as Bookmark & { cluster_id?: string | null }).cluster_id ?? null,
        score: 0,
        breakdown: { semantic: 0, recency: 0, engagement: 0, importance: 0 },
        reason: 'fallback_keyword',
      }));
    }
  },

  /**
   * Record that the current user opened this bookmark. Cheap fire-and-forget
   * for view-count + last_viewed_at tracking that feeds importance scoring.
   */
  async recordView(bookmarkId: string): Promise<void> {
    try {
      const callable = httpsCallable<{ bookmarkId: string }, { ok: boolean }>(
        fbFunctions,
        'recordView',
      );
      await callable({ bookmarkId });
    } catch (err) {
      // Non-fatal — view tracking must never break the UI.
      if (import.meta.env.DEV) console.warn('[bookmarkService] recordView failed', err);
    }
  },

  /**
   * Get backlog items for Tonight Pick (runtime <= 90 minutes or unknown).
   * Capped at 200 server-side; null-runtime items can't be excluded by Firestore
   * so client-side filtering is intentional here.
   */
  async getTonightCandidates(): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(
      bookmarksCol(uid),
      where('status', '==', 'backlog'),
      limit(200),
    );
    const snap = await getDocs(q);
    const bookmarks = snap.docs.map(docToBookmark);
    return bookmarks
      .filter((b) => b.runtime_minutes === null || b.runtime_minutes <= 90)
      .sort((a, b) => (a.shown_count || 0) - (b.shown_count || 0))
      .slice(0, 20);
  },

  /**
   * Update shown tracking for Tonight Pick
   */
  async markAsShown(id: string): Promise<void> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    await updateDoc(ref, {
      last_shown_at: new Date().toISOString(),
      shown_count: increment(1),
    });
  },

  /**
   * Get bookmarks grouped by mood tags
   */
  async getBookmarksByMood(): Promise<Record<string, Bookmark[]>> {
    const bookmarks = await this.getBookmarks();
    const byMood: Record<string, Bookmark[]> = {};
    bookmarks.forEach((bookmark) => {
      (bookmark.mood_tags || []).forEach((mood) => {
        if (!byMood[mood]) byMood[mood] = [];
        byMood[mood].push(bookmark);
      });
    });
    return byMood;
  },

  /**
   * Get statistics about user's bookmarks
   */
  async getStats() {
    const bookmarks = await this.getBookmarks();
    return {
      total: bookmarks.length,
      backlog: bookmarks.filter((b) => b.status === 'backlog').length,
      watching: bookmarks.filter((b) => b.status === 'watching').length,
      done: bookmarks.filter((b) => b.status === 'done').length,
      dropped: bookmarks.filter((b) => b.status === 'dropped').length,
      totalWatchedMinutes: bookmarks
        .filter((b) => b.status === 'done' && b.runtime_minutes)
        .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
    };
  },
};
