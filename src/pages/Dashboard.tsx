import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { FilterPanel, type AdvancedFilters } from "@/components/dashboard/FilterPanel";
import { BulkActionBar } from "@/components/dashboard/BulkActionBar";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { bookmarkService } from "@/services/bookmarks";
import { ScheduleDialog } from "@/components/schedules/ScheduleDialog";
import { watchPlanService } from "@/services/watchPlans";
import { notificationService } from "@/services/notifications";
import { useToast } from "@/hooks/use-toast";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import type { Bookmark } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterType = "all" | "movie" | "series" | "video" | "doc";
type FilterStatus = "all" | "backlog" | "watching" | "done";

const Dashboard = () => {
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  
  // Filter state
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    providers: [], moods: [], runtimeMin: null, runtimeMax: null,
  });

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bookmarks from Supabase
  const { data: bookmarks = [], isLoading, error } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  // Fetch notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.getUnreadCount(),
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

  // Calculate stats
  const stats = useMemo(() => ({
    total: bookmarks.length,
    backlog: filterCounts.backlog,
    watching: filterCounts.watching,
    done: filterCounts.done,
    totalMinutes: bookmarks
      .filter((b) => b.status === "done" && b.runtime_minutes)
      .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
  }), [bookmarks, filterCounts]);

  // Apply filters
  const filteredBookmarks = useMemo(() => {
    const hasAdvanced =
      advancedFilters.providers.length > 0 ||
      advancedFilters.moods.length > 0 ||
      advancedFilters.runtimeMin !== null ||
      advancedFilters.runtimeMax !== null;

    return bookmarks.filter((b) => {
      const typeMatch = filterType === "all" || b.type === filterType;
      const statusMatch = filterStatus === "all" || b.status === filterStatus;
      if (!typeMatch || !statusMatch) return false;
      if (!hasAdvanced) return true;
      const providerMatch = advancedFilters.providers.length === 0 || advancedFilters.providers.includes(b.provider);
      const moodMatch = advancedFilters.moods.length === 0 || (b.mood_tags || []).some((m) => advancedFilters.moods.includes(m));
      const rtMin = advancedFilters.runtimeMin;
      const rtMax = advancedFilters.runtimeMax;
      const runtimeMatch =
        (rtMin === null || (b.runtime_minutes !== null && b.runtime_minutes >= rtMin)) &&
        (rtMax === null || (b.runtime_minutes !== null && b.runtime_minutes <= rtMax));
      return providerMatch && moodMatch && runtimeMatch;
    });
  }, [bookmarks, filterType, filterStatus, advancedFilters]);

  // Mark as done mutation
  const markDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'done'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Marked as done!",
        description: "Moved to your watched list.",
      });
    },
  });

  // Undo done mutation (move back to backlog)
  const undoDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'backlog'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Moved to backlog",
        description: "Ready to watch again.",
      });
    },
  });

  // Set as watching mutation
  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'watching'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Now watching!",
        description: "Added to Continue Watching.",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.deleteBookmark(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setDeleteOpen(false);
      setSelectedBookmark(null);
      toast({
        title: "Deleted",
        description: "Bookmark removed from your list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Add to plan mutation
  const addToPlanMutation = useMutation({
    mutationFn: ({ planId, bookmarkId }: { planId: string; bookmarkId: string }) => 
      watchPlanService.addBookmarkToPlan(planId, bookmarkId),
    onSuccess: () => {
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
        description: error.message || "Something went wrong.",
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
    setSelectedBookmark(bookmark);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedBookmark) return;
    deleteMutation.mutate(selectedBookmark.id);
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
    const count = selectedIds.size;
    await Promise.all(Array.from(selectedIds).map((id) => bookmarkService.deleteBookmark(id)));
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set());
    toast({ title: `Deleted ${count} bookmark${count !== 1 ? "s" : ""}` });
  };

  const handleBulkMarkDone = async () => {
    const count = selectedIds.size;
    await Promise.all(Array.from(selectedIds).map((id) => bookmarkService.updateStatus(id, 'done')));
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set());
    toast({ title: `Marked ${count} as done` });
  };

  const handleBulkAddToPlan = async (planId: string) => {
    const count = selectedIds.size;
    await Promise.all(Array.from(selectedIds).map((id) => watchPlanService.addBookmarkToPlan(planId, id)));
    setSelectedIds(new Set());
    toast({ title: `Added ${count} to plan` });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={openSearch} notificationCount={0} />
        <div className="h-[70vh] min-h-[500px] bg-muted/30 animate-pulse" />
        <div className="relative z-10 -mt-24 pb-16 space-y-2">
          <SkeletonRail count={6} />
          <SkeletonRail count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading bookmarks</p>
          <p className="text-muted-foreground text-sm">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // Check if filters are active (basic or advanced)
  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    advancedFilters.providers.length > 0 ||
    advancedFilters.moods.length > 0 ||
    advancedFilters.runtimeMin !== null ||
    advancedFilters.runtimeMax !== null;

  // Group bookmarks (use filtered if filters active, otherwise use all)
  const displayBookmarks = hasActiveFilters ? filteredBookmarks : bookmarks;
  const continueWatching = displayBookmarks.filter((b) => b.status === "watching");
  const backlog = displayBookmarks.filter((b) => b.status === "backlog");
  const completed = displayBookmarks.filter((b) => b.status === "done");

  // Hero bookmark (next scheduled or first watching)
  const heroBookmark = continueWatching[0] || backlog[0] || null;

  // Group by mood
  const byMood: Record<string, Bookmark[]> = {};
  displayBookmarks.forEach((b) => {
    (b.mood_tags || []).forEach((mood) => {
      if (!byMood[mood]) byMood[mood] = [];
      byMood[mood].push(b);
    });
  });

  const handlePlay = () => {
    if (heroBookmark?.source_url) {
      window.open(heroBookmark.source_url, "_blank");
    }
  };

  const handleMoreInfo = () => {
    if (heroBookmark) {
      window.location.href = `/b/${heroBookmark.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={openSearch} notificationCount={unreadCount} />
      
      {/* Hero Banner */}
      <HeroBanner
        bookmark={heroBookmark}
        onPlay={handlePlay}
        onMoreInfo={handleMoreInfo}
      />

      {/* Content */}
      <div className="relative z-10 -mt-24 pb-16 space-y-8">
        {/* Stats Bar */}
        {bookmarks.length > 0 && (
          <StatsBar
            total={stats.total}
            backlog={stats.backlog}
            watching={stats.watching}
            done={stats.done}
            totalMinutes={stats.totalMinutes}
            className="animate-fade-in"
          />
        )}

        {/* Filter Chips + Toolbar */}
        {bookmarks.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <FilterChips
                  activeType={filterType}
                  activeStatus={filterStatus}
                  onTypeChange={setFilterType}
                  onStatusChange={setFilterStatus}
                  counts={filterCounts}
                  className="!px-0"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={filterPanelOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setFilterPanelOpen((v) => !v)}
                  className="h-8 gap-1 text-xs"
                >
                  Filters
                  {(advancedFilters.providers.length + advancedFilters.moods.length + (advancedFilters.runtimeMin !== null ? 1 : 0) + (advancedFilters.runtimeMax !== null ? 1 : 0)) > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                      {advancedFilters.providers.length + advancedFilters.moods.length + (advancedFilters.runtimeMin !== null ? 1 : 0) + (advancedFilters.runtimeMax !== null ? 1 : 0)}
                    </span>
                  )}
                </Button>
                <Button
                  variant={selectMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                  className="h-8 text-xs"
                >
                  {selectMode ? "Cancel" : "Select"}
                </Button>
              </div>
            </div>
            {filterPanelOpen && (
              <FilterPanel
                onApply={(f) => { setAdvancedFilters(f); }}
                onReset={() => setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null })}
              />
            )}
          </div>
        )}

        {/* Rails */}
        <div className="space-y-4 animate-fade-in">
          {continueWatching.length > 0 && (
            <Rail
              title="Continue Watching"
              bookmarks={continueWatching}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          )}

          {backlog.length > 0 && (
            <Rail
              title="Your Backlog"
              subtitle="Ready to watch"
              bookmarks={backlog}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          )}

          {/* Mood Rails */}
          {Object.entries(byMood)
            .filter(([_, items]) => items.length >= 2)
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
                isSelectable={selectMode}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
              />
            ))}

          {completed.length > 0 && (
            <Rail
              title="Recently Watched"
              bookmarks={completed}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          )}

          {/* Filtered empty state */}
          {hasActiveFilters && filteredBookmarks.length === 0 && (
            <div className="container mx-auto px-4 lg:px-8 text-center py-16">
              <p className="text-muted-foreground mb-4">No bookmarks match your filters</p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilterType("all");
                  setFilterStatus("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Empty state */}
          {bookmarks.length === 0 && (
            <div className="container mx-auto px-4 lg:px-8 text-center py-16">
              <p className="text-muted-foreground mb-4">Your watchlist is empty</p>
              <Button onClick={() => window.location.href = '/new'}>
                Add your first bookmark
              </Button>
            </div>
          )}
        </div>
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
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
                <Button onClick={() => window.location.href = '/plans'}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{selectedBookmark?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this bookmark from your watchlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
