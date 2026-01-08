import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { bookmarkService } from "@/services/bookmarks";
import { scheduleService } from "@/services/schedules";
import { watchPlanService } from "@/services/watchPlans";
import { notificationService } from "@/services/notifications";
import { useToast } from "@/hooks/use-toast";
import type { Bookmark } from "@/types/database";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("20:00");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  
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

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (data: { bookmark_id: string; scheduled_for: string }) => 
      scheduleService.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setScheduleOpen(false);
      setSelectedBookmark(null);
      toast({
        title: "Scheduled!",
        description: "Added to your calendar.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error scheduling",
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
    // Set default date to today
    const today = new Date();
    setScheduleDate(today.toISOString().split('T')[0]);
    setScheduleOpen(true);
  };

  const handleScheduleSubmit = () => {
    if (!selectedBookmark || !scheduleDate) return;
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    scheduleMutation.mutate({
      bookmark_id: selectedBookmark.id,
      scheduled_for: scheduledFor,
    });
  };

  const handleMarkDone = (bookmark: Bookmark) => {
    markDoneMutation.mutate(bookmark.id);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your watchlist...</p>
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

  // Group bookmarks
  const continueWatching = bookmarks.filter((b) => b.status === "watching");
  const backlog = bookmarks.filter((b) => b.status === "backlog");
  const completed = bookmarks.filter((b) => b.status === "done");

  // Hero bookmark (next scheduled or first watching)
  const heroBookmark = continueWatching[0] || backlog[0] || null;

  // Group by mood
  const byMood: Record<string, Bookmark[]> = {};
  bookmarks.forEach((b) => {
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
      <TopNav onSearchClick={() => setSearchOpen(true)} notificationCount={unreadCount} />
      
      {/* Hero Banner */}
      <HeroBanner
        bookmark={heroBookmark}
        onPlay={handlePlay}
        onMoreInfo={handleMoreInfo}
      />

      {/* Rails */}
      <div className="relative z-10 -mt-20 pb-16 space-y-2">
        {continueWatching.length > 0 && (
          <Rail
            title="Continue Watching"
            bookmarks={continueWatching}
            onSchedule={handleSchedule}
            onMarkDone={handleMarkDone}
            onAddToPlan={handleAddToPlan}
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
            />
          ))}

        {completed.length > 0 && (
          <Rail
            title="Recently Watched"
            bookmarks={completed}
            onSchedule={handleSchedule}
            onMarkDone={handleMarkDone}
            onAddToPlan={handleAddToPlan}
          />
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

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        bookmarks={bookmarks}
      />

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule "{selectedBookmark?.title}"</DialogTitle>
            <DialogDescription>
              Pick a date and time to watch this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleScheduleSubmit} 
                disabled={scheduleMutation.isPending || !scheduleDate}
              >
                {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default Dashboard;
