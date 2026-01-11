import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosterCard } from "./PosterCard";
import { cn } from "@/lib/utils";

interface Bookmark {
  id: string;
  title: string;
  poster_url?: string | null;
  backdrop_url?: string | null;
  runtime_minutes?: number | null;
  release_year?: number | null;
  type: string;
  provider: string;
  status: string;
  source_url?: string | null;
  mood_tags?: string[];
}

interface RailProps {
  title: string;
  subtitle?: string;
  bookmarks: Bookmark[];
  variant?: "poster" | "backdrop";
  onSchedule?: (bookmark: Bookmark) => void;
  onMarkDone?: (bookmark: Bookmark) => void;
  onAddToPlan?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
  onUndoDone?: (bookmark: Bookmark) => void;
  onSetWatching?: (bookmark: Bookmark) => void;
  emptyMessage?: string;
  className?: string;
}

export function Rail({
  title,
  subtitle,
  bookmarks,
  variant = "poster",
  onSchedule,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
  emptyMessage = "No items yet",
  className,
}: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateArrows, 300);
  };

  if (bookmarks.length === 0) {
    return null;
  }

  return (
    <section className={cn("relative py-6", className)}>
      {/* Header */}
      <div className="container mx-auto px-4 lg:px-8 mb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {bookmarks.length} item{bookmarks.length !== 1 && "s"}
          </span>
        </div>
      </div>

      {/* Rail Container */}
      <div className="relative group">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm opacity-0 transition-opacity hover:bg-background",
            showLeftArrow && "group-hover:opacity-100"
          )}
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm opacity-0 transition-opacity hover:bg-background",
            showRightArrow && "group-hover:opacity-100"
          )}
          onClick={() => scroll("right")}
        >
          <ChevronRight className="w-6 h-6" />
        </Button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 lg:px-8 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {bookmarks.map((bookmark) => (
            <PosterCard
              key={bookmark.id}
              bookmark={bookmark}
              variant={variant}
              onSchedule={() => onSchedule?.(bookmark)}
              onMarkDone={() => onMarkDone?.(bookmark)}
              onAddToPlan={() => onAddToPlan?.(bookmark)}
              onDelete={() => onDelete?.(bookmark)}
              onUndoDone={() => onUndoDone?.(bookmark)}
              onSetWatching={() => onSetWatching?.(bookmark)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
