const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 3000;

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

export interface SocialMediaResult {
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  source: 'opengraph' | 'api';
}

export interface EnrichmentError {
  code: 'MISSING_API_KEY' | 'API_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string;
  details?: string;
  retryable: boolean;
}

/**
 * Attempt an API call with retry logic and exponential backoff
 * @internal This is an internal helper function, not part of the public API
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  onError?: (error: EnrichmentError, attempt: number) => void,
): Promise<T | null> {
  let lastError: EnrichmentError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const enrichmentError: EnrichmentError = {
        code: 'UNKNOWN',
        message: error.message,
        retryable: true,
      };

      // Analyze error to determine if retryable
      if (error.message.includes('429')) {
        enrichmentError.code = 'RATE_LIMITED';
        enrichmentError.message = 'API rate limit exceeded';
      } else if (error.message.includes('timeout') || error.message.includes('aborted') || error.name === 'AbortError') {
        enrichmentError.code = 'TIMEOUT';
        enrichmentError.message = 'API request timed out';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        enrichmentError.code = 'NETWORK_ERROR';
        enrichmentError.message = 'Network error occurred';
      } else if (error.toString().includes('JSON')) {
        enrichmentError.code = 'INVALID_RESPONSE';
        enrichmentError.message = 'Invalid API response format';
        enrichmentError.retryable = false;
      }

      lastError = enrichmentError;

      if (onError) {
        onError(enrichmentError, attempt);
      }

      // Log attempt
      if (attempt < MAX_RETRIES && enrichmentError.retryable) {
        const delayMs = Math.min(
          INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          MAX_RETRY_DELAY_MS,
        );
        console.warn(
          `[Enrichment] ${operation} attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delayMs}ms:`,
          enrichmentError,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else if (attempt === MAX_RETRIES) {
        console.error(
          `[Enrichment] ${operation} failed after ${MAX_RETRIES} attempts:`,
          enrichmentError,
        );
      }
    }
  }

  return null;
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
 * Fetch metadata for a URL using the Microlink API.
 *
 * Direct browser fetch to external social domains (Instagram, Facebook, TikTok,
 * etc.) is always blocked by CORS. The Microlink API runs a headless browser
 * server-side, returns structured JSON, and includes proper CORS headers so it
 * works from the browser without any proxy setup.
 */
async function fetchOpenGraphMetadata(url: string): Promise<SocialMediaResult | null> {
  try {
    console.info('[Enrichment] Fetching metadata via Microlink for:', url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[Enrichment] Microlink returned status:', res.status);
      return null;
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data?.title) {
      console.warn('[Enrichment] Microlink returned no title for:', url);
      return null;
    }

    const d = json.data;
    const result: SocialMediaResult = {
      title: d.title ?? null,
      description: d.description ?? null,
      thumbnail_url: d.image?.url ?? null,
      source: 'opengraph',
    };

    console.info('[Enrichment] Successfully fetched metadata:', result);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Enrichment] Microlink fetch failed:', errorMsg);
    return null;
  }
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
  if (!apiKey) {
    console.error('[Enrichment] TMDB API key not configured');
    return null;
  }

  return withRetry(
    async () => {
      const params = new URLSearchParams({ api_key: apiKey, query: title });
      if (year && mediaType === 'movie') params.set('year', String(year));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`TMDB API returned status ${res.status}`);
      }

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
      const params = new URLSearchParams({
        id: videoId,
        part: 'snippet,contentDetails',
        key: apiKey,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(`${YT_BASE}/videos?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`YouTube API returned status ${res.status}`);
      }

      const data = await res.json();
      const item = data.items?.[0];

      if (!item) {
        console.warn('[Enrichment] No YouTube results found for video:', videoId);
        return null;
      }

      const snippet = item.snippet ?? {};
      const thumbnails = snippet.thumbnails ?? {};
      const thumbnail_url =
        thumbnails.maxres?.url ??
        thumbnails.high?.url ??
        thumbnails.medium?.url ??
        null;
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

/**
 * Enrich Instagram posts with OpenGraph metadata.
 * Note: Full API requires authentication. This uses OpenGraph as fallback.
 */
export async function enrichWithInstagram(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Instagram URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich Facebook content with OpenGraph metadata.
 * Note: Full API requires authentication. This uses OpenGraph as fallback.
 */
export async function enrichWithFacebook(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Facebook URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich Twitter/X posts with OpenGraph metadata.
 * Note: Full API requires authentication. This uses OpenGraph as fallback.
 */
export async function enrichWithTwitter(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Twitter/X URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich TikTok videos with OpenGraph metadata.
 * Note: TikTok is anti-scraping. This uses OpenGraph as fallback.
 */
export async function enrichWithTikTok(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching TikTok URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich Reddit posts with OpenGraph metadata.
 */
export async function enrichWithReddit(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Reddit URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich Letterboxd entries with OpenGraph metadata.
 */
export async function enrichWithLetterboxd(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Letterboxd URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Enrich Rotten Tomatoes entries with OpenGraph metadata.
 */
export async function enrichWithRottenTomatoes(url: string): Promise<SocialMediaResult | null> {
  console.info('[Enrichment] Enriching Rotten Tomatoes URL:', url);
  return fetchOpenGraphMetadata(url);
}

/**
 * Validate that required API keys are configured
 */
export function validateApiConfiguration(): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!import.meta.env.VITE_TMDB_API_KEY) {
    warnings.push('TMDB API key not configured - movie/TV show enrichment will not work');
  }

  if (!import.meta.env.VITE_YOUTUBE_API_KEY) {
    warnings.push('YouTube API key not configured - YouTube enrichment will not work');
  }

  // These are optional (fallback to OpenGraph)
  // But log that they're missing if someone configures partial support

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

