import type { EnrichResponse } from './types.js';
import { enrichTMDB, cleanTitleForTMDB } from './tmdb.js';

export async function fetchOEmbed(oembedUrl: string): Promise<{ title?: string; html?: string } | null> {
  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

export async function enrichTwitter(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`);
  const rawText = oembed?.html?.replace(/<[^>]+>/g, '') ?? '';
  const cleaned = cleanTitleForTMDB(rawText.split('\n')[0]);
  if (!cleaned) return { provider: 'x' };
  const tmdb = await enrichTMDB(cleaned);
  return { ...tmdb, provider: 'x' };
}

export async function enrichTikTok(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!oembed?.title) return { provider: 'tiktok' };
  const tmdb = await enrichTMDB(cleanTitleForTMDB(oembed.title));
  return { ...tmdb, provider: 'tiktok' };
}
