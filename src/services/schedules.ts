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
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Schedule, Bookmark } from '@/types/database';

type ScheduleWithBookmark = Schedule & { bookmarks: Bookmark };

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function schedulesCol(uid: string) {
  return collection(db, 'users', uid, 'schedules');
}

async function attachBookmark(uid: string, schedule: Schedule): Promise<ScheduleWithBookmark> {
  const bookmarkSnap = await getDoc(doc(db, 'users', uid, 'bookmarks', schedule.bookmark_id));
  const bookmark = { id: bookmarkSnap.id, ...bookmarkSnap.data() } as Bookmark;
  return { ...schedule, bookmarks: bookmark };
}

function docToSchedule(snap: any): Schedule {
  return { id: snap.id, ...snap.data() } as Schedule;
}

export const scheduleService = {
  /**
   * Get all schedules for the current user
   */
  async getSchedules(): Promise<ScheduleWithBookmark[]> {
    const uid = getUid();
    const q = query(schedulesCol(uid), orderBy('scheduled_for', 'asc'));
    const snap = await getDocs(q);
    const schedules = snap.docs.map(docToSchedule);
    return Promise.all(schedules.map((s) => attachBookmark(uid, s)));
  },

  /**
   * Get upcoming schedules
   */
  async getUpcomingSchedules(lim = 10): Promise<ScheduleWithBookmark[]> {
    const uid = getUid();
    const now = new Date().toISOString();
    const q = query(
      schedulesCol(uid),
      where('state', '==', 'scheduled'),
      where('scheduled_for', '>=', now),
      orderBy('scheduled_for', 'asc'),
      limit(lim),
    );
    const snap = await getDocs(q);
    const schedules = snap.docs.map(docToSchedule);
    return Promise.all(schedules.map((s) => attachBookmark(uid, s)));
  },

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string): Promise<ScheduleWithBookmark> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'schedules', id));
    if (!snap.exists()) throw new Error('Schedule not found');
    const schedule = docToSchedule(snap);
    return attachBookmark(uid, schedule);
  },

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: {
    bookmark_id: string;
    scheduled_for: string;
    reminder_offset_minutes?: number;
  }): Promise<Schedule> {
    const uid = getUid();
    const now = new Date().toISOString();
    const data = {
      ...schedule,
      user_id: uid,
      reminder_offset_minutes: schedule.reminder_offset_minutes || 60,
      state: 'scheduled',
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(schedulesCol(uid), data);
    return { id: ref.id, ...data } as Schedule;
  },

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'schedules', id);
    await updateDoc(ref, { ...updates, updated_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    return docToSchedule(snap);
  },

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'schedules', id));
  },

  /**
   * Cancel a schedule
   */
  async cancelSchedule(id: string): Promise<Schedule> {
    return this.updateSchedule(id, { state: 'cancelled' });
  },

  /**
   * Snooze a schedule
   */
  async snoozeSchedule(id: string, snoozeMinutes: number): Promise<Schedule> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'schedules', id));
    const schedule = docToSchedule(snap);
    const newScheduledFor = new Date(schedule.scheduled_for);
    newScheduledFor.setMinutes(newScheduledFor.getMinutes() + snoozeMinutes);
    return this.updateSchedule(id, {
      scheduled_for: newScheduledFor.toISOString(),
      state: 'snoozed',
    });
  },

  /**
   * Get schedules for today
   */
  async getTodaySchedules(): Promise<ScheduleWithBookmark[]> {
    const uid = getUid();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      schedulesCol(uid),
      where('state', '==', 'scheduled'),
      where('scheduled_for', '>=', today.toISOString()),
      where('scheduled_for', '<', tomorrow.toISOString()),
      orderBy('scheduled_for', 'asc'),
    );
    const snap = await getDocs(q);
    const schedules = snap.docs.map(docToSchedule);
    return Promise.all(schedules.map((s) => attachBookmark(uid, s)));
  },

  /**
   * Get schedules for this week
   */
  async getThisWeekSchedules(): Promise<ScheduleWithBookmark[]> {
    const uid = getUid();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const q = query(
      schedulesCol(uid),
      where('state', '==', 'scheduled'),
      where('scheduled_for', '>=', today.toISOString()),
      where('scheduled_for', '<', nextWeek.toISOString()),
      orderBy('scheduled_for', 'asc'),
    );
    const snap = await getDocs(q);
    const schedules = snap.docs.map(docToSchedule);
    return Promise.all(schedules.map((s) => attachBookmark(uid, s)));
  },
};
