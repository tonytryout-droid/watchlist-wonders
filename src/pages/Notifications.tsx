import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Clock, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { cn, formatRelativeDate } from "@/lib/utils";
import { notificationService } from "@/services/notifications";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";

const Notifications = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications(),
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "All caught up!",
        description: "All notifications marked as read.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={() => setSearchOpen(true)} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={() => setSearchOpen(true)} />
        <div className="flex items-center justify-center pt-32">
          <p className="text-destructive">Error loading notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav notificationCount={unreadCount} onSearchClick={() => setSearchOpen(true)} />

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
            <Button 
              variant="outline" 
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
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
                      onClick={() => markAsReadMutation.mutate(notification.id)}
                      disabled={markAsReadMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(notification.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        bookmarks={bookmarks}
      />
    </div>
  );
};

export default Notifications;
