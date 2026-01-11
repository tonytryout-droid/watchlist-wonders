import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Plus, Check, Clock, Calendar, MoreHorizontal, ExternalLink, Trash2, Undo2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface PosterCardProps {
  bookmark: Bookmark;
  onPlay?: () => void;
  onSchedule?: () => void;
  onMarkDone?: () => void;
  onAddToPlan?: () => void;
  onDelete?: () => void;
  onUndoDone?: () => void;
  onSetWatching?: () => void;
  variant?: "poster" | "backdrop";
  className?: string;
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
  variant = "poster",
  className,
}: PosterCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = variant === "poster" ? (bookmark.poster_url || bookmark.backdrop_url) : (bookmark.backdrop_url || bookmark.poster_url);
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmark.source_url) {
      window.open(bookmark.source_url, "_blank");
    }
    onPlay?.();
  };

  const formatRuntime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      youtube: "bg-red-600",
      netflix: "bg-red-600",
      imdb: "bg-yellow-500",
      instagram: "bg-pink-500",
      facebook: "bg-blue-600",
      x: "bg-foreground",
      generic: "bg-muted",
    };
    return colors[provider] || colors.generic;
  };

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = {
      chill: "bg-chart-4/20 text-chart-4",
      intense: "bg-destructive/20 text-destructive",
      funny: "bg-chart-2/20 text-chart-2",
      romantic: "bg-pink-500/20 text-pink-400",
      inspiring: "bg-chart-3/20 text-chart-3",
      dark: "bg-chart-5/20 text-chart-5",
    };
    return colors[mood.toLowerCase()] || "bg-muted text-muted-foreground";
  };

  return (
    <Link
      to={`/b/${bookmark.id}`}
      className={cn(
        "group relative block flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300",
        variant === "poster" ? "w-32 sm:w-36 md:w-40 lg:w-44" : "w-60 sm:w-72 md:w-80",
        isHovered && "scale-105 z-10 shadow-2xl ring-2 ring-primary/50",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className={cn("relative bg-secondary", aspectRatio)}>
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-3xl font-bold text-muted-foreground">
              {bookmark.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Provider Badge */}
        <div className="absolute top-2 left-2">
          <div className={cn("w-2 h-2 rounded-full", getProviderColor(bookmark.provider))} />
        </div>

        {/* Status Badge */}
        {bookmark.status === "watching" && (
          <div className="absolute top-2 right-2">
            <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
              Watching
            </Badge>
          </div>
        )}

        {/* Runtime */}
        {bookmark.runtime_minutes && (
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-xs px-1.5 py-0.5 rounded">
            {formatRuntime(bookmark.runtime_minutes)}
          </div>
        )}

        {/* Hover Overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 transition-opacity duration-300",
            isHovered && "opacity-100"
          )}
        />

        {/* Hover Actions */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 p-3 transform translate-y-full transition-transform duration-300",
            isHovered && "translate-y-0"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handlePlay}
            >
              <Play className="w-4 h-4 fill-current" />
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSchedule?.();
                }}
              >
                <Calendar className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {bookmark.status !== "watching" && (
                    <DropdownMenuItem onClick={onSetWatching}>
                      <Eye className="w-4 h-4 mr-2" />
                      Set as Watching
                    </DropdownMenuItem>
                  )}
                  {bookmark.status === "done" ? (
                    <DropdownMenuItem onClick={onUndoDone}>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Move to Backlog
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onMarkDone}>
                      <Check className="w-4 h-4 mr-2" />
                      Mark as Done
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onAddToPlan}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePlay}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Source
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Title and metadata */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {bookmark.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          {bookmark.release_year && (
            <span className="text-xs text-muted-foreground">{bookmark.release_year}</span>
          )}
          {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", getMoodColor(bookmark.mood_tags[0]))}>
              {bookmark.mood_tags[0]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
