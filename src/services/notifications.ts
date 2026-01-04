import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

export const notificationService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(limit = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, bookmarks(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Get unread notifications
   */
  async getUnreadNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, bookmarks(*)')
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Notification;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (error) throw error;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Create a notification (typically used by server-side functions)
   */
  async createNotification(notification: NotificationInsert) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) throw error;
    return data as Notification;
  },

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
