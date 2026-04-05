import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, Check, Trash2, Edit2,
  Clock, Tag, ExternalLink, Save, X,
  FileText, Download, Upload, Loader2, Star,
  Globe, Lock, Unlock, Copy, Plus, Shuffle,
  CalendarCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useWatchProviders } from "@/hooks/useWatchProviders";
import { useTmdbSearch } from "@/hooks/useTmdbSearch";
import { useSimilarTitles } from "@/hooks/useSimilarTitles";
import { useTmdbDetails } from "@/hooks/useTmdbDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sharingService } from "@/services/sharing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { useToast } from "@/hooks/use-toast";
import { getPreferredRegionFromBrowser } from "@/lib/localeRegion";
import { formatRuntime, getMoodEmoji } from "@/lib/utils";
import {
  buildAvailabilityFromWatchProviders,
  buildFallbackSearchUrls,
  DEFAULT_WATCH_REGION,
  getAvailabilityFromBookmark,
  isAvailabilityFresh,
  resolveAndFetchAvailability,
  type BookmarkAvailability,
} from "@/services/watchAvailability";
import type { Bookmark } from "@/types/database";

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const STATUS_OPTIONS: { value: Bookmark["status"]; label: string }[] = [
  { value: "backlog", label: "Want to Watch" },
  { value: "watching", label: "Currently Watching" },
  { value: "done", label: "Watched" },
  { value: "dropped", label: "Not for Me" },
  { value: "scheduled", label: "Scheduled" },
];

const STATUS_CONFIG: Record<
  Bookmark["status"],
  { dotClass: string; borderClass: string }
> = {
  backlog:   { dotClass: "bg-muted-foreground",   borderClass: "border-l-muted-foreground" },
  watching:  { dotClass: "bg-blue-500",            borderClass: "border-l-blue-500" },
  done:      { dotClass: "bg-green-500",           borderClass: "border-l-green-500" },
  dropped:   { dotClass: "bg-destructive/70",      borderClass: "border-l-destructive/70" },
  scheduled: { dotClass: "bg-amber-400",           borderClass: "border-l-amber-400" },
};

const BookmarkDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [watchDialogOpen, setWatchDialogOpen] = useState(false);
  const [isOpeningWatch, setIsOpeningWatch] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Bookmark["status"]>("backlog");

  const { data: bookmark, isLoading, error } = useQuery({
    queryKey: ['bookmark', id],
    queryFn: () => bookmarkService.getBookmark(id!),
    enabled: !!id,
  });

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['attachments', id],
    queryFn: () => attachmentService.getAttachments(id!),
    enabled: !!id,
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentService.deleteAttachment(attachmentId),
    onSuccess: () => {
      setDeletingAttachmentId(null);
      refetchAttachments();
      toast({ title: "File deleted" });
    },
    onError: () => {
      setDeletingAttachmentId(null);
      toast({
        title: "Failed to delete attachment",
        description: "Could not delete the attachment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      await attachmentService.createAttachment(file, id);
      refetchAttachments();
      toast({ title: "File uploaded", description: file.name });
      if (attachFileRef.current) attachFileRef.current.value = "";
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the file. Please try again.", variant: "destructive" });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Bookmark>) => bookmarkService.updateBookmark(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setIsEditing(false);
      toast({ title: "Changes saved" });
    },
    onError: () => {
      toast({
        title: "Couldn't save changes",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookmarkService.deleteBookmark(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({ title: "Removed from your list" });
      navigate("/dashboard");
    },
    onError: () => {
      toast({
        title: "Couldn't remove this title",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const makePublicMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPublic(id!),
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      const shareUrl = `${window.location.origin}/share/${token}`;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast({ title: "Share link copied!", description: shareUrl });
    },
    onError: () => {
      toast({
        title: "Couldn't create share link",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const makePrivateMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPrivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      toast({ title: "Sharing turned off" });
    },
    onError: () => {
      toast({
        title: "Couldn't turn off sharing",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const vaultMutation = useMutation({
    mutationFn: (vaulted: boolean) =>
      bookmarkService.updateBookmark(id!, { is_vaulted: vaulted }),
    onSuccess: (_, vaulted) => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: vaulted ? "Moved to Vault" : "Removed from Vault",
        description: vaulted
          ? "Hidden from dashboard by default."
          : "This title is visible on your dashboard again.",
      });
    },
    onError: () => {
      toast({
        title: "Couldn't update vault",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ rating, review }: { rating: number | null; review?: string | null }) =>
      bookmarkService.rateBookmark(id!, rating, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: () => {
      toast({ title: "Couldn't save your rating", description: "Please try again.", variant: "destructive" });
    },
  });

  const addSimilarMutation = useMutation({
    mutationFn: (item: { id: number; title: string; posterUrl: string | null; release_year: number | null; media_type: 'movie' | 'tv' }) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: item.media_type === 'tv' ? 'series' : 'movie',
        provider: 'tmdb',
        poster_url: item.posterUrl,
        release_year: item.release_year,
        metadata: { tmdb_id: item.id },
      }),
    onSuccess: (newBm) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({ title: "Added to your list", description: newBm.title });
    },
    onError: () => {
      toast({ title: "Couldn't add to list", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (bookmark) {
      setEditTitle(bookmark.title);
      setEditNotes(bookmark.notes || "");
      setEditStatus(bookmark.status);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editTitle,
      notes: editNotes || null,
      status: editStatus,
    });
  };

  const handleStatusChange = (status: Bookmark["status"]) => {
    updateMutation.mutate({ status });
  };

  // Handle both camelCase (tmdbId) and snake_case (tmdb_id) — legacy data may differ
  const rawTmdbId = bookmark?.metadata?.tmdb_id ?? bookmark?.metadata?.tmdbId;
  const tmdbId = (typeof rawTmdbId === "string" || typeof rawTmdbId === "number")
    ? rawTmdbId
    : undefined;
  const storedOverview = bookmark?.metadata?.overview as string | undefined;
  const { data: resolvedTmdbId } = useTmdbSearch(
    !tmdbId ? bookmark?.title : null,
    bookmark?.type || "movie",
    storedOverview,
  );
  const effectiveTmdbId = tmdbId ?? resolvedTmdbId ?? undefined;

  const preferredRegion = getPreferredRegionFromBrowser() ?? DEFAULT_WATCH_REGION;
  const cachedAvailability = getAvailabilityFromBookmark(bookmark);
  const hasFreshCache = isAvailabilityFresh(cachedAvailability, preferredRegion);
  const shouldRefreshProviders = Boolean(effectiveTmdbId) && !hasFreshCache;
  const { data: watchProviders } = useWatchProviders(
    shouldRefreshProviders ? effectiveTmdbId : undefined,
    bookmark?.type || "movie",
    preferredRegion,
  );
  const [watchSessionAvailability, setWatchSessionAvailability] = useState<BookmarkAvailability | null>(null);
  useEffect(() => {
    setWatchSessionAvailability(null);
  }, [bookmark?.id]);

  const currentAvailability = watchSessionAvailability
    ?? (watchProviders && bookmark
      ? buildAvailabilityFromWatchProviders(
          {
            title: bookmark.title,
            type: bookmark.type,
            provider: bookmark.provider,
            metadata: bookmark.metadata,
          },
          watchProviders,
          preferredRegion,
          typeof effectiveTmdbId === "number" ? effectiveTmdbId : null,
        )
      : null)
    ?? cachedAvailability;

  const { data: similarTitles = [] } = useSimilarTitles(effectiveTmdbId, bookmark?.type || "movie");
  const { data: tmdbDetails } = useTmdbDetails(effectiveTmdbId, bookmark?.type || "movie");

  const { data: allBookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 60 * 1000,
  });
  const ownedTmdbIds = new Set(
    allBookmarks
      .map((b) => {
        const bid = b.metadata?.tmdb_id ?? b.metadata?.tmdbId;
        return typeof bid === 'string' ? parseInt(bid, 10) : bid;
      })
      .filter((bid) => typeof bid === 'number' && !isNaN(bid))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Title not found</p>
            <p className="text-sm text-muted-foreground">This bookmark may have been removed or doesn't exist.</p>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="w-full sm:w-auto">
            Back to My List
          </Button>
        </div>
      </div>
    );
  }

  const imageUrl = bookmark.backdrop_url
    || (bookmark.metadata?.backdrop_url as string | undefined)
    || bookmark.poster_url;
  const voteAverage = bookmark.metadata?.vote_average as number | undefined;
  const overview = bookmark.metadata?.overview as string | undefined;

  const availableNowProviders = currentAvailability?.providers.filter((p) => p.type === "subscription") ?? [];
  const rentOrBuyProviders = currentAvailability?.providers.filter((p) => p.type !== "subscription") ?? [];
  const fallbackSearch = buildFallbackSearchUrls(bookmark.title);
  const noTmdbMatch = currentAvailability?.status === "no_tmdb_match" || (!effectiveTmdbId && resolvedTmdbId === null);

  const openSafeLink = (url: string) => {
    if (!isSafeUrl(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const persistAvailability = async (availability: BookmarkAvailability, resolvedId?: number | null) => {
    const nextMetadata = {
      ...(bookmark.metadata || {}),
      availability,
      ...(resolvedId && !bookmark.metadata?.tmdb_id && !bookmark.metadata?.tmdbId
        ? { tmdb_id: resolvedId }
        : {}),
    };
    try {
      await bookmarkService.updateBookmark(bookmark.id, {
        metadata: nextMetadata,
        availability,
      });
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
    } catch {
      // Non-blocking cache persistence.
    }
  };

  const openWatchFlow = async () => {
    setIsOpeningWatch(true);
    try {
      let availability = currentAvailability;
      if (!availability || !isAvailabilityFresh(availability, preferredRegion)) {
        const resolved = await resolveAndFetchAvailability(
          {
            title: bookmark.title,
            type: bookmark.type,
            provider: bookmark.provider,
            metadata: bookmark.metadata,
          },
          preferredRegion,
        );
        availability = resolved.availability;
        setWatchSessionAvailability(availability);
        await persistAvailability(availability, resolved.tmdbId);
      }

      if (availability && availability.providers.length === 1) {
        openSafeLink(availability.providers[0].url);
        return;
      }

      setWatchDialogOpen(true);
    } catch {
      toast({
        title: "Could not load watch options",
        description: "Use Search elsewhere while we retry provider data.",
        variant: "destructive",
      });
      setWatchDialogOpen(true);
    } finally {
      setIsOpeningWatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero/Backdrop — taller for a cinematic feel */}
      <div className="relative h-[55vh] md:h-[65vh] bg-secondary">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl font-bold text-muted-foreground">
              {bookmark.title.charAt(0)}
            </span>
          </div>
        )}
        {/* Netflix-style gradient: bottom-heavy for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />

        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-[80px] left-4 bg-background/80 backdrop-blur focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Top-right actions */}
        <div className="absolute top-[76px] right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleStartEdit}
            aria-label="Edit"
          >
            <Edit2 className="w-5 h-5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 backdrop-blur text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove from list"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from your list?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{bookmark.title}" will be permanently removed. You can always add it back later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content — overlapping the hero */}
      <div className="container mx-auto px-4 lg:px-8 -mt-48 relative z-10 pb-24">
        {isEditing ? (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as Bookmark["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">My Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Poster thumbnail — desktop only */}
            {bookmark.poster_url && (
              <div className="hidden md:block shrink-0 w-44 -mt-2">
                <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img
                    src={bookmark.poster_url}
                    alt={bookmark.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Main info */}
            <div className="flex-1 min-w-0">

              {/* ── LEVEL 1: DECISION LAYER ── */}

              {/* Title */}
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
                {bookmark.title}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-5">
                {bookmark.release_year && <span>{bookmark.release_year}</span>}
                {bookmark.release_year && <span>•</span>}
                <span className="capitalize">{bookmark.type}</span>
                {bookmark.runtime_minutes && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRuntime(bookmark.runtime_minutes)}
                    </span>
                  </>
                )}
                {voteAverage != null && voteAverage > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-yellow-400" />
                      {voteAverage.toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              {/* Status selector — colored left border per status */}
              <div className="mb-5">
                <Select value={bookmark.status} onValueChange={handleStatusChange}>
                  <SelectTrigger
                    className={`w-[200px] border-l-4 pl-3 ${STATUS_CONFIG[bookmark.status].borderClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CONFIG[bookmark.status].dotClass}`}
                      />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${STATUS_CONFIG[opt.value].dotClass}`}
                          />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary actions */}
              <div className="flex flex-wrap gap-3 mb-6">
                <Button
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white gap-2 px-6"
                  onClick={openWatchFlow}
                  disabled={isOpeningWatch}
                >
                  {isOpeningWatch ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  {isOpeningWatch ? "Loading options" : "Watch Now"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => handleStatusChange("done")}
                  disabled={bookmark.status === "done"}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  {bookmark.status === "done" ? "Already Watched" : "Mark as Watched"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => vaultMutation.mutate(!bookmark.is_vaulted)}
                  disabled={vaultMutation.isPending}
                  className="gap-2"
                >
                  {bookmark.is_vaulted ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      Remove from Vault
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Move to Vault
                    </>
                  )}
                </Button>
              </div>

              {/* My Rating — visible at a glance */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        rateMutation.mutate({
                          rating: bookmark.user_rating === star ? null : star,
                        })
                      }
                      className="p-1 hover:scale-110 transition-transform"
                      aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          (bookmark.user_rating || 0) >= star
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/50 hover:text-yellow-400/60"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {bookmark.user_rating ? (
                  <span className="text-sm text-muted-foreground">
                    {bookmark.user_rating}/5
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic">
                    Rate this
                  </span>
                )}
              </div>

              {/* User review — displayed when present (was never rendered before) */}
              {bookmark.user_review && (
                <blockquote className="mb-5 border-l-2 border-primary/40 pl-4 max-w-xl">
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    {bookmark.user_review}
                  </p>
                </blockquote>
              )}

              {/* Watched date — shown for completed bookmarks */}
              {bookmark.status === "done" && bookmark.watched_at && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
                  <CalendarCheck className="w-3.5 h-3.5 text-green-500" />
                  <span>
                    Watched on{" "}
                    <span className="text-foreground font-medium">
                      {format(new Date(bookmark.watched_at), "MMMM d, yyyy")}
                    </span>
                  </span>
                </div>
              )}

              {/* Synopsis */}
              {overview && (
                <div className="mb-6 max-w-xl">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">About</p>
                  <p
                    className={`text-muted-foreground text-sm leading-relaxed ${
                      synopsisExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {overview}
                  </p>
                  {overview.length > 200 && (
                    <button
                      type="button"
                      onClick={() => setSynopsisExpanded((prev) => !prev)}
                      className="mt-1 text-xs text-primary hover:underline focus-visible:outline-none"
                    >
                      {synopsisExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {/* WHERE TO WATCH — decision layer */}
              <div className="mb-6 rounded-xl bg-muted/30 border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Where You Can Watch ({currentAvailability?.region ?? preferredRegion})
                </p>

                {availableNowProviders.length > 0 ? (
                  <div className="space-y-2">
                    {availableNowProviders.slice(0, 4).map((provider) => (
                      <div
                        key={`${provider.providerId}-${provider.type}`}
                        className="flex items-center justify-between rounded-lg bg-background/70 border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {provider.logoUrl && (
                            <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />
                          )}
                          <span className="text-sm font-medium truncate">{provider.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openSafeLink(provider.url)}
                          className="gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Watch
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not available on subscription platforms right now.</p>
                )}

                {rentOrBuyProviders.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rent or Buy</p>
                    {rentOrBuyProviders.slice(0, 4).map((provider) => (
                      <div
                        key={`${provider.providerId}-${provider.type}`}
                        className="flex items-center justify-between rounded-lg bg-background/70 border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {provider.logoUrl && (
                            <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />
                          )}
                          <span className="text-sm font-medium truncate">{provider.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSafeLink(provider.url)}
                          className="gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {provider.type === "rent" ? "Rent" : "Buy"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Search Elsewhere</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.google)}>Search on Google</Button>
                    <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.youtube)}>Search on YouTube</Button>
                    <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.web)}>Search on Web</Button>
                  </div>
                </div>
              </div>

              {/* ── LEVEL 2: MID LAYER ── */}

              {/* Genre chips */}
              {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {tmdbDetails.genres.map((g) => (
                    <span
                      key={g.id}
                      className="text-xs bg-white/10 text-foreground rounded-full px-3 py-1"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Cast row */}
              {tmdbDetails?.cast && tmdbDetails.cast.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Top Cast
                  </p>
                  <div className="flex gap-4 overflow-x-auto pb-1 hide-scrollbar">
                    {tmdbDetails.cast.map((actor) => (
                      <div
                        key={actor.name}
                        className="shrink-0 flex flex-col items-center w-16 text-center"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted mb-1.5 ring-1 ring-white/10">
                          {actor.profileUrl ? (
                            <img
                              src={actor.profileUrl}
                              alt={actor.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                              {actor.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] font-medium leading-tight truncate w-full">
                          {actor.name}
                        </p>
                        <p className="text-[9px] text-muted-foreground leading-tight truncate w-full">
                          {actor.character}
                        </p>
                      </div>
                    ))}
                  </div>
                  {tmdbDetails.director && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Directed by{' '}
                      <span className="text-foreground font-medium">
                        {tmdbDetails.director}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Personal content — mood tags, tags, notes (moved from collapsible) */}
              {(bookmark.mood_tags?.length > 0 ||
                bookmark.tags?.length > 0 ||
                bookmark.notes) && (
                <div className="mb-6 space-y-4">
                  {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Mood
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bookmark.mood_tags.map((mood) => (
                          <Badge key={mood} variant="outline">
                            {getMoodEmoji(mood)} {mood}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bookmark.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {bookmark.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        My Notes
                      </p>
                      <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                        {bookmark.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source */}
              {bookmark.source_url && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Source</p>
                  {isSafeUrl(bookmark.source_url) ? (
                    <a
                      href={bookmark.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {bookmark.source_url}
                    </a>
                  ) : (
                    <span
                      className="text-muted-foreground flex items-center gap-1 text-sm opacity-70 cursor-not-allowed"
                      aria-disabled="true"
                      title="Invalid or unsafe source URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {bookmark.source_url}
                    </span>
                  )}
                </div>
              )}

              {/* Sharing */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sharing</p>
                {bookmark.is_public && bookmark.share_token ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Globe className="w-3 h-3" />
                      Anyone with the link can view
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const url = `${window.location.origin}/share/${bookmark.share_token}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        toast({ title: "Link copied!" });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => makePrivateMutation.mutate()}
                      disabled={makePrivateMutation.isPending}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Make private
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => makePublicMutation.mutate()}
                    disabled={makePublicMutation.isPending}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Share & copy link
                  </Button>
                )}
              </div>

              {/* Files */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Files {attachments.length > 0 && `(${attachments.length})`}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => attachFileRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                  <input
                    ref={attachFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleAttachFile}
                  />
                </div>
                {attachments.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => attachFileRef.current?.click()}
                    className="w-full border border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors"
                  >
                    No files yet — click to upload
                  </button>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
                      >
                        {att.file_type?.startsWith("image/") ? (
                          <img
                            src={att.file_url}
                            alt={att.file_name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          {att.size && (
                            <p className="text-xs text-muted-foreground">
                              {(att.size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                        {isSafeUrl(att.file_url) ? (
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-background rounded transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </a>
                        ) : (
                          <span
                            className="p-1.5 rounded text-muted-foreground/50 cursor-not-allowed"
                            aria-disabled="true"
                            aria-label="Invalid or unsafe attachment URL"
                            title="Invalid or unsafe attachment URL"
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => { setDeletingAttachmentId(att.id); deleteAttachmentMutation.mutate(att.id); }}
                          disabled={deletingAttachmentId === att.id}
                        >
                          {deletingAttachmentId === att.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── LEVEL 4: SIMILAR TITLES ── */}
              {similarTitles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Shuffle className="w-4 h-4" />
                    You Might Also Like
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                    {similarTitles.map((item) => {
                      const alreadyOwned = ownedTmdbIds.has(item.id);
                      return (
                        <div key={item.id} className="shrink-0 w-28 group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-1.5">
                            {item.posterUrl ? (
                              <img
                                src={item.posterUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-2xl font-bold text-muted-foreground">{item.title.charAt(0)}</span>
                              </div>
                            )}
                            {!alreadyOwned && (
                              <button
                                type="button"
                                onClick={() => addSimilarMutation.mutate(item)}
                                disabled={addSimilarMutation.isPending}
                                className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                aria-label={`Add ${item.title} to your list`}
                              >
                                <Plus className="w-6 h-6 text-primary" />
                              </button>
                            )}
                            {alreadyOwned && (
                              <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-foreground truncate">{item.title}</p>
                          {item.release_year && (
                            <p className="text-[10px] text-muted-foreground">{item.release_year}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={watchDialogOpen} onOpenChange={setWatchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{bookmark.title}</DialogTitle>
            <DialogDescription>
              Where you can watch
              {currentAvailability?.region ? ` (${currentAvailability.region})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {noTmdbMatch ? (
              <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-sm text-muted-foreground">
                We couldn't match this title automatically. Try searching below.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available now</p>
                {availableNowProviders.length > 0 ? (
                  availableNowProviders.map((provider) => (
                    <div key={`${provider.providerId}-${provider.type}`} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {provider.logoUrl && <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />}
                        <span className="text-sm truncate">{provider.name}</span>
                      </div>
                      <Button size="sm" onClick={() => openSafeLink(provider.url)}>Watch</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Not available on streaming right now.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search elsewhere</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.google)}>Search on Google</Button>
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.youtube)}>Search on YouTube</Button>
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.web)}>Search on Web</Button>
              </div>
            </div>

            {rentOrBuyProviders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rent or buy</p>
                {rentOrBuyProviders.map((provider) => (
                  <div key={`${provider.providerId}-${provider.type}`} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {provider.logoUrl && <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />}
                      <span className="text-sm truncate">{provider.name}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openSafeLink(provider.url)}>
                      {provider.type === "rent" ? "Rent" : "Buy"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookmarkDetail;
