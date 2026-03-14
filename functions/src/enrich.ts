import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  detectProvider,
  redactUrlForLog,
  extractYouTubeVideoId,
  enrichYouTube,
  enrichTwitter,
  enrichTikTok,
  enrichReddit,
  enrichIMDb,
  enrichLetterboxd,
  enrichRottenTomatoes,
  enrichViaOG,
  youtubeApiKey,
  tmdbApiKey,
  type EnrichResponse,
} from './enrichment/index.js';

export const enrich = onCall(
  { memory: '256MiB', timeoutSeconds: 30, secrets: [youtubeApiKey, tmdbApiKey] },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    try {
      const { url } = request.data;
      if (!url || typeof url !== 'string') {
        throw new HttpsError('invalid-argument', 'URL is required.');
      }

      logger.info('Enriching URL:', redactUrlForLog(url));
      const provider = detectProvider(url);
      let result: EnrichResponse = { provider };

      switch (provider) {
        case 'youtube': {
          const videoId = extractYouTubeVideoId(url);
          if (videoId) result = await enrichYouTube(videoId);
          break;
        }
        case 'x':
          result = await enrichTwitter(url);
          break;
        case 'tiktok':
          result = await enrichTikTok(url);
          break;
        case 'reddit':
          result = await enrichReddit(url);
          break;
        case 'imdb':
          result = await enrichIMDb(url);
          break;
        case 'letterboxd':
          result = await enrichLetterboxd(url);
          break;
        case 'rottentomatoes':
          result = await enrichRottenTomatoes(url);
          break;
        case 'instagram':
        case 'facebook':
        case 'netflix':
        case 'generic':
          result = await enrichViaOG(url, provider);
          break;
      }

      return result;
    } catch (error) {
      logger.error('Enrichment error:', error);
      throw error;
    }
  }
);
