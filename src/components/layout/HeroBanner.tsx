import { Link } from "react-router-dom";
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

const PROVIDER_LABEL: Record<string, string> = {
  netflix: "Netflix",
  youtube: "YouTube",
  imdb: "IMDb",
  disneyplus: "Disney+",
  primevideo: "Prime Video",
  hbomax: "HBO Max",
  generic: "Web",
};

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function HeroBanner({ bookmark, onPlay, onMoreInfo, className }: HeroBannerProps) {
  if (!bookmark) {
    return (
      <section className={cn("relative h-[86vh] min-h-[560px] flex items-end overflow-hidden", className)}>
        <GradientBarsBackground className="opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(229,9,20,0.18),transparent_40%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/85 via-[#141414]/35 to-transparent" />

        <div className="relative z-10 px-8 md:px-12 lg:px-16 pb-20 max-w-2xl">
          <p className="text-primary font-semibold text-xs tracking-[0.24em] uppercase mb-4">
            WatchMarks Home
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 leading-[0.95]">
            Build Your
            <br />
            Next Binge
          </h2>
          <p className="text-base md:text-lg text-white/75 max-w-xl mb-8 leading-relaxed">
            Save any streaming link, organize it into rails, and jump straight into watching.
          </p>
          <Button
            variant="default"
            size="lg"
            asChild
            className="bg-white hover:bg-white/90 text-black font-bold rounded px-8 h-12 text-base"
          >
            <Link to="/new">
              <Play className="w-5 h-5 fill-black mr-2" />
              Add First Bookmark
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const backdropUrl = bookmark.backdrop_url || bookmark.poster_url;
  const typeLabel = TYPE_LABEL[bookmark.type] || bookmark.type.toUpperCase();
  const providerLabel =
    PROVIDER_LABEL[bookmark.provider] ||
    bookmark.provider.charAt(0).toUpperCase() + bookmark.provider.slice(1);
  const moodSummary =
    bookmark.mood_tags && bookmark.mood_tags.length > 0 ? bookmark.mood_tags.slice(0, 3).join(" | ") : null;
  const description =
    bookmark.notes?.trim() ||
    `Queued in your watchlist. Open details to set mood tags, notes, and episode progress.`;

  return (
    <section className={cn("relative h-[86vh] min-h-[560px] flex items-end overflow-hidden", className)}>
      {backdropUrl && (
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover object-center scale-[1.03]"
          />
        </div>
      )}

      {!backdropUrl && <GradientBarsBackground baseClassName="bg-transparent" className="opacity-45" />}

      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/65 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/92 via-[#141414]/45 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(229,9,20,0.14),transparent_44%)]" />

      <div className="relative z-10 px-8 md:px-12 lg:px-16 pb-20 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-semibold tracking-wide uppercase">
          <span className="inline-flex items-center rounded bg-primary text-white px-2 py-1">{typeLabel}</span>
          <span className="inline-flex items-center rounded bg-white/10 text-white/90 px-2 py-1">
            on {providerLabel}
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-4 leading-[0.95] line-clamp-2 drop-shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
          {bookmark.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
          {bookmark.release_year && <span className="text-[#46d369] font-semibold">{bookmark.release_year}</span>}
          {bookmark.runtime_minutes && (
            <span className="text-white/85 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatRuntime(bookmark.runtime_minutes)}
            </span>
          )}
          {moodSummary && <span className="text-white/65 text-xs">{moodSummary}</span>}
        </div>

        <p className="text-sm md:text-base text-white/78 max-w-2xl mb-7 line-clamp-3 leading-relaxed">
          {description}
        </p>

        <div className="flex flex-wrap items-center gap-3">
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
    </section>
  );
}
