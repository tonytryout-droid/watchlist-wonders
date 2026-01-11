import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Film, Tv, Play, FileText, X } from "lucide-react";

type FilterType = "all" | "movie" | "series" | "video" | "doc";
type FilterStatus = "all" | "backlog" | "watching" | "done";

interface FilterChipsProps {
  activeType: FilterType;
  activeStatus: FilterStatus;
  onTypeChange: (type: FilterType) => void;
  onStatusChange: (status: FilterStatus) => void;
  counts: {
    movie: number;
    series: number;
    video: number;
    doc: number;
    backlog: number;
    watching: number;
    done: number;
  };
  className?: string;
}

export function FilterChips({
  activeType,
  activeStatus,
  onTypeChange,
  onStatusChange,
  counts,
  className,
}: FilterChipsProps) {
  const typeFilters = [
    { value: "all" as const, label: "All Types", icon: null },
    { value: "movie" as const, label: "Movies", icon: Film, count: counts.movie },
    { value: "series" as const, label: "Series", icon: Tv, count: counts.series },
    { value: "video" as const, label: "Videos", icon: Play, count: counts.video },
    { value: "doc" as const, label: "Documents", icon: FileText, count: counts.doc },
  ];

  const statusFilters = [
    { value: "all" as const, label: "All Status" },
    { value: "backlog" as const, label: "Backlog", count: counts.backlog },
    { value: "watching" as const, label: "Watching", count: counts.watching },
    { value: "done" as const, label: "Completed", count: counts.done },
  ];

  const hasActiveFilters = activeType !== "all" || activeStatus !== "all";

  const clearFilters = () => {
    onTypeChange("all");
    onStatusChange("all");
  };

  return (
    <div className={cn("container mx-auto px-4 lg:px-8", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((filter) => (
            <Badge
              key={filter.value}
              variant={activeType === filter.value ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:bg-primary/80",
                activeType === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent hover:bg-muted"
              )}
              onClick={() => onTypeChange(filter.value)}
            >
              {filter.icon && <filter.icon className="w-3 h-3 mr-1" />}
              {filter.label}
              {filter.count !== undefined && filter.count > 0 && (
                <span className="ml-1 opacity-70">({filter.count})</span>
              )}
            </Badge>
          ))}
        </div>

        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Badge
              key={filter.value}
              variant={activeStatus === filter.value ? "secondary" : "outline"}
              className={cn(
                "cursor-pointer transition-all",
                activeStatus === filter.value
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-transparent hover:bg-muted"
              )}
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label}
              {filter.count !== undefined && filter.count > 0 && (
                <span className="ml-1 opacity-70">({filter.count})</span>
              )}
            </Badge>
          ))}
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-destructive/20 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Badge>
        )}
      </div>
    </div>
  );
}
