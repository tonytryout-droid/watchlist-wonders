/**
 * Unit tests for socialService
 * Covers follow/unfollow, feed fan-out with retry logic, and profile management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedItem } from '@/types/database';

const {
  mockSetDoc,
  mockDeleteDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockDoc,
  mockQuery,
  mockOrderBy,
  mockLimit,
  mockServerTimestamp,
  mockGetCountFromServer,
  mockWriteBatch,
  mockAuth,
} = vi.hoisted(() => {
  const mockAuth = { currentUser: null as { uid: string } | null };
  const makeBatch = () => ({
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });
  return {
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn(() => 'mock-collection'),
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockOrderBy: vi.fn(() => 'mock-orderBy'),
    mockLimit: vi.fn(() => 'mock-limit'),
    mockServerTimestamp: vi.fn(() => 'mock-server-timestamp'),
    mockGetCountFromServer: vi.fn(),
    mockWriteBatch: vi.fn(() => makeBatch()),
    mockAuth,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  writeBatch: mockWriteBatch,
  serverTimestamp: mockServerTimestamp,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getCountFromServer: mockGetCountFromServer,
}));

vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: {},
}));

import { socialService } from './social';

function makeSnap(exists: boolean, data: Record<string, unknown> = {}) {
  return { exists: () => exists, data: () => data, id: 'mock-id' };
}

function makeQuerySnap(items: Array<Record<string, unknown>>) {
  return {
    docs: items.map((data, i) => ({ id: `item${i}`, data: () => data })),
    empty: items.length === 0,
    size: items.length,
  };
}

function makeBatch() {
  return {
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

const FEED_ITEM: Omit<FeedItem, 'id'> = {
  actor_uid: 'user-123',
  action: 'added',
  bookmark_id: 'bm1',
  created_at: '2024-01-01T00:00:00.000Z',
};

describe('socialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'user-123' };
    mockWriteBatch.mockImplementation(() => makeBatch());
  });

  describe('followUser', () => {
    it('writes to both following and followers subcollections atomically', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      await socialService.followUser('user-456');

      expect(batchInstance.set).toHaveBeenCalledTimes(2);
      expect(batchInstance.set).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ follower_uid: 'user-123', following_uid: 'user-456' }),
      );
      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });

    it('throws when attempting to follow yourself', async () => {
      await expect(socialService.followUser('user-123')).rejects.toThrow(
        'Cannot follow yourself',
      );
    });

    it('throws when not authenticated', async () => {
      mockAuth.currentUser = null;
      await expect(socialService.followUser('user-456')).rejects.toThrow('Not authenticated');
    });
  });

  describe('unfollowUser', () => {
    it('deletes from both following and followers subcollections atomically', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      await socialService.unfollowUser('user-456');

      expect(batchInstance.delete).toHaveBeenCalledTimes(2);
      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });
  });

  describe('isFollowing', () => {
    it('returns true when a follow relationship exists', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap(true));
      expect(await socialService.isFollowing('user-456')).toBe(true);
    });

    it('returns false when no follow relationship exists', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap(false));
      expect(await socialService.isFollowing('user-456')).toBe(false);
    });
  });

  describe('getFollowingList', () => {
    it('returns list of users the given uid is following', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { follower_uid: 'user-123', following_uid: 'user-456', created_at: '2024-01-01T00:00:00.000Z' },
          { follower_uid: 'user-123', following_uid: 'user-789', created_at: '2024-01-02T00:00:00.000Z' },
        ]),
      );

      const result = await socialService.getFollowingList('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].following_uid).toBe('user-456');
    });

    it('returns empty array when user follows nobody', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));
      expect(await socialService.getFollowingList('user-123')).toEqual([]);
    });
  });

  describe('getFollowerCount', () => {
    it('returns the count from the server', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 42 }) });
      expect(await socialService.getFollowerCount('user-123')).toBe(42);
    });

    it('returns 0 when the user has no followers', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 0 }) });
      expect(await socialService.getFollowerCount('user-123')).toBe(0);
    });
  });

  describe('getFollowingCount', () => {
    it('returns the following count from the server', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 10 }) });
      expect(await socialService.getFollowingCount('user-123')).toBe(10);
    });
  });

  describe('getFeed', () => {
    it('returns the last 50 feed items ordered by created_at desc', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { actor_uid: 'user-456', action: 'done', bookmark_id: 'bm2', created_at: '2024-01-02T00:00:00.000Z' },
        ]),
      );

      const result = await socialService.getFeed('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('done');
      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('returns empty array when the feed is empty', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));
      expect(await socialService.getFeed('user-123')).toEqual([]);
    });
  });

  describe('publishFeedItem', () => {
    it('writes to the current user\'s feed and all follower feeds', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      await socialService.publishFeedItem(FEED_ITEM, ['follower-1', 'follower-2']);

      // 1 (self) + 2 (followers) = 3 set operations
      expect(batchInstance.set).toHaveBeenCalledTimes(3);
      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });

    it('writes only to own feed when there are no followers', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      await socialService.publishFeedItem(FEED_ITEM, []);

      expect(batchInstance.set).toHaveBeenCalledTimes(1);
    });

    it('uses provided created_at if present', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      const itemWithTimestamp = { ...FEED_ITEM, created_at: '2024-06-15T10:00:00.000Z' };
      await socialService.publishFeedItem(itemWithTimestamp, []);

      expect(batchInstance.set).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ created_at: '2024-06-15T10:00:00.000Z' }),
      );
    });

    it('retries on batch commit failure and eventually throws', async () => {
      const failingBatch = {
        set: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        commit: vi.fn().mockRejectedValue(new Error('Firestore unavailable')),
      };
      mockWriteBatch.mockReturnValue(failingBatch);

      await expect(
        socialService.publishFeedItem(FEED_ITEM, []),
      ).rejects.toThrow('Feed fan-out failed');

      // Should have retried 3 times (MAX_RETRIES)
      expect(failingBatch.commit).toHaveBeenCalledTimes(3);
    }, 10000);

    it('chunks large follower lists into batches of 499', async () => {
      // 500 followers + 1 self = 501 UIDs, needs 2 batches
      const followers = Array.from({ length: 500 }, (_, i) => `follower-${i}`);
      const batch1 = makeBatch();
      const batch2 = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batch1).mockReturnValueOnce(batch2);

      await socialService.publishFeedItem(FEED_ITEM, followers);

      expect(batch1.set).toHaveBeenCalledTimes(499);
      expect(batch2.set).toHaveBeenCalledTimes(2);
      expect(batch1.commit).toHaveBeenCalledOnce();
      expect(batch2.commit).toHaveBeenCalledOnce();
    });
  });

  describe('getUserPublicProfile', () => {
    it('returns the public profile when it exists', async () => {
      mockGetDoc.mockResolvedValueOnce(
        makeSnap(true, { display_name: 'Alice', bio: 'Film lover', avatar_url: null }),
      );

      const profile = await socialService.getUserPublicProfile('user-456');

      expect(profile).not.toBeNull();
      expect(profile?.uid).toBe('user-456');
      expect(profile?.display_name).toBe('Alice');
    });

    it('returns null when the profile does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap(false));
      expect(await socialService.getUserPublicProfile('user-456')).toBeNull();
    });
  });

  describe('savePublicProfile', () => {
    it('merges profile data into the public profile document', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      await socialService.savePublicProfile({ display_name: 'Bob', bio: 'Writer' });

      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        { display_name: 'Bob', bio: 'Writer' },
        { merge: true },
      );
    });

    it('throws when not authenticated', async () => {
      mockAuth.currentUser = null;
      await expect(socialService.savePublicProfile({ display_name: 'X' })).rejects.toThrow(
        'Not authenticated',
      );
    });
  });
});
