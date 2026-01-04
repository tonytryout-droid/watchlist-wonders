import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Calendar, Clock, Tag, ChevronRight, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopNav } from "@/components/layout/TopNav";
import { cn, getMoodEmoji } from "@/lib/utils";
import type { WatchPlan } from "@/types/database";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Demo data
const demoPlans: WatchPlan[] = [
  {
    id: "plan1",
    user_id: "demo",
    name: "Weekend Binge",
    preferred_days: [5, 6], // Fri, Sat
    time_windows: [{ start: "19:00", end: "23:00" }],
    max_runtime_minutes: null,
    mood_tags: ["epic", "intense"],
    platforms_allowed: ["netflix", "imdb"],
    auto_suggest: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "plan2",
    user_id: "demo",
    name: "Quick Lunch Watch",
    preferred_days: [1, 2, 3, 4, 5], // Mon-Fri
    time_windows: [{ start: "12:00", end: "13:00" }],
    max_runtime_minutes: 45,
    mood_tags: ["fun", "relaxing", "comedy"],
    platforms_allowed: ["youtube"],
    auto_suggest: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "plan3",
    user_id: "demo",
    name: "Documentary Sundays",
    preferred_days: [0], // Sun
    time_windows: [{ start: "10:00", end: "12:00" }, { start: "20:00", end: "22:00" }],
    max_runtime_minutes: 120,
    mood_tags: ["educational", "thoughtful", "inspiring"],
    platforms_allowed: [],
    auto_suggest: true,
    created_at: new Date().toISOString(),
  },
];

const Plans = () => {
  const navigate = useNavigate();
  const [plans] = useState<WatchPlan[]>(demoPlans);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Watch Plans</h1>
            <p className="text-muted-foreground mt-1">
              Create custom viewing schedules tailored to your preferences
            </p>
          </div>
          <Button asChild>
            <Link to="/plans/new">
              <Plus className="w-4 h-4 mr-2" />
              New Plan
            </Link>
          </Button>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No plans yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first watch plan to get personalized suggestions
            </p>
            <Button asChild>
              <Link to="/plans/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Plan
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                to={`/plans/${plan.id}`}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {plan.name}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                {/* Preferred Days */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    {DAYS.map((day, i) => (
                      <span
                        key={day}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          plan.preferred_days.includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {day.charAt(0)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Time Windows */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {plan.time_windows.map((tw) => `${tw.start}-${tw.end}`).join(", ")}
                  </span>
                </div>

                {/* Runtime Limit */}
                {plan.max_runtime_minutes && (
                  <div className="text-sm text-muted-foreground mb-3">
                    Max {plan.max_runtime_minutes} min
                  </div>
                )}

                {/* Mood Tags */}
                {plan.mood_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {plan.mood_tags.slice(0, 4).map((mood) => (
                      <Badge key={mood} variant="outline" className="text-xs">
                        {getMoodEmoji(mood)} {mood}
                      </Badge>
                    ))}
                    {plan.mood_tags.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{plan.mood_tags.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Plans;
