import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import type { Bookmark, Schedule } from "@/types/database";

// Demo data for initial display
const demoBookmarks: Bookmark[] = [
  {
    id: "1",
    user_id: "demo",
    title: "Oppenheimer",
    type: "movie",
    provider: "imdb",
    status: "watching",
    runtime_minutes: 180,
    release_year: 2023,
    poster_url: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
    tags: ["thriller", "drama"],
    mood_tags: ["intense", "epic", "thoughtful"],
    notes: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    user_id: "demo",
    title: "Dune: Part Two",
    type: "movie",
    provider: "imdb",
    status: "backlog",
    runtime_minutes: 166,
    release_year: 2024,
    poster_url: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    tags: ["scifi", "action"],
    mood_tags: ["epic", "intense"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    user_id: "demo",
    title: "Shōgun",
    type: "series",
    provider: "imdb",
    status: "backlog",
    runtime_minutes: 60,
    release_year: 2024,
    poster_url: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgmT.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/bOnRKdLqsuKjAOkVAeRA2fKj4Ud.jpg",
    tags: ["drama", "history"],
    mood_tags: ["epic", "drama", "thoughtful"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    user_id: "demo",
    title: "Poor Things",
    type: "movie",
    provider: "imdb",
    status: "backlog",
    runtime_minutes: 141,
    release_year: 2023,
    poster_url: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/bQS43HSLZzMjZkcHJz4fGc7fNdz.jpg",
    tags: ["comedy", "scifi"],
    mood_tags: ["quirky", "fun"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "5",
    user_id: "demo",
    title: "Killers of the Flower Moon",
    type: "movie",
    provider: "imdb",
    status: "backlog",
    runtime_minutes: 206,
    release_year: 2023,
    poster_url: "https://image.tmdb.org/t/p/w500/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/1X7vow16X7CnCoexXh4H4F2yDJv.jpg",
    tags: ["drama", "crime"],
    mood_tags: ["intense", "drama"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "6",
    user_id: "demo",
    title: "The Bear",
    type: "series",
    provider: "imdb",
    status: "watching",
    runtime_minutes: 30,
    release_year: 2022,
    poster_url: "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/9Qq8InnodUYs8zdam8Zj5d0nPqU.jpg",
    tags: ["drama", "comedy"],
    mood_tags: ["intense", "emotional"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "7",
    user_id: "demo",
    title: "YouTube: Building a Second Brain",
    type: "video",
    provider: "youtube",
    status: "backlog",
    runtime_minutes: 45,
    release_year: 2024,
    poster_url: null,
    backdrop_url: null,
    tags: ["productivity"],
    mood_tags: ["educational", "inspiring"],
    source_url: "https://youtube.com/watch?v=example",
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "8",
    user_id: "demo",
    title: "Barbie",
    type: "movie",
    provider: "imdb",
    status: "done",
    runtime_minutes: 114,
    release_year: 2023,
    poster_url: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/nHf61UzkfFno5X1ofIhugCPus2R.jpg",
    tags: ["comedy"],
    mood_tags: ["fun", "uplifting"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const Dashboard = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarks] = useState<Bookmark[]>(demoBookmarks);

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
