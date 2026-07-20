import { useQuery } from "@tanstack/react-query";
import { bookmarkService } from "@/services/bookmarks";
import { scheduleService } from "@/services/schedules";
import { watchPlanService } from "@/services/watchPlans";
import type { Bookmark } from "@/types/database";

export interface ScheduleWithBookmark {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
}

/**
 * Bundles the four primary Dashboard reads. Returning a stable shape makes it
 * straightforward to swap data sources later (demo dataset, server cache, etc.)
 * without touching the consumer.
 */
export function useDashboardQueries() {
  const bookmarks = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const upcomingSchedules = useQuery<ScheduleWithBookmark[]>({
    queryKey: ["schedules", "upcoming"],
    queryFn: () => scheduleService.getUpcomingSchedules(8),
    staleTime: 2 * 60 * 1000,
  });

  const missedSchedules = useQuery<ScheduleWithBookmark[]>({
    queryKey: ["schedules", "missed"],
    queryFn: () => scheduleService.getMissedSchedules(),
    staleTime: 5 * 60 * 1000,
  });

  const plans = useQuery({
    queryKey: ["watch-plans"],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  return {
    bookmarks,
    upcomingSchedules,
    missedSchedules,
    plans,
  };
}
