import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Notification, Bookmark } from '@/types/database';

type NotificationWithBookmark = Notification & { bookmarks?: Bookmark };

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function notificationsCol(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

async function attachBookmark(uid: string, notif: Notification): Promise<NotificationWithBookmark> {
  if (!notif.bookmark_id) return notif;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'bookmarks', notif.bookmark_id));
    if (snap.exists()) {
      return { ...notif, bookmarks: { id: snap.id, ...snap.data() } as Bookmark };
    }
  } catch {}
  return notif;
}

function docToNotification(snap: any): Notification {
  return { id: snap.id, ...snap.data() } as Notification;
}

export const notificationService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(lim = 50): Promise<NotificationWithBookmark[]> {
    const uid = getUid();
    const q = query(notificationsCol(uid), orderBy('created_at', 'desc'), limit(lim));
    const snap = await getDocs(q);
    const notifications = snap.docs.map(docToNotification);
    return Promise.all(notifications.map((n) => attachBookmark(uid, n)));
  },

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(): Promise<NotificationWithBookmark[]> {
    const uid = getUid();
    const q = query(
      notificationsCol(uid),
      where('read_at', '==', null),
      orderBy('created_at', 'desc'),
    );
    const snap = await getDocs(q);
    const notifications = snap.docs.map(docToNotification);
    return Promise.all(notifications.map((n) => attachBookmark(uid, n)));
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const uid = getUid();
    const q = query(notificationsCol(uid), where('read_at', '==', null));
    const snap = await getDocs(q);
    return snap.size;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'notifications', id);
    await updateDoc(ref, { read_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    return docToNotification(snap);
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const uid = getUid();
    const q = query(notificationsCol(uid), where('read_at', '==', null));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    snap.docs.forEach((d) => batch.update(d.ref, { read_at: now }));
    await batch.commit();
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'notifications', id));
  },

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('created_at', 'desc'),
      limit(1),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = { id: change.doc.id, ...change.doc.data() } as Notification;
          callback(notif);
        }
      });
    });

    return unsubscribe;
  },
};
