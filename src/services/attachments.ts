import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import type { Attachment } from '@/types/database';

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function attachmentsCol(uid: string) {
  return collection(db, 'users', uid, 'attachments');
}

export const attachmentService = {
  /**
   * Get all attachments for a bookmark
   */
  async getAttachments(bookmarkId: string): Promise<Attachment[]> {
    const uid = getUid();
    const q = query(
      attachmentsCol(uid),
      where('bookmark_id', '==', bookmarkId),
      orderBy('created_at', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Attachment);
  },

  /**
   * Upload a file and create an attachment record
   */
  async createAttachment(file: File, bookmarkId: string): Promise<Attachment> {
    const uid = getUid();
    const storageRef = ref(storage, `attachments/${uid}/${bookmarkId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    const now = new Date().toISOString();
    const data = {
      user_id: uid,
      bookmark_id: bookmarkId,
      file_url: fileUrl,
      file_type: file.type,
      file_name: file.name,
      size: file.size,
      created_at: now,
      // Store storage path so we can delete later
      storage_path: storageRef.fullPath,
    };
    const docRef = await addDoc(attachmentsCol(uid), data);
    return { id: docRef.id, ...data } as Attachment & { storage_path: string };
  },

  /**
   * Delete an attachment (Firestore doc + Storage file)
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    const uid = getUid();
    const snap = await getDocs(
      query(attachmentsCol(uid), where('__name__', '==', attachmentId)),
    );
    // Try to delete from Storage if we have path
    try {
      const data = snap.docs[0]?.data();
      if (data?.storage_path) {
        await deleteObject(ref(storage, data.storage_path));
      } else if (data?.file_url) {
        // Best-effort: try to delete by constructing the ref from url
        await deleteObject(ref(storage, data.file_url));
      }
    } catch {
      // Storage delete failure is non-fatal; we still remove the Firestore doc
    }
    await deleteDoc(doc(db, 'users', uid, 'attachments', attachmentId));
  },
};
