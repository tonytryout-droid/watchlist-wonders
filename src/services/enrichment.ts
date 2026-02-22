const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export interface TmdbResult {
  poster_url: string | null;
  backdrop_url: string | null;
  tmdb_id: number;
  vote_average: number | null;
  release_year: number | null;
  overview: string | null;
}

export interface YoutubeResult {
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  channel_name: string | null;
}

/** Parse ISO 8601 duration (e.g. "PT1H23M45S") to minutes */
function parseDurationMinutes(iso: string): number | null {
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
 * Enrich a movie or TV show with TMDB metadata.
 * Returns null if the API key is missing or the request fails.
 */
export async function enrichWithTMDB(
  title: string,
  mediaType: 'movie' | 'tv',
  year?: number | null,
): Promise<TmdbResult | null> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({ api_key: apiKey, query: title });
    if (year && mediaType === 'movie') params.set('year', String(year));
    const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

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
  } catch {
    return null;
  }
}

/**
 * Enrich a YouTube video with its snippet and duration.
 * Returns null if the API key is missing or the request fails.
 */
export async function enrichWithYouTube(videoId: string): Promise<YoutubeResult | null> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      id: videoId,
      part: 'snippet,contentDetails',
      key: apiKey,
    });
    const res = await fetch(`${YT_BASE}/videos?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    const snippet = item.snippet ?? {};
    const thumbnails = snippet.thumbnails ?? {};
    const thumbnail_url =
      thumbnails.maxres?.url ??
      thumbnails.high?.url ??
      thumbnails.medium?.url ??
      null;
    const duration_minutes = parseDurationMinutes(
      item.contentDetails?.duration ?? '',
    );

    return {
      title: snippet.title ?? '',
      description: snippet.description || null,
      thumbnail_url,
      duration_minutes,
      channel_name: snippet.channelTitle || null,
    };
  } catch {
    return null;
  }
}
