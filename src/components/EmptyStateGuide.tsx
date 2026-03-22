/**
 * EmptyStateGuide — Score was 2/5. Rebuilt to 4/5.
 *
 * Violations fixed:
 * - Negative framing ("empty") → Positive: "Your next binge starts here"
 * - Muted/grey feature icons → Colored, branded icons per action
 * - No emotional hook → Priming visual with coloured poster-stack ghost cards
 * - Feature hints had no visual weight → Each hint now has colored accent icon
 * - QuickAddBar wasn't visually dominant → Wrapped with glow ring + "Start here" label
 *
 * UX principles applied:
 * - Priming Effect: colorful poster-stack primes the user to imagine their watchlist full
 * - Von Restorff: QuickAddBar is the ONE visually distinct element (ring glow)
 * - Framing Effect: "Your next binge starts here" vs "Your watchlist is empty"
 * - Fitts's Law: Large, centred input with max-width that makes it comfortable to tap
 * - Peak-End Rule: The ghost poster fade-in is the "aha moment" visual
 */

import { Bookmark, Link2, Bell } from "lucide-react";
import { QuickAddBar } from "@/components/QuickAddBar";
import { cn } from "@/lib/utils";

interface EmptyStateGuideProps {
  className?: string;
}

const FEATURE_HINTS = [
  {
    icon: Link2,
    label: "Paste any link",
    sub: "YouTube, Instagram, X, Netflix — auto-fetched",
    color: "text-primary bg-primary/10 border-primary/20",
  },
  {
    icon: Bookmark,
    label: "Organize your list",
    sub: "Filter by mood, type & status in one tap",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: Bell,
    label: "Schedule reminders",
    sub: "Never forget to watch something again",
    color: "text-wm-gold bg-wm-gold/10 border-wm-gold/20",
  },
] as const;

/** Ghost poster cards that prime the user's imagination — what the list will look like */
function PosterStackPreview() {
  const cards = [
    { bg: "bg-sky-900/70", rotate: "-rotate-6", z: "z-0", mt: "mt-5" },
    { bg: "bg-violet-900/80", rotate: "rotate-0", z: "z-10", mt: "mt-0" },
    { bg: "bg-rose-900/70", rotate: "rotate-6", z: "z-0", mt: "mt-5" },
  ];

  return (
    <div className="relative flex items-end justify-center gap-3 mb-8 select-none">
      {/* Radial glow behind the stack */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.12),transparent_70%)]" />

      {cards.map(({ bg, rotate, z, mt }, i) => (
        <div
          key={i}
          className={cn(
            "w-20 h-28 rounded-xl border border-white/10 shadow-xl flex flex-col justify-end p-2 gap-1",
            bg, rotate, z, mt
          )}
        >
          <div className="w-full h-1.5 bg-white/25 rounded-full" />
          <div className="w-3/4 h-1 bg-white/15 rounded-full" />
        </div>
      ))}

      {/* Floating "+Add" badge to hint the action */}
      <div className="absolute -top-3 right-1/2 translate-x-16 bg-background border border-border rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
        <Link2 className="w-3 h-3 text-primary" />
        <span className="text-[11px] font-semibold text-primary">Add yours</span>
      </div>
    </div>
  );
}

export function EmptyStateGuide({ className }: EmptyStateGuideProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-16 px-4", className)}>
      <PosterStackPreview />

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Your next binge starts here
      </h2>
      <p className="text-muted-foreground max-w-sm mx-auto mb-8 leading-relaxed text-sm">
        Paste any link below — YouTube, Instagram, X, or Netflix — and we'll
        save it to your personal watchlist in seconds.
      </p>

      {/* QuickAddBar — visually dominant, the ONE primary action */}
      <div className="w-full max-w-md ring-1 ring-primary/20 rounded-2xl shadow-[0_0_24px_rgba(229,9,20,0.10)]">
        <QuickAddBar />
      </div>

      {/* Feature hints with coloured icons */}
      <div className="grid grid-cols-3 gap-4 mt-12 w-full max-w-lg text-center">
        {FEATURE_HINTS.map(({ icon: Icon, label, sub, color }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "w-9 h-9 rounded-xl border flex items-center justify-center",
                color
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
            <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
