import * as logger from 'firebase-functions/logger';
import type { EnrichResponse } from './types.js';
import { enrichTMDB, cleanTitleForTMDB } from './tmdb.js';

export async function fetchOpenGraph(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchMarksBot/1.0)',
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const og: Record<string, string> = {};
    for (const m of html.matchAll(/<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi)) {
      if (!og[m[1]]) og[m[1]] = m[2];
    }
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

export async function enrichWithMicrolink(url: string): Promise<Partial<EnrichResponse>> {
  try {
    const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return {};
    const json = (await res.json()) as any;
    if (json.status !== 'success' || !json.data?.title) return {};
    const d = json.data;
    const year = d.date ? new Date(d.date).getFullYear() : undefined;
    logger.info('[microlink] enriched:', url, d.title);
    return {
      title: d.title ?? undefined,
      description: d.description ?? undefined,
      posterUrl: d.image?.url ?? undefined,
      releaseYear: year || undefined,
    };
  } catch (err) {
    logger.warn('[microlink] failed for', url, err);
    return {};
  }
}

export async function enrichViaOG(url: string, provider: string): Promise<EnrichResponse> {
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

  const ml = await enrichWithMicrolink(url);
  if (ml.title) return { ...ml, provider };

  return { provider };
}
