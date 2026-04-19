import { Check, Plus, Shuffle } from "lucide-react";
import type { SimilarTitle } from "@/hooks/useSimilarTitles";

interface SimilarTitlesRailProps {
  titles: SimilarTitle[];
  ownedIds: Set<number>;
  onAdd: (item: SimilarTitle) => void;
  isAdding: boolean;
}

export function SimilarTitlesRail({ titles, ownedIds, onAdd, isAdding }: SimilarTitlesRailProps) {
  if (titles.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
        <Shuffle className="w-4 h-4" />
        You Might Also Like
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
        {titles.map((item) => {
          const alreadyOwned = ownedIds.has(item.id);
          return (
            <div key={item.id} className="shrink-0 w-28 group">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-1.5">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground">{item.title.charAt(0)}</span>
                  </div>
                )}
                {!alreadyOwned && (
                  <button
                    type="button"
                    onClick={() => onAdd(item)}
                    disabled={isAdding}
                    className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label={`Add ${item.title} to your list`}
                  >
                    <Plus className="w-6 h-6 text-primary" />
                  </button>
                )}
                {alreadyOwned && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground truncate">{item.title}</p>
              {item.release_year && (
                <p className="text-[10px] text-muted-foreground">{item.release_year}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
