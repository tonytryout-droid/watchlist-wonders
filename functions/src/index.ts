import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { enrichBookmark } from "./enrichment/enrichBookmark";
import { runRetroactiveEnrichment } from "./enrichment/retroactive";
import type { BookmarkForEnrichment } from "./tmdb/types";

if (!getApps().length) {
  initializeApp();
}

const tmdbApiKey = defineSecret("TMDB_API_KEY");

export { enrich } from "./enrich.js";
export { tmdbProxy } from "./tmdb.js";
export { refreshWatchAvailability } from "./availabilityRefresh.js";
export { sendReminders } from "./reminders.js";

export const onBookmarkCreated = onDocumentCreated(
  {
    document: "users/{userId}/bookmarks/{bookmarkId}",
    secrets: [tmdbApiKey],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const apiKey = tmdbApiKey.value();
    if (!apiKey) {
      console.warn("[onBookmarkCreated] TMDB_API_KEY is not configured.");
      return;
    }

    const data = snapshot.data();
    if (data.enriched === true) return;

    const bookmark: BookmarkForEnrichment = {
      id: event.params.bookmarkId,
      userId: event.params.userId,
      title: typeof data.title === "string" ? data.title : undefined,
      url: typeof data.source_url === "string" ? data.source_url : null,
      canonicalUrl: typeof data.canonical_url === "string" ? data.canonical_url : null,
      type: typeof data.type === "string" ? data.type : null,
      provider: typeof data.provider === "string" ? data.provider : null,
      metadata:
        data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
          ? (data.metadata as Record<string, unknown>)
          : {},
      enriched: data.enriched === true,
      tmdb: data.tmdb ?? null,
    };

    const result = await enrichBookmark(bookmark, apiKey);
    console.log(`[onBookmarkCreated] ${bookmark.id} -> ${result.status}`);
  },
);

export const retroactiveEnrich = onSchedule(
  {
    schedule: "every 4 hours",
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const apiKey = tmdbApiKey.value();
    if (!apiKey) {
      console.warn("[retroactiveEnrich] TMDB_API_KEY is not configured.");
      return;
    }

    const stats = await runRetroactiveEnrichment(apiKey);
    console.log("[retroactiveEnrich] stats:", stats);
  },
);

export const manualRetroactiveEnrich = onRequest(
  {
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "512MiB",
    invoker: "private",
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = tmdbApiKey.value();
    if (!apiKey) {
      response.status(500).json({ success: false, error: "TMDB_API_KEY is not configured." });
      return;
    }

    try {
      const stats = await runRetroactiveEnrichment(apiKey);
      response.status(200).json({ success: true, stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[manualRetroactiveEnrich]", message);
      response.status(500).json({ success: false, error: message });
    }
  },
);
