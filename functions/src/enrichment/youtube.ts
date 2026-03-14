import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import type { EnrichResponse } from './types.js';
import { enrichTMDB, cleanTitleForTMDB } from './tmdb.js';

export const youtubeApiKey = defineSecret('YOUTUBE_API_KEY');

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {}
  return null;
}

export async function enrichYouTube(videoId: string): Promise<EnrichResponse> {
  const apiKey = youtubeApiKey.value();
  if (!apiKey) return { provider: 'youtube' };

  try {
    const params = new URLSearchParams({ id: videoId, part: 'snippet,contentDetails', key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) return { provider: 'youtube' };

    const data = (await res.json()) as any;
    const item = data.items?.[0];
    if (!item) return { provider: 'youtube' };

    const snippet = item.snippet ?? {};
    const thumbs = snippet.thumbnails ?? {};
    const posterUrl = thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url;

    const durationMatch = (item.contentDetails?.duration ?? '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let runtimeMinutes: number | undefined;
    if (durationMatch) {
      const h = parseInt(durationMatch[1] || '0', 10);
      const m = parseInt(durationMatch[2] || '0', 10);
      const s = parseInt(durationMatch[3] || '0', 10);
      runtimeMinutes = h * 60 + m + (s > 0 ? 1 : 0);
    }

    const tmdbData = await enrichTMDB(cleanTitleForTMDB(snippet.title ?? ''));

    return {
      title: tmdbData.title ?? snippet.title,
      description: tmdbData.description ?? snippet.description,
      posterUrl: tmdbData.posterUrl ?? posterUrl,
      backdropUrl: tmdbData.backdropUrl,
      runtimeMinutes: tmdbData.runtimeMinutes ?? runtimeMinutes,
      releaseYear: tmdbData.releaseYear,
      mediaType: tmdbData.mediaType,
      tmdbId: tmdbData.tmdbId,
      provider: 'youtube',
    };
  } catch (error) {
    logger.error('YouTube error:', error);
    return { provider: 'youtube' };
  }
}
