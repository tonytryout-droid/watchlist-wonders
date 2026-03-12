import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Plus, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { useWatchStreak } from "@/hooks/useWatchStreak";
import { QuickAddBar } from "@/components/QuickAddBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TopNavProps {
  notificationCount?: number;
  onSearchClick?: () => void;
  leftContent?: React.ReactNode;
}

const navLinks = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/plans", label: "My List" },
  { href: "/tonight", label: "Tonight's Pick" },
  { href: "/stats", label: "Stats" },
  { href: "/calendar", label: "Calendar" },
];

export function TopNav({ notificationCount = 0, onSearchClick, leftContent }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const { avatarUrl } = useAvatar();
  const { streak } = useWatchStreak();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Scroll detection — Netflix nav transitions from transparent to solid
  useEffect(() => {
    const scrollContainer = document.getElementById("main-scroll-container");
    const target = scrollContainer || window;

    const handleScroll = () => {
      const scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setScrolled(scrollY > 50);
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMobileAdd = () => navigate("/new");

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  const handleSearchIconClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      setSearchExpanded((v) => !v);
      if (!searchExpanded) setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-500",
          scrolled
            ? "bg-[#141414]"
            : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        )}
      >
        <div className="flex items-center h-[68px] px-4 md:px-8 lg:px-12 gap-6">

          {/* Logo */}
          <Link to="/dashboard" className="shrink-0 flex items-center gap-2">
            <span className="text-primary font-extrabold text-2xl tracking-tighter leading-none">
              W
            </span>
            <span className="hidden sm:block text-white font-bold text-lg tracking-tight">
              WatchMarks
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors rounded",
                  isActive(link.href, link.exact)
                    ? "text-white"
                    : "text-white/70 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile: Browse dropdown */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-white text-sm font-medium">
                  Browse <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#141414] border-white/10 w-48 max-w-[calc(100vw-2rem)]">
                {navLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      to={link.href}
                      className={cn(
                        "w-full text-sm",
                        isActive(link.href, link.exact) ? "text-white font-semibold" : "text-white/80"
                      )}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1 md:gap-2">

            {/* Search */}
            <div className="flex items-center">
              {searchExpanded && !onSearchClick ? (
                <div className="flex items-center gap-2 bg-black/60 border border-white/30 rounded px-3 py-1.5 backdrop-blur-sm">
                  <Search className="w-4 h-4 text-white/70 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Titles, people, genres"
                    className="bg-transparent text-white text-sm w-28 sm:w-40 outline-none placeholder:text-white/50"
                    onBlur={() => setSearchExpanded(false)}
                  />
                  <button onClick={() => setSearchExpanded(false)} className="text-white/70 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSearchIconClick}
                  className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  aria-label="Search (⌘K)"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Quick Add — desktop only */}
            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-white/80 hover:text-white transition-colors"
                  aria-label="Quick Add"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(96vw,24rem)] p-4 bg-[#1a1a1a] border-white/10" sideOffset={8}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Quick Add</p>
                    <button
                      type="button"
                      onClick={() => setAddPopoverOpen(false)}
                      className="text-white/50 hover:text-white transition-colors"
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
                  <button
                    className="hidden sm:flex w-10 h-10 items-center justify-center text-orange-400 font-bold text-sm hover:text-orange-300 transition-colors"
                    aria-label={`${streak} day watch streak`}
                  >
                    🔥{streak}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-4 bg-[#1a1a1a] border-white/10">
                  <p className="font-semibold text-sm mb-1 text-white">🔥 {streak}-day streak!</p>
                  <p className="text-xs text-white/60">
                    You've watched something {streak} days in a row. Keep it up!
                  </p>
                  <Link to="/stats" className="text-xs text-primary hover:underline block mt-3">
                    View your stats →
                  </Link>
                </PopoverContent>
              </Popover>
            )}

            {/* Notifications */}
            <Link
              to="/notifications"
              className="relative w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : "Notifications"}
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>

            {/* Avatar / Profile */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 group">
                    <Avatar className="h-8 w-8 cursor-pointer rounded">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary/80 text-white text-sm rounded">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-3 h-3 text-white/70 group-hover:text-white transition-all group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#1a1a1a] border-white/10">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="text-white/90 hover:text-white cursor-pointer">
                      Account & Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-white/70 hover:text-white cursor-pointer"
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="rounded">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      {user && (
        <BottomNav onSearchClick={onSearchClick} onAddClick={handleMobileAdd} />
      )}
    </>
  );
}
