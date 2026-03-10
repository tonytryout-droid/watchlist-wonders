/**
 * Unit tests for bookmarkService
 * Mocks Firebase Firestore to test CRUD operations, filtering, and business logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bookmark } from '@/types/database';

const {
  mockAddDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockGetDoc,
  mockIncrement,
  mockWriteBatch,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockCollection,
  mockDoc,
  mockAuth,
} = vi.hoisted(() => {
  const mockAuth = { currentUser: null as { uid: string } | null };
  return {
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockIncrement: vi.fn((n: number) => ({ __increment: n })),
    mockWriteBatch: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockWhere: vi.fn(() => 'mock-where'),
    mockOrderBy: vi.fn(() => 'mock-orderBy'),
    mockCollection: vi.fn(() => 'mock-collection'),
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockAuth,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  increment: mockIncrement,
  writeBatch: mockWriteBatch,
  documentId: vi.fn(() => '__name__'),
  deleteField: vi.fn(() => 'mock-delete-field'),
}));

vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: {},
}));

import { bookmarkService } from './bookmarks';

// Helper to build a fake Firestore snapshot
function makeSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: () => true };
}

function makeQuerySnap(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: items.map(({ id, data }) => makeSnap(id, data)),
    empty: items.length === 0,
    size: items.length,
  };
}

const BASE_BOOKMARK: Omit<Bookmark, 'id'> = {
  user_id: 'user-123',
  title: 'Inception',
  type: 'movie',
  provider: 'imdb',
  source_url: 'https://imdb.com/title/tt1375666',
  canonical_url: null,
  platform_label: null,
  status: 'backlog',
  runtime_minutes: 148,
  release_year: 2010,
  poster_url: null,
  backdrop_url: null,
  tags: [],
  mood_tags: ['thriller'],
  notes: null,
  metadata: {},
  last_shown_at: null,
  shown_count: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

describe('bookmarkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'user-123' };
  });

  describe('getBookmarks', () => {
    it('returns all bookmarks for the current user', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { id: 'bm1', data: BASE_BOOKMARK },
          { id: 'bm2', data: { ...BASE_BOOKMARK, title: 'The Matrix' } },
        ]),
      );

      const result = await bookmarkService.getBookmarks();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'bm1', ...BASE_BOOKMARK });
      expect(result[1].title).toBe('The Matrix');
    });

    it('returns empty array when user has no bookmarks', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));
      expect(await bookmarkService.getBookmarks()).toEqual([]);
    });

    it('throws when user is not authenticated', async () => {
      mockAuth.currentUser = null;
      await expect(bookmarkService.getBookmarks()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getBookmarksByStatus', () => {
    it('returns only bookmarks matching the given status', async () => {
      const done: Omit<Bookmark, 'id'> = { ...BASE_BOOKMARK, status: 'done' };
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([{ id: 'bm1', data: done }]));

      const result = await bookmarkService.getBookmarksByStatus('done');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('done');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'done');
    });
  });

  describe('getBookmark', () => {
    it('returns a single bookmark by ID', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', BASE_BOOKMARK));
      const result = await bookmarkService.getBookmark('bm1');
      expect(result).toEqual({ id: 'bm1', ...BASE_BOOKMARK });
    });

    it('throws when the bookmark does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false, id: 'bm-gone', data: () => ({}) });
      await expect(bookmarkService.getBookmark('bm-gone')).rejects.toThrow('Bookmark not found');
    });
  });

  describe('createBookmark', () => {
    it('creates a bookmark with required fields and sensible defaults', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-bm' });

      const result = await bookmarkService.createBookmark({ title: 'Dune' });

      expect(result.id).toBe('new-bm');
      expect(result.title).toBe('Dune');
      expect(result.type).toBe('movie');
      expect(result.status).toBe('backlog');
      expect(result.provider).toBe('generic');
      expect(result.tags).toEqual([]);
      expect(result.mood_tags).toEqual([]);
      expect(result.metadata).toEqual({});
      expect(result.shown_count).toBe(0);
      expect(result.user_id).toBe('user-123');
      expect(result.created_at).toBeTruthy();
      expect(result.updated_at).toBeTruthy();
    });

    it('preserves provided optional fields', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-bm' });

      const result = await bookmarkService.createBookmark({
        title: 'Dune',
        type: 'series',
        status: 'watching',
        runtime_minutes: 155,
        tags: ['sci-fi'],
        mood_tags: ['epic'],
      });

      expect(result.type).toBe('series');
      expect(result.status).toBe('watching');
      expect(result.runtime_minutes).toBe(155);
      expect(result.tags).toEqual(['sci-fi']);
      expect(result.mood_tags).toEqual(['epic']);
    });
  });

  describe('updateBookmark', () => {
    it('updates a bookmark and returns the updated document', async () => {
      const updated = { ...BASE_BOOKMARK, title: 'Updated Title' };
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', updated));

      const result = await bookmarkService.updateBookmark('bm1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('throws when the bookmark does not exist after update', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce({ exists: () => false, id: 'bm1', data: () => ({}) });

      await expect(bookmarkService.updateBookmark('bm1', { title: 'x' })).rejects.toThrow(
        'Bookmark not found after update',
      );
    });
  });

  describe('deleteBookmark', () => {
    it('deletes a bookmark by ID', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);
      await bookmarkService.deleteBookmark('bm1');
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('updateStatus', () => {
    it('sets watched_at when first marking a bookmark as done', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', { ...BASE_BOOKMARK, watched_at: null }));
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      const doneData = { ...BASE_BOOKMARK, status: 'done', watched_at: '2024-01-01T00:00:00.000Z' };
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', doneData));

      const result = await bookmarkService.updateStatus('bm1', 'done');

      expect(result.status).toBe('done');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ status: 'done', watched_at: expect.any(String) }),
      );
    });

    it('does not overwrite an existing watched_at when marking done again', async () => {
      const existingWatchedAt = '2023-12-01T00:00:00.000Z';
      mockGetDoc.mockResolvedValueOnce(
        makeSnap('bm1', { ...BASE_BOOKMARK, status: 'done', watched_at: existingWatchedAt }),
      );
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(
        makeSnap('bm1', { ...BASE_BOOKMARK, status: 'done', watched_at: existingWatchedAt }),
      );

      await bookmarkService.updateStatus('bm1', 'done');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.not.objectContaining({ watched_at: expect.any(String) }),
      );
    });

    it('sets status without watched_at for non-done statuses', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', { ...BASE_BOOKMARK, status: 'watching' }));

      const result = await bookmarkService.updateStatus('bm1', 'watching');

      expect(result.status).toBe('watching');
    });
  });

  describe('rateBookmark', () => {
    it('accepts ratings between 1 and 5', async () => {
      for (const rating of [1, 2, 3, 4, 5]) {
        mockUpdateDoc.mockResolvedValueOnce(undefined);
        mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', { ...BASE_BOOKMARK, user_rating: rating }));
        const result = await bookmarkService.rateBookmark('bm1', rating);
        expect(result.user_rating).toBe(rating);
      }
    });

    it('accepts null to clear a rating', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(makeSnap('bm1', { ...BASE_BOOKMARK, user_rating: null }));
      const result = await bookmarkService.rateBookmark('bm1', null);
      expect(result.user_rating).toBeNull();
    });

    it('throws for rating below 1', async () => {
      await expect(bookmarkService.rateBookmark('bm1', 0)).rejects.toThrow(
        'Rating must be null or an integer between 1 and 5',
      );
    });

    it('throws for rating above 5', async () => {
      await expect(bookmarkService.rateBookmark('bm1', 6)).rejects.toThrow(
        'Rating must be null or an integer between 1 and 5',
      );
    });

    it('throws for a non-integer rating', async () => {
      await expect(bookmarkService.rateBookmark('bm1', 3.5)).rejects.toThrow(
        'Rating must be null or an integer between 1 and 5',
      );
    });

    it('stores an optional review alongside the rating', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(
        makeSnap('bm1', { ...BASE_BOOKMARK, user_rating: 5, user_review: 'Great!' }),
      );

      await bookmarkService.rateBookmark('bm1', 5, 'Great!');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ user_rating: 5, user_review: 'Great!' }),
      );
    });
  });

  describe('searchBookmarks', () => {
    const items = [
      { id: 'bm1', data: { ...BASE_BOOKMARK, title: 'Inception', notes: 'mind bending' } },
      { id: 'bm2', data: { ...BASE_BOOKMARK, title: 'The Matrix', notes: null } },
      { id: 'bm3', data: { ...BASE_BOOKMARK, title: 'Dune', notes: 'desert planet' } },
    ];

    it('returns bookmarks whose title matches the query', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const results = await bookmarkService.searchBookmarks('incep');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Inception');
    });

    it('matches notes as well as titles', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const results = await bookmarkService.searchBookmarks('mind');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Inception');
    });

    it('is case-insensitive', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const results = await bookmarkService.searchBookmarks('MATRIX');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('The Matrix');
    });

    it('returns all bookmarks when query is empty', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const results = await bookmarkService.searchBookmarks('');
      expect(results).toHaveLength(3);
    });
  });

  describe('getTonightCandidates', () => {
    it('includes backlog bookmarks with runtime <= 90 minutes', async () => {
      const short = { ...BASE_BOOKMARK, runtime_minutes: 85, status: 'backlog' as const };
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([{ id: 'bm1', data: short }]));
      const result = await bookmarkService.getTonightCandidates();
      expect(result).toHaveLength(1);
    });

    it('excludes backlog bookmarks with runtime > 90 minutes', async () => {
      const long = { ...BASE_BOOKMARK, runtime_minutes: 148, status: 'backlog' as const };
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([{ id: 'bm1', data: long }]));
      const result = await bookmarkService.getTonightCandidates();
      expect(result).toHaveLength(0);
    });

    it('includes bookmarks with null runtime (unknown length)', async () => {
      const unknown = { ...BASE_BOOKMARK, runtime_minutes: null, status: 'backlog' as const };
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([{ id: 'bm1', data: unknown }]));
      const result = await bookmarkService.getTonightCandidates();
      expect(result).toHaveLength(1);
    });

    it('sorts by shown_count ascending (least shown first)', async () => {
      const items = [
        { id: 'bm1', data: { ...BASE_BOOKMARK, runtime_minutes: 60, shown_count: 5 } },
        { id: 'bm2', data: { ...BASE_BOOKMARK, runtime_minutes: 60, shown_count: 1 } },
        { id: 'bm3', data: { ...BASE_BOOKMARK, runtime_minutes: 60, shown_count: 3 } },
      ];
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const result = await bookmarkService.getTonightCandidates();
      expect(result[0].id).toBe('bm2');
      expect(result[1].id).toBe('bm3');
      expect(result[2].id).toBe('bm1');
    });

    it('caps results at 20', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        id: `bm${i}`,
        data: { ...BASE_BOOKMARK, runtime_minutes: 60 },
      }));
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));
      const result = await bookmarkService.getTonightCandidates();
      expect(result).toHaveLength(20);
    });
  });

  describe('getBookmarksByMood', () => {
    it('groups bookmarks by mood tag', async () => {
      const items = [
        { id: 'bm1', data: { ...BASE_BOOKMARK, mood_tags: ['thriller', 'dark'] } },
        { id: 'bm2', data: { ...BASE_BOOKMARK, mood_tags: ['thriller'] } },
        { id: 'bm3', data: { ...BASE_BOOKMARK, mood_tags: ['comedy'] } },
      ];
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));

      const result = await bookmarkService.getBookmarksByMood();

      expect(result['thriller']).toHaveLength(2);
      expect(result['dark']).toHaveLength(1);
      expect(result['comedy']).toHaveLength(1);
    });

    it('returns empty object when no bookmarks have mood tags', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([{ id: 'bm1', data: { ...BASE_BOOKMARK, mood_tags: [] } }]),
      );
      const result = await bookmarkService.getBookmarksByMood();
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('computes correct counts and total watched minutes', async () => {
      const items = [
        { id: 'bm1', data: { ...BASE_BOOKMARK, status: 'done', runtime_minutes: 120 } },
        { id: 'bm2', data: { ...BASE_BOOKMARK, status: 'done', runtime_minutes: 90 } },
        { id: 'bm3', data: { ...BASE_BOOKMARK, status: 'backlog' } },
        { id: 'bm4', data: { ...BASE_BOOKMARK, status: 'watching' } },
        { id: 'bm5', data: { ...BASE_BOOKMARK, status: 'dropped' } },
      ];
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));

      const stats = await bookmarkService.getStats();

      expect(stats.total).toBe(5);
      expect(stats.done).toBe(2);
      expect(stats.backlog).toBe(1);
      expect(stats.watching).toBe(1);
      expect(stats.dropped).toBe(1);
      expect(stats.totalWatchedMinutes).toBe(210);
    });

    it('excludes null runtime from totalWatchedMinutes', async () => {
      const items = [
        { id: 'bm1', data: { ...BASE_BOOKMARK, status: 'done', runtime_minutes: 100 } },
        { id: 'bm2', data: { ...BASE_BOOKMARK, status: 'done', runtime_minutes: null } },
      ];
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(items));

      const stats = await bookmarkService.getStats();
      expect(stats.totalWatchedMinutes).toBe(100);
    });
  });

  describe('markAsShown', () => {
    it('increments shown_count and updates last_shown_at', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      await bookmarkService.markAsShown('bm1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({
          last_shown_at: expect.any(String),
          shown_count: { __increment: 1 },
        }),
      );
    });
  });
});
