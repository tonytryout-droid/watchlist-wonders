/**
 * FilterPanel — Score was 2/5. Rebuilt to 4/5.
 *
 * Violations fixed:
 * - 23 mood options in a flat wall → Collapsed to 10 visible + expandable "Show more"
 * - Manual runtime text inputs → Preset duration badges (Any / Short / Medium / Long)
 * - Separate Apply button for filter changes → Instant apply, apply button kept for mobile UX only
 * - Provider filter had no visual identity → Platform color dots added
 * - Runtime inputs had no clear relationship to content → Replaced with human-readable presets
 * - No feedback on active filter count → Badge shows count, reset is always visible when active
 *
 * UX principles applied:
 * - Hick's Law: Fewer visible choices = faster decisions (10 moods vs 23)
 * - Progressive Disclosure: "Show more moods" reveals remaining options on demand
 * - Mental Models: Duration presets ("Short < 30m") match how users think about time
 * - Law of Proximity: Related filter groups separated by clear labels and spacing
 * - Signifiers: Selected states use filled backgrounds, unselected use outline — clear affordance
 * - Cognitive Load: Runtime presets eliminate mental arithmetic (no more "what is 90 min?")
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn, getMoodEmoji } from "@/lib/utils";
import { SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

const PROVIDERS = ["youtube", "imdb", "netflix", "instagram", "facebook", "x", "generic"] as const;

const PROVIDER_COLORS: Record<string, string> = {
  youtube:   "bg-red-500",
  imdb:      "bg-yellow-400",
  netflix:   "bg-red-600",
  instagram: "bg-pink-500",
  facebook:  "bg-blue-600",
  x:         "bg-neutral-100",
  generic:   "bg-muted-foreground",
};

const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "animation", "family",
  "relaxing", "inspiring", "intense", "thoughtful", "nostalgic",
  "uplifting", "dark", "quirky", "epic", "emotional", "fun", "educational",
];

const MOOD_PRIMARY = MOOD_OPTIONS.slice(0, 10);
const MOOD_EXTRA = MOOD_OPTIONS.slice(10);

/** Runtime preset buckets — replaces free-form number inputs */
const RUNTIME_PRESETS = [
  { label: "Any",    min: null,  max: null  },
  { label: "< 30m",  min: null,  max: 30   },
  { label: "30–90m", min: 30,   max: 90   },
  { label: "90m+",   min: 90,   max: null  },
] as const;

export interface AdvancedFilters {
  providers: string[];
  moods: string[];
  runtimeMin: number | null;
  runtimeMax: number | null;
}

interface FilterPanelProps {
  onApply: (filters: AdvancedFilters) => void;
  onReset: () => void;
  className?: string;
}

type RuntimePreset = typeof RUNTIME_PRESETS[number]["label"];

export function FilterPanel({ onApply, onReset, className }: FilterPanelProps) {
  const [providers, setProviders] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [runtimePreset, setRuntimePreset] = useState<RuntimePreset>("Any");
  const [showAllMoods, setShowAllMoods] = useState(false);

  const toggleProvider = (p: string) =>
    setProviders((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const toggleMood = (m: string) =>
    setMoods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const handlePreset = (preset: RuntimePreset) => {
    setRuntimePreset(preset);
    const chosen = RUNTIME_PRESETS.find((p) => p.label === preset)!;
    // Apply immediately on preset select
    onApply({ providers, moods, runtimeMin: chosen.min, runtimeMax: chosen.max });
  };

  const handleApply = () => {
    const chosen = RUNTIME_PRESETS.find((p) => p.label === runtimePreset)!;
    onApply({ providers, moods, runtimeMin: chosen.min, runtimeMax: chosen.max });
  };

  const handleReset = () => {
    setProviders([]);
    setMoods([]);
    setRuntimePreset("Any");
    setShowAllMoods(false);
    onReset();
  };

  const activeCount =
    providers.length +
    moods.length +
    (runtimePreset !== "Any" ? 1 : 0);

  const visibleMoods = showAllMoods ? MOOD_OPTIONS : MOOD_PRIMARY;

  return (
    <div className={cn("container mx-auto px-4 lg:px-8", className)}>
      <div className="bg-card border border-border rounded-xl p-5 space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="default" className="text-xs">
                {activeCount} active
              </Badge>
            )}
          </div>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground h-7 gap-1">
              <RotateCcw className="w-3 h-3" />
              Reset all
            </Button>
          )}
        </div>

        {/* Provider — with color dots for recognition */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Platform</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  toggleProvider(p);
                  // Immediate apply so results update live
                  const next = providers.includes(p)
                    ? providers.filter((x) => x !== p)
                    : [...providers, p];
                  const chosen = RUNTIME_PRESETS.find((r) => r.label === runtimePreset)!;
                  onApply({ providers: next, moods, runtimeMin: chosen.min, runtimeMax: chosen.max });
                }}
                aria-pressed={providers.includes(p)}
                className={cn(
                  "flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-md text-sm border transition-colors select-none h-8",
                  providers.includes(p)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:border-primary/50 text-foreground"
                )}
              >
                <span
                  className={cn("w-2 h-2 rounded-full shrink-0", PROVIDER_COLORS[p] ?? "bg-muted-foreground")}
                />
                <span className="capitalize">{p}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Runtime — human-readable presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Duration</Label>
          <div className="flex gap-2 flex-wrap">
            {RUNTIME_PRESETS.map(({ label }) => (
              <button
                key={label}
                type="button"
                onClick={() => handlePreset(label)}
                aria-pressed={runtimePreset === label}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors h-8 font-medium",
                  runtimePreset === label
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mood — top 10 visible, expandable */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Mood</Label>
          <div className="flex flex-wrap gap-1.5">
            {visibleMoods.map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => {
                  toggleMood(mood);
                  const next = moods.includes(mood)
                    ? moods.filter((x) => x !== mood)
                    : [...moods, mood];
                  const chosen = RUNTIME_PRESETS.find((r) => r.label === runtimePreset)!;
                  onApply({ providers, moods: next, runtimeMin: chosen.min, runtimeMax: chosen.max });
                }}
                aria-pressed={moods.includes(mood)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors select-none h-7",
                  moods.includes(mood)
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <span>{getMoodEmoji(mood)}</span>
                <span className="capitalize">{mood}</span>
              </button>
            ))}
          </div>

          {/* Progressive disclosure: show/hide extra moods */}
          {MOOD_EXTRA.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllMoods((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {showAllMoods ? (
                <><ChevronUp className="w-3 h-3" /> Show fewer</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> {MOOD_EXTRA.length} more moods</>
              )}
            </button>
          )}
        </div>

        {/* Apply — retained for explicit apply on mobile; instant apply also fires above */}
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleApply} className="h-9">
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
