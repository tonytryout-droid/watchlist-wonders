/** Strip query string and fragment for safe logging (avoids leaking tokens in query params) */
export function redactUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

export function detectProvider(url: string): string {
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
