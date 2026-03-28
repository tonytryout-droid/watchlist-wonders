/**
 * Queue Service — Phase 2 queue engine.
 *
 * Manages the active watchlist as a priority-ordered queue with states:
 *   queued       → in backlog, not yet started
 *   up_next      → manually promoted to top of queue
 *   in_progress  → actively watching (mirrors status: watching)
 *   completed    → finished (mirrors status: done)
 *
 * Priority is a float. Higher = appears sooner. Default = 100.
 * Reordering uses midpoint insertion: newPriority = (prev + next) / 2
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Bookmark } from '@/types/database';
import { buildLifecycleMetadataUpdate } from "@/engine/lifecycle";
import { normalizeBookmark } from '@/services/bookmarkNormalizer';

const DEFAULT_PRIORITY = 100;

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function bookmarksCol(uid: string) {
  return collection(db, 'users', uid, 'bookmarks');
}

function docToBookmark(snap: { id: string; data: () => Record<string, unknown> }): Bookmark {
  return normalizeBookmark(snap.id, snap.data());
}

export const queueService = {
  /**
   * Get the full queue (backlog + watching), sorted by priority desc then created_at desc.
   * Falls back to client-side sort since not all items have a priority field yet.
   */
  async getQueue(): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(
      bookmarksCol(uid),
      where('status', 'in', ['backlog', 'watching', 'scheduled']),
      orderBy('created_at', 'desc'),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(docToBookmark);
    // Client-side priority sort (handles missing priority gracefully)
    return items.sort((a, b) => {
      const pa = a.priority ?? DEFAULT_PRIORITY;
      const pb = b.priority ?? DEFAULT_PRIORITY;
      if (pb !== pa) return pb - pa;
      return b.created_at.localeCompare(a.created_at);
    });
  },

  /**
   * Get the top N "Up Next" items.
   * First returns items explicitly marked queue_status: 'up_next',
   * then fills remaining slots with highest-priority backlog items.
   */
  async getUpNext(count = 3): Promise<Bookmark[]> {
    const uid = getUid();

    // Explicit up_next items
    const upNextQuery = query(
      bookmarksCol(uid),
      where('queue_status', '==', 'up_next'),
      limit(count),
    );
    const upNextSnap = await getDocs(upNextQuery);
    const upNextItems = upNextSnap.docs.map(docToBookmark);

    if (upNextItems.length >= count) return upNextItems.slice(0, count);

    // Fill remaining with top-priority backlog items
    const needed = count - upNextItems.length;
    const upNextIds = new Set(upNextItems.map((b) => b.id));

    const backlogQuery = query(
      bookmarksCol(uid),
      where('status', '==', 'backlog'),
      orderBy('created_at', 'desc'),
      limit(needed + 5), // fetch extra to account for up_next duplicates
    );
    const backlogSnap = await getDocs(backlogQuery);
    const backlogItems = backlogSnap.docs
      .map(docToBookmark)
      .filter((b) => !upNextIds.has(b.id))
      .sort((a, b) => (b.priority ?? DEFAULT_PRIORITY) - (a.priority ?? DEFAULT_PRIORITY))
      .slice(0, needed);

    return [...upNextItems, ...backlogItems];
  },

  /**
   * Toggle a bookmark's "Up Next" status.
   * When promoted: sets queue_status = 'up_next' and bumps priority to 200.
   * When demoted: sets queue_status = 'queued' and resets priority to DEFAULT.
   */
  async toggleUpNext(id: string, promote: boolean): Promise<void> {
    const uid = getUid();
    const lifecycleState = promote ? "up_next" : "queued";
    await updateDoc(doc(db, 'users', uid, 'bookmarks', id), {
      queue_status: promote ? 'up_next' : 'queued',
      priority: promote ? 200 : DEFAULT_PRIORITY,
      ...buildLifecycleMetadataUpdate(lifecycleState),
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Set an explicit priority value on a bookmark.
   */
  async setPriority(id: string, priority: number): Promise<void> {
    const uid = getUid();
    await updateDoc(doc(db, 'users', uid, 'bookmarks', id), {
      priority,
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Reorder using midpoint insertion.
   * Pass null for prevPriority (top of list) or nextPriority (bottom of list).
   *   - Inserting at top:    prevPriority = null, nextPriority = existing top priority
   *   - Inserting at bottom: prevPriority = existing bottom priority, nextPriority = null
   *   - Inserting between:   both provided
   */
  async reorder(
    id: string,
    prevPriority: number | null,
    nextPriority: number | null,
  ): Promise<void> {
    const p = prevPriority ?? (nextPriority ?? DEFAULT_PRIORITY) + 200;
    const n = nextPriority ?? (prevPriority ?? DEFAULT_PRIORITY) - 200;
    const newPriority = (p + n) / 2;
    await this.setPriority(id, newPriority);
  },

  /**
   * Update watch progress (0–100%).
   * Also sets queue_status to 'in_progress' if > 0.
   */
  async updateProgress(id: string, percent: number): Promise<void> {
    const uid = getUid();
    const clamped = Math.max(0, Math.min(100, percent));
    const statusUpdate = clamped > 0 ? "watching" : undefined;
    const queueStatus = clamped > 0 ? "in_progress" : "queued";
    const lifecycleState = clamped > 0 ? "in_progress" : "queued";
    await updateDoc(doc(db, 'users', uid, 'bookmarks', id), {
      progress_percent: clamped,
      queue_status: queueStatus,
      ...(statusUpdate ? { status: statusUpdate } : {}),
      ...buildLifecycleMetadataUpdate(lifecycleState),
      updated_at: new Date().toISOString(),
    });
  },
};
