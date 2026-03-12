import { Play, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const TYPE_LABEL: Record<string, string> = {
  movie: "FILM",
  series: "SERIES",
  video: "VIDEO",
  doc: "DOCUMENTARY",
};

export function HeroBanner({ bookmark, onPlay, onMoreInfo, className }: HeroBannerProps) {
  if (!bookmark) {
    return (
      <div className={cn("relative h-[70vh] sm:h-[80vh] min-h-[400px] sm:min-h-[520px] flex items-end overflow-hidden", className)}>
        <GradientBarsBackground className="opacity-40" />
        {/* Strong gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/80 via-[#141414]/20 to-transparent" />

        <div className="relative z-10 px-4 sm:px-8 md:px-12 lg:px-16 pb-12 sm:pb-20">
          <p className="text-primary font-bold text-xs tracking-widest uppercase mb-3">
            Your Watchlist
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-4 leading-[1.05]">
            Save Anything.<br />Watch Everything.
          </h2>
          <p className="text-base md:text-lg text-white/70 max-w-lg mb-8 leading-relaxed">
            Paste any URL and we'll fetch the details automatically. Movies, shows, YouTube videos and more.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="lg"
              asChild
              className="bg-white hover:bg-white/90 text-black font-bold rounded px-8 h-12 text-base"
            >
              <a href="/new">
                <Play className="w-5 h-5 fill-black mr-2" />
                Add First Bookmark
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const backdropUrl = bookmark.backdrop_url || bookmark.poster_url;
  const typeLabel = TYPE_LABEL[bookmark.type] || bookmark.type.toUpperCase();

  return (
    <div className={cn("relative h-[80vh] min-h-[520px] flex items-end overflow-hidden", className)}>
      {/* Backdrop image */}
      {backdropUrl && (
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}

      {!backdropUrl && <GradientBarsBackground baseClassName="bg-transparent" className="opacity-40" />}

      {/* Netflix-style gradient overlays: strong bottom + left fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/90 via-[#141414]/40 to-transparent" />

      {/* Content — left-aligned, Netflix style */}
      <div className="relative z-10 px-4 sm:px-8 md:px-12 lg:px-16 pb-12 sm:pb-20 max-w-2xl">

        {/* Type label */}
        <p className="text-primary font-bold text-xs tracking-widest uppercase mb-2">
          {typeLabel}
        </p>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-3 leading-[1.05] line-clamp-2 drop-shadow-2xl">
          {bookmark.title}
        </h1>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-sm mb-4">
          {bookmark.release_year && (
            <span className="text-[#46d369] font-semibold">{bookmark.release_year}</span>
          )}
          {bookmark.runtime_minutes && (
            <span className="text-white/80 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(bookmark.runtime_minutes / 60)}h {bookmark.runtime_minutes % 60}m
            </span>
          )}
          {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
            <span className="text-white/60 text-xs">
              {bookmark.mood_tags.slice(0, 3).join(" · ")}
            </span>
          )}
        </div>

        {/* Description */}
        {bookmark.notes && (
          <p className="text-sm md:text-base text-white/75 max-w-lg mb-6 line-clamp-3 leading-relaxed">
            {bookmark.notes}
          </p>
        )}

        {/* Action buttons — Netflix-style */}
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={onPlay}
            className="bg-white hover:bg-white/90 text-black font-bold rounded px-8 h-12 text-base shadow-none"
          >
            <Play className="w-5 h-5 fill-black mr-2" />
            Watch
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onMoreInfo}
            className="bg-white/20 hover:bg-white/30 text-white border-white/0 font-semibold rounded px-6 h-12 text-base backdrop-blur-sm"
          >
            <Info className="w-5 h-5 mr-2" />
            More Info
          </Button>
        </div>
      </div>
    </div>
  );
}
