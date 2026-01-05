import { supabase } from '@/integrations/supabase/client';
import type { WatchPlan, Bookmark } from '@/types/database';

type WatchPlanBookmarkRow = {
  plan_id: string;
  bookmark_id: string;
  user_id: string;
  position: number;
  bookmarks: Bookmark;
};

export const watchPlanService = {
  /**
   * Get all watch plans for the current user
   */
  async getWatchPlans(): Promise<WatchPlan[]> {
    const { data, error } = await supabase
      .from('watch_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as WatchPlan[];
  },

  /**
   * Get a single watch plan by ID
   */
  async getWatchPlan(id: string): Promise<WatchPlan> {
    const { data, error } = await supabase
      .from('watch_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as WatchPlan;
  },

  /**
   * Create a new watch plan
   */
  async createWatchPlan(plan: Omit<WatchPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<WatchPlan> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('watch_plans')
      .insert({ 
        ...plan, 
        user_id: user.id,
        preferred_days: plan.preferred_days || [],
        mood_tags: plan.mood_tags || [],
        platforms_allowed: plan.platforms_allowed || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data as WatchPlan;
  },

  /**
   * Update a watch plan
   */
  async updateWatchPlan(id: string, updates: Partial<WatchPlan>): Promise<WatchPlan> {
    const { data, error } = await supabase
      .from('watch_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as WatchPlan;
  },

  /**
   * Delete a watch plan
   */
  async deleteWatchPlan(id: string): Promise<void> {
    const { error } = await supabase
      .from('watch_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get bookmarks in a watch plan
   */
  async getPlanBookmarks(planId: string): Promise<WatchPlanBookmarkRow[]> {
    const { data, error } = await supabase
      .from('watch_plan_bookmarks')
      .select('*, bookmarks(*)')
      .eq('plan_id', planId)
      .order('position', { ascending: true });

    if (error) throw error;
    return (data || []) as WatchPlanBookmarkRow[];
  },

  /**
   * Add a bookmark to a watch plan
   */
  async addBookmarkToPlan(planId: string, bookmarkId: string, position?: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('watch_plan_bookmarks')
      .insert({
        plan_id: planId,
        bookmark_id: bookmarkId,
        user_id: user.id,
        position: position ?? 0,
      });

    if (error) throw error;
  },

  /**
   * Remove a bookmark from a watch plan
   */
  async removeBookmarkFromPlan(planId: string, bookmarkId: string): Promise<void> {
    const { error } = await supabase
      .from('watch_plan_bookmarks')
      .delete()
      .eq('plan_id', planId)
      .eq('bookmark_id', bookmarkId);

    if (error) throw error;
  },

  /**
   * Reorder bookmarks in a watch plan
   */
  async reorderPlanBookmarks(planId: string, bookmarkIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Delete existing entries and re-insert with new positions
    const { error: deleteError } = await supabase
      .from('watch_plan_bookmarks')
      .delete()
      .eq('plan_id', planId);

    if (deleteError) throw deleteError;

    const inserts = bookmarkIds.map((bookmarkId, index) => ({
      plan_id: planId,
      bookmark_id: bookmarkId,
      user_id: user.id,
      position: index,
    }));

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from('watch_plan_bookmarks')
        .insert(inserts);

      if (insertError) throw insertError;
    }
  },
};
