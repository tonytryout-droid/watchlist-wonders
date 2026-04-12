import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X, ChevronDown, Sparkles, Loader2, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatar } from "@/hooks/useAvatar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/config/features";

interface TopNavProps {
  notificationCount?: number;
  onSearchClick?: () => void;
  leftContent?: React.ReactNode;
  vaultedCount?: number;
}

const secondaryLinks = [
  { href: "/dashboard", label: "Home", exact: true, enabled: true },
  { href: "/vault", label: "Vault", enabled: FEATURES.vault },
  { href: "/tonight", label: "Tonight's Pick", enabled: FEATURES.tonightPick },
  { href: "/stats", label: "Stats", enabled: FEATURES.stats },
  { href: "/activity", label: "Activity", enabled: FEATURES.activityLog },
  { href: "/calendar", label: "Calendar", enabled: FEATURES.scheduling },
  { href: "/notifications", label: "Notifications", enabled: FEATURES.notifications },
].filter((link) => link.enabled);

export function TopNav({ notificationCount = 0, onSearchClick, leftContent, vaultedCount = 0 }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const { avatarUrl } = useAvatar();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let activeTarget: Window | HTMLElement | null = null;

    const getScrollTarget = (): Window | HTMLElement => {
      const scrollContainer = document.getElementById("main-scroll-container");
      const canUseContainerScroll =
        !!scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1;
      return canUseContainerScroll ? scrollContainer : window;
    };

    const handleScroll = () => {
      const target = activeTarget ?? getScrollTarget();
      const scrollY = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      setScrolled(scrollY > 24);
    };

    const rebindScrollTarget = () => {
      const nextTarget = getScrollTarget();
      if (activeTarget !== nextTarget) {
        if (activeTarget) {
          activeTarget.removeEventListener("scroll", handleScroll);
        }
        activeTarget = nextTarget;
        activeTarget.addEventListener("scroll", handleScroll, { passive: true });
      }
      handleScroll();
    };

    rebindScrollTarget();
    window.addEventListener("resize", rebindScrollTarget);
    return () => {
      if (activeTarget) {
        activeTarget.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", rebindScrollTarget);
    };
  }, []);

  const handleMobileAdd = () => navigate("/new");

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      toast({ title: "Error signing out", variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSearchIconClick = () => {
    if (onSearchClick) {
      onSearchClick();
      return;
    }
    setSearchExpanded((value) => !value);
    if (!searchExpanded) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const openPickForMe = () => {
    navigate("/dashboard?decision=1");
  };

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-out",
          scrolled
            ? "bg-black/90 supports-[backdrop-filter]:bg-black/70 backdrop-blur-md border-b border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-black/85 via-black/45 to-transparent",
        )}
      >
        <div className="flex items-center h-[68px] px-4 md:px-8 lg:px-12 gap-3 md:gap-4">
          <Link to="/dashboard" className="shrink-0 flex items-center gap-2">
            <span className="text-primary font-black text-[1.7rem] leading-none tracking-tight">W</span>
            <span className="hidden sm:block text-white font-semibold text-base md:text-lg tracking-tight">WatchMarks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2" aria-label="Main navigation">
            {FEATURES.watchPlans && (
              <Link
                to="/plans"
                aria-current={isActive("/plans") ? "page" : undefined}
                className={cn(
                  "px-3 py-2 rounded text-sm transition-colors",
                  isActive("/plans") ? "text-white font-semibold" : "text-white/70 hover:text-white",
                )}
              >
                My List
              </Link>
            )}

            <Button
              type="button"
              onClick={openPickForMe}
              className="h-10 px-4 text-sm font-semibold rounded-md"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Pick for Me
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/new")}
              className="h-10 px-4 text-sm font-semibold rounded-md border-white/20 text-white hover:text-white hover:bg-white/10"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-2 rounded text-sm text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Browse pages"
                >
                  Browse <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-background border-white/10 w-52">
                {secondaryLinks.map((link) => {
                  const active = isActive(link.href, link.exact);
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        to={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "w-full text-sm flex items-center justify-between",
                          active ? "text-white font-semibold" : "text-white/80",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {link.label}
                          {link.href === "/vault" && vaultedCount > 0 && (
                            <span className="rounded-full bg-wm-gold px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
                              {vaultedCount}
                            </span>
                          )}
                          {link.href === "/notifications" && notificationCount > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {notificationCount > 99 ? "99+" : notificationCount}
                            </span>
                          )}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex-1">{leftContent}</div>

          <div className="md:hidden flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={openPickForMe}
              className="h-9 px-3 text-xs font-semibold rounded-md"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Pick for Me
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-white/90 text-sm font-medium"
                  aria-label="Browse pages"
                >
                  Browse <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-background border-white/10 w-52">
                {FEATURES.watchPlans && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/plans" className="w-full text-sm flex items-center justify-between">
                        <span>My List</span>
                        {isActive("/plans") && <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {secondaryLinks.map((link) => {
                  const active = isActive(link.href, link.exact);
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        to={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "w-full text-sm flex items-center justify-between",
                          active ? "text-white font-semibold" : "text-white/80",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {link.label}
                          {link.href === "/vault" && vaultedCount > 0 && (
                            <span className="rounded-full bg-wm-gold px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
                              {vaultedCount}
                            </span>
                          )}
                          {link.href === "/notifications" && notificationCount > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {notificationCount > 99 ? "99+" : notificationCount}
                            </span>
                          )}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden md:flex items-center gap-1 md:gap-2">
            <div className="flex items-center">
              {searchExpanded && !onSearchClick ? (
                <div className="flex items-center gap-2 bg-black/60 border border-white/30 rounded px-3 py-1.5 backdrop-blur-sm">
                  <Search className="w-4 h-4 text-white/70 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Titles, people, genres"
                    className="bg-transparent text-white text-sm w-40 outline-none placeholder:text-white/50"
                    onKeyDown={(e) => { if (e.key === "Escape") setSearchExpanded(false); }}
                  />
                  <button
                    type="button"
                    onClick={() => setSearchExpanded(false)}
                    aria-label="Close search"
                    className="text-white/70 hover:text-white min-w-[28px] min-h-[28px] flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSearchIconClick}
                  className="w-10 h-10 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Search (Ctrl+K)"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

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
                <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="text-white/90 hover:text-white cursor-pointer">
                      Account & Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-white/70 hover:text-white cursor-pointer"
                  >
                    {isSigningOut ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      "Sign Out"
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="rounded">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {user && (
        <BottomNav onSearchClick={onSearchClick} onAddClick={handleMobileAdd} />
      )}
    </>
  );
}
