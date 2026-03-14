import * as logger from 'firebase-functions/logger';
import type { EnrichResponse } from './types.js';
import { tmdbApiKey } from './tmdb.js';
import { enrichViaOG } from './openGraph.js';

export function extractImdbId(url: string): string | null {
  const match = url.match(/\/title\/(tt\d+)/i);
  return match ? match[1] : null;
}

export async function enrichIMDb(url: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey) return enrichViaOG(url, 'imdb');

  const imdbId = extractImdbId(url);
  if (!imdbId) return enrichViaOG(url, 'imdb');

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${apiKey}`
    );
    if (!res.ok) return enrichViaOG(url, 'imdb');

    const data = (await res.json()) as any;
    const isTV = !!data.tv_results?.[0];
    const result = isTV ? data.tv_results[0] : data.movie_results?.[0];
    if (!result) return enrichViaOG(url, 'imdb');

    const rawDate = isTV ? result.first_air_date : result.release_date;
    let runtimeMinutes: number | undefined;
    try {
      const mediaType = isTV ? 'tv' : 'movie';
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${result.id}?api_key=${apiKey}`
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as any;
        runtimeMinutes = isTV ? detail.episode_run_time?.[0] : detail.runtime ?? undefined;
      }
    } catch {}

    return {
      title: result.title ?? result.name,
      description: result.overview,
      posterUrl: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      backdropUrl: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : undefined,
      releaseYear: rawDate ? parseInt(rawDate.slice(0, 4), 10) || undefined : undefined,
      mediaType: isTV ? 'tv' : 'movie',
      tmdbId: result.id,
      runtimeMinutes,
      provider: 'imdb',
    };
  } catch (error) {
    logger.error('IMDb enrichment error:', error);
    return enrichViaOG(url, 'imdb');
  }
}
