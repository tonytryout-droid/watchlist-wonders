import type { TmdbResult } from './types.js';
import { withRetry } from './retry.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

/**
 * Enrich a movie or TV show with TMDB metadata.
 * Returns null if the API key is missing or the request fails.
 */
export async function enrichWithTMDB(
  title: string,
  mediaType: 'movie' | 'tv',
  year?: number | null,
): Promise<TmdbResult | null> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    console.error('[Enrichment] TMDB API key not configured');
    return null;
  }

  return withRetry(
    async () => {
      const params = new URLSearchParams({ api_key: apiKey, query: title });
      if (year && mediaType === 'movie') params.set('year', String(year));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params}`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`TMDB API returned status ${res.status}`);

      const data = await res.json();
      const result = data.results?.[0];
      if (!result) {
        console.warn('[Enrichment] No TMDB results found for:', title);
        return null;
      }

      const posterPath = result.poster_path;
      const backdropPath = result.backdrop_path;
      const rawDate: string | undefined =
        mediaType === 'movie' ? result.release_date : result.first_air_date;
      const releaseYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) || null : null;

      return {
        poster_url: posterPath ? `${TMDB_IMG}/w500${posterPath}` : null,
        backdrop_url: backdropPath ? `${TMDB_IMG}/original${backdropPath}` : null,
        tmdb_id: result.id,
        vote_average: result.vote_average ?? null,
        release_year: releaseYear,
        overview: result.overview || null,
      };
    },
    `TMDB enrichment for "${title}"`,
  );
}
