/**
 * Unit tests for watchPlanService
 * Covers CRUD operations, bookmark associations, and batch reorder logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WatchPlan } from '@/types/database';

const {
  mockAddDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockGetDoc,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockCollection,
  mockDoc,
  mockDeleteField,
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
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockWhere: vi.fn(() => 'mock-where'),
    mockOrderBy: vi.fn(() => 'mock-orderBy'),
    mockCollection: vi.fn(() => 'mock-collection'),
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockDeleteField: vi.fn(() => 'mock-delete-field'),
    mockWriteBatch: vi.fn(() => makeBatch()),
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
  writeBatch: mockWriteBatch,
  documentId: vi.fn(() => '__name__'),
  deleteField: mockDeleteField,
}));

vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: {},
}));

import { watchPlanService } from './watchPlans';

function makeSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: () => true };
}

function makeQuerySnap(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: items.map(({ id, data }) => ({ ...makeSnap(id, data), ref: `ref-${id}` })),
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

const BASE_PLAN: Omit<WatchPlan, 'id'> = {
  user_id: 'user-123',
  name: 'Weekend Picks',
  description: 'Movies for the weekend',
  preferred_days: [6, 0],
  time_windows: [{ start: '19:00', end: '23:00' }],
  max_runtime_minutes: 120,
  mood_tags: ['comedy'],
  platforms_allowed: ['netflix'],
  auto_suggest: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

describe('watchPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'user-123' };
    mockWriteBatch.mockImplementation(() => makeBatch());
  });

  describe('getWatchPlans', () => {
    it('returns all watch plans ordered by created_at desc', async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([
          { id: 'plan1', data: BASE_PLAN },
          { id: 'plan2', data: { ...BASE_PLAN, name: 'Weeknight Queue' } },
        ]),
      );

      const result = await watchPlanService.getWatchPlans();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('plan1');
      expect(result[1].name).toBe('Weeknight Queue');
    });

    it('throws when not authenticated', async () => {
      mockAuth.currentUser = null;
      await expect(watchPlanService.getWatchPlans()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getWatchPlan', () => {
    it('returns a single watch plan by ID', async () => {
      mockGetDoc.mockResolvedValueOnce(makeSnap('plan1', BASE_PLAN));
      const result = await watchPlanService.getWatchPlan('plan1');
      expect(result).toEqual({ id: 'plan1', ...BASE_PLAN });
    });

    it('throws when the plan does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false, id: 'plan-gone', data: () => ({}) });
      await expect(watchPlanService.getWatchPlan('plan-gone')).rejects.toThrow(
        'Watch plan not found',
      );
    });
  });

  describe('createWatchPlan', () => {
    it('creates a plan and returns it with generated id and timestamps', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-plan' });

      const result = await watchPlanService.createWatchPlan({
        name: 'Test Plan',
        description: null,
        preferred_days: [],
        time_windows: [],
        max_runtime_minutes: null,
        mood_tags: [],
        platforms_allowed: [],
        auto_suggest: false,
      });

      expect(result.id).toBe('new-plan');
      expect(result.name).toBe('Test Plan');
      expect(result.user_id).toBe('user-123');
      expect(result.created_at).toBeTruthy();
      expect(result.updated_at).toBeTruthy();
    });

    it('applies defaults for array fields when not provided', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-plan' });

      const result = await watchPlanService.createWatchPlan({
        name: 'Minimal Plan',
        description: null,
        time_windows: [],
        max_runtime_minutes: null,
        auto_suggest: false,
      } as any);

      expect(result.preferred_days).toEqual([]);
      expect(result.mood_tags).toEqual([]);
      expect(result.platforms_allowed).toEqual([]);
    });
  });

  describe('updateWatchPlan', () => {
    it('updates a plan and returns the refreshed document', async () => {
      const updated = { ...BASE_PLAN, name: 'Updated Name' };
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      mockGetDoc.mockResolvedValueOnce(makeSnap('plan1', updated));

      const result = await watchPlanService.updateWatchPlan('plan1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ name: 'Updated Name', updated_at: expect.any(String) }),
      );
    });
  });

  describe('deleteWatchPlan', () => {
    it('deletes the plan and all bookmark sub-documents', async () => {
      const bookmarkDocs = [
        { id: 'pb1', data: () => ({}), ref: 'ref-pb1' },
        { id: 'pb2', data: () => ({}), ref: 'ref-pb2' },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: bookmarkDocs, empty: false });

      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await watchPlanService.deleteWatchPlan('plan1');

      expect(batchInstance.delete).toHaveBeenCalledTimes(2);
      expect(batchInstance.commit).toHaveBeenCalledOnce();
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });

    it('skips batch delete when plan has no bookmarks', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [], empty: true });
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await watchPlanService.deleteWatchPlan('empty-plan');

      expect(mockWriteBatch).not.toHaveBeenCalled();
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('addBookmarkToPlan', () => {
    it('adds a bookmark to a plan at a given position', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-entry' });

      await watchPlanService.addBookmarkToPlan('plan1', 'bm1', 2);

      expect(mockAddDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          bookmark_id: 'bm1',
          user_id: 'user-123',
          position: 2,
        }),
      );
    });

    it('defaults position to 0 when not specified', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-entry' });

      await watchPlanService.addBookmarkToPlan('plan1', 'bm1');

      expect(mockAddDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({ position: 0 }),
      );
    });
  });

  describe('removeBookmarkFromPlan', () => {
    it('removes all entries matching the bookmark_id from the plan', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([{ id: 'entry1', data: { bookmark_id: 'bm1', position: 0 } }]),
      );

      await watchPlanService.removeBookmarkFromPlan('plan1', 'bm1');

      expect(batchInstance.delete).toHaveBeenCalledOnce();
      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });
  });

  describe('reorderPlanBookmarks', () => {
    it('uses a single atomic batch for small reorders (under 500 ops)', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);

      const existingDocs = [
        { id: 'e1', data: () => ({}), ref: 'ref-e1' },
        { id: 'e2', data: () => ({}), ref: 'ref-e2' },
        { id: 'e3', data: () => ({}), ref: 'ref-e3' },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: existingDocs, empty: false });

      await watchPlanService.reorderPlanBookmarks('plan1', ['bm3', 'bm1', 'bm2']);

      expect(batchInstance.delete).toHaveBeenCalledTimes(3);
      expect(batchInstance.set).toHaveBeenCalledTimes(3);
      expect(batchInstance.set).toHaveBeenNthCalledWith(
        1,
        'mock-doc-ref',
        expect.objectContaining({ bookmark_id: 'bm3', position: 0 }),
      );
      expect(batchInstance.set).toHaveBeenNthCalledWith(
        2,
        'mock-doc-ref',
        expect.objectContaining({ bookmark_id: 'bm1', position: 1 }),
      );
    });

    it('handles an empty reorder (no bookmark IDs)', async () => {
      const batchInstance = makeBatch();
      mockWriteBatch.mockReturnValueOnce(batchInstance);
      mockGetDocs.mockResolvedValueOnce({ docs: [], empty: true });

      await watchPlanService.reorderPlanBookmarks('plan1', []);

      expect(batchInstance.commit).toHaveBeenCalledOnce();
    });
  });

  describe('getPlanBookmarks', () => {
    it('returns empty array for a plan with no bookmarks', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [], empty: true, size: 0 });

      const result = await watchPlanService.getPlanBookmarks('plan1');
      expect(result).toEqual([]);
    });

    it('fetches and joins bookmark data to plan entries', async () => {
      const planDocs = [
        { id: 'entry1', data: () => ({ bookmark_id: 'bm1', position: 0 }), ref: 'ref-e1' },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: planDocs, empty: false, size: 1 });
      mockGetDocs.mockResolvedValueOnce(
        makeQuerySnap([{ id: 'bm1', data: { title: 'Inception', status: 'backlog' } }]),
      );

      const result = await watchPlanService.getPlanBookmarks('plan1');

      expect(result).toHaveLength(1);
      expect(result[0].bookmark_id).toBe('bm1');
      expect(result[0].position).toBe(0);
      expect(result[0].bookmarks?.title).toBe('Inception');
    });

    it('sets bookmarks to null when the bookmark doc no longer exists', async () => {
      const planDocs = [
        { id: 'entry1', data: () => ({ bookmark_id: 'deleted-bm', position: 0 }), ref: 'ref-e1' },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: planDocs, empty: false, size: 1 });
      mockGetDocs.mockResolvedValueOnce(makeQuerySnap([]));

      const result = await watchPlanService.getPlanBookmarks('plan1');

      expect(result[0].bookmarks).toBeNull();
    });
  });
});
