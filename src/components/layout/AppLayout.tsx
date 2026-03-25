import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "./TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { HowItWorksButton } from "@/components/HowItWorksButton";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { useAuth } from "@/contexts/AuthContext";
import { bookmarkService } from "@/services/bookmarks";
import { notificationService } from "@/services/notifications";

export function AppLayout() {
  const { user } = useAuth();
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const notifs = await notificationService.getNotifications();
      return notifs.filter((n) => !n.read_at).length;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background" id="main-scroll-container">
      <TopNav
        onSearchClick={openSearch}
        notificationCount={unreadCount}
      />
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
      />
      <Outlet />
      <HowItWorksButton />
    </div>
  );
}
