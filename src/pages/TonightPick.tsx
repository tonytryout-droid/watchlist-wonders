import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, RefreshCw, Play, Calendar, Check, X, Clock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatRuntime, getMoodEmoji } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

// Demo data - backlog items under 90 minutes
const backlogUnder90: Bookmark[] = [
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
    notes: "A guide to organizing your digital life with effective note-taking systems.",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "6a",
    user_id: "demo",
    title: "The Bear - Episode 1",
    type: "episode",
    provider: "imdb",
    status: "backlog",
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
    id: "new1",
    user_id: "demo",
    title: "TED Talk: The Power of Vulnerability",
    type: "video",
    provider: "generic",
    status: "backlog",
    runtime_minutes: 20,
    release_year: 2010,
    poster_url: null,
    backdrop_url: null,
    tags: ["psychology"],
    mood_tags: ["inspiring", "emotional", "thoughtful"],
    notes: "Brené Brown's famous talk on vulnerability and connection.",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "new2",
    user_id: "demo",
    title: "Black Mirror: Joan Is Awful",
    type: "episode",
    provider: "netflix",
    status: "backlog",
    runtime_minutes: 60,
    release_year: 2023,
    poster_url: "https://image.tmdb.org/t/p/w500/7PRddO7z7mcPi21nMTXMQXNlOng.jpg",
    backdrop_url: null,
    tags: ["scifi", "thriller"],
    mood_tags: ["dark", "quirky", "thoughtful"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "new3",
    user_id: "demo",
    title: "Comedy Special: Nate Bargatze",
    type: "video",
    provider: "netflix",
    status: "backlog",
    runtime_minutes: 65,
    release_year: 2024,
    poster_url: null,
    backdrop_url: null,
    tags: ["comedy"],
    mood_tags: ["fun", "relaxing"],
    notes: "",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const TonightPick = () => {
  const navigate = useNavigate();
  const [picks, setPicks] = useState<Bookmark[]>(() => shuffleArray(backlogUnder90).slice(0, 3));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleRerollAll = () => {
    setPicks(shuffleArray(backlogUnder90).slice(0, 3));
    setSelectedIndex(null);
  };

  const handleSwapOne = (index: number) => {
    const currentIds = new Set(picks.map((p) => p.id));
    const available = backlogUnder90.filter((b) => !currentIds.has(b.id));
    if (available.length === 0) return;
    
    const newPick = shuffleArray(available)[0];
    const newPicks = [...picks];
    newPicks[index] = newPick;
    setPicks(newPicks);
  };

  const handleWatch = (bookmark: Bookmark) => {
    if (bookmark.source_url) {
      window.open(bookmark.source_url, "_blank");
    }
  };

  const handleSchedule = (bookmark: Bookmark) => {
    // TODO: Open schedule modal
    console.log("Schedule:", bookmark.id);
  };

  const handleMarkDone = (bookmark: Bookmark) => {
    // TODO: Mark as done via Supabase
    setPicks(picks.filter((p) => p.id !== bookmark.id));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="container mx-auto px-4 lg:px-8 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Tonight Pick 1</h1>
        </div>
        <p className="text-muted-foreground">
          Quick decisions for busy nights. Under 90 minutes, perfectly curated.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 container mx-auto px-4 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {picks.map((bookmark, index) => (
            <div
              key={bookmark.id}
              className={cn(
                "relative bg-card border border-border rounded-lg overflow-hidden transition-all duration-300",
                selectedIndex === index && "ring-2 ring-primary scale-[1.02]"
              )}
            >
              {/* Poster/Image */}
              <div className="aspect-video bg-secondary relative">
                {bookmark.poster_url ? (
                  <img
                    src={bookmark.poster_url}
                    alt={bookmark.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted-foreground">
                      {bookmark.title.charAt(0)}
                    </span>
                  </div>
                )}
                {/* Swap button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur"
                  onClick={() => handleSwapOne(index)}
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
                {/* Runtime */}
                <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-sm font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRuntime(bookmark.runtime_minutes)}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-2">{bookmark.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="capitalize">{bookmark.type}</span>
                    <span>•</span>
                    <span className="capitalize">{bookmark.provider}</span>
                    {bookmark.release_year && (
                      <>
                        <span>•</span>
                        <span>{bookmark.release_year}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Mood tags */}
                {bookmark.mood_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bookmark.mood_tags.slice(0, 3).map((mood) => (
                      <Badge key={mood} variant="outline" className="text-xs">
                        {getMoodEmoji(mood)} {mood}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {bookmark.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {bookmark.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleWatch(bookmark)}
                  >
                    <Play className="w-4 h-4 mr-1 fill-current" />
                    Watch
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleSchedule(bookmark)}
                  >
                    <Calendar className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleMarkDone(bookmark)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reroll Button */}
        <div className="text-center mt-8">
          <Button variant="outline" size="lg" onClick={handleRerollAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reroll All
          </Button>
        </div>
      </div>

      {/* Back link */}
      <div className="container mx-auto px-4 lg:px-8 py-8 text-center">
        <Button variant="ghost" onClick={() => navigate("/")}>
          <X className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default TonightPick;
