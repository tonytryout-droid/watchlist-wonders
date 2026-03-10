/**
 * Unit tests for notificationService
 * Covers notification retrieval, state transitions, batch operations, and real-time subscription
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification } from '@/types/database';

const {
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockGetDoc,
  mockOnSnapshot,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockCollection,
  mockDoc,
  mockDocumentId,
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
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockOnSnapshot: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockWhere: vi.fn(() => 'mock-where'),
    mockOrderBy: vi.fn(() => 'mock-orderBy'),
    mockLimit: vi.fn(() => 'mock-limit'),
    mockCollection: vi.fn(() => 'mock-collection'),
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockDocumentId: vi.fn(() => '__name__'),
    mockWriteBatch: vi.fn(() => makeBatch()),
    mockAuth,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  writeBatch: mockWriteBatch,
  documentId: mockDocumentId,
}));

vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: {},
}));

import { notificationService } from './notifications';

function makeSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: () => true, ref: `ref-${id}` };
}

function makeQuerySnap(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: items.map(({ id, data }) => makeSnap(id, data)),
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

const BASE_NOTIFICATION: Omit<Notification, 'id'> = {
  user_id: 'user-123',
  bookmark_id: 'bm1',
  schedule_id: null,
  title: 'Time to watch!',
  body: 'Your scheduled movie is ready.',
  read_at: null,
  created_at: '2024-01-01T12:00:00.000Z',
};

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'user-123' };
    mockWriteBatch.mockImplementation(() => makeBatch());
  });

  describe('getNotifications', () => {
    it('returns notifications with attached bookmark data', async () => {
      mockGetDocs
        .mockResolvedValueOnce(makeQuerySnap([{ id: 'n1', data: BASE_NOTIFICATION }]))
        .mockResolvedValueOnce(
          makeQuerySnap([{ id: 'bm1', data: { title: 'Inception', status: 'backlog' } }]),
        );

      const result = await notificationService.getNotifications();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n1');
      expect((result[0] as any).bookmarks?.title).toBe('Inception');
    });

    it('returns notifications without bookmark when bookmark_id is null', async () => {
      const noBookmark = { ...BASE_NOTIFICATION, bookmark_id: null };
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([{ id: 'n1', data: noBookmark }]));

      const result = await notificationService.getNotifications();

      expect(result).toHaveLength(1);
      expect((result[0] as any).bookmarks).toBeUndefined();
    });

    it('throws when not authenticated', async () => {
      mockAuth.currentUser = null;
      await expect(notificationService.getNotifications()).rejects.toThrow('Not authenticated');
    });

    it('deduplicates bookmark_ids before fetching', async () => {
      mockGetDocs
        .mockResolvedValueOnce(
          makeQuerySnap([
            { id: 'n1', data: BASE_NOTIFICATION },
            { id: 'n2', data: BASE_NOTIFICATION },
          ]),
        )
        .mockResolvedValueOnce(
          makeQuerySnap([{ id: 'bm1', data: { title: 'Inception', status: 'backlog' } }]),
        );

      const result = await notificationService.getNotifications();

      expect(result).toHaveLength(2);
      expect((result[0] as any).bookmarks?.title).toBe('Inception');
      expect((result[1] as any).bookmarks?.title).toBe('Inception');
      // Only 2 getDocs calls: one for notifications, one for the deduplicated bookmark batch
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUnreadNotifications', () => {
    it('queries only notifications where read_at is null', async () => {
      mockGetDocs
        .mockResolvedValueOnce(makeQuerySnap([{ id: 'n1', data: BASE_NOTIFICATION }]))
        .mockResolvedValueOnce(makeQuerySnap([]));

      await notificationService.getUnreadNotifications();

      expect(mockWhere).toHaveBeenCalledWith('read_at', '==', null);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the count of unread notifications', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { id: 'n1', data: BASE_NOTIFICATION },
          { id: 'n2', data: BASE_NOTIFICATION },
        ]),
      );

      const count = await notificationService.getUnreadCount();
      expect(count).toBe(2);
    });

    it('returns 0 when there are no unread notifications', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));
      expect(await notificationService.getUnreadCount()).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('sets read_at to an ISO string and returns the updated notification', async () => {
      const readData = { ...BASE_NOTIFICATION, read_at: '2024-06-01T10:00:00.000Z' };
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(makeSnap('n1', readData));

      const result = await notificationService.markAsRead('n1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ read_at: expect.any(String) }),
      );
      expect(result.read_at).not.toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('updates all unread notifications in a single batch', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { id: 'n1', data: BASE_NOTIFICATION },
          { id: 'n2', data: BASE_NOTIFICATION },
        ]),
      );

      await notificationService.markAllAsRead();

      expect(batchInstance.update).toHaveBeenCalledTimes(2);
      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ read_at: expect.any(String) }),
      );
      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });

    it('does nothing when there are no unread notifications', async () => {
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));

      await notificationService.markAllAsRead();

      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('processes more than 500 notifications in multiple batches', async () => {
      const notifications = Array.from({ length: 501 }, (_, i) => ({
        id: `n${i}`,
        data: BASE_NOTIFICATION,
      }));
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap(notifications));

      const batch1 = makeBatch();
      const batch2 = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batch1).mockReturnValueOnce(batch2);

      await notificationService.markAllAsRead();

      expect(batch1.update).toHaveBeenCalledTimes(500);
      expect(batch2.update).toHaveBeenCalledTimes(1);
      expect(batch1.commit).toHaveBeenCalledOnce();
      expect(batch2.commit).toHaveBeenCalledOnce();
    });
  });

  describe('deleteNotification', () => {
    it('deletes a notification by ID', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);
      await notificationService.deleteNotification('n1');
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('subscribeToNotifications', () => {
    it('registers a real-time snapshot listener', () => {
      const mockUnsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const callback = vi.fn();
      const unsubscribe = notificationService.subscribeToNotifications(callback);

      expect(mockOnSnapshot).toHaveBeenCalledOnce();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('calls callback only for new added documents (skips initial load)', () => {
      let capturedHandler: (snapshot: any) => void;
      mockOnSnapshot.mockImplementationOnce((_query: any, handler: (snapshot: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      notificationService.subscribeToNotifications(callback);

      // First snapshot — initial load, should be skipped
      capturedHandler!({
        docChanges: () => [{ type: 'added', doc: makeSnap('n1', BASE_NOTIFICATION) }],
      });
      expect(callback).not.toHaveBeenCalled();

      // Second snapshot — real new notification
      capturedHandler!({
        docChanges: () => [{ type: 'added', doc: makeSnap('n2', BASE_NOTIFICATION) }],
      });
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'n2' }));
    });

    it('ignores non-added change types (modified, removed)', () => {
      let capturedHandler: (snapshot: any) => void;
      mockOnSnapshot.mockImplementationOnce((_query: any, handler: (snapshot: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      notificationService.subscribeToNotifications(callback);

      // Skip initial load
      capturedHandler!({ docChanges: () => [] });

      // Modified and removed changes should not trigger callback
      capturedHandler!({
        docChanges: () => [
          { type: 'modified', doc: makeSnap('n1', BASE_NOTIFICATION) },
          { type: 'removed', doc: makeSnap('n1', BASE_NOTIFICATION) },
        ],
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
