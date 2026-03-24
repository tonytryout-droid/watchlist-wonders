import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, Shuffle, ArrowUpDown, Play, Check } from "lucide-react";
import { generateRails } from "@/lib/railGenerator";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { FilterPanel, type AdvancedFilters } from "@/components/dashboard/FilterPanel";
import { BulkActionBar } from "@/components/dashboard/BulkActionBar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { MoodPicker } from "@/components/dashboard/MoodPicker";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { DashboardTour } from "@/components/onboarding/DashboardTour";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { CompletionSheet } from "@/components/bookmarks/CompletionSheet";
import { bookmarkService } from "@/services/bookmarks";
import { queueService } from "@/services/queue";
import { scheduleService } from "@/services/schedules";
import { ScheduleDialog } from "@/components/schedules/ScheduleDialog";
import { watchPlanService } from "@/services/watchPlans";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRuntime } from "@/lib/utils";

type FilterType = "all" | "movie" | "series" | "video" | "doc";
type FilterStatus = "all" | "backlog" | "watching" | "done";
type SortOption = "newest" | "oldest" | "az" | "runtime" | "rating";

const Dashboard = () => {
  const navigate = useNavigate();
  const { showTour, dismissTour } = useDashboardTour();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [completionBookmark, setCompletionBookmark] = useState<Bookmark | null>(null);
  const [completionSheetOpen, setCompletionSheetOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  
  // Filter state
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    providers: [], moods: [], runtimeMin: null, runtimeMax: null,
  });

  // Sort + Surprise Me state
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [surpriseBookmark, setSurpriseBookmark] = useState<Bookmark | null>(null);

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bookmarks
  const { data: bookmarks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  // Fetch upcoming schedules for "Up Next" rail
  const { data: upcomingSchedules = [] } = useQuery({
    queryKey: ['schedules', 'upcoming'],
    queryFn: () => scheduleService.getUpcomingSchedules(8),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch watch plans for the "Add to Plan" dialog
  const { data: plans = [] } = useQuery({
    queryKey: ['watch-plans'],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  // Calculate filter counts
  const filterCounts = useMemo(() => ({
    movie: bookmarks.filter((b) => b.type === "movie").length,
    series: bookmarks.filter((b) => b.type === "series").length,
    video: bookmarks.filter((b) => b.type === "video").length,
    doc: bookmarks.filter((b) => b.type === "doc").length,
    backlog: bookmarks.filter((b) => b.status === "backlog").length,
    watching: bookmarks.filter((b) => b.status === "watching").length,
    done: bookmarks.filter((b) => b.status === "done").length,
  }), [bookmarks]);

  // Apply filters + sort
  const filteredBookmarks = useMemo(() => {
    const hasAdvanced =
      activeMood !== null ||
      advancedFilters.providers.length > 0 ||
      advancedFilters.moods.length > 0 ||
      advancedFilters.runtimeMin !== null ||
      advancedFilters.runtimeMax !== null;

    const filtered = bookmarks.filter((b) => {
      const typeMatch = filterType === "all" || b.type === filterType;
      const statusMatch = filterStatus === "all" || b.status === filterStatus;
      if (!typeMatch || !statusMatch) return false;
      if (!hasAdvanced) return true;
      const providerMatch = advancedFilters.providers.length === 0 || advancedFilters.providers.includes(b.provider);
      const moodMatch = advancedFilters.moods.length === 0 || (b.mood_tags || []).some((m) => advancedFilters.moods.includes(m));
      const quickMoodMatch = activeMood === null || (b.mood_tags || []).includes(activeMood);
      const rtMin = advancedFilters.runtimeMin;
      const rtMax = advancedFilters.runtimeMax;
      const runtimeMatch =
        (rtMin === null || (b.runtime_minutes !== null && b.runtime_minutes >= rtMin)) &&
        (rtMax === null || (b.runtime_minutes !== null && b.runtime_minutes <= rtMax));
      return providerMatch && moodMatch && quickMoodMatch && runtimeMatch;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "oldest": return a.created_at.localeCompare(b.created_at);
        case "az": return a.title.localeCompare(b.title);
        case "runtime": return (b.runtime_minutes || 0) - (a.runtime_minutes || 0);
        case "rating": return (b.user_rating || 0) - (a.user_rating || 0);
        default: return b.created_at.localeCompare(a.created_at); // newest
      }
    });
  }, [bookmarks, filterType, filterStatus, activeMood, advancedFilters, sortBy]);

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

  // Undo delete â€” recreate the bookmark with its original data
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
        description: (!error.code && error.message) ? error.message : "Failed to restore the bookmark. Please try again.",
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
        description: (!error.code && error.message) ? error.message : "Something went wrong.",
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
        description: (!error.code && error.message) ? error.message : "Something went wrong.",
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

  const toggleSelect = (bookmarkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) next.delete(bookmarkId);
      else next.add(bookmarkId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => bookmarkService.deleteBookmark(id)));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    if (succeeded.length > 0) queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Deleted ${succeeded.length} bookmark${succeeded.length !== 1 ? "s" : ""}` });
    } else {
      toast({
        title: `Deleted ${succeeded.length} of ${ids.length}`,
        description: `${failedIds.length} could not be deleted`,
        variant: "destructive",
      });
    }
  };

  const handleBulkMarkDone = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => bookmarkService.updateStatus(id, 'done')));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    if (succeeded.length > 0) queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Marked ${succeeded.length} as done` });
    } else {
      toast({
        title: `Marked ${succeeded.length} of ${ids.length} as done`,
        description: `${failedIds.length} could not be updated`,
        variant: "destructive",
      });
    }
  };

  const handleBulkAddToPlan = async (planId: string) => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => watchPlanService.addBookmarkToPlan(planId, id)));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Added ${succeeded.length} to plan` });
    } else {
      toast({
        title: `Added ${succeeded.length} of ${ids.length} to plan`,
        description: `${failedIds.length} could not be added`,
        variant: "destructive",
      });
    }
  };

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

  // Check if filters are active (basic or advanced)
  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    activeMood !== null ||
    advancedFilters.providers.length > 0 ||
    advancedFilters.moods.length > 0 ||
    advancedFilters.runtimeMin !== null ||
    advancedFilters.runtimeMax !== null;

  const totalActiveFilterCount =
    (filterType !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (activeMood !== null ? 1 : 0) +
    advancedFilters.providers.length +
    advancedFilters.moods.length +
    (advancedFilters.runtimeMin !== null ? 1 : 0) +
    (advancedFilters.runtimeMax !== null ? 1 : 0);

  // Group bookmarks (use filtered if filters active, otherwise use all)
  const displayBookmarks = hasActiveFilters ? filteredBookmarks : bookmarks;
  const continueWatching = displayBookmarks.filter((b) => b.status === "watching");
  const backlog = displayBookmarks.filter((b) => b.status === "backlog");
  const completed = displayBookmarks.filter((b) => b.status === "done");
  const totalWatchMinutes = completed.reduce((sum, b) => sum + (b.runtime_minutes || 0), 0);

  // Hero bookmark: only show when actively watching something
  const heroBookmark = continueWatching[0] || null;

  // Group by mood
  const byMood: Record<string, Bookmark[]> = {};
  displayBookmarks.forEach((b) => {
    (b.mood_tags || []).forEach((mood) => {
      if (!byMood[mood]) byMood[mood] = [];
      byMood[mood].push(b);
    });
  });

  const watchedMoods = new Set(
    completed.flatMap((b) => b.mood_tags || []).map((m) => m.toLowerCase())
  );

  const topTenForYou = [...displayBookmarks]
    .filter((item) => item.status !== "done")
    .sort((a, b) => {
      const aMoodScore = (a.mood_tags || []).reduce(
        (sum, mood) => (watchedMoods.has(mood.toLowerCase()) ? sum + 6 : sum),
        0
      );
      const bMoodScore = (b.mood_tags || []).reduce(
        (sum, mood) => (watchedMoods.has(mood.toLowerCase()) ? sum + 6 : sum),
        0
      );
      const aFreshness = Math.max(0, 14 - Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000));
      const bFreshness = Math.max(0, 14 - Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000));
      const aScore =
        (a.status === "watching" ? 40 : 20) +
        aMoodScore +
        aFreshness +
        (a.runtime_minutes && a.runtime_minutes >= 80 && a.runtime_minutes <= 160 ? 4 : 0);
      const bScore =
        (b.status === "watching" ? 40 : 20) +
        bMoodScore +
        bFreshness +
        (b.runtime_minutes && b.runtime_minutes >= 80 && b.runtime_minutes <= 160 ? 4 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, 10);

  // Generate cinematic rails from current display bookmarks
  const generatedRails = useMemo(
    () => generateRails(displayBookmarks),
    [displayBookmarks],
  );

  const handleSurpriseMe = () => {
    const pool = backlog.length > 0 ? backlog : displayBookmarks;
    if (pool.length === 0) return;
    setSurpriseBookmark(pool[Math.floor(Math.random() * pool.length)]);
  };

  const handlePlay = () => {
    if (heroBookmark?.source_url) {
      window.open(heroBookmark.source_url, "_blank");
    }
  };

  const handleMoreInfo = () => {
    if (heroBookmark) {
      navigate(`/b/${heroBookmark.id}`);
    }
  };

  // Empty state check
  const isEmpty = bookmarks.length === 0;

  // When filters are active, rails use a contextual empty message instead of the default
  const filteredEmptyMessage = hasActiveFilters ? "No matches for your current filters" : undefined;

  return (
    <div className="min-h-full bg-background pb-20 md:pb-0">

      {/* Hero Banner â€” sits behind the transparent fixed navbar */}
      {heroBookmark && (
        <HeroBanner
          bookmark={heroBookmark}
          onPlay={handlePlay}
          onMoreInfo={handleMoreInfo}
        />
      )}

      {heroBookmark && (
        <div className="relative z-10 -mt-24 md:-mt-28 lg:-mt-32 h-24 md:h-28 lg:h-32 bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
      )}

      {/* Page body â€” offset from top only when no hero banner */}
      <div
        className={cn(
          "flex gap-0 relative",
          heroBookmark ? "-mt-16 md:-mt-20 lg:-mt-24 z-20" : "pt-[68px]"
        )}
      >

        {/* Main content column */}
        <div className="flex-1 min-w-0 relative z-10 pb-16 space-y-3">

          {/* Filter status bar + advanced controls */}
          {bookmarks.length > 0 && (
            <div
              id="filter-toolbar"
              className={cn(
                "animate-fade-in pt-3 pb-2",
                heroBookmark
                  ? "sticky top-[68px] z-30 border-y border-white/5 bg-background/75 supports-[backdrop-filter]:bg-background/55 backdrop-blur-md"
                  : ""
              )}
            >
              <StatsBar
                total={displayBookmarks.length}
                backlog={backlog.length}
                watching={continueWatching.length}
                done={completed.length}
                totalMinutes={totalWatchMinutes}
                onFilter={setFilterStatus}
                className="mb-3"
              />
              <div className="px-4 sm:px-6 lg:px-8 flex items-center gap-3">
                {/* Status filter chips */}
                <FilterChips
                  activeType="all"
                  activeStatus={filterStatus}
                  onTypeChange={() => {}}
                  onStatusChange={setFilterStatus}
                  counts={filterCounts}
                  className="flex-1 min-w-0"
                  statusOnly
                />
                {/* Right controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSurpriseMe}
                    disabled={!!surpriseBookmark}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Surprise me - pick a random title"
                    aria-label="Surprise me, pick a random title"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="h-8 text-xs w-[100px] gap-1 border-0 bg-transparent text-muted-foreground hover:text-foreground">
                      <ArrowUpDown className="w-3 h-3 shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="az">A-Z</SelectItem>
                      <SelectItem value="runtime">Runtime</SelectItem>
                      <SelectItem value="rating">My Rating</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={filterPanelOpen ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterPanelOpen((v) => !v)}
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Filters
                    {totalActiveFilterCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                        {totalActiveFilterCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={selectMode ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {selectMode ? "Cancel" : "Select"}
                  </Button>
                </div>
              </div>
              {filterPanelOpen && (
                <div className="mt-2">
                  <FilterPanel
                    onApply={(f) => { setAdvancedFilters(f); }}
                    onReset={() => {
                      setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null });
                      setActiveMood(null);
                    }}
                  />
                </div>
              )}
              <div className="px-4 sm:px-6 lg:px-8 mt-3">
                <MoodPicker activeMood={activeMood} onMoodSelect={setActiveMood} />
              </div>
            </div>
          )}

          {/* Rails */}
          <div className=”space-y-3 animate-fade-in”>

          {/* ── Scheduled / Up Next calendar strip ───────────────────────── */}
          {upcomingSchedules.length > 0 && (
            <section className=”py-3”>
              <div className=”px-4 sm:px-6 lg:px-8 mb-4”>
                <div className=”flex items-center justify-between”>
                  <div>
                    <h2 className=”text-xl font-semibold flex items-center gap-2”>
                      <CalendarClock className=”w-5 h-5 text-wm-gold” />
                      Scheduled
                    </h2>
                    <p className=”text-sm text-muted-foreground mt-0.5”>Coming up on your calendar</p>
                  </div>
                  <Link to=”/calendar” className=”text-xs text-primary hover:underline”>
                    View calendar
                  </Link>
                </div>
              </div>
              <div className=”flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2” style={{ scrollbarWidth: “none” }}>
                {upcomingSchedules.map((sched) => {
                  const bm = sched.bookmarks;
                  if (!bm) return null;
                  const rawDate = sched.scheduled_for ? new Date(sched.scheduled_for) : null;
                  const scheduledDate = rawDate && isFinite(rawDate.getTime()) ? rawDate : null;
                  const isToday = scheduledDate ? scheduledDate.toDateString() === new Date().toDateString() : false;
                  return (
                    <Link
                      key={sched.id}
                      to={`/b/${bm.id}`}
                      className=”shrink-0 w-56 bg-wm-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group”
                    >
                      <div className=”relative h-28 bg-muted overflow-hidden”>
                        {bm.backdrop_url || bm.poster_url ? (
                          <img
                            src={bm.backdrop_url || bm.poster_url || “”}
                            alt={bm.title}
                            className=”w-full h-full object-cover group-hover:scale-105 transition-transform duration-300”
                          />
                        ) : (
                          <div className=”w-full h-full flex items-center justify-center”>
                            <span className=”text-3xl font-bold text-muted-foreground”>{bm.title.charAt(0)}</span>
                          </div>
                        )}
                        <div className=”absolute inset-0 bg-gradient-to-t from-background/80 to-transparent” />
                        {scheduledDate && (
                          <div className={cn(
                            “absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full”,
                            isToday ? “bg-primary text-primary-foreground” : “bg-wm-gold text-background”
                          )}>
                            {isToday ? `Today ${format(scheduledDate, “h:mm a”)}` : format(scheduledDate, “EEE, MMM d”)}
                          </div>
                        )}
                      </div>
                      <div className=”p-3”>
                        <p className=”text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors”>
                          {bm.title}
                        </p>
                        {bm.runtime_minutes && (
                          <p className=”text-[11px] text-muted-foreground mt-0.5”>
                            {bm.runtime_minutes < 60 ? `${bm.runtime_minutes}m` : `${Math.floor(bm.runtime_minutes / 60)}h ${bm.runtime_minutes % 60}m`}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Top 10 scoring rail (shown when no active filters) ────────── */}
          {!hasActiveFilters && topTenForYou.length > 0 && (
            <Rail
              title=”Top 10 In Your Queue”
              subtitle=”Ranked by momentum”
              bookmarks={topTenForYou}
              showRanks
              cardSize=”featured”
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              onStatusCycle={handleStatusCycle}
              onEpisodeUpdate={handleEpisodeUpdate}
              onToggleUpNext={handleToggleUpNext}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          )}

          {/* ── Cinematic generated rails ─────────────────────────────────── */}
          {generatedRails.map((rail) => (
            <Rail
              key={rail.id}
              title={rail.title}
              subtitle={rail.subtitle ?? rail.reason}
              bookmarks={rail.bookmarks}
              variant={rail.variant}
              emptyMessage={filteredEmptyMessage}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              onStatusCycle={handleStatusCycle}
              onEpisodeUpdate={handleEpisodeUpdate}
              onToggleUpNext={handleToggleUpNext}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          ))}

          {/* ── Mood rails (up to 3, ≥ 2 items) ─────────────────────────── */}
          {!hasActiveFilters &&
            Object.entries(byMood)
              .filter(([, items]) => items.length >= 2)
              .sort(([, a], [, b]) => b.length - a.length)
              .slice(0, 3)
              .map(([mood, items]) => (
                <Rail
                  key={mood}
                  title={`${mood.charAt(0).toUpperCase()}${mood.slice(1)} Picks`}
                  bookmarks={items}
                  onSchedule={handleSchedule}
                  onMarkDone={handleMarkDone}
                  onAddToPlan={handleAddToPlan}
                  onDelete={handleDelete}
                  onUndoDone={handleUndoDone}
                  onSetWatching={handleSetWatching}
                  onStatusCycle={handleStatusCycle}
                  onEpisodeUpdate={handleEpisodeUpdate}
                  onToggleUpNext={handleToggleUpNext}
                  isSelectable={selectMode}
                  selectedIds={selectedIds}
                  onSelect={toggleSelect}
                />
              ))}

          {/* ── Recently Watched (always at bottom) ──────────────────────── */}
          {completed.length > 0 && (
            <Rail
              title=”Recently Watched”
              bookmarks={completed}
              emptyMessage={filteredEmptyMessage}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              onStatusCycle={handleStatusCycle}
              onEpisodeUpdate={handleEpisodeUpdate}
              onToggleUpNext={handleToggleUpNext}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          )}

          {/* Filtered empty state */}
          {hasActiveFilters && filteredBookmarks.length === 0 && (
            <div className="px-4 sm:px-6 lg:px-8 text-center py-16">
              <p className="text-muted-foreground mb-4">No bookmarks match your filters</p>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterType("all");
                  setFilterStatus("all");
                  setActiveMood(null);
                  setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null });
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Empty state - new user */}
          {isEmpty && (
            <div className="px-4 sm:px-6 lg:px-8">
              <EmptyStateGuide />
            </div>
          )}
          </div>{/* end rails wrapper */}
        </div>{/* end main content column */}

        {/* Right panel (xl screens) - Popular and favorites */}
        {!isEmpty && (
          <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-border px-4 pt-5 pb-16 gap-6 sticky top-0 max-h-screen overflow-y-auto">
            {/* Saved for Later -> Popular */}
            {backlog.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-foreground">Saved for Later</h3>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("backlog")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View more
                  </button>
                </div>
                <div className="space-y-3">
                  {backlog.slice(0, 4).map((bm) => (
                    <Link
                      key={bm.id}
                      to={`/b/${bm.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-wm-surface">
                        {(bm.poster_url || bm.backdrop_url) ? (
                          <img
                            src={bm.poster_url || bm.backdrop_url!}
                            alt={bm.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                            {bm.title.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {bm.title}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {bm.type}{bm.release_year ? `, ${bm.release_year}` : ""}
                        </p>
                        {bm.user_rating && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-bold bg-wm-gold text-background px-1.5 py-0.5 rounded">
                              * {bm.user_rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Watched -> Favorites */}
            {completed.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-foreground">Favorites</h3>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("done")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View more
                  </button>
                </div>
                <div className="space-y-3">
                  {[...completed]
                    .sort((a, b) => (b.user_rating || 0) - (a.user_rating || 0))
                    .slice(0, 4)
                    .map((bm) => (
                      <Link
                        key={bm.id}
                        to={`/b/${bm.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-wm-surface">
                          {(bm.poster_url || bm.backdrop_url) ? (
                            <img
                              src={bm.poster_url || bm.backdrop_url!}
                              alt={bm.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                              {bm.title.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {bm.title}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {bm.type}{bm.release_year ? `, ${bm.release_year}` : ""}
                          </p>
                          {bm.user_rating && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-bold bg-wm-gold text-background px-1.5 py-0.5 rounded">
                                * {bm.user_rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </aside>
        )}

      </div>{/* end flex page body */}

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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        plans={plans}
        onDeleteAll={handleBulkDelete}
        onMarkDone={handleBulkMarkDone}
        onAddToPlan={handleBulkAddToPlan}
        onClear={() => { setSelectedIds(new Set()); setSelectMode(false); }}
      />

      {/* Completion Rating Sheet */}
      <CompletionSheet
        bookmark={completionBookmark}
        open={completionSheetOpen}
        onOpenChange={setCompletionSheetOpen}
        onRate={(id, rating, review, watchedWith) => rateMutation.mutate({ id, rating, review, watchedWith })}
        onSkip={() => setCompletionSheetOpen(false)}
      />

      {/* Onboarding Tour */}
      <DashboardTour
        open={showTour}
        onDismiss={dismissTour}
        onFinish={dismissTour}
      />

      {/* Surprise Me Sheet */}
      <Sheet open={!!surpriseBookmark} onOpenChange={(o) => { if (!o) setSurpriseBookmark(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          {surpriseBookmark && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-primary" />
                  Watch Tonight
                </SheetTitle>
              </SheetHeader>
              <div className="flex gap-4">
                {(surpriseBookmark.poster_url || surpriseBookmark.backdrop_url) && (
                  <img
                    src={surpriseBookmark.poster_url || surpriseBookmark.backdrop_url!}
                    alt={surpriseBookmark.title}
                    className="w-20 h-28 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{surpriseBookmark.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {surpriseBookmark.release_year && <span>{surpriseBookmark.release_year}</span>}
                    {surpriseBookmark.runtime_minutes && (
                      <span>| {formatRuntime(surpriseBookmark.runtime_minutes)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {surpriseBookmark.source_url && (
                      <Button size="sm" onClick={() => window.open(surpriseBookmark.source_url!, "_blank")}>
                        <Play className="w-3 h-3 mr-1 fill-current" />
                        Watch Now
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => {
                      const id = surpriseBookmark.id;
                      markDoneMutation.mutate(id);
                      setSurpriseBookmark(null);
                    }}>
                      <Check className="w-3 h-3 mr-1" />
                      Mark Done
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigate(`/b/${surpriseBookmark.id}`);
                      setSurpriseBookmark(null);
                    }}>
                      Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleSurpriseMe}>
                      <Shuffle className="w-3 h-3 mr-1" />
                      Reroll
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
};

export default Dashboard;

