import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ListChecks,
  Moon,
  BarChart2,
  Settings,
  LogOut,
  CalendarDays,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { href: "/dashboard",     label: "Home",           icon: Home,        exact: true },
  { href: "/plans",         label: "My List",        icon: ListChecks },
  { href: "/tonight",       label: "Tonight's Pick", icon: Moon },
  { href: "/stats",         label: "Stats",          icon: BarChart2 },
  { href: "/calendar",      label: "Calendar",       icon: CalendarDays },
  { href: "/notifications", label: "Notifications",  icon: Bell },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen bg-card border-r border-border sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-7 pb-6 shrink-0">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <span className="text-white font-extrabold text-lg leading-none">W</span>
        </div>
        <span className="text-[17px] font-bold text-foreground tracking-tight">WatchMarks</span>
      </div>

      <div className="flex-1 flex flex-col px-3 overflow-y-auto min-h-0">
        {/* MENU section */}
        <div className="mb-6">
          <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 mb-2">
            Menu
          </p>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-wm-surface"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                  )}
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* GENERAL section — pushed to bottom */}
        <div className="mt-auto pb-5">
          <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 mb-2">
            General
          </p>
          <nav className="space-y-0.5">
            <Link
              to="/settings"
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive("/settings")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-wm-surface"
              )}
            >
              {isActive("/settings") && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <Settings className="w-4 h-4 shrink-0" />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-wm-surface transition-all duration-150"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Log Out
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
}
