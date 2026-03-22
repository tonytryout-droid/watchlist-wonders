import { useQuery } from '@tanstack/react-query';
import { buildRegionFallbackList } from '@/lib/localeRegion';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const LOGO_BASE = 'https://image.tmdb.org/t/p/original';

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  logoUrl: string | null;
}

export interface WatchProviderResult {
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  link?: string;
  resolvedRegion?: string;
}

function mapProviders(arr: any[]): WatchProvider[] {
  return (arr || []).map((p) => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name,
    logo_path: p.logo_path,
    logoUrl: p.logo_path ? `${LOGO_BASE}${p.logo_path}` : null,
  }));
}

async function fetchWatchProviders(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
  preferredRegion?: string,
): Promise<WatchProviderResult> {
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch watch providers');
  const data = await res.json();

  const allRegions = data.results ?? {};
  const regionCandidates = buildRegionFallbackList(preferredRegion);

  const hasOffers = (regionData: any): boolean =>
    (regionData?.flatrate?.length ?? 0) + (regionData?.rent?.length ?? 0) + (regionData?.buy?.length ?? 0) > 0;

  const resolvedRegion = regionCandidates.find((regionCode) => hasOffers(allRegions[regionCode]));
  const firstAvailableRegion = Object.keys(allRegions)[0];
  const regionData = resolvedRegion ? allRegions[resolvedRegion] : {};
  const fallbackLink = firstAvailableRegion ? allRegions[firstAvailableRegion]?.link : undefined;

  return {
    flatrate: mapProviders(regionData.flatrate),
    rent: mapProviders(regionData.rent),
    buy: mapProviders(regionData.buy),
    link: regionData.link || fallbackLink,
    resolvedRegion: resolvedRegion || firstAvailableRegion,
  };
}

export function useWatchProviders(
  tmdbId: number | string | undefined | null,
  type: string,
  preferredRegion?: string,
) {
  const mediaType: 'movie' | 'tv' = type === 'series' || type === 'episode' ? 'tv' : 'movie';
  const normalizedPreferredRegion = preferredRegion?.trim().toUpperCase() || undefined;

  return useQuery({
    queryKey: ['watch-providers', tmdbId, mediaType, normalizedPreferredRegion],
    queryFn: () => fetchWatchProviders(tmdbId!, mediaType as 'movie' | 'tv', normalizedPreferredRegion),
    enabled: !!tmdbId && !!TMDB_KEY,
    staleTime: 24 * 60 * 60 * 1000, // 24h
  });
}
