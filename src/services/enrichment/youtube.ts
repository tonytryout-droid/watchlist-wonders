import type { YoutubeResult } from './types.js';
import { withRetry } from './retry.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

/** Parse ISO 8601 duration (e.g. "PT1H23M45S") to minutes */
export function parseDurationMinutes(iso: string): number | null {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const hours = parseInt(m[1] || '0', 10);
  const mins = parseInt(m[2] || '0', 10);
  const secs = parseInt(m[3] || '0', 10);
  return hours * 60 + mins + (secs > 0 ? 1 : 0);
}

/** Extract YouTube video ID from various URL formats */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {
    // not a valid URL
  }
  return null;
}

/**
 * Enrich a YouTube video with its snippet and duration.
 * Returns null if the API key is missing or the request fails.
 */
export async function enrichWithYouTube(videoId: string): Promise<YoutubeResult | null> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[Enrichment] YouTube API key not configured');
    return null;
  }

  return withRetry(
    async () => {
      const params = new URLSearchParams({ id: videoId, part: 'snippet,contentDetails', key: apiKey });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${YT_BASE}/videos?${params}`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`YouTube API returned status ${res.status}`);

      const data = await res.json();
      const item = data.items?.[0];
      if (!item) {
        console.warn('[Enrichment] No YouTube results found for video:', videoId);
        return null;
      }

      const snippet = item.snippet ?? {};
      const thumbnails = snippet.thumbnails ?? {};
      const thumbnail_url =
        thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? null;
      const duration_minutes = parseDurationMinutes(item.contentDetails?.duration ?? '');

      return {
        title: snippet.title ?? '',
        description: snippet.description || null,
        thumbnail_url,
        duration_minutes,
        channel_name: snippet.channelTitle || null,
      };
    },
    `YouTube enrichment for video "${videoId}"`,
  );
}
