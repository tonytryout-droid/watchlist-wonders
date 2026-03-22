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

interface OEmbedResponse {
  title?: string;
  html?: string;
  thumbnail_url?: string;
  author_name?: string;
  provider_name?: string;
}

interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  siteName?: string;
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

function extractIpv4FromMappedIpv6(hostname: string): string | null {
  const mapped = hostname.match(/^::ffff:(.+)$/);
  if (!mapped) return null;

  const embedded = mapped[1];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(embedded)) {
    const parts = embedded.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    return parts.join('.');
  }

  const hexMatch = embedded.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hexMatch) return null;

  const high = Number.parseInt(hexMatch[1], 16);
  const low = Number.parseInt(hexMatch[2], 16);
  const octets = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff];
  return octets.join('.');
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const mappedIpv4 = extractIpv4FromMappedIpv6(h);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

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
    .replace(/[\-\u2013]\s*(trailer|teaser|season\s*\d+).*/gi, '')
    .replace(/[^\w\s']/g, ' ') // strip emoji/symbols
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x2F;|&#47;/gi, '/');
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFirstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = normalizeText(value);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

function resolveAbsoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function stripSocialPrefix(value: string): string {
  return value
    .replace(/^.+?\s+on\s+(instagram|facebook|tiktok|x|twitter)\s*:\s*/i, '')
    .replace(/\s*\|\s*(instagram|facebook|tiktok|x|twitter).*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

function cleanSocialText(raw: string): string {
  return normalizeText(stripSocialPrefix(raw))
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')
    .replace(/(?:^|\s)[#@][A-Za-z0-9_]+/g, ' ')
    .replace(/\b(link in bio|original sound)\b/gi, ' ')
    .replace(/\b(fyp|foryou|viral|trending|reels|shorts)\b/gi, ' ')
    .replace(/\b(follow|subscribe|like|share|comment)\s+(for\s+)?(more|updates?)\b.*$/i, ' ')
    .replace(/\s*[|\u2022\u00b7]+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength + 1);
  const cut = slice.lastIndexOf(' ');
  return (cut > 0 ? slice.slice(0, cut) : value.slice(0, maxLength)).trim();
}

function firstSentence(value: string): string {
  const part = value.split(/(?<=[.!?])\s+/)[0] ?? value;
  return part.trim();
}

function getSocialTitleAndDescription(rawTitle?: string, rawDescription?: string): {
  title?: string;
  description?: string;
} {
  let title = cleanSocialText(rawTitle ?? '');
  let description = cleanSocialText(rawDescription ?? '');

  if (!title && description) {
    const guessed = truncateAtWord(firstSentence(description), 110);
    title = guessed;
    if (guessed && guessed === description) {
      description = '';
    }
  }

  if (title && !description) {
    const split = title.match(/^(.{4,90}?)\s*(?:\||-|:)\s*(.{15,})$/);
    if (split) {
      title = split[1].trim();
      description = split[2].trim();
    }
  }

  if (title.length > 120) {
    const conciseTitle = truncateAtWord(firstSentence(title), 110);
    if (conciseTitle && conciseTitle !== title) {
      description = description || title;
      title = conciseTitle;
    }
  }

  if (description && description === title) {
    description = '';
  }

  return {
    title: title || undefined,
    description: description || undefined,
  };
}

function isLikelyMediaTitle(value: string): boolean {
  const cleaned = cleanTitleForTMDB(value);
  if (!cleaned) return false;
  if (cleaned.length < 2 || cleaned.length > 120) return false;
  if (/[@#]|https?:\/\//i.test(value)) return false;
  if (/\b(follow|subscribe|link in bio|fyp|viral|trending|reels|shorts)\b/i.test(value)) return false;
  return cleaned.split(/\s+/).length <= 12;
}

async function maybeMergeTMDB(base: EnrichResponse): Promise<EnrichResponse> {
  if (!base.title || !isLikelyMediaTitle(base.title)) return base;

  const tmdb = await enrichTMDB(cleanTitleForTMDB(base.title));
  if (!tmdb.title) return base;
  return mergeWithTMDB(base, tmdb);
}

function mergeWithTMDB(base: EnrichResponse, tmdb: EnrichResponse): EnrichResponse {
  return {
    ...base,
    title: tmdb.title,
    description: tmdb.description ?? base.description,
    posterUrl: tmdb.posterUrl ?? base.posterUrl,
    backdropUrl: tmdb.backdropUrl ?? base.backdropUrl,
    runtimeMinutes: tmdb.runtimeMinutes ?? base.runtimeMinutes,
    releaseYear: tmdb.releaseYear ?? base.releaseYear,
    mediaType: tmdb.mediaType ?? base.mediaType,
    tmdbId: tmdb.tmdbId ?? base.tmdbId,
  };
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

async function fetchOEmbed(oembedUrl: string): Promise<OEmbedResponse | null> {
  try {
    const res = await fetchWithTimeout(oembedUrl, {}, 6000);
    if (!res.ok) return null;
    return (await res.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

async function fillMissingWithMicrolink(base: EnrichResponse, url: string): Promise<EnrichResponse> {
  if (base.title && base.description && base.posterUrl) return base;
  const ml = await enrichWithMicrolink(url);
  return {
    ...base,
    title: base.title ?? ml.title,
    description: base.description ?? ml.description,
    posterUrl: base.posterUrl ?? ml.posterUrl,
    releaseYear: base.releaseYear ?? ml.releaseYear,
  };
}

async function enrichTwitter(url: string): Promise<EnrichResponse> {
  const [oembed, og] = await Promise.all([
    fetchOEmbed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`),
    fetchOpenGraph(url),
  ]);

  const oembedText = normalizeText(stripHtmlTags(oembed?.html ?? ''));
  const social = getSocialTitleAndDescription(
    pickFirstNonEmpty(og.title, oembed?.title, oembedText),
    pickFirstNonEmpty(og.description, oembedText)
  );

  let result: EnrichResponse = {
    title: social.title,
    description: social.description,
    posterUrl: resolveAbsoluteUrl(pickFirstNonEmpty(og.image, oembed?.thumbnail_url), url),
    provider: 'x',
  };

  result = await maybeMergeTMDB(result);
  return fillMissingWithMicrolink(result, url);
}

async function enrichTikTok(url: string): Promise<EnrichResponse> {
  const [oembed, og] = await Promise.all([
    fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`),
    fetchOpenGraph(url),
  ]);

  const oembedText = normalizeText(stripHtmlTags(oembed?.html ?? ''));
  const social = getSocialTitleAndDescription(
    pickFirstNonEmpty(og.title, oembed?.title, oembedText),
    pickFirstNonEmpty(og.description, oembedText)
  );

  let result: EnrichResponse = {
    title: social.title,
    description: social.description,
    posterUrl: resolveAbsoluteUrl(pickFirstNonEmpty(oembed?.thumbnail_url, og.image), url),
    provider: 'tiktok',
  };

  result = await maybeMergeTMDB(result);
  return fillMissingWithMicrolink(result, url);
}

// --- OpenGraph ---

function parseTagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrRegex)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (!value || attrs[key]) continue;
    attrs[key] = decodeHtmlEntities(value);
  }
  return attrs;
}

function collectJsonLdObjects(node: unknown, out: Array<Record<string, unknown>>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdObjects(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  out.push(obj);
  if (obj['@graph']) collectJsonLdObjects(obj['@graph'], out);
}

const READ_IMAGE_MAX_DEPTH = 10;

function readImageFromValue(
  value: unknown,
  depth: number = READ_IMAGE_MAX_DEPTH
): string | undefined {
  if (depth <= 0) return undefined;
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = readImageFromValue(item, depth - 1);
      if (parsed) return parsed;
    }
    return undefined;
  }
  if (typeof value !== 'object' || !value) return undefined;

  const obj = value as Record<string, unknown>;
  return pickFirstNonEmpty(
    typeof obj.url === 'string' ? obj.url : undefined,
    typeof obj.contentUrl === 'string' ? obj.contentUrl : undefined,
    typeof obj.thumbnailUrl === 'string' ? obj.thumbnailUrl : undefined,
    readImageFromValue(obj.image, depth - 1)
  );
}

function extractJsonLdMetadata(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  const objects: Array<Record<string, unknown>> = [];
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(jsonLdPattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      collectJsonLdObjects(JSON.parse(raw), objects);
    } catch {
      // Skip invalid JSON-LD blocks.
    }
  }

  let title: string | undefined;
  let description: string | undefined;
  let image: string | undefined;

  for (const obj of objects) {
    title =
      title ??
      pickFirstNonEmpty(
        typeof obj.headline === 'string' ? obj.headline : undefined,
        typeof obj.name === 'string' ? obj.name : undefined,
        typeof obj.alternativeHeadline === 'string' ? obj.alternativeHeadline : undefined
      );
    description =
      description ??
      pickFirstNonEmpty(typeof obj.description === 'string' ? obj.description : undefined);
    image = image ?? readImageFromValue(obj.image ?? obj.thumbnailUrl);

    if (title && description && image) break;
  }

  return { title, description, image };
}

async function fetchOpenGraph(url: string): Promise<OpenGraphMetadata> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchWondersBot/1.0)',
      },
    });
    if (!res.ok) return {};

    const html = await res.text();
    const og: Record<string, string> = {};
    const twitter: Record<string, string> = {};
    const nameMeta: Record<string, string> = {};
    const itemProp: Record<string, string> = {};

    for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs = parseTagAttributes(tag[0]);
      const content = attrs.content ? normalizeText(attrs.content) : '';
      if (!content) continue;

      const property = attrs.property?.toLowerCase();
      if (property?.startsWith('og:')) {
        const key = property.slice(3);
        if (!og[key]) og[key] = content;
      }

      const name = attrs.name?.toLowerCase();
      if (name?.startsWith('twitter:')) {
        const key = name.slice(8);
        if (!twitter[key]) twitter[key] = content;
      }
      if (name && !nameMeta[name]) {
        nameMeta[name] = content;
      }

      const prop = attrs.itemprop?.toLowerCase();
      if (prop && !itemProp[prop]) {
        itemProp[prop] = content;
      }
    }

    let canonicalUrl: string | undefined;
    let imageFromLink: string | undefined;
    for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
      const attrs = parseTagAttributes(tag[0]);
      const rel = attrs.rel?.toLowerCase();
      const href = attrs.href;
      if (!rel || !href) continue;

      const relTokens = rel.split(/\s+/);
      if (!canonicalUrl && relTokens.includes('canonical')) {
        canonicalUrl = href;
      }
      if (!imageFromLink && (relTokens.includes('image_src') || relTokens.includes('thumbnail'))) {
        imageFromLink = href;
      }
    }

    const jsonLd = extractJsonLdMetadata(html);
    const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    const title = pickFirstNonEmpty(
      og['title'],
      twitter['title'],
      nameMeta['title'],
      itemProp['name'],
      jsonLd.title,
      htmlTitle
    );
    const description = pickFirstNonEmpty(
      og['description'],
      twitter['description'],
      nameMeta['description'],
      itemProp['description'],
      jsonLd.description
    );
    const image = pickFirstNonEmpty(
      og['image:secure_url'],
      og['image:url'],
      og['image'],
      twitter['image'],
      twitter['image:src'],
      twitter['player:image'],
      nameMeta['image'],
      itemProp['image'],
      itemProp['thumbnailurl'],
      imageFromLink,
      jsonLd.image
    );

    return {
      title,
      description,
      image: resolveAbsoluteUrl(image, url),
      canonicalUrl: resolveAbsoluteUrl(pickFirstNonEmpty(og['url'], canonicalUrl), url),
      siteName: pickFirstNonEmpty(og['site_name']),
    };
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

  const isSocialProvider = provider === 'instagram' || provider === 'facebook';
  const social = isSocialProvider
    ? getSocialTitleAndDescription(og.title, og.description)
    : { title: og.title, description: og.description };

  let result: EnrichResponse = {
    title: social.title,
    description: social.description,
    posterUrl: og.image,
    provider,
  };

  if (provider === 'netflix' && result.title) {
    const tmdb = await enrichTMDB(cleanTitleForTMDB(result.title));
    if (tmdb.title) {
      result = mergeWithTMDB(result, tmdb);
    }
  } else if (provider === 'generic' && result.title && isLikelyMediaTitle(result.title)) {
    const tmdb = await enrichTMDB(cleanTitleForTMDB(result.title));
    if (tmdb.title) {
      result = mergeWithTMDB(result, tmdb);
    }
  } else if (isSocialProvider) {
    result = await maybeMergeTMDB(result);
  }

  result = await fillMissingWithMicrolink(result, url);
  if (result.title || result.description || result.posterUrl) return result;

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
    const og = await fetchOpenGraph(url);

    const previewImage = post?.preview?.images?.[0]?.source?.url;
    const thumbnail = typeof post?.thumbnail === 'string' ? post.thumbnail : undefined;
    const imageCandidate =
      (typeof previewImage === 'string' ? previewImage : undefined) ??
      (/^https?:\/\//i.test(thumbnail ?? '') ? thumbnail : undefined) ??
      og.image;

    const social = getSocialTitleAndDescription(
      pickFirstNonEmpty(post?.title, og.title),
      pickFirstNonEmpty(post?.selftext, og.description)
    );

    let result: EnrichResponse = {
      title: social.title,
      description: social.description,
      posterUrl: resolveAbsoluteUrl(imageCandidate ? decodeHtmlEntities(imageCandidate) : undefined, url),
      provider: 'reddit',
    };

    result = await maybeMergeTMDB(result);
    return fillMissingWithMicrolink(result, url);
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


