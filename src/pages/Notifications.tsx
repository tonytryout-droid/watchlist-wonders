import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Notification } from "@/types/database";

// Demo data
const demoNotifications: Notification[] = [
  {
    id: "n1",
    user_id: "demo",
    bookmark_id: "1",
    schedule_id: "s1",
    title: "Time to watch!",
    body: "Oppenheimer is scheduled for tonight at 8:00 PM",
    read_at: null,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "n2",
    user_id: "demo",
    bookmark_id: "3",
    schedule_id: null,
    title: "Shōgun reminder",
    body: "You added Shōgun to your backlog 7 days ago. Ready to start?",
    read_at: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "n3",
    user_id: "demo",
    bookmark_id: "8",
    schedule_id: null,
    title: "Weekend Plan suggestion",
    body: "Based on your Weekend Binge plan, we suggest watching Barbie tonight!",
    read_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  },
];

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(demoNotifications);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(
      notifications.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav notificationCount={unreadCount} />

      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No notifications</h2>
            <p className="text-muted-foreground">
              You're all caught up! Notifications will appear here when you have scheduled content.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border transition-colors",
                  notification.read_at
                    ? "bg-card border-border"
                    : "bg-secondary/50 border-primary/20"
                )}
              >
                {/* Unread indicator */}
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      notification.read_at ? "bg-transparent" : "bg-primary"
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatRelativeDate(notification.created_at)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notification.read_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
