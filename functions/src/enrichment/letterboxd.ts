import type { EnrichResponse } from './types.js';
import { enrichTMDB } from './tmdb.js';
import { enrichViaOG } from './openGraph.js';

export async function enrichLetterboxd(url: string): Promise<EnrichResponse> {
  try {
    const match = new URL(url).pathname.match(/^\/film\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'letterboxd');
    const title = match[1].replace(/-/g, ' ');
    const tmdb = await enrichTMDB(title);
    if (tmdb.title) return { ...tmdb, provider: 'letterboxd' };
  } catch {}
  return enrichViaOG(url, 'letterboxd');
}
