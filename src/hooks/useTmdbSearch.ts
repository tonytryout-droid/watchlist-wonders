import { useQuery } from '@tanstack/react-query';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

/**
 * Counts overlapping significant words between two strings.
 * Used to pick the best match when a title search returns multiple results.
 */
function overlapScore(a: string, b: string): number {
  const sig = (s: string) =>
    new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const setA = sig(a);
  let count = 0;
  for (const w of sig(b)) if (setA.has(w)) count++;
  return count;
}

async function searchTmdb(
  title: string,
  mediaType: 'movie' | 'tv',
  overview?: string,
): Promise<number | null> {
  const url = `${TMDB_BASE}/search/${mediaType}?query=${encodeURIComponent(title)}&api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  const results = (data.results ?? []) as any[];
  if (!results.length) return null;

  // Single result — no disambiguation needed
  if (results.length === 1 || !overview) return results[0].id;

  // Disambiguate: favour the result whose overview overlaps most with ours
  let best = results[0];
  let bestScore = overlapScore(overview, results[0].overview ?? '');

  for (let i = 1; i < results.length; i++) {
    const score = overlapScore(overview, results[i].overview ?? '');
    if (score > bestScore) {
      bestScore = score;
      best = results[i];
    }
  }

  return best.id as number;
}

/**
 * Resolves a TMDB ID from a title + media type when the ID is not already
 * stored in the bookmark's metadata.  Uses the bookmark's stored overview
 * (if any) to pick the right result when multiple titles match.
 */
export function useTmdbSearch(
  title: string | undefined | null,
  type: string,
  overview?: string,
) {
  const mediaType: 'movie' | 'tv' =
    type === 'series' || type === 'episode' ? 'tv' : 'movie';

  return useQuery({
    queryKey: ['tmdb-search', title, mediaType],
    queryFn: () => searchTmdb(title!, mediaType, overview),
    enabled: !!title && !!TMDB_KEY,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days — titles don't change
  });
}
