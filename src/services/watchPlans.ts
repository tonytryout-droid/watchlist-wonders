import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { WatchPlan, Bookmark } from '@/types/database';

type WatchPlanBookmarkRow = {
  plan_id: string;
  bookmark_id: string;
  user_id: string;
  position: number;
  bookmarks: Bookmark;
};

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function plansCol(uid: string) {
  return collection(db, 'users', uid, 'watchPlans');
}

function planBookmarksCol(uid: string, planId: string) {
  return collection(db, 'users', uid, 'watchPlans', planId, 'bookmarks');
}

function docToWatchPlan(snap: any): WatchPlan {
  return { id: snap.id, ...snap.data() } as WatchPlan;
}

export const watchPlanService = {
  /**
   * Get all watch plans for the current user
   */
  async getWatchPlans(): Promise<WatchPlan[]> {
    const uid = getUid();
    const q = query(plansCol(uid), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(docToWatchPlan);
  },

  /**
   * Get a single watch plan by ID
   */
  async getWatchPlan(id: string): Promise<WatchPlan> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'watchPlans', id));
    if (!snap.exists()) throw new Error('Watch plan not found');
    return docToWatchPlan(snap);
  },

  /**
   * Create a new watch plan
   */
  async createWatchPlan(
    plan: Omit<WatchPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ): Promise<WatchPlan> {
    const uid = getUid();
    const now = new Date().toISOString();
    const data = {
      ...plan,
      user_id: uid,
      preferred_days: plan.preferred_days || [],
      mood_tags: plan.mood_tags || [],
      platforms_allowed: plan.platforms_allowed || [],
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(plansCol(uid), data);
    return { id: ref.id, ...data } as WatchPlan;
  },

  /**
   * Update a watch plan
   */
  async updateWatchPlan(id: string, updates: Partial<WatchPlan>): Promise<WatchPlan> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'watchPlans', id);
    await updateDoc(ref, { ...updates, updated_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    return docToWatchPlan(snap);
  },

  /**
   * Delete a watch plan
   */
  async deleteWatchPlan(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'watchPlans', id));
  },

  /**
   * Get bookmarks in a watch plan
   */
  async getPlanBookmarks(planId: string): Promise<WatchPlanBookmarkRow[]> {
    const uid = getUid();
    const q = query(planBookmarksCol(uid, planId), orderBy('position', 'asc'));
    const snap = await getDocs(q);

    const rows = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const bookmarkSnap = await getDoc(doc(db, 'users', uid, 'bookmarks', data.bookmark_id));
        const bookmark = { id: bookmarkSnap.id, ...bookmarkSnap.data() } as Bookmark;
        return {
          plan_id: planId,
          bookmark_id: data.bookmark_id,
          user_id: uid,
          position: data.position,
          bookmarks: bookmark,
        } as WatchPlanBookmarkRow;
      }),
    );

    return rows;
  },

  /**
   * Add a bookmark to a watch plan
   */
  async addBookmarkToPlan(planId: string, bookmarkId: string, position?: number): Promise<void> {
    const uid = getUid();
    await addDoc(planBookmarksCol(uid, planId), {
      bookmark_id: bookmarkId,
      user_id: uid,
      position: position ?? 0,
    });
  },

  /**
   * Remove a bookmark from a watch plan
   */
  async removeBookmarkFromPlan(planId: string, bookmarkId: string): Promise<void> {
    const uid = getUid();
    const q = query(planBookmarksCol(uid, planId), where('bookmark_id', '==', bookmarkId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },

  /**
   * Reorder bookmarks in a watch plan
   */
  async reorderPlanBookmarks(planId: string, bookmarkIds: string[]): Promise<void> {
    const uid = getUid();
    const existingSnap = await getDocs(planBookmarksCol(uid, planId));
    const batch = writeBatch(db);
    existingSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    if (bookmarkIds.length > 0) {
      const insertBatch = writeBatch(db);
      bookmarkIds.forEach((bookmarkId, index) => {
        const newRef = doc(planBookmarksCol(uid, planId));
        insertBatch.set(newRef, { bookmark_id: bookmarkId, user_id: uid, position: index });
      });
      await insertBatch.commit();
    }
  },
};
