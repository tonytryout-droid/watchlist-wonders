import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collectionGroup,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Bookmark } from '@/types/database';

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export const sharingService = {
  /**
   * Make a bookmark publicly accessible via a share token.
   * Returns the share token (UUID).
   */
  async makeBookmarkPublic(bookmarkId: string): Promise<string> {
    const uid = getUid();
    const token = crypto.randomUUID();
    const ref = doc(db, 'users', uid, 'bookmarks', bookmarkId);
    await updateDoc(ref, { is_public: true, share_token: token });
    return token;
  },

  /** Remove public access from a bookmark. */
  async makeBookmarkPrivate(bookmarkId: string): Promise<void> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', bookmarkId);
    await updateDoc(ref, { is_public: false, share_token: null });
  },

  /**
   * Fetch a single bookmark by share token (public — no auth required).
   * Requires a Firestore composite index on bookmarks collection group:
   *   share_token ASC, is_public ASC
   */
  async getPublicBookmarkByToken(
    token: string,
  ): Promise<(Bookmark & { owner_uid: string }) | null> {
    const q = query(
      collectionGroup(db, 'bookmarks'),
      where('share_token', '==', token),
      where('is_public', '==', true),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    // Path is users/{uid}/bookmarks/{id}
    const owner_uid = d.ref.parent.parent?.id;
    if (!owner_uid) throw new Error('malformed bookmark path: missing owner uid');
    return { id: d.id, owner_uid, ...d.data() } as Bookmark & { owner_uid: string };
  },

  /** Fetch all public bookmarks by a specific user. */
  async getPublicBookmarksByUser(uid: string, lim = 50): Promise<Bookmark[]> {
    const q = query(
      collectionGroup(db, 'bookmarks'),
      where('user_id', '==', uid),
      where('is_public', '==', true),
      limit(lim),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bookmark);
  },
};
