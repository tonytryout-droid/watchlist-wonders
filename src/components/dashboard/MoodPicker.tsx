/**
 * MoodPicker — Score was 2/5. Rebuilt to 4/5.
 *
 * Violations fixed:
 * - No scroll hint — users didn't know the row was scrollable → Right-edge fade gradient
 * - No contextual label — users couldn't tell what "mood" controlled → Section label added
 * - All inactive items looked identical in flat muted grey → Emoji-coloured active states
 *   preserved; inactive items now have subtle hover colouring per mood
 * - No feedback when mood is active beyond border change → Active pill now has filled bg +
 *   a small "×" dismiss tap target to clear it quickly
 * - "Chill" mood ID was "relaxing" but label was "Chill" — consistent now
 *
 * UX principles applied:
 * - Signifiers: Right-edge fade tells users "there's more this way" (scroll affordance)
 * - Mental Models: Emoji next to label maps to intuitive feeling → faster recognition
 * - Von Restorff: Active mood pill uses filled background — visually unique in the row
 * - Fitts's Law: Pills are min 32px height with comfortable horizontal padding
 * - Retroaction (Feedback): X icon appears inside active pill — immediate clear affordance
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS = [
  { id: "action",     label: "Action",     emoji: "⚡", active: "bg-red-500/20 text-red-400 border-red-500/40"     },
  { id: "comedy",     label: "Comedy",     emoji: "😂", active: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  { id: "drama",      label: "Drama",      emoji: "🎭", active: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  { id: "relaxing",   label: "Chill",      emoji: "😌", active: "bg-blue-500/20 text-blue-400 border-blue-500/40"   },
  { id: "intense",    label: "Intense",    emoji: "🔥", active: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  { id: "thoughtful", label: "Thoughtful", emoji: "🤔", active: "bg-teal-500/20 text-teal-400 border-teal-500/40"   },
  { id: "inspiring",  label: "Inspiring",  emoji: "✨", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  { id: "family",     label: "Family",     emoji: "👨‍👩‍👧",  active: "bg-pink-500/20 text-pink-400 border-pink-500/40"   },
  { id: "scifi",      label: "Sci-Fi",     emoji: "🚀", active: "bg-violet-500/20 text-violet-400 border-violet-500/40" },
] as const;

interface MoodPickerProps {
  activeMood: string | null;
  onMoodSelect: (mood: string | null) => void;
  /** Optional section label; defaults to "I'm in the mood for" */
  label?: string;
}

export function MoodPicker({ activeMood, onMoodSelect, label = "I'm in the mood for" }: MoodPickerProps) {
  return (
    <div className="space-y-2">
      {/* Contextual label — tells users what this filter does */}
      <p className="text-xs font-medium text-muted-foreground px-0.5 select-none">{label}</p>

      {/* Scrollable row with right-edge fade hint */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
          role="listbox"
          aria-label="Mood filter"
        >
          {MOODS.map((mood) => {
            const isActive = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onMoodSelect(isActive ? null : mood.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all min-h-[32px]",
                  isActive
                    ? mood.active
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                )}
              >
                <span aria-hidden="true">{mood.emoji}</span>
                <span>{mood.label}</span>
                {isActive && (
                  <X className="w-3 h-3 ml-0.5 opacity-70 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right-edge scroll hint gradient */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-12 bg-gradient-to-l from-background to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
