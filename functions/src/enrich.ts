import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

const youtubeApiKey = defineSecret('YOUTUBE_API_KEY');
const tmdbApiKey = defineSecret('TMDB_API_KEY');

interface EnrichResponse {
  title?: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  runtimeMinutes?: number;
  releaseYear?: number;
  mediaType?: 'movie' | 'tv' | 'unknown';
  provider?: string;
  tmdbId?: number;
  error?: { message: string };
}

// --- URL helpers ---

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DISALLOWED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  '169.254.169.254',
]);

/** Strip query string and fragment for safe logging (avoids leaking tokens in query params) */
function redactUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    h === '::1' ||
    h === '::' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80:')
  );
}

function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':');
}

function isDisallowedHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (DISALLOWED_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;

  if (!isIpLiteral(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return isPrivateIpv4(h);
  return isPrivateIpv6(h);
}

function normalizeAndValidateUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new HttpsError('invalid-argument', 'A valid absolute URL is required.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpsError('invalid-argument', 'Only http:// and https:// URLs are supported.');
  }

  if (parsed.username || parsed.password) {
    throw new HttpsError('invalid-argument', 'URLs with embedded credentials are not allowed.');
  }

  if (!parsed.hostname || isDisallowedHostname(parsed.hostname)) {
    throw new HttpsError('invalid-argument', 'Private or local network URLs are not allowed.');
  }

  return parsed;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// --- Platform Detection ---

function detectProvider(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('netflix.com')) return 'netflix';
    if (h.includes('imdb.com')) return 'imdb';
    if (h.includes('letterboxd.com')) return 'letterboxd';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('facebook.com') || h.includes('fb.watch')) return 'facebook';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'x';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('reddit.com')) return 'reddit';
    if (h.includes('rottentomatoes.com')) return 'rottentomatoes';
    return 'generic';
  } catch {
    return 'generic';
  }
}

// --- Title Cleaning ---

function cleanTitleForTMDB(raw: string): string {
  return raw
    .replace(/\(?\d{4}\)?/g, '') // remove years
    .replace(/official\s*(trailer|teaser|clip|video)/gi, '')
    .replace(/\|\s*.+$/i, '') // strip "| Netflix" suffixes
    .replace(/[-–]\s*(trailer|teaser|season\s*\d+).*/gi, '')
    .replace(/[^\w\s']/g, ' ') // strip emoji/symbols
    .replace(/\s+/g, ' ')
    .trim();
}

// --- YouTube ---

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {}
  return null;
}

async function enrichYouTube(videoId: string): Promise<EnrichResponse> {
  const apiKey = youtubeApiKey.value();
  if (!apiKey) return { provider: 'youtube' };

  try {
    const params = new URLSearchParams({ id: videoId, part: 'snippet,contentDetails', key: apiKey });
    const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${params}`);
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

    // Cross-enrich: use cleaned YouTube title to get TMDB metadata
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

// --- oEmbed (Twitter, TikTok) ---

async function fetchOEmbed(oembedUrl: string): Promise<{ title?: string; html?: string } | null> {
  try {
    const res = await fetchWithTimeout(oembedUrl, {}, 6000);
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

async function enrichTwitter(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`);
  const rawText = oembed?.html?.replace(/<[^>]+>/g, '') ?? '';
  const cleaned = cleanTitleForTMDB(rawText.split('\n')[0]);
  if (!cleaned) return { provider: 'x' };
  const tmdb = await enrichTMDB(cleaned);
  return { ...tmdb, provider: 'x' };
}

async function enrichTikTok(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!oembed?.title) return { provider: 'tiktok' };
  const tmdb = await enrichTMDB(cleanTitleForTMDB(oembed.title));
  return { ...tmdb, provider: 'tiktok' };
}

// --- OpenGraph ---

async function fetchOpenGraph(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchWondersBot/1.0)',
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const og: Record<string, string> = {};
    // Match property-before-content order
    for (const m of html.matchAll(/<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi)) {
      if (!og[m[1]]) og[m[1]] = m[2];
    }
    // Match content-before-property order (common in WordPress, Shopify, etc.)
    for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:(\w+)["']/gi)) {
      if (!og[m[2]]) og[m[2]] = m[1];
    }
    if (!og['title']) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) og['title'] = titleMatch[1];
    }
    return og;
  } catch {
    return {};
  }
}

// --- Microlink (headless browser fallback) ---

async function enrichWithMicrolink(url: string): Promise<Partial<EnrichResponse>> {
  try {
    const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
    const res = await fetchWithTimeout(endpoint);
    if (!res.ok) return {};
    const json = (await res.json()) as any;
    if (json.status !== 'success' || !json.data?.title) return {};
    const d = json.data;
    const year = d.date ? new Date(d.date).getFullYear() : undefined;
    logger.info('[microlink] enriched:', redactUrlForLog(url), d.title);
    return {
      title: d.title ?? undefined,
      description: d.description ?? undefined,
      posterUrl: d.image?.url ?? undefined,
      releaseYear: year || undefined,
    };
  } catch (err) {
    logger.warn('[microlink] failed for', redactUrlForLog(url), err);
    return {};
  }
}

async function enrichViaOG(url: string, provider: string): Promise<EnrichResponse> {
  const og = await fetchOpenGraph(url);

  if (og['title']) {
    const cleaned = cleanTitleForTMDB(og['title']);
    const tmdb = await enrichTMDB(cleaned);
    return {
      title: tmdb.title ?? og['title'],
      description: tmdb.description ?? og['description'],
      posterUrl: tmdb.posterUrl ?? og['image'],
      backdropUrl: tmdb.backdropUrl,
      releaseYear: tmdb.releaseYear,
      mediaType: tmdb.mediaType,
      tmdbId: tmdb.tmdbId,
      provider,
    };
  }

  // OG scraping failed (blocked or JS-rendered) — try Microlink headless browser
  const ml = await enrichWithMicrolink(url);
  if (ml.title) return { ...ml, provider };

  return { provider };
}

// --- IMDb ---

function extractImdbId(url: string): string | null {
  const match = url.match(/\/title\/(tt\d+)/i);
  return match ? match[1] : null;
}

async function enrichIMDb(url: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey) return enrichViaOG(url, 'imdb');

  const imdbId = extractImdbId(url);
  if (!imdbId) return enrichViaOG(url, 'imdb');

  try {
    const res = await fetchWithTimeout(
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
      const detailRes = await fetchWithTimeout(
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

// --- Letterboxd ---

async function enrichLetterboxd(url: string): Promise<EnrichResponse> {
  try {
    const match = new URL(url).pathname.match(/^\/film\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'letterboxd');
    const title = match[1].replace(/-/g, ' ');
    const tmdb = await enrichTMDB(title);
    if (tmdb.title) return { ...tmdb, provider: 'letterboxd' };
  } catch {}
  return enrichViaOG(url, 'letterboxd');
}

// --- Rotten Tomatoes ---

async function enrichRottenTomatoes(url: string): Promise<EnrichResponse> {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/(?:m|tv)\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'rottentomatoes');
    const title = match[1].replace(/[_-]/g, ' ');
    const tmdb = await enrichTMDB(title);
    if (tmdb.title) return { ...tmdb, provider: 'rottentomatoes' };
  } catch {}
  return enrichViaOG(url, 'rottentomatoes');
}

// --- Reddit ---

async function enrichReddit(url: string): Promise<EnrichResponse> {
  try {
    const jsonUrl = url.replace(/\?.*$/, '').replace(/\/$/, '') + '.json';
    const res = await fetchWithTimeout(jsonUrl, {
      headers: { 'User-Agent': 'WatchWondersBot/1.0' },
    }, 6000);
    if (!res.ok) return { provider: 'reddit' };
    const data = (await res.json()) as any;
    const post = data?.[0]?.data?.children?.[0]?.data;
    if (!post?.title) return { provider: 'reddit' };
    const tmdb = await enrichTMDB(cleanTitleForTMDB(post.title));
    return { ...tmdb, provider: 'reddit' };
  } catch {
    return { provider: 'reddit' };
  }
}

// --- TMDB ---

async function enrichTMDB(title: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey || !title) return { provider: 'generic' };

  try {
    const params = new URLSearchParams({ api_key: apiKey, query: title });
    const res = await fetchWithTimeout(`https://api.themoviedb.org/3/search/multi?${params}`);
    if (!res.ok) return { provider: 'generic' };

    const data = (await res.json()) as any;
    const result = data.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!result) return { provider: 'generic' };

    const isTV = result.media_type === 'tv';
    const rawDate = isTV ? result.first_air_date : result.release_date;

    let runtimeMinutes: number | undefined;
    try {
      const detailRes = await fetchWithTimeout(
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

// --- Main Handler ---

export const enrich = onCall(
  { memory: '256MiB', timeoutSeconds: 30, secrets: [youtubeApiKey, tmdbApiKey] },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    try {
      const { url } = request.data;
      if (!url || typeof url !== 'string') {
        throw new HttpsError('invalid-argument', 'URL is required.');
      }

      const validatedUrl = normalizeAndValidateUrl(url);
      const normalizedUrl = validatedUrl.toString();

      logger.info('Enriching URL:', redactUrlForLog(normalizedUrl));
      const provider = detectProvider(normalizedUrl);
      let result: EnrichResponse = { provider };

      switch (provider) {
        case 'youtube': {
          const videoId = extractYouTubeVideoId(normalizedUrl);
          if (videoId) result = await enrichYouTube(videoId);
          break;
        }
        case 'x':
          result = await enrichTwitter(normalizedUrl);
          break;
        case 'tiktok':
          result = await enrichTikTok(normalizedUrl);
          break;
        case 'reddit':
          result = await enrichReddit(normalizedUrl);
          break;
        case 'imdb':
          result = await enrichIMDb(normalizedUrl);
          break;
        case 'letterboxd':
          result = await enrichLetterboxd(normalizedUrl);
          break;
        case 'rottentomatoes':
          result = await enrichRottenTomatoes(normalizedUrl);
          break;
        case 'instagram':
        case 'facebook':
        case 'netflix':
        case 'generic':
          result = await enrichViaOG(normalizedUrl, provider);
          break;
      }

      return result;
    } catch (error) {
      logger.error('Enrichment error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Unable to enrich URL at this time.');
    }
  }
);
