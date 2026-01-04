import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { bookmarkService } from "@/services/bookmarks";
import type { Bookmark } from "@/types/database";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch bookmarks from Supabase
  const { data: bookmarks = [], isLoading, error } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your watchlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading bookmarks</p>
          <p className="text-muted-foreground text-sm">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // Group bookmarks
  const continueWatching = bookmarks.filter((b) => b.status === "watching");
  const backlog = bookmarks.filter((b) => b.status === "backlog");
  const completed = bookmarks.filter((b) => b.status === "done");

  // Hero bookmark (next scheduled or first watching)
  const heroBookmark = continueWatching[0] || backlog[0] || null;

  // Group by mood
  const byMood: Record<string, Bookmark[]> = {};
  bookmarks.forEach((b) => {
    b.mood_tags.forEach((mood) => {
      if (!byMood[mood]) byMood[mood] = [];
      byMood[mood].push(b);
    });
  });

  const handlePlay = () => {
    if (heroBookmark?.source_url) {
      window.open(heroBookmark.source_url, "_blank");
    }
  };

  const handleMoreInfo = () => {
    if (heroBookmark) {
      window.location.href = `/b/${heroBookmark.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={() => setSearchOpen(true)} notificationCount={2} />
      
      {/* Hero Banner */}
      <HeroBanner
        bookmark={heroBookmark}
        onPlay={handlePlay}
        onMoreInfo={handleMoreInfo}
      />

      {/* Rails */}
      <div className="relative z-10 -mt-20 pb-16 space-y-2">
        {continueWatching.length > 0 && (
          <Rail
            title="Continue Watching"
            bookmarks={continueWatching}
          />
        )}

        {backlog.length > 0 && (
          <Rail
            title="Your Backlog"
            subtitle="Ready to watch"
            bookmarks={backlog}
          />
        )}

        {/* Mood Rails */}
        {Object.entries(byMood)
          .filter(([_, items]) => items.length >= 2)
          .slice(0, 3)
          .map(([mood, items]) => (
            <Rail
              key={mood}
              title={`${mood.charAt(0).toUpperCase()}${mood.slice(1)} Picks`}
              bookmarks={items}
            />
          ))}

        {completed.length > 0 && (
          <Rail
            title="Recently Watched"
            bookmarks={completed}
          />
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

export default Dashboard;
