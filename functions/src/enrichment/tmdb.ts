import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import type { EnrichResponse } from './types.js';

export const tmdbApiKey = defineSecret('TMDB_API_KEY');

export function cleanTitleForTMDB(raw: string): string {
  return raw
    .replace(/\(?\d{4}\)?/g, '')
    .replace(/official\s*(trailer|teaser|clip|video)/gi, '')
    .replace(/\|\s*.+$/i, '')
    .replace(/[-–]\s*(trailer|teaser|season\s*\d+).*/gi, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function enrichTMDB(title: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey || !title) return { provider: 'generic' };

  try {
    const params = new URLSearchParams({ api_key: apiKey, query: title });
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`);
    if (!res.ok) return { provider: 'generic' };

    const data = (await res.json()) as any;
    const result = data.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!result) return { provider: 'generic' };

    const isTV = result.media_type === 'tv';
    const rawDate = isTV ? result.first_air_date : result.release_date;

    let runtimeMinutes: number | undefined;
    try {
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/${result.media_type}/${result.id}?api_key=${apiKey}`
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
      provider: 'generic',
    };
  } catch (error) {
    logger.error('TMDB error:', error);
    return { provider: 'generic' };
  }
}
