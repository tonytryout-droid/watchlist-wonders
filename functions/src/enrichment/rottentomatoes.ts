import type { EnrichResponse } from './types.js';
import { enrichTMDB } from './tmdb.js';
import { enrichViaOG } from './openGraph.js';

export async function enrichRottenTomatoes(url: string): Promise<EnrichResponse> {
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
