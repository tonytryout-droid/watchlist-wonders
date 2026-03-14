export interface EnrichResponse {
  title?: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  runtimeMinutes?: number;
  releaseYear?: number;
  mediaType?: 'movie' | 'tv' | 'unknown';
  provider?: string;
  tmdbId?: number;
  error?: { message: string };
}
