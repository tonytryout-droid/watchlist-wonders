import type { EnrichmentError } from './types.js';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 3000;

/**
 * Attempt an API call with retry logic and exponential backoff.
 * @internal
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  onError?: (error: EnrichmentError, attempt: number) => void,
): Promise<T | null> {
  let lastError: EnrichmentError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const enrichmentError: EnrichmentError = {
        code: 'UNKNOWN',
        message: error.message,
        retryable: true,
      };

      if (error.message.includes('429')) {
        enrichmentError.code = 'RATE_LIMITED';
        enrichmentError.message = 'API rate limit exceeded';
      } else if (error.message.includes('timeout') || error.message.includes('aborted') || error.name === 'AbortError') {
        enrichmentError.code = 'TIMEOUT';
        enrichmentError.message = 'API request timed out';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        enrichmentError.code = 'NETWORK_ERROR';
        enrichmentError.message = 'Network error occurred';
      } else if (error.toString().includes('JSON')) {
        enrichmentError.code = 'INVALID_RESPONSE';
        enrichmentError.message = 'Invalid API response format';
        enrichmentError.retryable = false;
      }

      lastError = enrichmentError;
      if (onError) onError(enrichmentError, attempt);

      if (attempt < MAX_RETRIES && enrichmentError.retryable) {
        const delayMs = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
        console.warn(`[Enrichment] ${operation} attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delayMs}ms:`, enrichmentError);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else if (attempt === MAX_RETRIES) {
        console.error(`[Enrichment] ${operation} failed after ${MAX_RETRIES} attempts:`, enrichmentError);
      }
    }
  }

  return null;
}
