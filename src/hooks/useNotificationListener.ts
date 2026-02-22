import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notifications";

export function useNotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mountTimeRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (!user) return;

    const mountTime = mountTimeRef.current;

    const unsubscribe = notificationService.subscribeToNotifications(
      user.uid,
      (notif) => {
        // Only show toast for notifications created after the listener was mounted
        // and that are unread
        if (notif.created_at > mountTime && notif.read_at === null) {
          toast(notif.title, {
            description: notif.body,
            duration: 6000,
          });
        }
        // Always invalidate so badge + list stay in sync
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      }
    );

    return () => unsubscribe();
  }, [user, queryClient]);
}

export function NotificationListenerMount() {
  useNotificationListener();
  return null;
}
