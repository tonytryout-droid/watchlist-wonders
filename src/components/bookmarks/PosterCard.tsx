import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Play, Plus, Check, CalendarPlus, MoreHorizontal, ExternalLink,
  Trash2, Undo2, Eye, BookMarked, Minus, ThumbsUp, Info, Film, Star, SkipForward,
  Lock, Unlock, Globe, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn, extractYouTubeVideoId } from "@/lib/utils";
import { getNextStatus } from "@/engine/lifecycle";
import { fetchTrailerEmbedUrlViaProxy } from "@/services/tmdbProxy";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import { WatchModal } from "@/components/bookmarks/WatchModal";
import type { Bookmark, Schedule } from "@/types/database";

interface PosterCardProps {
  bookmark: Bookmark;
  rank?: number;
  cardSize?: "default" | "featured";
  recommendationReason?: string;
  isHighlighted?: boolean;
  onPlay?: () => void;
  onSchedule?: () => void;
  onSkip?: () => void;
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
  onToggleUpNext?: (bookmark: Bookmark) => void;
  onSharePublic?: () => void;
  onSharePrivate?: () => void;
  onVault?: () => void;
  onUnvault?: () => void;
  schedule?: Schedule;
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
  disney:         "bg-blue-800",
  disneyplus:     "bg-blue-800",
  prime:          "bg-sky-600",
  primevideo:     "bg-sky-600",
  twitch:         "bg-purple-600",
  appletv:        "bg-zinc-900",
  appletvplus:    "bg-zinc-900",
  hbo:            "bg-purple-900",
  hbomax:         "bg-purple-900",
  peacock:        "bg-yellow-600",
  generic:        "bg-neutral-500",
};

function formatRuntime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatScheduleBadge(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Today ${format(date, 'h a')}`;
  }
  const tomorrow = new Date(now.getTime() + 86400000);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return format(date, 'EEE MMM d');
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

function toYouTubeWatchUrl(rawUrl: string): string | null {
  const parsedId = extractYouTubeVideoId(rawUrl);
  if (parsedId) {
    return `https://www.youtube.com/watch?v=${parsedId}`;
  }

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!hostname.includes("youtube.com")) return null;

    const embedId = segments[0] === "embed" ? segments[1] : null;
    const shortsId = segments[0] === "shorts" ? segments[1] : null;
    const videoId = embedId ?? shortsId;
    if (!videoId) return null;

    const watchUrl = new URL("https://www.youtube.com/watch");
    watchUrl.searchParams.set("v", videoId);
    const list = parsed.searchParams.get("list");
    const start = parsed.searchParams.get("start") ?? parsed.searchParams.get("t");
    if (list) watchUrl.searchParams.set("list", list);
    if (start) watchUrl.searchParams.set("t", start);
    return watchUrl.toString();
  } catch {
    return null;
  }
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
  const tmdbId = getMetadataNumber(bookmark.metadata || {}, ["tmdb_id", "tmdbId"]);
  if (!tmdbId) return null;
  const mediaType = bookmark.type === "series" ? "tv" : "movie";
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (trailerUrlCache.has(cacheKey)) return trailerUrlCache.get(cacheKey) ?? null;
  try {
    const trailerUrl = await fetchTrailerEmbedUrlViaProxy(tmdbId, mediaType);
    trailerUrlCache.set(cacheKey, trailerUrl);
    return trailerUrl;
  } catch {
    trailerUrlCache.set(cacheKey, null);
    return null;
  }
}

export function PosterCard({
  bookmark,
  rank,
  cardSize = "default",
  recommendationReason,
  isHighlighted = false,
  onPlay,
  onSchedule,
  onSkip,
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
  onToggleUpNext,
  onSharePublic,
  onSharePrivate,
  onVault,
  onUnvault,
  schedule,
}: PosterCardProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [watchModalOpen, setWatchModalOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(() => getBookmarkTrailerUrl(bookmark));
  const [isLoadingTrailer, setIsLoadingTrailer] = useState(false);
  const [episodePopoverOpen, setEpisodePopoverOpen] = useState(false);
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const trailerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const providers = bookmark.availability?.providers ?? [];
    if (providers.length === 1) {
      const url = providers[0].url;
      try {
        const { protocol } = new URL(url);
        if (protocol === "https:" || protocol === "http:") {
          window.open(url, "_blank", "noopener");
          return;
        }
      } catch { /* fall through */ }
    }
    if (providers.length > 1) {
      setWatchModalOpen(true);
      return;
    }

    if (bookmark.source_url) {
      window.open(bookmark.source_url, "_blank", "noopener");
      return;
    }
    const trailerWatchUrl = trailerUrl ? toYouTubeWatchUrl(trailerUrl) ?? trailerUrl : null;
    if (trailerWatchUrl) {
      window.open(trailerWatchUrl, "_blank", "noopener");
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
    const next = getNextStatus(bookmark.status);
    onStatusCycle(bookmark, next);
  };

  const handleEpisodeUpdate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEpisodeUpdate?.(bookmark, localEpisodeCount);
    setEpisodePopoverOpen(false);
  };

  const clearHoverOpenTimer = () => {
    if (hoverOpenRef.current) {
      clearTimeout(hoverOpenRef.current);
      hoverOpenRef.current = null;
    }
  };

  const clearHoverCloseTimer = () => {
    if (hoverCloseRef.current) {
      clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = null;
    }
  };

  const scheduleHoverOpen = () => {
    clearHoverCloseTimer();
    clearHoverOpenTimer();
    hoverOpenRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 140);
  };

  const scheduleHoverClose = () => {
    clearHoverOpenTimer();
    clearHoverCloseTimer();
    hoverCloseRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsTouched(false);
    }, 170);
  };

  useEffect(() => {
    setTrailerUrl(getBookmarkTrailerUrl(bookmark));
  }, [bookmark.id, bookmark.source_url, bookmark.metadata]);

  useEffect(() => {
    setLocalEpisodeCount(episodesWatched);
  }, [episodesWatched]);

  useEffect(() => {
    if (!isPreviewActive || trailerUrl) {
      if (trailerDebounceRef.current) clearTimeout(trailerDebounceRef.current);
      return;
    }
    let cancelled = false;
    setIsLoadingTrailer(true);
    trailerDebounceRef.current = setTimeout(() => {
      fetchTmdbTrailerUrl(bookmark).then((url) => {
        if (!cancelled) {
          if (url) setTrailerUrl(url);
          setIsLoadingTrailer(false);
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      if (trailerDebounceRef.current) clearTimeout(trailerDebounceRef.current);
      setIsLoadingTrailer(false);
    };
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

  useEffect(() => {
    return () => {
      if (hoverOpenRef.current) {
        clearTimeout(hoverOpenRef.current);
        hoverOpenRef.current = null;
      }
      if (hoverCloseRef.current) {
        clearTimeout(hoverCloseRef.current);
        hoverCloseRef.current = null;
      }
    };
  }, []);

  const showExpanded = (isHovered || isTouched) && !isSelectable;
  const shouldElevate = showExpanded && !isMobile;
  const elevatedTransform =
    variant === "poster" ? "translateY(-24px) scale(1.08)" : "translateY(-18px) scale(1.05)";

  return (
    <>
      {/* Wrapper Ã¢â‚¬â€ expands on hover (Netflix-style scale + info panel) */}
      <div
        ref={cardRef}
        className={cn(
          "group relative flex-shrink-0 snap-start transition-transform duration-300 ease-out will-change-transform",
          variant === "poster"
            ? cardSize === "featured"
              ? "w-44 sm:w-48 md:w-52 lg:w-56"
              : "w-36 sm:w-40 md:w-44 lg:w-48"
            : cardSize === "featured"
            ? "w-72 sm:w-80 md:w-[22rem]"
            : "w-64 sm:w-72 md:w-80",
          rank && "ml-6",
          showExpanded && "z-30",
          isHighlighted && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background rounded-md motion-safe:animate-[pulse_2.2s_ease-in-out_infinite] motion-reduce:animate-none",
          isSelected && "ring-2 ring-primary rounded-md",
          className
        )}
        style={{
          transform: shouldElevate ? elevatedTransform : "translateY(0) scale(1)",
          transformOrigin: "bottom center",
        }}
        onMouseEnter={() => !isMobile && scheduleHoverOpen()}
        onMouseLeave={() => !isMobile && scheduleHoverClose()}
        onFocusCapture={() => {
          if (isMobile) return;
          clearHoverCloseTimer();
          setIsHovered(true);
        }}
        onBlurCapture={(event) => {
          if (cardRef.current && !cardRef.current.contains(event.relatedTarget as Node)) {
            scheduleHoverClose();
          }
        }}
      >
        {rank && (
          <span
            aria-hidden="true"
            className="absolute -left-7 bottom-[-2px] z-0 text-[5.2rem] font-black leading-none text-[#151515] pointer-events-none select-none"
            style={{ WebkitTextStroke: "2px rgba(255,255,255,0.45)" }}
          >
            {rank}
          </span>
        )}

        <Link
          to={`/b/${bookmark.id}`}
          className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          data-rail-card-link="true"
          onClick={handleCardClick}
        >
          {/* Image container */}
          <div
            className={cn(
              "relative overflow-hidden rounded-sm transition-transform duration-300 ease-out",
              aspectRatio,
              showExpanded && "rounded-t-sm rounded-b-none shadow-[0_18px_30px_rgba(0,0,0,0.55)]"
            )}
          >
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={bookmark.title}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-300 ease-out",
                  showExpanded && "scale-105"
                )}
                onError={() => setImageError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
                <Film className="w-8 h-8 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/60 text-center px-2 leading-tight truncate max-w-full">
                  {bookmark.title}
                </span>
              </div>
            )}

            {/* Trailer preview loading skeleton */}
            {isPreviewActive && isLoadingTrailer && !trailerUrl && (
              <div className="absolute inset-0 z-[1] bg-black flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
            <div className={cn("absolute left-1.5", rank ? "top-7" : "top-1.5")}>
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

            {/* Schedule badge */}
            {schedule && bookmark.queue_status !== "up_next" && !isNew && !isSelectable && (
              <div className="absolute top-1.5 right-1.5">
                <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  {formatScheduleBadge(schedule.scheduled_for)}
                </span>
              </div>
            )}

            {/* Up Next badge */}
            {bookmark.queue_status === "up_next" && !isSelectable && !isNew && (
              <div className="absolute top-1.5 right-1.5">
                <span className="flex items-center gap-0.5 text-[9px] font-bold bg-wm-gold text-background px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  <Star className="w-2 h-2 fill-current" />
                  Up Next
                </span>
              </div>
            )}

            {bookmark.is_public && !isSelectable && (
              <div className="absolute bottom-2 right-2 z-20">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white/95 backdrop-blur-sm">
                  <Globe className="w-2.5 h-2.5" />
                  Public
                </span>
              </div>
            )}

            {/* Watch progress bar */}
            {(bookmark.progress_percent ?? 0) > 0 && !isSelectable && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(bookmark.progress_percent ?? 0, 100)}%` }}
                />
              </div>
            )}

            {rank && (
              <div className="absolute top-1.5 left-1.5">
                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  Top 10
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

            {/* Status badge Ã¢â‚¬â€ watching */}
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
                <PopoverContent side="top" className="w-48 p-3 bg-card border-white/10" onClick={(e) => e.stopPropagation()}>
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
                  <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
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
                    {onToggleUpNext && bookmark.status !== "done" && (
                      <DropdownMenuItem
                        onClick={() => onToggleUpNext(bookmark)}
                        className={bookmark.queue_status === "up_next" ? "text-wm-gold" : "text-white/90"}
                      >
                        <Star className={cn("w-4 h-4 mr-2", bookmark.queue_status === "up_next" && "fill-current")} />
                        {bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onAddToPlan} className="text-white/90">
                      <Plus className="w-4 h-4 mr-2" />Add to Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleScheduleClick} className="text-white/90">
                      <CalendarPlus className="w-4 h-4 mr-2" />Quick Schedule
                    </DropdownMenuItem>
                    {bookmark.status !== "done" && (
                      <DropdownMenuItem onClick={onSkip} className="text-white/90">
                        <SkipForward className="w-4 h-4 mr-2" />Skip for now
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_public ? (
                      <DropdownMenuItem onClick={onSharePrivate} className="text-white/90">
                        <Globe className="w-4 h-4 mr-2" />Make private
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onSharePublic} className="text-white/90">
                        <Share2 className="w-4 h-4 mr-2" />Share publicly
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_vaulted ? (
                      <DropdownMenuItem onClick={onUnvault} className="text-white/90">
                        <Unlock className="w-4 h-4 mr-2" />Remove from Vault
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onVault} className="text-white/90">
                        <Lock className="w-4 h-4 mr-2" />Move to Vault
                      </DropdownMenuItem>
                    )}
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

        {/* Netflix-style expanded info panel Ã¢â‚¬â€ appears below on hover */}
        {!isSelectable && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out bg-card rounded-b-sm",
              showExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-2.5">
              {/* Action row */}
              <div className="grid grid-cols-1 gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="h-8 rounded-md bg-white text-black text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/90 transition-colors"
                  aria-label={`Watch now: ${bookmark.title}`}
                >
                  <Play className="w-3.5 h-3.5 fill-black text-black" />
                  <span>Watch now</span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleScheduleClick}
                    className="h-8 rounded-md border border-white/30 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:border-white transition-colors"
                    aria-label={`Schedule ${bookmark.title}`}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Schedule</span>
                  </button>
                  {bookmark.status !== "done" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip?.(); }}
                      className="h-8 rounded-md border border-white/30 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:border-white transition-colors"
                      aria-label={`Skip ${bookmark.title} for now`}
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUndoDone?.(); }}
                      className="h-8 rounded-md border border-[#46d369] text-[#46d369] text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[#46d369]/10 transition-colors"
                      aria-label="Undo watched"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToPlan?.(); }}
                  className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center hover:border-white transition-colors text-white shrink-0"
                  aria-label="Add to plan"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {onToggleUpNext && bookmark.status !== "done" && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleUpNext(bookmark); }}
                    className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0",
                      bookmark.queue_status === "up_next"
                        ? "border-wm-gold text-wm-gold bg-wm-gold/10"
                        : "border-white/30 text-white hover:border-wm-gold hover:text-wm-gold"
                    )}
                    aria-label={bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                    title={bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                  >
                    <Star className={cn("w-4 h-4", bookmark.queue_status === "up_next" && "fill-current")} />
                  </button>
                )}

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
                  <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                    {bookmark.status !== "watching" && (
                      <DropdownMenuItem onClick={onSetWatching} className="text-white/90">
                        <Eye className="w-4 h-4 mr-2" />Set as Watching
                      </DropdownMenuItem>
                    )}
                    {onToggleUpNext && bookmark.status !== "done" && (
                      <DropdownMenuItem
                        onClick={() => onToggleUpNext(bookmark)}
                        className={bookmark.queue_status === "up_next" ? "text-wm-gold" : "text-white/90"}
                      >
                        <Star className={cn("w-4 h-4 mr-2", bookmark.queue_status === "up_next" && "fill-current")} />
                        {bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleScheduleClick} className="text-white/90">
                      <CalendarPlus className="w-4 h-4 mr-2" />Quick Schedule
                    </DropdownMenuItem>
                    {bookmark.is_public ? (
                      <DropdownMenuItem onClick={onSharePrivate} className="text-white/90">
                        <Globe className="w-4 h-4 mr-2" />Make private
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onSharePublic} className="text-white/90">
                        <Share2 className="w-4 h-4 mr-2" />Share publicly
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_vaulted ? (
                      <DropdownMenuItem onClick={onUnvault} className="text-white/90">
                        <Unlock className="w-4 h-4 mr-2" />Remove from Vault
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onVault} className="text-white/90">
                        <Lock className="w-4 h-4 mr-2" />Move to Vault
                      </DropdownMenuItem>
                    )}
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
                  <span className="text-[10px] text-white/50">{bookmark.mood_tags.slice(0, 2).join(" | ")}</span>
                )}
              </div>
              {recommendationReason && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#54b3d6]">
                  <Info className="h-3 w-3 shrink-0" />
                  <p className="truncate">Why this? {recommendationReason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Non-hover title (always visible when not expanded) */}
        {!showExpanded && (
          <div className="pt-1.5 px-0.5">
            <p className="text-[11px] font-medium text-white/80 truncate leading-tight">
              {bookmark.title}
            </p>
            {recommendationReason && (
              <p className="text-[10px] text-[#54b3d6]/90 truncate leading-tight mt-0.5">
                Why this? {recommendationReason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Schedule Sheet */}
      <QuickScheduleSheet
        bookmark={bookmark}
        open={quickScheduleOpen}
        onOpenChange={setQuickScheduleOpen}
      />

      <WatchModal
        bookmark={bookmark}
        open={watchModalOpen}
        onClose={() => setWatchModalOpen(false)}
      />
    </>
  );
}
