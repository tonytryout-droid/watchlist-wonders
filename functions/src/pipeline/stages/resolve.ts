import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { searchMulti, getDetails, buildEnrichment } from "../../tmdb/client";
import { titleSimilarity } from "../../tmdb/titleNormalizer";
import { embedText, isVertexConfigured } from "../../ai/vertex";
import { cosineSimilarity } from "../../ai/vectorIndex";
import type {
  ClassifyResult,
  ExtractedSignals,
  FingerprintResult,
  PipelineBookmark,
  ResolveResult,
} from "../types";

const CONFIDENCE_MATCH = 0.75;
const CONFIDENCE_SUGGESTED = 0.55;
const EMBED_RERANK_THRESHOLD = 0.78;

function urlHash(url: string | null | undefined): string {
  if (!url) return "";
  return createHash("sha1").update(url.trim().toLowerCase()).digest("hex");
}

function unresolved(reason: string): ResolveResult {
  return {
    source: "unresolved",
    id: reason,
    type: "unknown",
    title: "",
    year: null,
    genres: [],
    runtime: null,
    poster: null,
    confidence: 0,
    suggested: false,
  };
}

interface Candidate {
  title: string;
  year: number | null;
  overview: string;
  popularity: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  posterPath: string | null;
}

function normalizePopularity(value: number): number {
  return Math.min(value / 200, 1);
}

async function fetchTmdbCandidates(
  apiKey: string,
  titles: string[],
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const seen = new Set<number>();
  for (const title of titles) {
    if (!title.trim()) continue;
    const res = await searchMulti(apiKey, title).catch(() => null);
    if (!res?.results) continue;
    for (const r of res.results) {
      if (r.media_type !== "movie" && r.media_type !== "tv") continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const display = r.title ?? r.name ?? "";
      const date = r.release_date ?? r.first_air_date ?? null;
      out.push({
        title: display,
        year: date ? Number(date.slice(0, 4)) : null,
        overview: r.overview ?? "",
        popularity: Number(r.popularity) || 0,
        tmdbId: r.id,
        mediaType: r.media_type,
        posterPath: r.poster_path ?? null,
      });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

async function readCache(hash: string): Promise<ResolveResult | null> {
  if (!hash) return null;
  try {
    const snap = await getFirestore().collection("entityCache").doc(hash).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.canonical_entity) return null;
    const ce = data.canonical_entity as ResolveResult & { suggested?: boolean };
    return { ...ce, suggested: ce.suggested ?? false };
  } catch {
    return null;
  }
}

async function writeCache(hash: string, entity: ResolveResult): Promise<void> {
  if (!hash || entity.source === "unresolved") return;
  try {
    await getFirestore().collection("entityCache").doc(hash).set({
      url_hash: hash,
      canonical_entity: entity,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[resolve.writeCache] failed", err instanceof Error ? err.message : err);
  }
}

export async function resolve(
  bookmark: PipelineBookmark,
  signals: ExtractedSignals,
  fp: FingerprintResult | null,
  classifyResult: ClassifyResult,
  tmdbApiKey: string | null,
): Promise<ResolveResult> {
  const cacheKey = urlHash(bookmark.canonical_url ?? bookmark.source_url ?? null);
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  if (classifyResult.contentType === "article" && classifyResult.confidence < 0.5) {
    return unresolved("article_low_confidence");
  }

  if (!tmdbApiKey) {
    return unresolved("no_tmdb_key");
  }

  const titles = classifyResult.candidateTitles.length
    ? classifyResult.candidateTitles
    : [signals.rawTitle].filter(Boolean);

  if (!titles.length) return unresolved("no_candidates");

  const candidates = await fetchTmdbCandidates(tmdbApiKey, titles);
  if (!candidates.length) {
    const result = unresolved("no_tmdb_results");
    await writeCache(cacheKey, result);
    return result;
  }

  const primary = titles[0].toLowerCase();
  const scored = candidates.map((c) => ({
    candidate: c,
    tokenOverlap: titleSimilarity(primary, c.title.toLowerCase()),
    popularity: normalizePopularity(c.popularity),
    yearAligned: classifyResult.year && c.year ? (Math.abs(c.year - classifyResult.year) <= 1 ? 1 : 0) : 0.5,
  }));

  let bestScored = scored[0];
  for (const s of scored) {
    if (s.tokenOverlap + s.popularity * 0.2 > bestScored.tokenOverlap + bestScored.popularity * 0.2) {
      bestScored = s;
    }
  }

  let embeddingSimilarity = 0;
  if (fp?.textEmbedding.length && isVertexConfigured()) {
    try {
      const embeds = await Promise.all(
        scored.slice(0, 6).map((s) =>
          embedText(`${s.candidate.title} ${s.candidate.year ?? ""} ${s.candidate.overview}`.trim()),
        ),
      );
      let maxSim = 0;
      let maxIdx = 0;
      embeds.forEach((emb, i) => {
        const sim = cosineSimilarity(fp.textEmbedding, emb);
        if (sim > maxSim) {
          maxSim = sim;
          maxIdx = i;
        }
      });
      embeddingSimilarity = maxSim;
      if (maxSim >= EMBED_RERANK_THRESHOLD) {
        bestScored = scored[maxIdx];
      }
    } catch (err) {
      console.warn("[resolve] embed rerank failed", err instanceof Error ? err.message : err);
    }
  }

  const confidence =
    0.5 * bestScored.tokenOverlap +
    0.4 * embeddingSimilarity +
    0.1 * bestScored.popularity;

  if (confidence < CONFIDENCE_SUGGESTED) {
    const result = unresolved(`low_confidence:${bestScored.candidate.title}`);
    await writeCache(cacheKey, result);
    return result;
  }

  const detail = await getDetails(tmdbApiKey, bestScored.candidate.tmdbId, bestScored.candidate.mediaType).catch(() => null);
  const enrichment = buildEnrichment(
    {
      id: bestScored.candidate.tmdbId,
      media_type: bestScored.candidate.mediaType,
      title: bestScored.candidate.title,
      poster_path: bestScored.candidate.posterPath,
      overview: bestScored.candidate.overview,
      popularity: bestScored.candidate.popularity,
    } as never,
    detail,
  );

  const result: ResolveResult = {
    source: "tmdb",
    id: String(enrichment.tmdbId),
    type: bestScored.candidate.mediaType === "tv" ? "tv" : "movie",
    title: enrichment.title,
    year: enrichment.releaseYear,
    genres: enrichment.genres,
    runtime: enrichment.runtimeMinutes,
    poster: enrichment.posterUrl,
    confidence,
    suggested: confidence < CONFIDENCE_MATCH,
  };
  await writeCache(cacheKey, result);
  return result;
}
