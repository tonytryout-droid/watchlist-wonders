import { supabase } from '@/integrations/supabase/client';
import type { Bookmark } from '@/types/database';

export const bookmarkService = {
  /**
   * Get all bookmarks for the current user
   */
  async getBookmarks(): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Bookmark[];
  },

  /**
   * Get bookmarks by status
   */
  async getBookmarksByStatus(status: Bookmark['status']): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Bookmark[];
  },

  /**
   * Get a single bookmark by ID
   */
  async getBookmark(id: string): Promise<Bookmark> {
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
  async createBookmark(bookmark: Partial<Bookmark> & { title: string }): Promise<Bookmark> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        title: bookmark.title,
        type: bookmark.type || 'movie',
        provider: bookmark.provider || 'generic',
        source_url: bookmark.source_url ?? null,
        canonical_url: bookmark.canonical_url ?? null,
        platform_label: bookmark.platform_label ?? null,
        status: bookmark.status || 'backlog',
        runtime_minutes: bookmark.runtime_minutes ?? null,
        release_year: bookmark.release_year ?? null,
        poster_url: bookmark.poster_url ?? null,
        backdrop_url: bookmark.backdrop_url ?? null,
        tags: bookmark.tags || [],
        mood_tags: bookmark.mood_tags || [],
        notes: bookmark.notes ?? null,
        metadata: (bookmark.metadata || {}) as Record<string, unknown>,
        user_id: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as Bookmark;
  },

  /**
   * Update an existing bookmark
   */
  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<Bookmark> {
    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Bookmark;
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<void> {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Update bookmark status
   */
  async updateStatus(id: string, status: Bookmark['status']): Promise<Bookmark> {
    return this.updateBookmark(id, { status });
  },

  /**
   * Search bookmarks by title or notes
   */
  async searchBookmarks(query: string): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .or(`title.ilike.%${query}%,notes.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Bookmark[];
  },

  /**
   * Get backlog items for Tonight Pick (runtime <= 90 minutes)
   */
  async getTonightCandidates(): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('status', 'backlog')
      .or('runtime_minutes.is.null,runtime_minutes.lte.90')
      .order('shown_count', { ascending: true })
      .limit(20);

    if (error) throw error;
    return (data || []) as Bookmark[];
  },

  /**
   * Update shown tracking for Tonight Pick
   */
  async markAsShown(id: string): Promise<void> {
    const { error } = await supabase
      .from('bookmarks')
      .update({ 
        last_shown_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get bookmarks grouped by mood tags
   */
  async getBookmarksByMood(): Promise<Record<string, Bookmark[]>> {
    const bookmarks = await this.getBookmarks();
    const byMood: Record<string, Bookmark[]> = {};

    bookmarks.forEach((bookmark) => {
      (bookmark.mood_tags || []).forEach((mood) => {
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
    const bookmarks = await this.getBookmarks();
    
    return {
      total: bookmarks.length,
      backlog: bookmarks.filter((b) => b.status === 'backlog').length,
      watching: bookmarks.filter((b) => b.status === 'watching').length,
      done: bookmarks.filter((b) => b.status === 'done').length,
      dropped: bookmarks.filter((b) => b.status === 'dropped').length,
      totalWatchedMinutes: bookmarks
        .filter((b) => b.status === 'done' && b.runtime_minutes)
        .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
    };
  },
};
