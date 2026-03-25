import { useState } from "react";
import { HelpCircle, X, Link2, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Link2,
    color: "text-primary bg-primary/10",
    title: "Paste a link",
    detail: "Copy any link from TikTok, YouTube, IMDb, or anywhere. We find the movie automatically.",
  },
  {
    icon: Layers,
    color: "text-emerald-400 bg-emerald-400/10",
    title: "It saves to your list",
    detail: "Your list is organized into rows — what you're watching, what you haven't started, and picks by mood.",
  },
  {
    icon: Sparkles,
    color: "text-wm-gold bg-wm-gold/10",
    title: "We tell you what to watch",
    detail: "Hit 'Pick for me' and we suggest the best thing from your list based on your time and mood.",
  },
];

export function HowItWorksButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 md:bottom-6 z-40",
          "flex items-center gap-1.5 px-3 py-2 rounded-full",
          "bg-wm-surface border border-border shadow-lg",
          "text-xs text-muted-foreground hover:text-foreground transition-colors"
        )}
        aria-label="How this works"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">How this works</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm bg-wm-surface border border-border rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-foreground">How WatchMarks works</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-4">
              {STEPS.map(({ icon: Icon, color, title, detail }, i) => (
                <div key={i} className="flex gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
