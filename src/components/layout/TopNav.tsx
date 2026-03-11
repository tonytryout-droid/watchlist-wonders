import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { useWatchStreak } from "@/hooks/useWatchStreak";
import { QuickAddBar } from "@/components/QuickAddBar";
import { BottomNav } from "@/components/layout/BottomNav";

interface TopNavProps {
  notificationCount?: number;
  onSearchClick?: () => void;
  /** Optional slot for left-side content (e.g. category filter tabs on Dashboard) */
  leftContent?: React.ReactNode;
}

export function TopNav({ notificationCount = 0, onSearchClick, leftContent }: TopNavProps) {
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const { streak } = useWatchStreak();
  const navigate = useNavigate();

  const handleMobileAdd = () => navigate("/new");

  return (
    <>
      <nav className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center gap-3 h-16 px-4 lg:px-6">

          {/* Left slot — category tabs or spacer */}
          <div className="flex-1 min-w-0">
            {leftContent ?? null}
          </div>

          {/* Search bar — Netflix-style pill input button */}
          <button
            type="button"
            onClick={onSearchClick}
            className="flex items-center gap-2.5 h-10 px-4 bg-wm-surface hover:bg-wm-surface-hover border border-border rounded-full text-sm text-muted-foreground transition-colors shrink-0 w-[180px] md:w-[260px]"
            aria-label="Search (⌘K)"
          >
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left truncate">Search here...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground shrink-0">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Add button */}
            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 rounded-full h-9 px-4"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-4" sideOffset={8}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Quick Add</p>
                    <button
                      type="button"
                      onClick={() => setAddPopoverOpen(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <QuickAddBar />
                  <div className="text-center pt-1">
                    <Link
                      to="/new"
                      onClick={() => setAddPopoverOpen(false)}
                      className="text-xs text-primary hover:underline"
                    >
                      Open full add page →
                    </Link>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Streak indicator */}
            {user && streak >= 2 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-orange-500 font-bold px-2 hover:text-orange-400"
                    aria-label={`${streak} day watch streak`}
                  >
                    🔥 {streak}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-4">
                  <p className="font-semibold text-sm mb-1">🔥 {streak}-day streak!</p>
                  <p className="text-xs text-muted-foreground">
                    You've watched something {streak} days in a row. Keep it up!
                  </p>
                  <Link to="/stats" className="text-xs text-primary hover:underline block mt-3">
                    View your stats →
                  </Link>
                </PopoverContent>
              </Popover>
            )}

            {/* Notifications bell */}
            <Link to="/notifications" className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label={
                  notificationCount > 0
                    ? `${notificationCount} unread notifications`
                    : "Notifications"
                }
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Avatar */}
            {user ? (
              <Link to="/settings">
                <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                  <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="secondary" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav — stays in TopNav so pages can pass onSearchClick */}
      {user && (
        <BottomNav onSearchClick={onSearchClick} onAddClick={handleMobileAdd} />
      )}
    </>
  );
}
