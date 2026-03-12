import { Link, useLocation } from "react-router-dom";
import { Home, Search, Plus, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onSearchClick?: () => void;
  onAddClick?: () => void;
}

export function BottomNav({ onSearchClick, onAddClick }: BottomNavProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[#141414]/98 border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around h-14 px-2">

        {/* Home */}
        <Link
          to="/dashboard"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center transition-colors",
            isActive("/dashboard") ? "text-white" : "text-white/50 hover:text-white/80"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Search */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center text-white/50 hover:text-white/80 transition-colors"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium">Search</span>
        </button>

        {/* Add */}
        <button
          type="button"
          onClick={onAddClick}
          className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center text-white/50 hover:text-white/80 transition-colors"
        >
          <div className="w-8 h-8 rounded bg-white/10 border border-white/20 flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-medium">Add</span>
        </button>

        {/* Stats */}
        <Link
          to="/stats"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center transition-colors",
            isActive("/stats") ? "text-white" : "text-white/50 hover:text-white/80"
          )}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Stats</span>
        </Link>

        {/* Profile */}
        <Link
          to="/settings"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center transition-colors",
            isActive("/settings") ? "text-white" : "text-white/50 hover:text-white/80"
          )}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Me</span>
        </Link>
      </div>
    </nav>
  );
}
