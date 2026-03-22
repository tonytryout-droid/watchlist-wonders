import { useQuery } from '@tanstack/react-query';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

export interface TmdbCastMember {
  name: string;
  character: string;
  profileUrl: string | null;
}

export interface TmdbDetails {
  genres: { id: number; name: string }[];
  cast: TmdbCastMember[];
  director: string | null;
}

async function fetchTmdbDetails(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
): Promise<TmdbDetails> {
  const res = await fetch(
    `${TMDB_BASE}/${mediaType}/${tmdbId}?append_to_response=credits&api_key=${TMDB_KEY}`,
  );
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    const bodySuffix = errorBody ? ` - ${errorBody.slice(0, 200)}` : '';
    throw new Error(
      `Failed to fetch TMDB details: ${res.status} ${res.statusText}${bodySuffix}`,
    );
  }
  const data = await res.json();

  return {
    genres: data.genres ?? [],
    cast: ((data.credits?.cast ?? []) as any[]).slice(0, 4).map((c) => ({
      name: c.name,
      character: c.character,
      profileUrl: c.profile_path ? `${PROFILE_BASE}${c.profile_path}` : null,
    })),
    director:
      mediaType === 'movie'
        ? ((data.credits?.crew ?? []) as any[]).find((c) => c.job === 'Director')?.name ?? null
        : null,
  };
}

export function useTmdbDetails(
  tmdbId: number | string | undefined | null,
  type: string,
) {
  const mediaType: 'movie' | 'tv' =
    type === 'series' || type === 'episode' ? 'tv' : 'movie';
  return useQuery({
    queryKey: ['tmdb-details', tmdbId, mediaType],
    queryFn: () => fetchTmdbDetails(tmdbId!, mediaType),
    enabled: !!tmdbId && !!TMDB_KEY,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
