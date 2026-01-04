import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Bookmark = Database['public']['Tables']['bookmarks']['Row'];
type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert'];
type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update'];

export const bookmarkService = {
  /**
   * Get all bookmarks for the current user
   */
  async getBookmarks() {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Bookmark[];
  },

  /**
   * Get bookmarks by status
   */
  async getBookmarksByStatus(status: Bookmark['status']) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Bookmark[];
  },

  /**
   * Get a single bookmark by ID
   */
  async getBookmark(id: string) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Bookmark;
  },

  /**
   * Create a new bookmark
   */
  async createBookmark(bookmark: BookmarkInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({ ...bookmark, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as Bookmark;
  },

  /**
   * Update an existing bookmark
   */
  async updateBookmark(id: string, updates: BookmarkUpdate) {
    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Bookmark;
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Update bookmark status
   */
  async updateStatus(id: string, status: Bookmark['status']) {
    return this.updateBookmark(id, { status });
  },

  /**
   * Search bookmarks by title or notes
   */
  async searchBookmarks(query: string) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .or(`title.ilike.%${query}%,notes.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Bookmark[];
  },

  /**
   * Filter bookmarks by multiple criteria
   */
  async filterBookmarks(filters: {
    status?: Bookmark['status'][];
    provider?: Bookmark['provider'][];
    type?: Bookmark['type'][];
    moodTags?: string[];
  }) {
    let query = supabase.from('bookmarks').select('*');

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.provider && filters.provider.length > 0) {
      query = query.in('provider', filters.provider);
    }

    if (filters.type && filters.type.length > 0) {
      query = query.in('type', filters.type);
    }

    if (filters.moodTags && filters.moodTags.length > 0) {
      query = query.overlaps('mood_tags', filters.moodTags);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as Bookmark[];
  },

  /**
   * Get bookmarks grouped by mood tags
   */
  async getBookmarksByMood() {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bookmarks = data as Bookmark[];
    const byMood: Record<string, Bookmark[]> = {};

    bookmarks.forEach((bookmark) => {
      bookmark.mood_tags.forEach((mood) => {
        if (!byMood[mood]) byMood[mood] = [];
        byMood[mood].push(bookmark);
      });
    });

    return byMood;
  },

  /**
   * Get statistics about user's bookmarks
   */
  async getStats() {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('status, runtime_minutes');

    if (error) throw error;

    const bookmarks = data as Bookmark[];
    const stats = {
      total: bookmarks.length,
      backlog: bookmarks.filter((b) => b.status === 'backlog').length,
      watching: bookmarks.filter((b) => b.status === 'watching').length,
      done: bookmarks.filter((b) => b.status === 'done').length,
      dropped: bookmarks.filter((b) => b.status === 'dropped').length,
      totalWatchedMinutes: bookmarks
        .filter((b) => b.status === 'done' && b.runtime_minutes)
        .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
    };

    return stats;
  },
};
