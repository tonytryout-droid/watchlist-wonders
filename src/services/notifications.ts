import { supabase } from '@/integrations/supabase/client';
import type { Notification, Bookmark } from '@/types/database';

type NotificationWithBookmark = Notification & { bookmarks?: Bookmark };

export const notificationService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(limit = 50): Promise<NotificationWithBookmark[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, bookmarks(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as NotificationWithBookmark[];
  },

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(): Promise<NotificationWithBookmark[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, bookmarks(*)')
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as NotificationWithBookmark[];
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
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
  async markAsRead(id: string): Promise<Notification> {
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
  async markAllAsRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (error) throw error;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
