import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { TmdbEnrichment } from "../../tmdb/types";
import type {
  AutoTagResult,
  ClassifyResult,
  ClusterAssignment,
  ExtractedSignals,
  FingerprintResult,
  PipelineBookmark,
  ResolveResult,
} from "../types";
import { PIPELINE_VERSION } from "../types";

function buildLegacyTmdb(resolveResult: ResolveResult): TmdbEnrichment | null {
  if (resolveResult.source !== "tmdb" || !resolveResult.id) return null;
  const tmdbId = Number(resolveResult.id);
  if (!Number.isFinite(tmdbId)) return null;
  return {
    tmdbId,
    mediaType: resolveResult.type === "tv" ? "tv" : "movie",
    title: resolveResult.title,
    originalTitle: resolveResult.title,
    overview: null,
    posterPath: null,
    posterUrl: resolveResult.poster,
    backdropPath: null,
    backdropUrl: null,
    releaseDate: resolveResult.year ? `${resolveResult.year}-01-01` : null,
    releaseYear: resolveResult.year ?? null,
    rating: null,
    voteCount: null,
    popularity: null,
    genreIds: [],
    genres: resolveResult.genres,
    runtimeMinutes: resolveResult.runtime,
    trailerUrl: null,
    canonicalUrl: `https://www.themoviedb.org/${resolveResult.type === "tv" ? "tv" : "movie"}/${tmdbId}`,
    streaming: {},
    enrichedAt: new Date().toISOString(),
  };
}

export async function persist(
  bookmark: PipelineBookmark,
  signals: ExtractedSignals,
  fp: FingerprintResult | null,
  classifyResult: ClassifyResult,
  resolveResult: ResolveResult,
  autoTags: AutoTagResult,
  cluster: ClusterAssignment,
): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("users").doc(bookmark.userId).collection("bookmarks").doc(bookmark.id);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    updated_at: now,
    pipeline_version: PIPELINE_VERSION,
    auto_tags: autoTags.tags,
    context: {
      reason: null,
      mood: autoTags.inferredMood,
      inferred_tags: autoTags.topics,
      domain_type: signals.domainType,
    },
    fingerprint: fp
      ? {
          text_embedding_id: fp.textEmbeddingId,
          image_embedding_id: fp.imageEmbeddingId,
          extracted_keywords: fp.extractedKeywords,
          platform: fp.platform,
          // embedding_cache is retained transiently to support scheduled clustering
          // when no centroid was close enough at write time. Cleared after assignment.
          embedding_cache: cluster.clusterId ? null : (fp.textEmbedding.length ? fp.textEmbedding : null),
        }
      : null,
    embedding_ref: fp?.textEmbeddingId ?? null,
    cluster_id: cluster.clusterId,
    pending_cluster_assignment: cluster.pending,
  };

  if (resolveResult.source !== "unresolved") {
    update.canonical_entity = {
      source: resolveResult.source,
      id: resolveResult.id,
      type: resolveResult.type,
      title: resolveResult.title,
      year: resolveResult.year,
      genres: resolveResult.genres,
      runtime: resolveResult.runtime,
      poster: resolveResult.poster,
      confidence: resolveResult.confidence,
      matched_at: now,
      suggested: resolveResult.suggested,
    };

    const legacy = buildLegacyTmdb(resolveResult);
    if (legacy && !bookmark.enriched && !bookmark.tmdb) {
      update.tmdb = legacy;
      update.enriched = true;
      update.enriched_at = now;
      update.enrich_fail_reason = null;
      if (resolveResult.title) update.title = resolveResult.title;
      if (resolveResult.poster) {
        update.poster_url = resolveResult.poster;
      }
      if (resolveResult.year) update.release_year = resolveResult.year;
      if (resolveResult.runtime) update.runtime_minutes = resolveResult.runtime;
      update.type = resolveResult.type === "tv" ? "series" : "movie";
    }
  } else {
    update.canonical_entity = null;
    if (!bookmark.enriched) {
      update.enriched = true;
      update.enriched_at = now;
      update.enrich_fail_reason = resolveResult.id;
      update.tmdb = null;
    }
  }

  if (typeof bookmark.view_count !== "number") {
    update.view_count = 0;
  }
  if (typeof bookmark.importance_score !== "number") {
    update.importance_score = 0.5;
  }

  await ref.set(update, { merge: true });
}

export async function bumpView(userId: string, bookmarkId: string): Promise<void> {
  const ref = getFirestore()
    .collection("users")
    .doc(userId)
    .collection("bookmarks")
    .doc(bookmarkId);
  await ref.set(
    {
      view_count: FieldValue.increment(1),
      last_viewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );
}

