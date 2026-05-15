import { getFirestore } from "firebase-admin/firestore";
import { incrementMetric } from "../admin/metrics";

interface BookmarkLite {
  id: string;
  view_count: number;
  has_canonical: boolean;
  tags: string[];
  has_note: boolean;
  has_rating: boolean;
  user_id: string;
}

function normalizeViews(views: number, maxViews: number): number {
  if (maxViews <= 0) return 0;
  return Math.min(1, Math.log(views + 1) / Math.log(maxViews + 1));
}

function tagOverlap(tags: string[], userTopTags: Set<string>): number {
  if (!tags.length || userTopTags.size === 0) return 0;
  let hits = 0;
  for (const t of tags) if (userTopTags.has(t.toLowerCase())) hits++;
  return Math.min(1, hits / Math.max(1, tags.length));
}

function topUserTags(bookmarks: BookmarkLite[], n = 20): Set<string> {
  const counts: Record<string, number> = {};
  for (const b of bookmarks) {
    for (const t of b.tags) {
      const key = t.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return new Set(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([t]) => t),
  );
}

async function loadUserBookmarks(uid: string): Promise<BookmarkLite[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("bookmarks")
    .limit(1000)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      user_id: uid,
      view_count: typeof data.view_count === "number" ? data.view_count : 0,
      has_canonical: !!data.canonical_entity,
      tags: [
        ...(Array.isArray(data.tags) ? (data.tags as string[]) : []),
        ...(Array.isArray(data.auto_tags) ? (data.auto_tags as string[]) : []),
      ],
      has_note: typeof data.notes === "string" && data.notes.trim().length > 0,
      has_rating: typeof data.user_rating === "number" && data.user_rating > 0,
    };
  });
}

export async function recomputeImportance(uid: string): Promise<{ updated: number }> {
  const bookmarks = await loadUserBookmarks(uid);
  if (!bookmarks.length) return { updated: 0 };

  const maxViews = bookmarks.reduce((m, b) => Math.max(m, b.view_count), 0);
  const userTopTags = topUserTags(bookmarks);
  const db = getFirestore();
  const batch = db.batch();
  let updated = 0;

  for (const b of bookmarks) {
    const score =
      0.4 * normalizeViews(b.view_count, maxViews) +
      0.3 * (b.has_canonical ? 1 : 0.3) +
      0.2 * tagOverlap(b.tags, userTopTags) +
      0.1 * (b.has_note || b.has_rating ? 1 : 0);

    const ref = db.collection("users").doc(uid).collection("bookmarks").doc(b.id);
    batch.set(ref, { importance_score: Math.round(score * 1000) / 1000 }, { merge: true });
    updated++;
    if (updated % 400 === 0) await batch.commit();
  }
  await batch.commit().catch(() => undefined);
  await incrementMetric("importance.user.recomputed");
  return { updated };
}

export async function recomputeAllImportance(maxUsers = 200): Promise<{ users: number; bookmarks: number }> {
  const usersSnap = await getFirestore().collection("users").limit(maxUsers).get();
  let users = 0;
  let bookmarks = 0;
  for (const u of usersSnap.docs) {
    const r = await recomputeImportance(u.id).catch((err) => {
      console.warn("[importance] user failed", u.id, err);
      return { updated: 0 };
    });
    users++;
    bookmarks += r.updated;
  }
  await incrementMetric("importance.run.completed");
  return { users, bookmarks };
}
