import { useMemo } from "react";
import { buildDecisionSnapshot } from "@/engine/decisionEngine";
import type { Bookmark } from "@/types/database";
import type { DecisionRail, RecommendationInsights } from "@/engine/decisionEngine";

export interface UpcomingScheduleSignal {
  bookmarkId: string;
  scheduledFor: string;
}

interface DashboardViewOptions {
  allBookmarks: Bookmark[];
  upcomingSchedules: UpcomingScheduleSignal[];
  now: Date;
  maxRails?: number;
}

export interface DashboardView {
  heroBookmark: Bookmark | null;
  bestNextItem: Bookmark | null;
  nextReason: string | undefined;
  supportingRails: DecisionRail[];
  insights: RecommendationInsights;
  isEmpty: boolean;
  hasOnlyVaultedItems: boolean;
  vaultedBookmarks: Bookmark[];
  visibleBookmarks: Bookmark[];
}

const MAX_RAILS = 4;

export function useDashboardView({
  allBookmarks,
  upcomingSchedules,
  now,
  maxRails = MAX_RAILS,
}: DashboardViewOptions): DashboardView {
  const vaultedBookmarks = useMemo(
    () => allBookmarks.filter((b) => b.is_vaulted),
    [allBookmarks],
  );

  const visibleBookmarks = useMemo(
    () => allBookmarks.filter((b) => !b.is_vaulted),
    [allBookmarks],
  );

  const decisionSnapshot = useMemo(
    () =>
      buildDecisionSnapshot(visibleBookmarks, {
        now,
        maxRails,
        upcomingSchedules,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleBookmarks, now, upcomingSchedules, maxRails],
  );

  const bestNextItem = decisionSnapshot.bestNext;

  const continueWatching = useMemo(
    () => visibleBookmarks.filter((b) => b.status === "watching"),
    [visibleBookmarks],
  );

  const heroBookmark = bestNextItem ?? continueWatching[0] ?? null;
  const nextReason = bestNextItem
    ? decisionSnapshot.insights.reasons[bestNextItem.id]
    : undefined;

  const supportingRails = useMemo((): DecisionRail[] => {
    if (!bestNextItem) return decisionSnapshot.rails;
    return decisionSnapshot.rails
      .map((rail) => ({
        ...rail,
        bookmarks: rail.bookmarks.filter((b) => b.id !== bestNextItem.id),
      }))
      .filter((rail) => {
        const minSize =
          rail.id === "continue-watching" || rail.id === "planned" ? 1 : 2;
        return rail.bookmarks.length >= minSize;
      });
  }, [decisionSnapshot.rails, bestNextItem]);

  return {
    heroBookmark,
    bestNextItem,
    nextReason,
    supportingRails,
    insights: decisionSnapshot.insights,
    isEmpty: visibleBookmarks.length === 0,
    hasOnlyVaultedItems: visibleBookmarks.length === 0 && vaultedBookmarks.length > 0,
    vaultedBookmarks,
    visibleBookmarks,
  };
}
