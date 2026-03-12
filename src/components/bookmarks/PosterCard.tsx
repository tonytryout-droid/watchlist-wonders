import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Play, Plus, Check, CalendarPlus, MoreHorizontal, ExternalLink,
  Trash2, Undo2, Eye, BookMarked, Minus, ThumbsUp, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import type { Bookmark } from "@/types/database";

interface PosterCardProps {
  bookmark: Bookmark;
  onPlay?: () => void;
  onSchedule?: () => void;
  onMarkDone?: () => void;
  onAddToPlan?: () => void;
  onDelete?: () => void;
  onUndoDone?: () => void;
  onSetWatching?: () => void;
  onStatusCycle?: (bookmark: Bookmark, newStatus: Bookmark["status"]) => void;
  onEpisodeUpdate?: (bookmark: Bookmark, count: number) => void;
  variant?: "poster" | "backdrop";
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const PROVIDER_COLOR: Record<string, string> = {
  youtube:        "bg-red-600",
  netflix:        "bg-red-700",
  imdb:           "bg-yellow-500",
  instagram:      "bg-pink-500",
  facebook:       "bg-blue-600",
  x:              "bg-neutral-400",
  letterboxd:     "bg-green-600",
  tiktok:         "bg-neutral-900",
  reddit:         "bg-orange-500",
  rottentomatoes: "bg-red-500",
  generic:        "bg-neutral-500",
};

const STATUS_CYCLE: Record<string, Bookmark["status"]> = {
  backlog: "watching",
  watching: "done",
  done: "backlog",
  scheduled: "watching",
  dropped: "backlog",
};

function formatRuntime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isNewBookmark(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
}

const trailerUrlCache = new Map<string, string | null>();

function getMetadataNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch { /* ignore */ }
  return null;
}

function toYouTubeEmbedUrl(videoId: string, autoplay = true): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    loop: "1",
    playlist: videoId,
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function toTrailerEmbedUrl(rawUrl: string): string | null {
  const youtubeId = extractYouTubeVideoId(rawUrl);
  if (youtubeId) return toYouTubeEmbedUrl(youtubeId);
  return null;
}

function getBookmarkTrailerUrl(bookmark: Bookmark): string | null {
  const metadata = bookmark.metadata || {};
  const fromMetadata = getMetadataString(metadata, [
    "trailer_url", "trailerUrl", "youtube_trailer_url", "youtubeTrailerUrl", "video_url", "videoUrl",
  ]);
  if (fromMetadata) {
    const embedded = toTrailerEmbedUrl(fromMetadata);
    if (embedded) return embedded;
  }
  if (bookmark.source_url) {
    const embedded = toTrailerEmbedUrl(bookmark.source_url);
    if (embedded) return embedded;
  }
  return null;
}

async function fetchTmdbTrailerUrl(bookmark: Bookmark): Promise<string | null> {
  const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!tmdbApiKey) return null;
  const tmdbId = getMetadataNumber(bookmark.metadata || {}, ["tmdb_id", "tmdbId"]);
  if (!tmdbId) return null;
  const mediaType = bookmark.type === "series" ? "tv" : "movie";
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (trailerUrlCache.has(cacheKey)) return trailerUrlCache.get(cacheKey) ?? null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=${tmdbApiKey}`);
    if (!res.ok) { trailerUrlCache.set(cacheKey, null); return null; }
    const data = (await res.json()) as { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> };
    const videos = data.results || [];
    const selected =
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official && v.key) ||
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.key) ||
      videos.find((v) => v.site === "YouTube" && (v.type === "Teaser" || v.type === "Clip") && v.key);
    const trailerUrl = selected?.key ? toYouTubeEmbedUrl(selected.key) : null;
    trailerUrlCache.set(cacheKey, trailerUrl);
    return trailerUrl;
  } catch {
    trailerUrlCache.set(cacheKey, null);
    return null;
  }
}

export function PosterCard({
  bookmark,
  onPlay,
  onSchedule,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
  onStatusCycle,
  onEpisodeUpdate,
  variant = "poster",
  className,
  isSelectable,
  isSelected,
  onSelect,
}: PosterCardProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(() => getBookmarkTrailerUrl(bookmark));
  const [episodePopoverOpen, setEpisodePopoverOpen] = useState(false);
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const imageUrl =
    variant === "poster"
      ? bookmark.poster_url || bookmark.backdrop_url
      : bookmark.backdrop_url || bookmark.poster_url;
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";

  const isPreviewActive = !isMobile && !isSelectable && (isHovered || isTouched);
  const showTrailerPreview = isPreviewActive && Boolean(trailerUrl);

  // Episode tracking
  const episodesWatched = typeof bookmark.metadata?.episodes_watched === "number" ? bookmark.metadata.episodes_watched : 0;
  const totalEpisodes = typeof bookmark.metadata?.total_episodes === "number" ? bookmark.metadata.total_episodes : null;
  const showEpisodeBar = bookmark.type === "series" && bookmark.status === "watching";
  const episodeProgress = totalEpisodes ? (episodesWatched / totalEpisodes) * 100 : 0;

  const isNew = isNewBookmark(bookmark.created_at);

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) { onPlay(); return; }
    if (!trailerUrl && bookmark.source_url) {
      window.open(bookmark.source_url, "_blank", "noopener");
      return;
    }
    setIsHovered(true);
    setIsTouched(true);
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmark.source_url) window.open(bookmark.source_url, "_blank");
  };

  const handleScheduleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickScheduleOpen(true);
    onSchedule?.();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectable) { e.preventDefault(); onSelect?.(); return; }
    if (isMobile) {
      if (!isTouched) {
        e.preventDefault();
        setIsTouched(true);
      } else {
        setIsTouched(false);
      }
    }
  };

  const handleStatusPillClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onStatusCycle) return;
    const next = STATUS_CYCLE[bookmark.status] ?? "backlog";
    onStatusCycle(bookmark, next);
  };

  const handleEpisodeUpdate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEpisodeUpdate?.(bookmark, localEpisodeCount);
    setEpisodePopoverOpen(false);
  };

  useEffect(() => {
    setTrailerUrl(getBookmarkTrailerUrl(bookmark));
  }, [bookmark.id, bookmark.source_url, bookmark.metadata]);

  useEffect(() => {
    setLocalEpisodeCount(episodesWatched);
  }, [episodesWatched]);

  useEffect(() => {
    if (!isPreviewActive || trailerUrl) return;
    let cancelled = false;
    fetchTmdbTrailerUrl(bookmark).then((url) => {
      if (!cancelled && url) setTrailerUrl(url);
    });
    return () => { cancelled = true; };
  }, [isPreviewActive, trailerUrl, bookmark]);

  // Clear isTouched on outside click (mobile)
  useEffect(() => {
    if (!isTouched) return;
    const handleOutside = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsTouched(false);
        setIsHovered(false);
      }
    };
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("click", handleOutside);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("click", handleOutside);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [isTouched]);

  const showExpanded = (isHovered || isTouched) && !isSelectable;

  return (
    <>
      {/* Wrapper — expands on hover (Netflix-style scale + info panel) */}
      <div
        ref={cardRef}
        className={cn(
          "group relative flex-shrink-0 transition-all duration-300",
          variant === "poster" ? "w-36 sm:w-40 md:w-44 lg:w-48" : "w-[min(72vw,16rem)] sm:w-64 md:w-72 lg:w-80",
          showExpanded && "z-30",
          isSelected && "ring-2 ring-primary rounded-md",
          className
        )}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setIsTouched(false); }}
      >
        <Link
          to={`/b/${bookmark.id}`}
          className="block"
          onClick={handleCardClick}
        >
          {/* Image container */}
          <div
            className={cn(
              "relative overflow-hidden rounded-sm transition-transform duration-300",
              aspectRatio,
              showExpanded && "rounded-t-sm rounded-b-none"
            )}
            style={{
              transform: showExpanded ? "scale(1.0)" : "scale(1.0)",
            }}
          >
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={bookmark.title}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-300",
                  showExpanded && "scale-105"
                )}
                onError={() => setImageError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#2f2f2f]">
                <span className="text-4xl font-extrabold text-white/20">
                  {bookmark.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Trailer preview */}
            {showTrailerPreview && trailerUrl && (
              <div className="absolute inset-0 z-[1] bg-black">
                <iframe
                  src={trailerUrl}
                  title={`${bookmark.title} trailer`}
                  className="w-full h-full pointer-events-none"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  loading="lazy"
                />
              </div>
            )}

            {/* Provider dot */}
            <div className="absolute top-1.5 left-1.5">
              <div
                title={bookmark.provider}
                className={cn("w-2.5 h-2.5 rounded-full border border-black/30", PROVIDER_COLOR[bookmark.provider] || "bg-neutral-500")}
              />
            </div>

            {/* New badge */}
            {isNew && !isSelectable && (
              <div className="absolute top-1.5 right-1.5">
                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  New
                </span>
              </div>
            )}

            {/* Select checkbox */}
            {isSelectable && (
              <div className="absolute top-2 right-2 z-20">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.()}
                  className="bg-black/60 backdrop-blur-sm data-[state=checked]:bg-primary"
                />
              </div>
            )}

            {/* Status badge — watching */}
            {!isSelectable && !onStatusCycle && bookmark.status === "watching" && !isNew && (
              <div className="absolute top-1.5 right-1.5">
                <span className="flex items-center gap-1 text-[9px] font-bold bg-primary/90 text-white px-1.5 py-0.5 rounded-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Watching
                </span>
              </div>
            )}

            {/* Episode progress bar */}
            {showEpisodeBar && !isSelectable && (
              <Popover open={episodePopoverOpen} onOpenChange={setEpisodePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEpisodePopoverOpen(true); }}
                    className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20 cursor-pointer hover:h-1.5 transition-all"
                    aria-label="Episode progress"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(episodeProgress, 100)}%`, minWidth: episodesWatched > 0 ? "4px" : "0" }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-48 p-3 bg-[#1a1a1a] border-white/10" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium mb-2 text-white">Episodes watched</p>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => Math.max(0, c - 1)); }}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="flex-1 text-center font-semibold text-sm text-white">
                      {localEpisodeCount}{totalEpisodes ? `/${totalEpisodes}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => c + 1); }}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <Button size="sm" className="w-full text-xs" onClick={handleEpisodeUpdate}>Update</Button>
                </PopoverContent>
              </Popover>
            )}

            {/* One-tap status pill */}
            {onStatusCycle && !isSelectable && (
              <button
                type="button"
                onClick={handleStatusPillClick}
                className={cn(
                  "absolute bottom-2 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold transition-opacity",
                  bookmark.status === "watching"
                    ? "bg-primary/90 text-white"
                    : bookmark.status === "done"
                    ? "bg-[#46d369]/90 text-black"
                    : "bg-black/70 text-white/80 backdrop-blur-sm"
                )}
                aria-label={`Status: ${bookmark.status}. Click to advance.`}
              >
                {bookmark.status === "watching" && (
                  <><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Watching</>
                )}
                {bookmark.status === "done" && (
                  <><Check className="w-2.5 h-2.5" />Done</>
                )}
                {(bookmark.status === "backlog" || bookmark.status === "scheduled" || bookmark.status === "dropped") && (
                  <><BookMarked className="w-2.5 h-2.5" />
                  {bookmark.status === "backlog" ? "Saved" : bookmark.status === "scheduled" ? "Scheduled" : "Dropped"}</>
                )}
              </button>
            )}

            {/* Mobile dropdown */}
            {isMobile && !isSelectable && (
              <div className="absolute bottom-10 right-1.5 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11 rounded-full bg-black/70 backdrop-blur-sm border-white/10"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4 text-white" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#1a1a1a] border-white/10">
                    {bookmark.status !== "watching" && (
                      <DropdownMenuItem onClick={onSetWatching} className="text-white/90">
                        <Eye className="w-4 h-4 mr-2" />Set as Watching
                      </DropdownMenuItem>
                    )}
                    {bookmark.status === "done" ? (
                      <DropdownMenuItem onClick={onUndoDone} className="text-white/90">
                        <Undo2 className="w-4 h-4 mr-2" />Add Back to List
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onMarkDone} className="text-white/90">
                        <Check className="w-4 h-4 mr-2" />Mark as Watched
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onAddToPlan} className="text-white/90">
                      <Plus className="w-4 h-4 mr-2" />Add to Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleScheduleClick} className="text-white/90">
                      <CalendarPlus className="w-4 h-4 mr-2" />Quick Schedule
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleOpenSource} className="text-white/90">
                      <ExternalLink className="w-4 h-4 mr-2" />Open Source
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </Link>

        {/* Netflix-style expanded info panel — appears below on hover */}
        {!isSelectable && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 bg-[#1a1a1a] rounded-b-sm",
              showExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-2.5">
              {/* Action row */}
              <div className="flex items-center gap-1.5 mb-2">
                {/* Play */}
                <button
                  type="button"
                  onClick={handlePlay}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors shrink-0"
                  aria-label={`Play ${bookmark.title}`}
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                </button>

                {/* Add to plan */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToPlan?.(); }}
                  className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center hover:border-white transition-colors text-white shrink-0"
                  aria-label="Add to plan"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Mark done */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); bookmark.status === "done" ? onUndoDone?.() : onMarkDone?.(); }}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center transition-colors text-white shrink-0",
                    bookmark.status === "done"
                      ? "border-[#46d369] text-[#46d369]"
                      : "border-white/30 hover:border-white"
                  )}
                  aria-label={bookmark.status === "done" ? "Undo watched" : "Mark as watched"}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>

                {/* More options / overflow */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center hover:border-white transition-colors text-white shrink-0 ml-auto"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#1a1a1a] border-white/10">
                    {bookmark.status !== "watching" && (
                      <DropdownMenuItem onClick={onSetWatching} className="text-white/90">
                        <Eye className="w-4 h-4 mr-2" />Set as Watching
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleScheduleClick} className="text-white/90">
                      <CalendarPlus className="w-4 h-4 mr-2" />Quick Schedule
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleOpenSource} className="text-white/90">
                      <ExternalLink className="w-4 h-4 mr-2" />Open Source
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Title + meta */}
              <p className="text-xs font-bold text-white truncate leading-tight mb-1">
                {bookmark.title}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {bookmark.release_year && (
                  <span className="text-[10px] text-[#46d369] font-semibold">{bookmark.release_year}</span>
                )}
                {bookmark.runtime_minutes && (
                  <span className="text-[10px] text-white/60">{formatRuntime(bookmark.runtime_minutes)}</span>
                )}
                {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                  <span className="text-[10px] text-white/50">{bookmark.mood_tags.slice(0, 2).join(" · ")}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Non-hover title (always visible when not expanded) */}
        {!showExpanded && (
          <div className="pt-1.5 px-0.5">
            <p className="text-[11px] font-medium text-white/80 truncate leading-tight">
              {bookmark.title}
            </p>
          </div>
        )}
      </div>

      {/* Quick Schedule Sheet */}
      <QuickScheduleSheet
        bookmark={bookmark}
        open={quickScheduleOpen}
        onOpenChange={setQuickScheduleOpen}
      />
    </>
  );
}
