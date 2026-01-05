import { supabase } from '@/integrations/supabase/client';
import type { Schedule, Bookmark } from '@/types/database';

type ScheduleWithBookmark = Schedule & { bookmarks: Bookmark };

export const scheduleService = {
  /**
   * Get all schedules for the current user
   */
  async getSchedules(): Promise<ScheduleWithBookmark[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return (data || []) as ScheduleWithBookmark[];
  },

  /**
   * Get upcoming schedules
   */
  async getUpcomingSchedules(limit = 10): Promise<ScheduleWithBookmark[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('state', 'scheduled')
      .gte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ScheduleWithBookmark[];
  },

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string): Promise<ScheduleWithBookmark> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ScheduleWithBookmark;
  },

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: { 
    bookmark_id: string; 
    scheduled_for: string; 
    reminder_offset_minutes?: number;
  }): Promise<Schedule> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('schedules')
      .insert({ 
        ...schedule, 
        user_id: user.id,
        reminder_offset_minutes: schedule.reminder_offset_minutes || 60,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Schedule;
  },

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Schedule;
  },

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Cancel a schedule
   */
  async cancelSchedule(id: string): Promise<Schedule> {
    return this.updateSchedule(id, { state: 'cancelled' });
  },

  /**
   * Snooze a schedule
   */
  async snoozeSchedule(id: string, snoozeMinutes: number): Promise<Schedule> {
    const schedule = await this.getSchedule(id);
    const newScheduledFor = new Date(schedule.scheduled_for);
    newScheduledFor.setMinutes(newScheduledFor.getMinutes() + snoozeMinutes);

    return this.updateSchedule(id, {
      scheduled_for: newScheduledFor.toISOString(),
      state: 'snoozed',
    });
  },

  /**
   * Get schedules for today
   */
  async getTodaySchedules(): Promise<ScheduleWithBookmark[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('state', 'scheduled')
      .gte('scheduled_for', today.toISOString())
      .lt('scheduled_for', tomorrow.toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return (data || []) as ScheduleWithBookmark[];
  },

  /**
   * Get schedules for this week
   */
  async getThisWeekSchedules(): Promise<ScheduleWithBookmark[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('state', 'scheduled')
      .gte('scheduled_for', today.toISOString())
      .lt('scheduled_for', nextWeek.toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return (data || []) as ScheduleWithBookmark[];
  },
};
