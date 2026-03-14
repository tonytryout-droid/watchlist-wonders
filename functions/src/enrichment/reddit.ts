import type { EnrichResponse } from './types.js';
import { enrichTMDB, cleanTitleForTMDB } from './tmdb.js';

export async function enrichReddit(url: string): Promise<EnrichResponse> {
  try {
    const jsonUrl = url.replace(/\?.*$/, '').replace(/\/$/, '') + '.json';
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'WatchMarksBot/1.0' },
    });
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
