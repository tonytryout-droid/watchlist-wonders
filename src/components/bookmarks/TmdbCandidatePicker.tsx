import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: EnrichmentMatchCandidate[];
  /** The title extracted from the pasted link — shown as context above the grid */
  extractedTitle: string;
  onSelect: (candidate: EnrichmentMatchCandidate) => void;
  onSkip: () => void;
};

export function TmdbCandidatePicker({
  open,
  onOpenChange,
  candidates,
  extractedTitle,
  onSelect,
  onSkip,
}: Props) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  // Reset selection when dialog opens with new candidates
  React.useEffect(() => {
    if (open) setSelectedId(null);
  }, [open, candidates]);

  const isSingleCandidate = candidates.length === 1;

  const handleConfirm = () => {
    const candidate = candidates.find((c) => c.tmdbId === selectedId);
    if (!candidate) return;
    onSelect(candidate);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isSingleCandidate ? "Is this the right title?" : "We found possible matches"}
          </DialogTitle>
          <DialogDescription>
            {extractedTitle ? (
              <>
                We searched for{" "}
                <span className="font-medium text-foreground">"{extractedTitle}"</span> — select
                the correct result to auto-fill title, synopsis, runtime, and genre.
              </>
            ) : (
              "Select the correct result to auto-fill title, synopsis, runtime, and genre."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Candidate grid — poster-dominant, 2-col on mobile, up to 4-col on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-2">
          {candidates.slice(0, 5).map((candidate, index) => {
            const isActive = selectedId === candidate.tmdbId;
            return (
              <button
                key={`${candidate.tmdbId}-${candidate.mediaType}`}
                type="button"
                onClick={() => setSelectedId(candidate.tmdbId)}
                className={cn(
                  "flex flex-col rounded-lg border overflow-hidden text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
                aria-pressed={isActive}
              >
                {/* Poster — 2:3 aspect ratio */}
                <div className="aspect-[2/3] w-full bg-muted relative overflow-hidden">
                  {candidate.posterUrl ? (
                    <img
                      src={candidate.posterUrl}
                      alt={candidate.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/20">
                      {candidate.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white drop-shadow" />
                    </div>
                  )}
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      Best match
                    </span>
                  )}
                </div>
                {/* Meta row */}
                <div className="p-2">
                  <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                    {candidate.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {candidate.mediaType === "tv" ? "Series" : "Movie"}
                    {candidate.releaseYear ? ` · ${candidate.releaseYear}` : ""}
                    {candidate.runtimeMinutes ? ` · ${candidate.runtimeMinutes}m` : ""}
                  </p>
                  {candidate.description && (
                    <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                      {candidate.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleConfirm} disabled={selectedId === null} className="w-full">
            Confirm selection
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
            None of these — enter manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
