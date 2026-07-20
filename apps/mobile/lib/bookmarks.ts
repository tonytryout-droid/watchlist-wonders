import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { selectResolutionCandidate, skipResolutionSelection } from "./functions";

export interface MobileBookmark {
  id: string;
  title: string;
  type: string;
  provider: string;
  status: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  tags: string[];
  notes: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}

function bookmarksCol() {
  return collection(db, "users", uid(), "bookmarks");
}

export async function getSavedBookmarks(count = 40): Promise<MobileBookmark[]> {
  const q = query(bookmarksCol(), orderBy("created_at", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MobileBookmark, "id">) }));
}

export async function getBookmark(id: string): Promise<MobileBookmark | null> {
  const snap = await getDoc(doc(db, "users", uid(), "bookmarks", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MobileBookmark, "id">) };
}

export async function selectCandidate(bookmarkId: string, candidate: unknown): Promise<void> {
  await selectResolutionCandidate(bookmarkId, candidate);
}

export async function skipSelection(bookmarkId: string): Promise<void> {
  await skipResolutionSelection(bookmarkId);
}
