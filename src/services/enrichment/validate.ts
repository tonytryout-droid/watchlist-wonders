/**
 * Validate that required API keys are configured.
 */
export function validateApiConfiguration(): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!import.meta.env.VITE_TMDB_API_KEY) {
    warnings.push('TMDB API key not configured - movie/TV show enrichment will not work');
  }

  if (!import.meta.env.VITE_YOUTUBE_API_KEY) {
    warnings.push('YouTube API key not configured - YouTube enrichment will not work');
  }

  return { isValid: errors.length === 0, warnings, errors };
}
