import { getFirestore } from "firebase-admin/firestore";
import { generateStructured, isVertexConfigured } from "../ai/vertex";
import { cosineSimilarity } from "../ai/vectorIndex";
import { incrementMetric } from "../admin/metrics";

interface BookmarkEmbedding {
  id: string;
  title: string;
  embedding: number[];
  tags: string[];
}

const CLUSTER_NAME_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    emerging: { type: "boolean" },
  },
  required: ["name"],
};

// In this codebase embeddings live in Vertex Vector Search, not Firestore. For the
// reclustering job we operate on a working set drawn from the bookmark fingerprint's
// cached `centroid_embedding` (clusters) and an in-memory representative drawn at
// cluster-creation time. This keeps the job bounded and tractable.

async function loadCentroids(uid: string): Promise<Map<string, { embedding: number[]; titles: string[] }>> {
  const snap = await getFirestore().collection("users").doc(uid).collection("clusters").get();
  const out = new Map<string, { embedding: number[]; titles: string[] }>();
  for (const d of snap.docs) {
    const data = d.data();
    const emb = Array.isArray(data.centroid_embedding) ? (data.centroid_embedding as number[]) : null;
    if (!emb) continue;
    out.set(d.id, { embedding: emb, titles: Array.isArray(data.top_titles) ? (data.top_titles as string[]) : [] });
  }
  return out;
}

async function loadPendingBookmarks(uid: string): Promise<BookmarkEmbedding[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("bookmarks")
    .where("pending_cluster_assignment", "==", true)
    .limit(100)
    .get();

  const out: BookmarkEmbedding[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const embRef = typeof data.embedding_ref === "string" ? data.embedding_ref : null;
    if (!embRef) continue;
    // We don't have full embedding in Firestore — clustering uses a probe embedding
    // stamped onto the bookmark by the pipeline. For new bookmarks we pull a freshly
    // computed embedding from the pipeline's `fingerprint` cache if present.
    const cachedEmbedding = Array.isArray(data.fingerprint?.embedding_cache)
      ? (data.fingerprint.embedding_cache as number[])
      : null;
    if (!cachedEmbedding) continue;
    out.push({
      id: d.id,
      title: typeof data.title === "string" ? data.title : "",
      embedding: cachedEmbedding,
      tags: Array.isArray(data.auto_tags) ? (data.auto_tags as string[]) : [],
    });
  }
  return out;
}

function seedClusterId(): string {
  return `cl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function nameCluster(titles: string[], tags: string[]): Promise<{ name: string; emerging: boolean }> {
  if (!isVertexConfigured() || !titles.length) {
    return { name: titles[0]?.slice(0, 40) || tags[0] || "Cluster", emerging: false };
  }
  try {
    const prompt = [
      "Name this cluster of saved bookmarks in 2-4 words, like a Spotify playlist title.",
      "Be specific — avoid 'media', 'content', 'misc'.",
      "Set emerging=true if the topic looks novel or recent.",
      "",
      `Top titles:\n- ${titles.slice(0, 5).join("\n- ")}`,
      `Tags: ${tags.slice(0, 10).join(", ")}`,
    ].join("\n");
    return await generateStructured<{ name: string; emerging: boolean }>(prompt, CLUSTER_NAME_SCHEMA);
  } catch {
    return { name: titles[0]?.slice(0, 40) || "Cluster", emerging: false };
  }
}

const JOIN_THRESHOLD = 0.70;

export async function runOnlineClustering(uid: string): Promise<{ assigned: number; seeded: number }> {
  const centroids = await loadCentroids(uid);
  const pending = await loadPendingBookmarks(uid);
  if (!pending.length) return { assigned: 0, seeded: 0 };

  const db = getFirestore();
  let assigned = 0;
  let seeded = 0;

  for (const item of pending) {
    let bestId: string | null = null;
    let bestSim = 0;
    centroids.forEach((c, id) => {
      const sim = cosineSimilarity(item.embedding, c.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestId = id;
      }
    });

    let targetId: string;
    if (bestId && bestSim >= JOIN_THRESHOLD) {
      targetId = bestId;
      assigned++;
    } else {
      targetId = seedClusterId();
      const { name, emerging } = await nameCluster([item.title], item.tags);
      await db.collection("users").doc(uid).collection("clusters").doc(targetId).set({
        id: targetId,
        name,
        centroid_ref: `centroid:${targetId}`,
        centroid_embedding: item.embedding,
        member_count: 1,
        last_updated: new Date().toISOString(),
        emerging_trend: emerging,
        top_titles: [item.title],
      });
      centroids.set(targetId, { embedding: item.embedding, titles: [item.title] });
      seeded++;
    }

    await db.collection("users").doc(uid).collection("bookmarks").doc(item.id).set(
      {
        cluster_id: targetId,
        pending_cluster_assignment: false,
        "fingerprint.embedding_cache": null,
      },
      { merge: true },
    );
  }

  await incrementMetric("clustering.online.run");
  return { assigned, seeded };
}

export async function runReclusteringForAllUsers(maxUsers = 200): Promise<{ users: number; clusters: number }> {
  const usersSnap = await getFirestore().collection("users").limit(maxUsers).get();
  let users = 0;
  let clusters = 0;
  for (const u of usersSnap.docs) {
    const r = await runOnlineClustering(u.id).catch((err) => {
      console.warn("[clustering] user failed", u.id, err);
      return { assigned: 0, seeded: 0 };
    });
    users++;
    clusters += r.seeded;
  }
  return { users, clusters };
}
