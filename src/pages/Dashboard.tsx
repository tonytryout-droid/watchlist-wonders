import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { DecisionMode } from "@/components/bookmarks/DecisionMode";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { DashboardTour } from "@/components/onboarding/DashboardTour";
import { WelcomeFlow, type OnboardingSuggestion } from "@/components/onboarding/WelcomeFlow";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { CompletionSheet } from "@/components/bookmarks/CompletionSheet";
import { bookmarkService } from "@/services/bookmarks";
import { queueService } from "@/services/queue";
import { scheduleService } from "@/services/schedules";
import { ScheduleDialog } from "@/components/schedules/ScheduleDialog";
import { MissedSchedulesBanner } from "@/components/schedules/MissedSchedulesBanner";
import { watchPlanService } from "@/services/watchPlans";
import { sharingService } from "@/services/sharing";
import { socialService } from "@/services/social";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/errorMessage";
import { buildDecisionSnapshot } from "@/engine/decisionEngine";
import { buildDemoDataset } from "@/engine/demoData";
import { useWatchStreak } from "@/hooks/useWatchStreak";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Bookmark, Schedule } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DecisionIntentSeed = "quick" | "deep" | "random" | "continue";
type ScheduleWithBookmark = {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
};

const DEMO_URL = "https://tiktok.com/@user/video/demo";
const WELCOME_FLOW_KEY_PREFIX = "ww_welcome_flow_v1_";
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;
const MAX_SUPPORTING_RAILS = 4;
const INTENT_VALUES: DecisionIntentSeed[] = ["quick", "deep", "random", "continue"];

function parseIntentParam(intentParam: string | null): DecisionIntentSeed | null {
  if (!intentParam) return null;
  return INTENT_VALUES.includes(intentParam as DecisionIntentSeed) ? (intentParam as DecisionIntentSeed) : null;
}

function buildDemoBookmark(): Bookmark {
  const now = new Date().toISOString();
  return {
    id: "demo-1",
    user_id: "demo",
    title: "Inception",
    type: "movie",
    provider: "tiktok",
    source_url: DEMO_URL,
    canonical_url: DEMO_URL,
    platform_label: "TikTok",
    status: "backlog",
    runtime_minutes: 148,
    release_year: 2010,
    poster_url: null,
    backdrop_url: null,
    tags: ["demo"],
    mood_tags: ["mind-bending", "thriller"],
    notes: "Saved from a short clip.",
    metadata: { isDemo: true },
    last_shown_at: null,
    shown_count: 0,
    created_at: now,
    updated_at: now,
    priority: 200,
    queue_status: "up_next",
    progress_percent: 0,
  };
}

function DemoTooltip({ message }: { message: string }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-black px-4 py-2 text-sm text-white shadow-2xl">
      {message}
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showTour, dismissTour } = useDashboardTour();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [completionBookmark, setCompletionBookmark] = useState<Bookmark | null>(null);
  const [completionSheetOpen, setCompletionSheetOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // Decision Mode + Intent
  const [decisionModeOpen, setDecisionModeOpen] = useState(false);
  const [decisionSeedIntent, setDecisionSeedIntent] = useState<DecisionIntentSeed | null>(null);

  // Missed banner state
  const [dismissedMissedBanner, setDismissedMissedBanner] = useState(false);

  // Local demo flow state
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoItem, setDemoItem] = useState<Bookmark | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoInputValue, setDemoInputValue] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [highlightBookmarkId, setHighlightBookmarkId] = useState<string | null>(null);
  const [welcomeFlowDismissed, setWelcomeFlowDismissed] = useState(true);
  const [welcomeFlowActive, setWelcomeFlowActive] = useState(false);
  const accountCreationTime = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getTime()
    : null;
  const isNewAccount =
    accountCreationTime !== null && Date.now() - accountCreationTime <= NEW_ACCOUNT_WINDOW_MS;

  const { toast } = useToast();
  const { streak } = useWatchStreak();
  const queryClient = useQueryClient();
  const demoRunIdRef = useRef(0);
  const demoTimeoutsRef = useRef<number[]>([]);
  const upNextHighlightRef = useRef<HTMLDivElement | null>(null);
  const watchNextRailRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFocusedWatchNextRef = useRef(false);

  // Fetch bookmarks
  const { data: bookmarksData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  // Fetch upcoming schedules for "Planned" rail + schedule badges
  const { data: upcomingSchedules = [] } = useQuery({
    queryKey: ['schedules', 'upcoming'],
    queryFn: () => scheduleService.getUpcomingSchedules(8),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch missed schedules for the recovery banner
  const { data: missedSchedules = [] } = useQuery<ScheduleWithBookmark[]>({
    queryKey: ['schedules', 'missed'],
    queryFn: () => scheduleService.getMissedSchedules(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch watch plans for the "Add to Plan" dialog
  const { data: plans = [] } = useQuery({
    queryKey: ['watch-plans'],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  const demoDataset = useMemo(() => buildDemoDataset(now), [now]);
  const demoScheduleCards: ScheduleWithBookmark[] = useMemo(
    () =>
      demoDataset.schedules.map((schedule) => ({
        id: `demo-schedule-${schedule.bookmarkId}`,
        bookmark_id: schedule.bookmarkId,
        scheduled_for: schedule.scheduledFor,
        bookmarks: demoDataset.bookmarks.find((bookmark) => bookmark.id === schedule.bookmarkId) ?? null,
      })),
    [demoDataset.bookmarks, demoDataset.schedules],
  );
  const upcomingSchedulesForDisplay: ScheduleWithBookmark[] = demoActive
    ? demoScheduleCards
    : (upcomingSchedules as ScheduleWithBookmark[]);

  // Map of bookmarkId -> schedule for card badges
  const allScheduleMap = useMemo((): Record<string, Schedule> => {
    const map: Record<string, Schedule> = {};
    for (const s of upcomingSchedulesForDisplay) {
      if (!map[s.bookmark_id]) map[s.bookmark_id] = s as Schedule;
    }
    return map;
  }, [upcomingSchedulesForDisplay]);

  const allBookmarks = useMemo(() => {
    if (demoActive) {
      const base = demoDataset.bookmarks;
      if (!demoItem) return base;
      return [demoItem, ...base.filter((bookmark) => bookmark.id !== demoItem.id)];
    }
    return bookmarksData;
  }, [demoActive, demoDataset.bookmarks, demoItem, bookmarksData]);
  const vaultedBookmarks = useMemo(
    () => allBookmarks.filter((bookmark) => bookmark.is_vaulted),
    [allBookmarks],
  );
  const bookmarks = useMemo(
    () => allBookmarks.filter((bookmark) => !bookmark.is_vaulted),
    [allBookmarks],
  );

  const clearDemoTimers = useCallback(() => {
    demoTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    demoTimeoutsRef.current = [];
  }, []);

  const delay = useCallback((ms: number) => new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      demoTimeoutsRef.current = demoTimeoutsRef.current.filter((activeId) => activeId !== timeoutId);
      resolve();
    }, ms);
    demoTimeoutsRef.current.push(timeoutId);
  }), []);

  const endDemo = useCallback(() => {
    window.localStorage.setItem("seen_demo", "true");
    demoRunIdRef.current += 1;
    clearDemoTimers();
    setDemoActive(false);
    setDemoStep(0);
    setDemoItem(null);
    setDemoLoading(false);
    setDemoInputValue("");
  }, [clearDemoTimers]);

  const startDemo = useCallback(async () => {
    window.localStorage.setItem("seen_demo", "true");
    const runId = demoRunIdRef.current + 1;
    demoRunIdRef.current = runId;
    clearDemoTimers();

    setDecisionModeOpen(false);
    setDecisionSeedIntent(null);
    setScheduleOpen(false);
    setPlanOpen(false);
    setSelectedBookmark(null);
    setDemoActive(true);
    setDemoStep(1);
    setDemoItem(null);
    setDemoLoading(false);
    setDemoInputValue(DEMO_URL);

    await delay(800);
    if (demoRunIdRef.current !== runId) return;

    setDemoStep(2);
    setDemoLoading(true);

    await delay(1200);
    if (demoRunIdRef.current !== runId) return;

    setDemoLoading(false);
    setDemoItem(buildDemoBookmark());
    setDemoStep(3);

    await delay(1200);
    if (demoRunIdRef.current !== runId) return;

    setDemoStep(4);
  }, [clearDemoTimers, delay]);

  // Mark as done mutation
  const markDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'done'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'done' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: (_, id) => {
      const completed = queryClient.getQueryData<Bookmark[]>(['bookmarks'])?.find((b) => b.id === id);
      if (completed) {
        setCompletionBookmark(completed);
        setCompletionSheetOpen(true);
      }
      toast({
        title: "Marked as done!",
        description: "Moved to your watched list.",
        action: (
          <ToastAction altText="Undo" onClick={() => undoDoneMutation.mutate(id)}>
            Undo
          </ToastAction>
        ),
      });
    },
  });

  // Rate a completed bookmark (from CompletionSheet)
  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, review, watchedWith }: { id: string; rating: number | undefined; review?: string; watchedWith?: string | null }) => {
      const tasks: Promise<unknown>[] = [];
      if (rating != null && rating > 0) tasks.push(bookmarkService.rateBookmark(id, rating, review));
      if (watchedWith) {
        const existing = queryClient.getQueryData<Bookmark[]>(['bookmarks'])?.find((b) => b.id === id)?.metadata ?? {};
        tasks.push(bookmarkService.updateBookmark(id, { metadata: { ...existing, watched_with: watchedWith } }));
      }
      await Promise.all(tasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  // Undo done mutation (move back to backlog)
  const undoDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'backlog'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'backlog' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: () => {
      toast({ title: "Added back to your list", description: "Ready to watch when you are." });
    },
  });

  // Set as watching mutation
  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'watching'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'watching' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: () => {
      toast({ title: "Now watching!", description: "Added to Continue Watching." });
    },
  });

  // Undo delete â€" recreate the bookmark with its original data
  const handleUndoDelete = (bookmark: Bookmark) => {
    bookmarkService.createBookmark({
      title: bookmark.title,
      type: bookmark.type,
      provider: bookmark.provider,
      source_url: bookmark.source_url,
      canonical_url: bookmark.canonical_url,
      platform_label: bookmark.platform_label,
      status: bookmark.status,
      runtime_minutes: bookmark.runtime_minutes,
      release_year: bookmark.release_year,
      poster_url: bookmark.poster_url,
      backdrop_url: bookmark.backdrop_url,
      tags: bookmark.tags,
      mood_tags: bookmark.mood_tags,
      notes: bookmark.notes,
      metadata: bookmark.metadata,
    }).then((newBookmark) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Restored",
        description: `"${newBookmark.title}" has been restored to your watchlist.`,
      });
    }).catch((error: any) => {
      toast({
        title: "Error restoring bookmark",
        description: getSafeErrorMessage(error, "Failed to restore the bookmark. Please try again."),
        variant: "destructive",
      });
    });
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (bookmark: Bookmark) => bookmarkService.deleteBookmark(bookmark.id),
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.filter((b) => b.id !== bookmark.id)
      );
      return { prev };
    },
    onError: (error: any, _, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
      toast({
        title: "Error deleting",
        description: getSafeErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: (_, bookmark) => {
      toast({
        title: "Deleted",
        description: `"${bookmark.title}" removed.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndoDelete(bookmark)}>
            Undo
          </ToastAction>
        ),
      });
    },
  });

  // Add to plan mutation
  const addToPlanMutation = useMutation({
    mutationFn: ({ planId, bookmarkId }: { planId: string; bookmarkId: string }) =>
      watchPlanService.addBookmarkToPlan(planId, bookmarkId),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['watch-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-bookmarks', planId] });
      setPlanOpen(false);
      setSelectedBookmark(null);
      toast({
        title: "Added to plan!",
        description: "Bookmark added to your watch plan.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding to plan",
        description: getSafeErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    },
  });

  const handleSchedule = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setScheduleOpen(true);
  };

  const handleMarkDone = (bookmark: Bookmark) => {
    markDoneMutation.mutate(bookmark.id);
  };

  const handleUndoDone = (bookmark: Bookmark) => {
    undoDoneMutation.mutate(bookmark.id);
  };

  const handleSetWatching = (bookmark: Bookmark) => {
    setWatchingMutation.mutate(bookmark.id);
  };

  const handleDelete = (bookmark: Bookmark) => {
    deleteMutation.mutate(bookmark);
  };

  const handleStatusCycle = (bookmark: Bookmark, newStatus: string) => {
    if (newStatus === "done") markDoneMutation.mutate(bookmark.id);
    else if (newStatus === "watching") setWatchingMutation.mutate(bookmark.id);
    else undoDoneMutation.mutate(bookmark.id);
  };

  // Episode update mutation
  const updateEpisodesMutation = useMutation({
    mutationFn: ({ id, count, existing }: { id: string; count: number; existing: Record<string, unknown> }) =>
      bookmarkService.updateBookmark(id, { metadata: { ...existing, episodes_watched: count } }),
    onMutate: async ({ id, count }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => b.id === id ? { ...b, metadata: { ...b.metadata, episodes_watched: count } } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const handleEpisodeUpdate = (bookmark: Bookmark, count: number) => {
    updateEpisodesMutation.mutate({ id: bookmark.id, count, existing: bookmark.metadata ?? {} });
  };

  const getSkippedPriority = (bookmark: Bookmark): number => {
    const base = bookmark.priority ?? 100;
    return Math.max(base - 20, 40);
  };

  const skipMutation = useMutation({
    mutationFn: async (bookmark: Bookmark) => {
      await bookmarkService.markAsShown(bookmark.id);
      if (bookmark.queue_status === "up_next") {
        await queueService.toggleUpNext(bookmark.id, false);
      } else {
        await queueService.setPriority(bookmark.id, getSkippedPriority(bookmark));
      }
    },
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      const skippedAt = new Date().toISOString();
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) =>
          b.id !== bookmark.id
            ? b
            : {
                ...b,
                last_shown_at: skippedAt,
                shown_count: (b.shown_count ?? 0) + 1,
                queue_status: b.queue_status === "up_next" ? "queued" : b.queue_status,
                priority: b.queue_status === "up_next" ? 100 : getSkippedPriority(b),
              },
        ),
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(["bookmarks"], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onSuccess: (_, bookmark) => {
      toast({
        title: "Skipped for now",
        description: `"${bookmark.title}" moved down. We will suggest a different pick next.`,
      });
    },
  });

  const handleSkip = (bookmark: Bookmark) => {
    skipMutation.mutate(bookmark);
  };

  const handleMissedScheduleSkip = useCallback((schedId: string) => {
    scheduleService.cancelSchedule(schedId)
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['schedules'] }),
          queryClient.invalidateQueries({ queryKey: ['schedules', 'missed'] }),
        ]);
        toast({
          title: "Schedule skipped",
          description: "Removed from your missed schedules.",
        });
      })
      .catch((error) => {
        console.error("Failed to skip missed schedule", error);
        toast({
          title: "Could not skip schedule",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      });
  }, [queryClient, toast]);

  // Toggle Up Next mutation
  const toggleUpNextMutation = useMutation({
    mutationFn: ({ id, promote }: { id: string; promote: boolean }) =>
      queueService.toggleUpNext(id, promote),
    onMutate: async ({ id, promote }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) =>
          b.id === id
            ? { ...b, queue_status: promote ? "up_next" : "queued", priority: promote ? 200 : 100 }
            : b,
        ),
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(["bookmarks"], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onSuccess: (_, { promote }) => {
      toast({
        title: promote ? "Added to Up Next" : "Removed from Up Next",
        description: promote ? "This will appear at the top of your queue." : "Moved back to your main queue.",
      });
    },
  });

  const handleToggleUpNext = (bookmark: Bookmark) => {
    toggleUpNextMutation.mutate({
      id: bookmark.id,
      promote: bookmark.queue_status !== "up_next",
    });
  };

  const handleSharePublic = async (bookmark: Bookmark) => {
    try {
      const token = await sharingService.makeBookmarkPublic(bookmark.id);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      const shareUrl = `${window.location.origin}/share/${token}`;
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }
      toast({
        title: copied ? "Public link copied" : "Public link ready",
        description: copied ? "Anyone with the link can view this bookmark." : shareUrl,
      });
    } catch (error) {
      toast({
        title: "Couldn't create public link",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleSharePrivate = async (bookmark: Bookmark) => {
    try {
      await sharingService.makeBookmarkPrivate(bookmark.id);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({
        title: "Sharing turned off",
        description: `"${bookmark.title}" is now private.`,
      });
    } catch (error) {
      toast({
        title: "Couldn't update sharing",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleVault = async (bookmark: Bookmark) => {
    try {
      await bookmarkService.updateBookmark(bookmark.id, { is_vaulted: true });
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({
        title: "Moved to Vault",
        description: `"${bookmark.title}" is hidden from your dashboard.`,
      });
    } catch (error) {
      toast({
        title: "Couldn't move item to Vault",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleUnvault = async (bookmark: Bookmark) => {
    try {
      await bookmarkService.updateBookmark(bookmark.id, { is_vaulted: false });
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({
        title: "Removed from Vault",
        description: `"${bookmark.title}" is visible on your dashboard again.`,
      });
    } catch (error) {
      toast({
        title: "Couldn't remove from Vault",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleAddToPlan = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setSelectedPlanId("");
    setPlanOpen(true);
  };

  const handleAddToPlanSubmit = () => {
    if (!selectedBookmark || !selectedPlanId) return;
    addToPlanMutation.mutate({
      planId: selectedPlanId,
      bookmarkId: selectedBookmark.id,
    });
  };

  const displayBookmarks = bookmarks;
  const continueWatching = displayBookmarks.filter((b) => b.status === "watching");

  const closeDecisionMode = useCallback(() => {
    setDecisionModeOpen(false);
    setDecisionSeedIntent(null);
    const next = new URLSearchParams(searchParams);
    next.delete("decision");
    next.delete("intent");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const decisionSnapshot = useMemo(
    () =>
      buildDecisionSnapshot(displayBookmarks, {
        now,
        maxRails: MAX_SUPPORTING_RAILS,
        upcomingSchedules: (demoActive ? demoDataset.schedules : upcomingSchedules.map((schedule) => ({
          bookmarkId: schedule.bookmark_id,
          scheduledFor: schedule.scheduled_for,
        }))),
      }),
    [displayBookmarks, now, upcomingSchedules, demoActive, demoDataset.schedules],
  );

  const recommendationInsights = decisionSnapshot.insights;
  const bestNextItem = decisionSnapshot.bestNext;
  const generatedRails = decisionSnapshot.rails;
  const heroBookmark = bestNextItem ?? continueWatching[0] ?? null;
  const nextReason = bestNextItem ? recommendationInsights.reasons[bestNextItem.id] : undefined;
  const supportingRails = useMemo(() => {
    if (!bestNextItem) return generatedRails;
    return generatedRails
      .map((rail) => ({
        ...rail,
        bookmarks: rail.bookmarks.filter((bookmark) => bookmark.id !== bestNextItem.id),
      }))
      .filter((rail) => {
        const minSize = rail.id === "continue-watching" || rail.id === "planned" ? 1 : 2;
        return rail.bookmarks.length >= minSize;
      });
  }, [generatedRails, bestNextItem]);

  const demoTooltipMessage =
    demoStep === 1
      ? "Paste a link from TikTok, YouTube or anywhere"
      : demoStep === 2
        ? "We find the movie automatically"
        : demoStep === 3
          ? "This is your saved movie"
          : demoStep === 4
            ? "We suggest what to watch next"
            : null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      demoRunIdRef.current += 1;
      clearDemoTimers();
    };
  }, [clearDemoTimers]);

  useEffect(() => {
    if (demoStep === 4) {
      upNextHighlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [demoStep]);

  useEffect(() => {
    if (searchParams.get("decision") !== "1" || decisionModeOpen) return;
    setDecisionSeedIntent(parseIntentParam(searchParams.get("intent")));
    setDecisionModeOpen(true);
  }, [searchParams, decisionModeOpen]);

  useEffect(() => {
    if (isLoading || demoActive || bookmarksData.length > 0 || isNewAccount) return;

    const hasSeenDemo = window.localStorage.getItem("seen_demo");
    if (hasSeenDemo) return;

    void startDemo();
  }, [bookmarksData.length, demoActive, isLoading, isNewAccount, startDemo]);

  useEffect(() => {
    if (isLoading || demoActive) return;
    if (hasAutoFocusedWatchNextRef.current) return;
    if (!bestNextItem) return;

    hasAutoFocusedWatchNextRef.current = true;
    const watchNextId = bestNextItem.id;
    setHighlightBookmarkId(watchNextId);

    const focusTimeout = window.setTimeout(() => {
      watchNextRailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstCardLink =
        watchNextRailRef.current?.querySelector<HTMLElement>("[data-rail-card-link='true']");
      firstCardLink?.focus();
    }, 140);

    const clearHighlightTimeout = window.setTimeout(() => {
      setHighlightBookmarkId((current) => (current === watchNextId ? null : current));
    }, 4200);

    return () => {
      window.clearTimeout(focusTimeout);
      window.clearTimeout(clearHighlightTimeout);
    };
  }, [isLoading, demoActive, bestNextItem]);

  const handleKeepStreak = () => {
    if (!bestNextItem) return;
    watchNextRailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightBookmarkId(bestNextItem.id);
  };

  const handlePlay = () => {
    if (heroBookmark?.source_url) {
      window.open(heroBookmark.source_url, "_blank");
    }
  };

  const handlePlayNext = () => {
    if (bestNextItem?.source_url) {
      window.open(bestNextItem.source_url, "_blank");
    }
  };

  const handleMoreInfo = () => {
    if (heroBookmark) {
      navigate(`/b/${heroBookmark.id}`);
    }
  };

  const handleHeroSchedule = () => {
    if (!heroBookmark) return;
    handleSchedule(heroBookmark);
  };

  const handleHeroSkip = () => {
    if (!heroBookmark) return;
    handleSkip(heroBookmark);
  };

  // Empty state check
  const isEmpty = bookmarks.length === 0;
  const hasOnlyVaultedItems = bookmarks.length === 0 && vaultedBookmarks.length > 0;
  const welcomeStorageKey = user?.uid ? `${WELCOME_FLOW_KEY_PREFIX}${user.uid}` : null;
  const shouldShowWelcomeFlow =
    welcomeFlowActive;

  const dismissWelcomeFlow = () => {
    if (welcomeStorageKey) {
      window.localStorage.setItem(welcomeStorageKey, "done");
    }
    setWelcomeFlowActive(false);
    setWelcomeFlowDismissed(true);
  };

  const handleWelcomeSuggestionAdd = async (suggestion: OnboardingSuggestion) => {
    try {
      await bookmarkService.createBookmark({
        title: suggestion.title,
        type: suggestion.type,
        provider: suggestion.provider,
        source_url: null,
        canonical_url: null,
        runtime_minutes: null,
        release_year: suggestion.release_year,
        poster_url: suggestion.poster_url,
        mood_tags: suggestion.genres.map((genre) => genre.toLowerCase()),
        tags: ["onboarding", ...suggestion.genres.map((genre) => genre.toLowerCase())],
        status: "backlog",
        metadata: {
          onboarding_seed: true,
          onboarding_suggestion_id: suggestion.id,
          onboarding_genres: suggestion.genres,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({
        title: "Added to watchlist",
        description: suggestion.title,
      });
    } catch (error) {
      toast({
        title: "Couldn't add title",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleWelcomeComplete = async (payload: {
    genres: string[];
    providers: string[];
    addedSuggestionIds: string[];
  }) => {
    try {
      await socialService.savePrivatePreferences({
        favorite_genres: payload.genres,
        preferred_providers: payload.providers,
        onboarding_added_ids: payload.addedSuggestionIds,
        onboarding_completed_at: new Date().toISOString(),
      });
      dismissWelcomeFlow();
      toast({
        title: "Setup complete",
        description: "We'll use these picks for future recommendations.",
      });
    } catch (error) {
      toast({
        title: "Couldn't save onboarding preferences",
        description: getSafeErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!welcomeStorageKey) {
      setWelcomeFlowActive(false);
      setWelcomeFlowDismissed(true);
      return;
    }
    setWelcomeFlowDismissed(window.localStorage.getItem(welcomeStorageKey) === "done");
  }, [welcomeStorageKey]);

  useEffect(() => {
    const shouldActivate =
      !welcomeFlowDismissed &&
      !welcomeFlowActive &&
      !demoActive &&
      !showTour &&
      !isLoading &&
      isNewAccount &&
      allBookmarks.length === 0;
    if (shouldActivate) {
      setWelcomeFlowActive(true);
    }
  }, [welcomeFlowDismissed, welcomeFlowActive, demoActive, showTour, isLoading, isNewAccount, allBookmarks.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-[68px]">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-4">
          <div className="h-14 bg-wm-surface rounded-xl animate-pulse" />
          <div className="h-10 bg-wm-surface rounded-lg animate-pulse w-2/3" />
        </div>
        <div className="space-y-2">
          <SkeletonRail count={6} />
          <SkeletonRail count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ArrowUpDown className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Couldn't load your watchlist</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          </div>
          <Button onClick={() => refetch()} className="w-full sm:w-auto">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background pb-20 md:pb-0">
      {demoActive && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />
          <Button
            variant="secondary"
            size="sm"
            onClick={endDemo}
            className="fixed right-4 top-20 z-[60]"
          >
            Skip Demo
          </Button>
          {demoTooltipMessage && <DemoTooltip message={demoTooltipMessage} />}
        </>
      )}

      {/* Hero Banner â€" sits behind the transparent fixed navbar */}
      {heroBookmark && (
        <HeroBanner
          bookmark={heroBookmark}
          onPlay={handlePlay}
          onSchedule={handleHeroSchedule}
          onSkip={handleHeroSkip}
          onMoreInfo={handleMoreInfo}
          reason={bestNextItem ? nextReason : undefined}
          streakCount={streak}
          onKeepStreak={handleKeepStreak}
        />
      )}

      {heroBookmark && (
        <div className="relative z-10 -mt-24 md:-mt-28 lg:-mt-32 h-24 md:h-28 lg:h-32 bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
      )}

      {/* Page body â€" offset from top only when no hero banner */}
      <div
        className={cn(
          "flex gap-0 relative",
          heroBookmark ? "-mt-16 md:-mt-20 lg:-mt-24 z-20" : "pt-[68px]"
        )}
      >

        {/* Main content column */}
        <div className="flex-1 min-w-0 relative z-10 pb-16 space-y-3">

          {/* Rails */}
          <div className="space-y-3 animate-fade-in">

          {/* ── Missed schedules recovery banner ─────────────────────────── */}
          {missedSchedules.length > 0 && !dismissedMissedBanner && !demoActive && (
            <div className="px-4 sm:px-6 lg:px-8">
              <MissedSchedulesBanner
                missed={missedSchedules}
                onWatch={(bm) => navigate(`/b/${bm.id}`)}
                onReschedule={(bm) => handleSchedule(bm)}
                onSkip={handleMissedScheduleSkip}
                onDismiss={() => setDismissedMissedBanner(true)}
              />
            </div>
          )}


          {bestNextItem && (
            <div ref={watchNextRailRef}>
              <Rail
                title="Watch This Next"
                subtitle={recommendationInsights.timeSubtitle}
                bookmarks={[bestNextItem]}
                itemReasons={recommendationInsights.reasons}
                itemSchedules={allScheduleMap}
                highlightBookmarkId={highlightBookmarkId ?? undefined}
                cardSize="featured"
                onSchedule={handleSchedule}
                onSkip={handleSkip}
                onMarkDone={handleMarkDone}
                onAddToPlan={handleAddToPlan}
                onDelete={handleDelete}
                onUndoDone={handleUndoDone}
                onSetWatching={handleSetWatching}
                onStatusCycle={handleStatusCycle}
                onEpisodeUpdate={handleEpisodeUpdate}
                onToggleUpNext={handleToggleUpNext}
                onSharePublic={handleSharePublic}
                onSharePrivate={handleSharePrivate}
                onVault={handleVault}
                onUnvault={handleUnvault}
              />
            </div>
          )}

          {supportingRails.map((rail, index) => {
            const shouldHighlight = demoStep === 4 && index === 0;

            return (
              <div
                key={rail.id}
                ref={shouldHighlight ? upNextHighlightRef : undefined}
                className={cn(
                  shouldHighlight && "relative z-50 scale-[1.01] rounded-2xl ring-2 ring-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_40px_rgba(255,255,255,0.18)] transition-all"
                )}
              >
                <Rail
                  title={rail.title}
                  subtitle={rail.subtitle ?? rail.reason}
                  bookmarks={rail.bookmarks}
                  itemReasons={recommendationInsights.reasons}
                  itemSchedules={allScheduleMap}
                  variant={rail.variant}
                  onSchedule={handleSchedule}
                  onSkip={handleSkip}
                  onMarkDone={handleMarkDone}
                  onAddToPlan={handleAddToPlan}
                  onDelete={handleDelete}
                  onUndoDone={handleUndoDone}
                  onSetWatching={handleSetWatching}
                  onStatusCycle={handleStatusCycle}
                  onEpisodeUpdate={handleEpisodeUpdate}
                  onToggleUpNext={handleToggleUpNext}
                  onSharePublic={handleSharePublic}
                  onSharePrivate={handleSharePrivate}
                  onVault={handleVault}
                  onUnvault={handleUnvault}
                />
              </div>
            );
          })}
          {/* Empty state - new user */}
          {isEmpty && !hasOnlyVaultedItems && (
            <div className="px-4 sm:px-6 lg:px-8">
              <EmptyStateGuide
                demoActive={demoActive}
                demoLoading={demoLoading}
                demoInputValue={demoInputValue}
                onDemoInputChange={setDemoInputValue}
                onStartDemo={() => { void startDemo(); }}
              />
            </div>
          )}
          {hasOnlyVaultedItems && (
            <div className="px-4 sm:px-6 lg:px-8 py-12">
              <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-lg font-semibold text-foreground mb-1">Your dashboard is hidden by Vault</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {`You have 🔒 ${vaultedBookmarks.length} item${vaultedBookmarks.length === 1 ? "" : "s"} tucked away.`}
                </p>
                <Button asChild>
                  <Link to="/vault">Open Vault</Link>
                </Button>
              </div>
            </div>
          )}
          </div>{/* end rails wrapper */}
        </div>{/* end main content column */}

      </div>{/* end flex page body */}

      {/* Decision Mode */}
      <DecisionMode
        open={decisionModeOpen}
        onClose={closeDecisionMode}
        bookmarks={bookmarks}
        initialIntent={decisionSeedIntent}
      />

      {/* Schedule Dialog */}
      <ScheduleDialog
        bookmark={selectedBookmark}
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSelectedBookmark(null);
        }}
      />

      {/* Add to Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watch Plan</DialogTitle>
            <DialogDescription>
              Choose a plan to add "{selectedBookmark?.title}" to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {plans.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No watch plans yet</p>
                <Button onClick={() => { setPlanOpen(false); navigate('/plans'); }}>
                  Create a Plan
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="plan-select">Select Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setPlanOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddToPlanSubmit} 
                    disabled={addToPlanMutation.isPending || !selectedPlanId}
                  >
                    {addToPlanMutation.isPending ? "Adding..." : "Add to Plan"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Completion Rating Sheet */}
      <CompletionSheet
        bookmark={completionBookmark}
        open={completionSheetOpen}
        onOpenChange={setCompletionSheetOpen}
        onRate={(id, rating, review, watchedWith) => rateMutation.mutate({ id, rating, review, watchedWith })}
        onSkip={() => setCompletionSheetOpen(false)}
        nextSuggestion={bestNextItem}
        nextReason={nextReason}
        streakCount={streak}
        onPlayNext={bestNextItem?.source_url ? handlePlayNext : undefined}
        onScheduleNext={bestNextItem ? () => handleSchedule(bestNextItem) : undefined}
      />

      <WelcomeFlow
        open={shouldShowWelcomeFlow}
        onDismiss={dismissWelcomeFlow}
        onAddSuggestion={handleWelcomeSuggestionAdd}
        onComplete={handleWelcomeComplete}
      />

      {/* Onboarding Tour */}
      <DashboardTour
        open={!demoActive && !shouldShowWelcomeFlow && showTour}
        onDismiss={dismissTour}
        onFinish={dismissTour}
      />

    </div>
  );
};

export default Dashboard;
