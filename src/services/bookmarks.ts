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
  increment,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function bookmarksCol(uid: string) {
  return collection(db, 'users', uid, 'bookmarks');
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
   * Get all bookmarks for the current user
   */
  async getBookmarks(): Promise<Bookmark[]> {
    const uid = getUid();
    try {
      const q = query(bookmarksCol(uid), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(docToBookmark);
    } catch (error) {
      console.error('[bookmarkService] getBookmarks failed', error);
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
    if (updates.is_vaulted !== undefined || updates.is_public !== undefined) {
      const currentSnap = await getDoc(ref);
      if (!currentSnap.exists()) throw new Error('Bookmark not found');
      const currentData = currentSnap.data() as Partial<Bookmark>;
      validateBookmarkUpdateVisibility(
        {
          is_vaulted: currentData.is_vaulted,
          is_public: currentData.is_public,
        },
        {
          is_vaulted: updates.is_vaulted,
          is_public: updates.is_public,
        },
      );
    }
    const { metadata, availability, ...restUpdates } = updates;
    
    // Define the set of fields that are safe to update (allow-list)
    // Exclude immutable fields: id, user_id, created_at, share_token
    const allowedUpdateFields = new Set<string>([
      'title', 'type', 'provider', 'source_url', 'canonical_url',
      'platform_label', 'status', 'runtime_minutes', 'release_year',
      'poster_url', 'backdrop_url', 'tags', 'mood_tags', 'notes',
      'last_shown_at', 'shown_count', 'user_rating', 'user_review',
      'watched_at', 'is_public', 'is_vaulted', 'priority',
      'queue_status', 'progress_percent'
    ]);
    
    // Filter restUpdates to only include allowed mutable fields
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

    await updateDoc(ref, nextUpdates);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Bookmark not found after update');
    return docToBookmark(snap);
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
   * Search bookmarks by title or notes (client-side filtering)
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
   * Get backlog items for Tonight Pick (runtime <= 90 minutes)
   */
  async getTonightCandidates(): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(
      bookmarksCol(uid),
      where('status', '==', 'backlog'),
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
