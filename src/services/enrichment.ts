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
 * Fetch OpenGraph meta tags from a URL as a fallback for social media enrichment
 * 
 * NOTE: This function makes direct fetch requests to external URLs from the browser.
 * This may fail due to CORS restrictions on some domains. For production use:
 * - Implement a server-side proxy endpoint that fetches and parses OpenGraph tags
 * - Or use a CORS proxy service that provides metadata extraction
 * - Or document that only CORS-permissive sites are supported
 */
async function fetchOpenGraphMetadata(url: string): Promise<SocialMediaResult | null> {
  try {
    console.info('[Enrichment] Fetching OpenGraph metadata from:', url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[Enrichment] OpenGraph fetch returned status:', res.status);
      return null;
    }

    const html = await res.text();

    // Extract OpenGraph meta tags with flexible attribute order
    // Uses regex to handle both <meta property="og:*" content="*"> and <meta content="*" property="og:*">
    const extractOGValue = (prop: string): string | null => {
      // Try property first, content second (most common order)
      const regex1 = new RegExp(
        `<meta\\s+property=["']og:${prop}["']\\s+content=["']([^"']+)["']`,
        'i'
      );
      // Try content first, property second (alternate order)
      const regex2 = new RegExp(
        `<meta\\s+content=["']([^"']+)["']\\s+property=["']og:${prop}["']`,
        'i'
      );
      
      const match1 = html.match(regex1);
      if (match1) return match1[1];
      
      const match2 = html.match(regex2);
      if (match2) return match2[1];
      
      return null;
    };

    const title = extractOGValue('title');
    const description = extractOGValue('description');
    const image = extractOGValue('image');

    if (!title) {
      console.warn('[Enrichment] No OpenGraph title found in URL:', url);
      return null;
    }

    const result: SocialMediaResult = {
      title: title || null,
      description: description || null,
      thumbnail_url: image || null,
      source: 'opengraph',
    };

    console.info('[Enrichment] Successfully extracted OpenGraph metadata:', result);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Enrichment] OpenGraph fetch failed:', errorMsg);
    return null;
  }
}

// enrichWithTMDB and enrichWithYouTube have been removed.
// All TMDB and YouTube enrichment is handled server-side by the Firebase Cloud Function
// (functions/src/enrich.ts) to prevent API key exposure in the browser bundle.

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


