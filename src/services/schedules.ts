import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update'];
type ScheduleOccurrence = Database['public']['Tables']['schedule_occurrences']['Row'];

export const scheduleService = {
  /**
   * Get all schedules for the current user
   */
  async getSchedules() {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Get upcoming schedules
   */
  async getUpcomingSchedules(limit = 10) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('state', 'scheduled')
      .gte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookmarks(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: ScheduleInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('schedules')
      .insert({ ...schedule, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as Schedule;
  },

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, updates: ScheduleUpdate) {
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
  async deleteSchedule(id: string) {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Cancel a schedule
   */
  async cancelSchedule(id: string) {
    return this.updateSchedule(id, { state: 'cancelled' });
  },

  /**
   * Snooze a schedule
   */
  async snoozeSchedule(id: string, snoozeMinutes: number) {
    const schedule = await this.getSchedule(id);
    const newScheduledFor = new Date(schedule.scheduled_for);
    newScheduledFor.setMinutes(newScheduledFor.getMinutes() + snoozeMinutes);

    return this.updateSchedule(id, {
      scheduled_for: newScheduledFor.toISOString(),
      state: 'snoozed',
    });
  },

  /**
   * Get schedule occurrences for a date range
   */
  async getOccurrences(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('schedule_occurrences')
      .select('*, bookmarks(*)')
      .gte('occurrence_date', startDate)
      .lte('occurrence_date', endDate)
      .order('occurrence_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Get occurrences for today
   */
  async getTodayOccurrences() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getOccurrences(today.toISOString(), tomorrow.toISOString());
  },

  /**
   * Update occurrence state
   */
  async updateOccurrenceState(occurrenceId: string, state: ScheduleOccurrence['state']) {
    const { data, error } = await supabase
      .from('schedule_occurrences')
      .update({ state })
      .eq('id', occurrenceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Skip an occurrence
   */
  async skipOccurrence(occurrenceId: string) {
    const { data, error } = await supabase
      .from('schedule_occurrences')
      .update({
        state: 'skipped',
        skipped_at: new Date().toISOString(),
      })
      .eq('id', occurrenceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
