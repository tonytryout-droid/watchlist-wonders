import { useEffect, useState } from "react";
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

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

  const vaultedCount = bookmarks.filter((bookmark) => bookmark.is_vaulted).length;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleOpenSearch = () => openSearch();
    window.addEventListener("wm:open-search", handleOpenSearch);
    return () => window.removeEventListener("wm:open-search", handleOpenSearch);
  }, [openSearch]);

  return (
    <div className="min-h-screen bg-background" id="main-scroll-container">
      <TopNav
        onSearchClick={openSearch}
        notificationCount={unreadCount}
        vaultedCount={vaultedCount}
      />
      {!isOnline && (
        <div
          className="fixed inset-x-0 top-[68px] z-40 border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-200"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          Offline - viewing cached data
        </div>
      )}
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
