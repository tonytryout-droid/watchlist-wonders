import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { UserFollow, FeedItem, PublicProfile } from '@/types/database';

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export const socialService = {
  /** Follow a user — writes to both follower's following list and target's followers list. */
  async followUser(targetUid: string): Promise<void> {
    const myUid = getUid();
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    batch.set(doc(db, 'users', myUid, 'following', targetUid), {
      follower_uid: myUid,
      following_uid: targetUid,
      created_at: now,
    });
    batch.set(doc(db, 'users', targetUid, 'followers', myUid), {
      follower_uid: myUid,
      following_uid: targetUid,
      created_at: now,
    });
    await batch.commit();
  },

  /** Unfollow a user — removes from both subcollections. */
  async unfollowUser(targetUid: string): Promise<void> {
    const myUid = getUid();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', myUid, 'following', targetUid));
    batch.delete(doc(db, 'users', targetUid, 'followers', myUid));
    await batch.commit();
  },

  /** Check if current user follows targetUid. */
  async isFollowing(targetUid: string): Promise<boolean> {
    const myUid = getUid();
    const snap = await getDoc(doc(db, 'users', myUid, 'following', targetUid));
    return snap.exists();
  },

  /** Get list of UIDs the given user is following. */
  async getFollowingList(uid: string): Promise<UserFollow[]> {
    const snap = await getDocs(collection(db, 'users', uid, 'following'));
    return snap.docs.map((d) => d.data() as UserFollow);
  },

  /** Get follower count for a user. */
  async getFollowerCount(uid: string): Promise<number> {
    const snap = await getDocs(collection(db, 'users', uid, 'followers'));
    return snap.size;
  },

  /** Get following count for a user. */
  async getFollowingCount(uid: string): Promise<number> {
    const snap = await getDocs(collection(db, 'users', uid, 'following'));
    return snap.size;
  },

  /** Get the current user's feed (last 50 items). */
  async getFeed(uid: string): Promise<FeedItem[]> {
    const q = query(
      collection(db, 'feed', uid, 'items'),
      orderBy('created_at', 'desc'),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FeedItem);
  },

  /**
   * Publish a feed item to current user's own feed and each follower's feed.
   * ⚠️ writeBatch is limited to 500 ops — fine for <400 followers.
   */
  async publishFeedItem(
    item: Omit<FeedItem, 'id'>,
    followerUids: string[],
  ): Promise<void> {
    const myUid = getUid();
    const batch = writeBatch(db);
    const addItem = (uid: string) =>
      batch.set(doc(collection(db, 'feed', uid, 'items')), {
        ...item,
        created_at: item.created_at || new Date().toISOString(),
      });
    addItem(myUid);
    followerUids.forEach(addItem);
    await batch.commit();
  },

  /** Read public profile for a user. */
  async getUserPublicProfile(uid: string): Promise<PublicProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'public'));
    if (!snap.exists()) return null;
    return { uid, ...snap.data() } as PublicProfile;
  },

  /** Save current user's public profile. */
  async savePublicProfile(profile: Partial<Omit<PublicProfile, 'uid'>>): Promise<void> {
    const uid = getUid();
    await setDoc(doc(db, 'users', uid, 'profile', 'public'), profile, { merge: true });
  },
};
