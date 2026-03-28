import { type RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { MissedSchedulesBanner } from "@/components/schedules/MissedSchedulesBanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Bookmark, Schedule } from "@/types/database";
import type { DecisionRail, RecommendationInsights } from "@/engine/decisionEngine";

type ScheduleWithBookmark = {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
};

interface DashboardShellProps {
  // View data
  heroBookmark: Bookmark | null;
  bestNextItem: Bookmark | null;
  nextReason: string | undefined;
  supportingRails: DecisionRail[];
  insights: RecommendationInsights;
  isEmpty: boolean;
  hasOnlyVaultedItems: boolean;
  vaultedBookmarks: Bookmark[];
  visibleBookmarks: Bookmark[];
  allScheduleMap: Record<string, Schedule>;
  missedSchedules: ScheduleWithBookmark[];
  streakCount: number;
  highlightBookmarkId: string | null;
  dismissedMissedBanner: boolean;
  // Demo state
  demoActive: boolean;
  demoLoading: boolean;
  demoInputValue: string;
  demoStep: number;
  // Refs
  watchNextRailRef: RefObject<HTMLDivElement | null>;
  upNextHighlightRef: RefObject<HTMLDivElement | null>;
  // Callbacks
  onPlay: () => void;
  onHeroSchedule: () => void;
  onHeroSkip: () => void;
  onMoreInfo: () => void;
  onKeepStreak: () => void;
  onSchedule: (bookmark: Bookmark) => void;
  onSkip: (bookmark: Bookmark) => void;
  onMarkDone: (bookmark: Bookmark) => void;
  onAddToPlan: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onUndoDone: (bookmark: Bookmark) => void;
  onSetWatching: (bookmark: Bookmark) => void;
  onStatusCycle: (bookmark: Bookmark, newStatus: string) => void;
  onEpisodeUpdate: (bookmark: Bookmark, count: number) => void;
  onToggleUpNext: (bookmark: Bookmark) => void;
  onSharePublic: (bookmark: Bookmark) => void;
  onSharePrivate: (bookmark: Bookmark) => void;
  onVault: (bookmark: Bookmark) => void;
  onUnvault: (bookmark: Bookmark) => void;
  onMissedScheduleSkip: (schedId: string) => void;
  onDismissMissedBanner: () => void;
  onDemoInputChange: (value: string) => void;
  onStartDemo: () => void;
}

function RevealSection({
  children,
  delayMs,
  className,
  sectionRef,
}: {
  children: React.ReactNode;
  delayMs: number;
  className?: string;
  sectionRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={sectionRef}
      className={cn("section-reveal is-visible", className)}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export function DashboardShell({
  heroBookmark,
  bestNextItem,
  nextReason,
  supportingRails,
  insights,
  isEmpty,
  hasOnlyVaultedItems,
  vaultedBookmarks,
  allScheduleMap,
  missedSchedules,
  streakCount,
  highlightBookmarkId,
  dismissedMissedBanner,
  demoActive,
  demoLoading,
  demoInputValue,
  demoStep,
  watchNextRailRef,
  upNextHighlightRef,
  onPlay,
  onHeroSchedule,
  onHeroSkip,
  onMoreInfo,
  onKeepStreak,
  onSchedule,
  onSkip,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
  onStatusCycle,
  onEpisodeUpdate,
  onToggleUpNext,
  onSharePublic,
  onSharePrivate,
  onVault,
  onUnvault,
  onMissedScheduleSkip,
  onDismissMissedBanner,
  onDemoInputChange,
  onStartDemo,
}: DashboardShellProps) {
  const navigate = useNavigate();

  const railHandlers = {
    onSchedule,
    onSkip,
    onMarkDone,
    onAddToPlan,
    onDelete,
    onUndoDone,
    onSetWatching,
    onStatusCycle,
    onEpisodeUpdate,
    onToggleUpNext,
    onSharePublic,
    onSharePrivate,
    onVault,
    onUnvault,
  };

  return (
    <div className="min-h-full bg-background pb-20 md:pb-0">
      {/* Hero Banner */}
      {heroBookmark && (
        <HeroBanner
          bookmark={heroBookmark}
          onPlay={onPlay}
          onSchedule={onHeroSchedule}
          onSkip={onHeroSkip}
          onMoreInfo={onMoreInfo}
          reason={bestNextItem ? nextReason : undefined}
          streakCount={streakCount}
          onKeepStreak={onKeepStreak}
        />
      )}

      {heroBookmark && (
        <div className="relative z-10 -mt-24 md:-mt-28 lg:-mt-32 h-24 md:h-28 lg:h-32 bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
      )}

      <div
        className={cn(
          "flex gap-0 relative",
          heroBookmark ? "-mt-16 md:-mt-20 lg:-mt-24 z-20" : "pt-[68px]",
        )}
      >
        <div className="flex-1 min-w-0 relative z-10 pb-16 space-y-3">
          <div className="space-y-3 animate-fade-in">
            {/* Missed schedules banner */}
            {missedSchedules.length > 0 && !dismissedMissedBanner && !demoActive && (
              <div className="px-4 sm:px-6 lg:px-8">
                <MissedSchedulesBanner
                  missed={missedSchedules}
                  onWatch={(bm) => navigate(`/b/${bm.id}`)}
                  onReschedule={onSchedule}
                  onSkip={onMissedScheduleSkip}
                  onDismiss={onDismissMissedBanner}
                />
              </div>
            )}

            {/* Watch This Next rail */}
            {bestNextItem && (
              <RevealSection delayMs={0} sectionRef={watchNextRailRef}>
                <Rail
                  title="Watch This Next"
                  subtitle={insights.timeSubtitle}
                  bookmarks={[bestNextItem]}
                  itemReasons={insights.reasons}
                  itemSchedules={allScheduleMap}
                  highlightBookmarkId={highlightBookmarkId ?? undefined}
                  cardSize="featured"
                  {...railHandlers}
                />
              </RevealSection>
            )}

            {/* Supporting rails */}
            {supportingRails.map((rail, index) => {
              const shouldHighlight = demoStep === 4 && index === 0;
              return (
                <RevealSection
                  key={rail.id}
                  delayMs={(index + 1) * 80}
                  sectionRef={shouldHighlight ? upNextHighlightRef : undefined}
                  className={cn(
                    shouldHighlight &&
                      "relative z-50 scale-[1.01] rounded-2xl ring-2 ring-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_40px_rgba(255,255,255,0.18)] transition-all",
                  )}
                >
                  <Rail
                    title={rail.title}
                    subtitle={rail.subtitle}
                    bookmarks={rail.bookmarks}
                    itemReasons={insights.reasons}
                    itemSchedules={allScheduleMap}
                    variant={rail.variant}
                    {...railHandlers}
                  />
                </RevealSection>
              );
            })}

            {/* Empty state */}
            {isEmpty && !hasOnlyVaultedItems && (
              <div className="px-4 sm:px-6 lg:px-8">
                <EmptyStateGuide
                  demoActive={demoActive}
                  demoLoading={demoLoading}
                  demoInputValue={demoInputValue}
                  onDemoInputChange={onDemoInputChange}
                  onStartDemo={onStartDemo}
                />
              </div>
            )}

            {/* Vault-only empty state */}
            {hasOnlyVaultedItems && (
              <div className="px-4 sm:px-6 lg:px-8 py-12">
                <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
                  <p className="text-lg font-semibold text-foreground mb-1">
                    Your dashboard is hidden by Vault
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {`You have 🔒 ${vaultedBookmarks.length} item${vaultedBookmarks.length === 1 ? "" : "s"} tucked away.`}
                  </p>
                  <Button asChild>
                    <Link to="/vault">Open Vault</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
