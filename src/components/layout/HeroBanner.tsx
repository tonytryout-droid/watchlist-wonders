import { Play, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientBarsBackground } from "@/components/ui/gradient-bars-background";
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
  source_url?: string | null;
  notes?: string | null;
  mood_tags?: string[];
  scheduled_for?: string | null;
}

interface HeroBannerProps {
  bookmark: Bookmark | null;
  onPlay?: () => void;
  onMoreInfo?: () => void;
  className?: string;
}

export function HeroBanner({ bookmark, onPlay, onMoreInfo, className }: HeroBannerProps) {
  if (!bookmark) {
    return (
      <div className={cn("relative h-[55vh] min-h-[420px] flex items-end overflow-hidden", className)}>
        <GradientBarsBackground className="opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="relative z-10 px-6 lg:px-8 pb-14">
          <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4">
            Your Watchlist Awaits
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6">
            Add your first bookmark to get started. Paste any URL and we'll fetch the details automatically.
          </p>
          <Button variant="default" size="lg" asChild className="rounded-full px-8">
            <a href="/new">Add Your First Bookmark</a>
          </Button>
        </div>
      </div>
    );
  }

  const backdropUrl = bookmark.backdrop_url || bookmark.poster_url;

  return (
    <div className={cn("relative h-[55vh] min-h-[420px] flex items-end overflow-hidden", className)}>
      {/* Backdrop */}
      {backdropUrl && (
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}

      <GradientBarsBackground baseClassName="bg-transparent" className="opacity-50" />

      {/* Gradient overlays — bottom-heavy + left-side fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 px-6 lg:px-8 pb-12 max-w-2xl">
        {/* Genre / provider badges */}
        <div className="flex items-center gap-2 mb-3">
          <Badge className="capitalize bg-primary/90 text-white border-0 text-xs px-2.5">
            {bookmark.type}
          </Badge>
          <Badge variant="outline" className="capitalize text-xs">
            {bookmark.provider}
          </Badge>
          {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {bookmark.mood_tags.slice(0, 2).join(", ")}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-foreground mb-3 leading-tight line-clamp-2 drop-shadow-lg">
          {bookmark.title}
        </h1>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          {bookmark.release_year && (
            <span className="font-medium text-foreground/80">{bookmark.release_year}</span>
          )}
          {bookmark.runtime_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(bookmark.runtime_minutes / 60)}h {bookmark.runtime_minutes % 60}m
            </span>
          )}
        </div>

        {/* Description */}
        {bookmark.notes && (
          <p className="text-sm text-muted-foreground max-w-lg mb-6 line-clamp-2 leading-relaxed">
            {bookmark.notes}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={onPlay}
            className="flex items-center gap-2 rounded-lg px-7 font-bold shadow-lg shadow-primary/25"
          >
            <Play className="w-5 h-5 fill-current" />
            Watch
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onMoreInfo}
            className="flex items-center gap-1.5 rounded-lg border-white/20 bg-white/10 hover:bg-white/20 text-foreground backdrop-blur-sm"
            aria-label="More info"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs font-bold">+</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
