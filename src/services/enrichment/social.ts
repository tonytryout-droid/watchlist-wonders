import type { SocialMediaResult } from './types.js';
import { fetchOpenGraphMetadata } from './openGraph.js';

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
