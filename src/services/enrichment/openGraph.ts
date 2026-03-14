import type { SocialMediaResult } from './types.js';

/**
 * Fetch OpenGraph meta tags from a URL as a fallback for social media enrichment.
 *
 * NOTE: This function makes direct fetch requests to external URLs from the browser.
 * This may fail due to CORS restrictions on some domains. For production use,
 * implement a server-side proxy or use the Cloud Function enrichment pipeline.
 */
export async function fetchOpenGraphMetadata(url: string): Promise<SocialMediaResult | null> {
  try {
    console.info('[Enrichment] Fetching OpenGraph metadata from:', url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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

    const extractOGValue = (prop: string): string | null => {
      const regex1 = new RegExp(`<meta\\s+property=["']og:${prop}["']\\s+content=["']([^"']+)["']`, 'i');
      const regex2 = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, 'i');
      return html.match(regex1)?.[1] ?? html.match(regex2)?.[1] ?? null;
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
