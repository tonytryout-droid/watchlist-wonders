import { httpsCallable } from "firebase/functions";
import { fbFunctions } from "@/lib/firebase";

export interface EnrichResponse {
  [key: string]: unknown;
}

export async function enrichUrl(url: string): Promise<EnrichResponse> {
  const enrichCallable = httpsCallable<{ url: string }, EnrichResponse>(fbFunctions, "enrich");
  const result = await enrichCallable({ url });
  return result.data as EnrichResponse;
}

export async function selectResolutionCandidate(
  bookmarkId: string,
  action: "selected" | "skipped",
  candidate?: unknown,
): Promise<void> {
  const callable = httpsCallable<
    { bookmarkId: string; action: "selected" | "skipped"; candidate?: unknown },
    unknown
  >(fbFunctions, "selectResolutionCandidate");
  await callable({ bookmarkId, action, candidate });
}

export const skipResolutionSelection = async (bookmarkId: string): Promise<void> => {
  await selectResolutionCandidate(bookmarkId, 'skipped');
};

export interface SearchBookmarksResponse {
  results: Array<{
    id: string;
    title: string;
    poster_url: string | null;
    type: string;
    provider: string;
    tags: string[];
    auto_tags: string[];
    canonical_entity: unknown | null;
    cluster_id: string | null;
    score: number;
    breakdown: Record<string, number>;
    reason: string;
  }>;
}

export async function semanticSearchBookmarks(
  queryStr: string,
  options?: { topK?: number; mode?: string },
): Promise<SearchBookmarksResponse> {
  const callable = httpsCallable<
    { query: string; topK?: number; mode?: string },
    SearchBookmarksResponse
  >(fbFunctions, 'searchBookmarks');
  const result = await callable({
    query: queryStr,
    topK: options?.topK,
    mode: options?.mode,
  });
  return result.data;
}

export async function recordBookmarkView(bookmarkId: string): Promise<void> {
  const callable = httpsCallable<{ bookmarkId: string }, { ok: boolean }>(
    fbFunctions,
    'recordView',
  );
  await callable({ bookmarkId });
}
