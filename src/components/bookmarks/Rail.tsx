import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PosterCard } from "./PosterCard";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

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
  onStatusCycle?: (bookmark: Bookmark, newStatus: Bookmark["status"]) => void;
  onEpisodeUpdate?: (bookmark: Bookmark, count: number) => void;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
  isSelectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (bookmarkId: string) => void;
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
  onStatusCycle,
  onEpisodeUpdate,
  emptyMessage = "No items yet",
  emptyState,
  className,
  isSelectable,
  selectedIds,
  onSelect,
}: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 4);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    setTimeout(updateArrows, 350);
  };

  if (bookmarks.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    if (emptyMessage) return <div className="px-8 md:px-12 lg:px-16 py-6 text-white/40 text-sm">{emptyMessage}</div>;
    return null;
  }

  return (
    <section className={cn("relative py-2 group/rail overflow-visible", className)}>
      {/* Row header */}
      <div className="px-8 md:px-12 lg:px-16 mb-2 flex items-baseline gap-3">
        <h2 className="text-sm md:text-base font-bold text-white tracking-tight hover:text-white/80 cursor-default transition-colors">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-[#54b3d6] font-semibold hidden group-hover/rail:inline transition-opacity">
            {subtitle}
          </span>
        )}
      </div>

      {/* Scrollable row */}
      <div className="relative">
        {/* Left gradient fade + arrow */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 z-20 flex items-center transition-opacity duration-200",
            showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-12 md:w-16 h-full bg-gradient-to-r from-[#141414] to-transparent" />
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 h-full w-12 md:w-16 flex items-center justify-center text-white hover:bg-white/5 transition-colors"
            aria-label="Scroll left"
          >
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Right gradient fade + arrow */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 z-20 flex items-center transition-opacity duration-200",
            showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-12 md:w-16 h-full bg-gradient-to-l from-[#141414] to-transparent" />
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 h-full w-12 md:w-16 flex items-center justify-center text-white hover:bg-white/5 transition-colors"
            aria-label="Scroll right"
          >
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide px-8 md:px-12 lg:px-16 pb-3"
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
              onStatusCycle={onStatusCycle}
              onEpisodeUpdate={onEpisodeUpdate}
              isSelectable={isSelectable}
              isSelected={selectedIds?.has(bookmark.id)}
              onSelect={() => onSelect?.(bookmark.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
