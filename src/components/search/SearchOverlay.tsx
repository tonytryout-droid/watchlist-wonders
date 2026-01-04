import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock, Film, Tv, Play, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Bookmark {
  id: string;
  title: string;
  poster_url?: string | null;
  type: string;
  provider: string;
  runtime_minutes?: number | null;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
}

export function SearchOverlay({ isOpen, onClose, bookmarks }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const searchTerm = query.toLowerCase();
    const filtered = bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(searchTerm) ||
        b.type.toLowerCase().includes(searchTerm) ||
        b.provider.toLowerCase().includes(searchTerm)
    );
    setResults(filtered.slice(0, 10));
    setIsSearching(false);
  }, [query, bookmarks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Search Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your watchlist..."
            className="h-14 pl-12 pr-12 text-lg bg-secondary border-border focus-visible:ring-primary"
          />
          {isSearching ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
          ) : query ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          ) : null}
        </div>

        {/* Results */}
        {(query.trim() || results.length > 0) && (
          <div className="mt-2 bg-card border border-border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
            {results.length === 0 && query.trim() && (
              <div className="p-8 text-center text-muted-foreground">
                <p>No results found for "{query}"</p>
              </div>
            )}

            {results.map((bookmark) => {
              const Icon = getTypeIcon(bookmark.type);
              return (
                <button
                  key={bookmark.id}
                  onClick={() => handleSelect(bookmark)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-secondary transition-colors text-left"
                >
                  {/* Poster Thumbnail */}
                  <div className="w-12 h-16 flex-shrink-0 rounded bg-muted overflow-hidden">
                    {bookmark.poster_url ? (
                      <img
                        src={bookmark.poster_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {bookmark.title}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{bookmark.type}</span>
                      <span>•</span>
                      <span className="capitalize">{bookmark.provider}</span>
                      {bookmark.runtime_minutes && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
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
        )}

        {/* Hint */}
        <div className="mt-3 text-center text-sm text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">ESC</kbd> to close
        </div>
      </div>
    </div>
  );
}
