import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus, Clock, FileText, Film, Play, Search, Tv, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSimilarTitles, type SimilarTitle } from "@/hooks/useSimilarTitles";
import { RecommendationRail } from "@/components/recommendations/RecommendationRail";
import { bookmarkService } from "@/services/bookmarks";
import { cn } from "@/lib/utils";
import type { Bookmark as BookmarkRecord } from "@/types/database";

interface Bookmark {
  id: string;
  title: string;
  poster_url?: string | null;
  type: string;
  provider: string;
  runtime_minutes?: number | null;
  release_year?: number | null;
  tags?: string[];
  mood_tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
}

const MAX_RESULTS = 20;
const FALLBACK_THRESHOLD = 3;
const QUICK_INTENTS = ["Anime", "Action", "Comedy", "Short", "Tonight"];

function getMetadataTmdbId(bookmark: Bookmark | null): number | null {
  if (!bookmark?.metadata || typeof bookmark.metadata !== "object") return null;
  const raw = bookmark.metadata.tmdb_id ?? bookmark.metadata.tmdbId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBookmarkType(mediaType: SimilarTitle["media_type"]): BookmarkRecord["type"] {
  return mediaType === "tv" ? "series" : "movie";
}

function toTmdbSourceUrl(item: SimilarTitle): string {
  const media = item.media_type === "tv" ? "tv" : "movie";
  return `https://www.themoviedb.org/${media}/${item.id}`;
}

export function SearchOverlay({ isOpen, onClose, bookmarks }: SearchOverlayProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
      setSelectedIndex(-1);
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const term = query.toLowerCase();
    const filtered = bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(term) ||
        b.type.toLowerCase().includes(term) ||
        b.provider.toLowerCase().includes(term) ||
        (b.tags ?? []).some((tag) => tag.toLowerCase().includes(term)) ||
        (b.mood_tags ?? []).some((mood) => mood.toLowerCase().includes(term)),
    );

    setResults(filtered.slice(0, MAX_RESULTS));
    setSelectedIndex(-1);
  }, [query, bookmarks]);

  const recommendationSeed = results[0] ?? null;
  const recommendationSeedTmdbId = getMetadataTmdbId(recommendationSeed);
  const recommendationSeedType =
    recommendationSeed?.type === "series" || recommendationSeed?.type === "episode"
      ? "tv"
      : "movie";

  const { data: similarTitles = [] } = useSimilarTitles(
    recommendationSeedTmdbId,
    recommendationSeedType,
  );

  const recommendationItems = useMemo(() => {
    const existingTmdbIds = new Set<number>();
    const existingTitles = new Set<string>();

    for (const bookmark of bookmarks) {
      const tmdbId = getMetadataTmdbId(bookmark);
      if (tmdbId) existingTmdbIds.add(tmdbId);
      existingTitles.add(bookmark.title.trim().toLowerCase());
    }

    return similarTitles
      .filter((item) => !existingTmdbIds.has(item.id))
      .filter((item) => !existingTitles.has(item.title.trim().toLowerCase()))
      .slice(0, 8);
  }, [similarTitles, bookmarks]);

  const saveRecommendationMutation = useMutation({
    mutationFn: async (item: SimilarTitle) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: toBookmarkType(item.media_type),
        provider: "generic",
        source_url: toTmdbSourceUrl(item),
        canonical_url: toTmdbSourceUrl(item),
        poster_url: item.posterUrl ?? null,
        release_year: item.release_year ?? null,
        status: "backlog",
        tags: ["recommendation"],
        mood_tags: [],
        metadata: {
          tmdb_id: item.id,
          recommendation_source: "tmdb_similar_titles",
          vote_average: item.vote_average,
          media_type: item.media_type,
        },
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Saved", description: `"${saved.title}" added to your list.` });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Couldn't save recommendation right now.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose, results, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "movie":
        return Film;
      case "series":
      case "episode":
        return Tv;
      case "video":
        return Play;
      default:
        return FileText;
    }
  };

  const handleSelect = (bookmark: Bookmark) => {
    navigate(`/b/${bookmark.id}`);
    onClose();
  };

  const handleSaveNew = () => {
    navigate(`/new?title=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  const showFallback = query.trim().length > 0 && results.length < FALLBACK_THRESHOLD;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative mx-4 w-full max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your saved list (e.g. anime, action, short)"
            className="h-14 border-border bg-secondary pl-12 pr-12 text-lg focus-visible:ring-primary"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {query.trim() && (
          <p className="mt-1.5 pl-1 text-xs text-muted-foreground">
            Saved-first search across {bookmarks.length} item{bookmarks.length !== 1 ? "s" : ""}
          </p>
        )}

        {!query.trim() && (
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_INTENTS.map((intent) => (
              <Button
                key={intent}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setQuery(intent.toLowerCase())}
              >
                {intent}
              </Button>
            ))}
          </div>
        )}

        {query.trim() && (
          <div ref={resultsRef} className="mt-2 max-h-[60vh] space-y-3 overflow-y-auto">
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border/50 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  From your list
                </p>
              </div>

              {results.length > 0 ? (
                <div role="listbox" aria-label="Search results">
                  {results.map((bookmark, index) => {
                    const Icon = getTypeIcon(bookmark.type);
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={bookmark.id}
                        onClick={() => handleSelect(bookmark)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "w-full px-4 py-3 text-left transition-colors focus:outline-none",
                          "flex items-center gap-4",
                          isSelected ? "bg-secondary" : "hover:bg-secondary/50",
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                          {bookmark.poster_url ? (
                            <img src={bookmark.poster_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-medium text-foreground">{bookmark.title}</h4>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{bookmark.type}</span>
                            <span>·</span>
                            <span className="capitalize">{bookmark.provider}</span>
                            {bookmark.runtime_minutes && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {bookmark.runtime_minutes}m
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm text-muted-foreground">No saved matches for "{query.trim()}".</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add it once and retrieve it instantly next time.
                  </p>
                </div>
              )}
            </section>

            {recommendationItems.length > 0 ? (
              <RecommendationRail
                title="You might also like"
                subtitle="External recommendations"
                items={recommendationItems}
                savingItemId={
                  saveRecommendationMutation.isPending && saveRecommendationMutation.variables
                    ? `${saveRecommendationMutation.variables.media_type}-${saveRecommendationMutation.variables.id}`
                    : null
                }
                onSave={(item) => {
                  saveRecommendationMutation.mutate(item);
                }}
              />
            ) : (
              showFallback && (
                <section className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3">
                  <div className="mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      You might also like
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">"{query.trim()}"</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Not in your list yet. Add it now.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      onClick={handleSaveNew}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Save it
                    </Button>
                  </div>
                </section>
              )
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5 text-sm text-muted-foreground"
            aria-label="Close search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Close
          </Button>
          <span className="hidden text-sm text-muted-foreground md:inline">
            or press <kbd className="rounded bg-secondary px-1.5 py-0.5 text-xs">ESC</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
