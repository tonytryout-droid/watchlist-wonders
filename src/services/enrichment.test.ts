/**
 * Unit tests for enrichment service
 * Tests error handling, retry logic, and API integration
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  enrichWithInstagram,
  enrichWithFacebook,
  enrichWithTwitter,
} from './enrichment';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Enrichment Service', () => {
  describe('Social Media Enrichment (OpenGraph)', () => {
    it('should extract Instagram metadata via OpenGraph', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="Amazing Sunset" />
              <meta property="og:description" content="Beautiful sunset at the beach" />
              <meta property="og:image" content="https://instagram.com/image.jpg" />
            </head>
          </html>
        `,
      });

      const result = await enrichWithInstagram('https://instagram.com/p/ABC123/');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Amazing Sunset');
      expect(result?.description).toBe('Beautiful sunset at the beach');
      expect(result?.source).toBe('opengraph');
    });

    it('should handle Facebook URL enrichment', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="Shared Article" />
              <meta property="og:image" content="https://facebook.com/image.jpg" />
            </head>
          </html>
        `,
      });

      const result = await enrichWithFacebook('https://facebook.com/article');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Shared Article');
    });

    it('should handle Twitter URL enrichment', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="Great News" />
              <meta property="og:description" content="This is amazing" />
            </head>
          </html>
        `,
      });

      const result = await enrichWithTwitter('https://x.com/user/status/123');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Great News');
    });

    it('should return null when OpenGraph tags missing', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><head></head></html>',
      });

      const result = await enrichWithInstagram('https://instagram.com/p/ABC123/');
      expect(result).toBeNull();
    });

    it('should handle fetch timeout for OpenGraph', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 50);
          }),
      );

      const result = await enrichWithInstagram('https://instagram.com/p/ABC123/');
      expect(result).toBeNull();
    });
  });

});
