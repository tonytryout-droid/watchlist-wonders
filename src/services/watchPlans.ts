import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type WatchPlan = Database['public']['Tables']['watch_plans']['Row'];
type WatchPlanInsert = Database['public']['Tables']['watch_plans']['Insert'];
type WatchPlanUpdate = Database['public']['Tables']['watch_plans']['Update'];

export const watchPlanService = {
  /**
   * Get all watch plans for the current user
   */
  async getWatchPlans() {
    const { data, error } = await supabase
      .from('watch_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as WatchPlan[];
  },

  /**
   * Get a single watch plan by ID
   */
  async getWatchPlan(id: string) {
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
  async createWatchPlan(plan: WatchPlanInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('watch_plans')
      .insert({ ...plan, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as WatchPlan;
  },

  /**
   * Update a watch plan
   */
  async updateWatchPlan(id: string, updates: WatchPlanUpdate) {
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
  async deleteWatchPlan(id: string) {
    const { error } = await supabase
      .from('watch_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get bookmarks in a watch plan
   */
  async getPlanBookmarks(planId: string) {
    const { data, error } = await supabase
      .from('watch_plan_bookmarks')
      .select('*, bookmarks(*)')
      .eq('plan_id', planId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Add a bookmark to a watch plan
   */
  async addBookmarkToPlan(planId: string, bookmarkId: string, position?: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('watch_plan_bookmarks')
      .insert({
        plan_id: planId,
        bookmark_id: bookmarkId,
        user_id: user.id,
        position: position ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove a bookmark from a watch plan
   */
  async removeBookmarkFromPlan(planId: string, bookmarkId: string) {
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
  async reorderPlanBookmarks(planId: string, bookmarkIds: string[]) {
    const updates = bookmarkIds.map((bookmarkId, index) => ({
      plan_id: planId,
      bookmark_id: bookmarkId,
      position: index,
    }));

    const { error } = await supabase
      .from('watch_plan_bookmarks')
      .upsert(updates);

    if (error) throw error;
  },
};
