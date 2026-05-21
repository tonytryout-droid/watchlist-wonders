import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { runIngestionPipeline } from "./pipeline/ingest";
import { recomputeAllImportance } from "./intelligence/importance";
import { runReclusteringForAllUsers } from "./intelligence/cluster";
import { resurfaceAllUsers } from "./intelligence/resurface";
import type { PipelineBookmark } from "./pipeline/types";

if (!getApps().length) {
  initializeApp();
}

const tmdbApiKey = defineSecret("TMDB_API_KEY");

export { enrich } from "./enrich.js";
export { captureShare } from "./captureShare.js";
export { selectResolutionCandidate } from "./resolution/events.js";
export { tmdbProxy } from "./tmdb.js";
export { refreshWatchAvailability } from "./availabilityRefresh.js";
export { sendReminders } from "./reminders.js";
export { searchBookmarks } from "./retrieval/searchBookmarks";
export {
  adminSystemHealth,
  adminUserBehavior,
  adminIntelligenceQuality,
  adminContentGraph,
  adminRetention,
  recordView,
  respondToResurface,
} from "./admin/queries";

function toPipelineBookmark(eventBookmarkId: string, eventUserId: string, data: Record<string, unknown>): PipelineBookmark {
  return {
    id: eventBookmarkId,
    userId: eventUserId,
    title: typeof data.title === "string" ? data.title : undefined,
    source_url: typeof data.source_url === "string" ? data.source_url : null,
    canonical_url: typeof data.canonical_url === "string" ? data.canonical_url : null,
    type: typeof data.type === "string" ? data.type : null,
    provider: typeof data.provider === "string" ? data.provider : null,
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
    poster_url: typeof data.poster_url === "string" ? data.poster_url : null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    notes: typeof data.notes === "string" ? data.notes : null,
    user_rating: typeof data.user_rating === "number" ? data.user_rating : null,
    enriched: data.enriched === true,
    tmdb: data.tmdb ?? null,
    view_count: typeof data.view_count === "number" ? data.view_count : undefined,
    importance_score: typeof data.importance_score === "number" ? data.importance_score : undefined,
  };
}

export const onBookmarkCreated = onDocumentCreated(
  {
    document: "users/{userId}/bookmarks/{bookmarkId}",
    secrets: [tmdbApiKey],
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (typeof data.pipeline_version === "number" && data.pipeline_version >= 2) {
      return;
    }

    const bookmark = toPipelineBookmark(event.params.bookmarkId, event.params.userId, data);
    const apiKey = (() => {
      try {
        return tmdbApiKey.value() || null;
      } catch {
        return null;
      }
    })();

    const summary = await runIngestionPipeline(bookmark, apiKey);
    console.log("[onBookmarkCreated]", bookmark.id, summary.status, summary.resolveSource, summary.resolveConfidence.toFixed(2));
  },
);

export const retroactivePipeline = onSchedule(
  {
    schedule: "every 4 hours",
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const apiKey = (() => {
      try {
        return tmdbApiKey.value() || null;
      } catch {
        return null;
      }
    })();
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();
    const snap = await db
      .collectionGroup("bookmarks")
      .where("pipeline_version", "<", 2)
      .orderBy("pipeline_version", "asc")
      .limit(500)
      .get()
      .catch(async () => {
        // pipeline_version may not exist on legacy docs; fall back to enriched=false
        return db
          .collectionGroup("bookmarks")
          .where("enriched", "==", false)
          .orderBy("created_at", "asc")
          .limit(500)
          .get();
      });
    let completed = 0;
    let errors = 0;
    for (const doc of snap.docs) {
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;
      const data = doc.data();
      const bookmark = toPipelineBookmark(doc.id, uid, data);
      const r = await runIngestionPipeline(bookmark, apiKey).catch((err) => {
        console.warn("[retroactivePipeline] error", doc.id, err instanceof Error ? err.message : err);
        return null;
      });
      if (!r) errors++;
      else if (r.status === "completed" || r.status === "partial") completed++;
      else errors++;
    }
    console.log("[retroactivePipeline]", { processed: snap.size, completed, errors });
  },
);

export const recomputeImportanceJob = onSchedule(
  { schedule: "every day 03:00", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const result = await recomputeAllImportance();
    console.log("[recomputeImportanceJob]", result);
  },
);

export const reclusterJob = onSchedule(
  { schedule: "every 6 hours", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const result = await runReclusteringForAllUsers();
    console.log("[reclusterJob]", result);
  },
);

export const resurfaceJob = onSchedule(
  { schedule: "every day 09:00", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const result = await resurfaceAllUsers();
    console.log("[resurfaceJob]", result);
  },
);

export const manualRetroactiveEnrich = onRequest(
  {
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "1GiB",
    invoker: "private",
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const apiKey = tmdbApiKey.value() || null;
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore();
      const snap = await db
        .collectionGroup("bookmarks")
        .where("enriched", "==", false)
        .orderBy("created_at", "asc")
        .limit(500)
        .get();
      let completed = 0;
      for (const doc of snap.docs) {
        const uid = doc.ref.parent.parent?.id;
        if (!uid) continue;
        const bookmark = toPipelineBookmark(doc.id, uid, doc.data());
        const r = await runIngestionPipeline(bookmark, apiKey).catch(() => null);
        if (r && (r.status === "completed" || r.status === "partial")) completed++;
      }
      response.status(200).json({ success: true, processed: snap.size, completed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[manualRetroactiveEnrich]", message);
      response.status(500).json({ success: false, error: message });
    }
  },
);
