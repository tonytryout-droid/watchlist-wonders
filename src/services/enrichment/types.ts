export interface TmdbResult {
  poster_url: string | null;
  backdrop_url: string | null;
  tmdb_id: number;
  vote_average: number | null;
  release_year: number | null;
  overview: string | null;
}

export interface YoutubeResult {
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  channel_name: string | null;
}

export interface SocialMediaResult {
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  source: 'opengraph' | 'api';
}

export interface EnrichmentError {
  code: 'MISSING_API_KEY' | 'API_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string;
  details?: string;
  retryable: boolean;
}
