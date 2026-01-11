import { Film, Clock, CheckCircle2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsBarProps {
  total: number;
  backlog: number;
  watching: number;
  done: number;
  totalMinutes: number;
  className?: string;
}

export function StatsBar({ total, backlog, watching, done, totalMinutes, className }: StatsBarProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const stats = [
    { label: "Total", value: total, icon: Film, color: "text-primary" },
    { label: "Backlog", value: backlog, icon: ListTodo, color: "text-chart-4" },
    { label: "Watching", value: watching, icon: Clock, color: "text-chart-2" },
    { label: "Completed", value: done, icon: CheckCircle2, color: "text-chart-3" },
  ];

  return (
    <div className={cn("container mx-auto px-4 lg:px-8", className)}>
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-lg bg-muted", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
        {totalMinutes > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{formatTime(totalMinutes)}</span> watched so far
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
