import { Bookmark, Link2, Bell } from "lucide-react";
import { QuickAddBar } from "@/components/QuickAddBar";

interface EmptyStateGuideProps {
  className?: string;
}

export function EmptyStateGuide({ className }: EmptyStateGuideProps) {
  return (
    <div className={`flex flex-col items-center text-center py-20 px-4 ${className ?? ""}`}>
      {/* Icon cluster */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-wm-surface border border-border flex items-center justify-center mx-auto">
          <Bookmark className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-wm-surface border border-border flex items-center justify-center">
          <Link2 className="w-4 h-4 text-primary" />
        </div>
        <div className="absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-wm-surface border border-border flex items-center justify-center">
          <Bell className="w-4 h-4 text-wm-gold" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Your watchlist is empty</h2>
      <p className="text-muted-foreground max-w-sm mx-auto mb-10 leading-relaxed">
        Paste a link from YouTube, Instagram, Facebook, or X below — we'll save it to your watchlist automatically.
      </p>

      {/* QuickAddBar embedded */}
      <div className="w-full max-w-md">
        <QuickAddBar />
      </div>

      {/* Feature hints */}
      <div className="grid grid-cols-3 gap-4 mt-12 w-full max-w-lg text-center">
        {[
          { icon: Link2,    label: "Paste any social link",    sub: "Auto-fetch details" },
          { icon: Bookmark, label: "Organize your list",       sub: "Filter by mood & type" },
          { icon: Bell,     label: "Schedule reminders",       sub: "Never forget to watch" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-wm-surface border border-border flex items-center justify-center">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
