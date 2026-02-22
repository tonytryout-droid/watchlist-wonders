import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link as LinkIcon, Loader2, Upload, X, Plus, Clock, Tag, FileText, Image, Film, Tv, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { detectProvider, getMoodEmoji } from "@/lib/utils";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { enrichWithTMDB, enrichWithYouTube, extractYouTubeVideoId } from "@/services/enrichment";
import { ConfirmMetadataDialog, type ConfirmMetadataPayload } from "@/components/bookmarks/ConfirmMetadataDialog";
import type { Bookmark } from "@/types/database";

const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "animation", "family",
  "relaxing", "inspiring", "intense", "thoughtful", "nostalgic",
  "uplifting", "dark", "quirky", "epic", "emotional", "fun", "educational"
];

const TYPE_OPTIONS: { value: Bookmark["type"]; label: string; icon: React.ElementType }[] = [
  { value: "movie", label: "Movie", icon: Film },
  { value: "series", label: "Series", icon: Tv },
  { value: "episode", label: "Episode", icon: Play },
  { value: "video", label: "Video", icon: Play },
  { value: "doc", label: "Document", icon: FileText },
  { value: "other", label: "Other", icon: LinkIcon },
];

const NewBookmark = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [url, setUrl] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Bookmark["type"]>("movie");
  const [provider, setProvider] = useState<Bookmark["provider"]>("generic");
  const [runtimeMinutes, setRuntimeMinutes] = useState<number | null>(null);
  const [releaseYear, setReleaseYear] = useState<number | null>(null);
  const [posterUrl, setPosterUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Confirm metadata dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitial, setConfirmInitial] = useState<ConfirmMetadataPayload>({ url: "" });

  // Create bookmark mutation
  const createBookmarkMutation = useMutation({
    mutationFn: async (bookmarkData: any) => {
      const bookmark = await bookmarkService.createBookmark(bookmarkData);
      // Upload attachments if any
      if (attachments.length > 0) {
        setUploadProgress(0);
        for (let i = 0; i < attachments.length; i++) {
          await attachmentService.createAttachment(attachments[i], bookmark.id);
          setUploadProgress(i + 1);
        }
      }
      return bookmark;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setUploadProgress(0);
      toast({
        title: "Bookmark saved!",
        description: `"${title}" has been added to your library.`,
      });
      navigate("/");
    },
    onError: (error: any) => {
      setUploadProgress(0);
      toast({
        title: "Error saving bookmark",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUrlPaste = async () => {
    if (!url.trim()) return;

    setIsEnriching(true);
    const detectedProvider = detectProvider(url);
    setProvider(detectedProvider);

    try {
      const res = await fetch(
        import.meta.env.VITE_ENRICH_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        },
      );

      type EnrichResult = {
        ok: boolean;
        provider: Bookmark["provider"] | "unknown";
        canonicalUrl: string;
        title?: string;
        posterUrl?: string;
        runtimeMinutes?: number | null;
        metadata?: Record<string, unknown>;
        blocked?: boolean;
        error?: { message: string; step?: string; status?: number };
      };

      if (!res.ok) {
        throw new Error(`Enrich request failed: ${res.status}`);
      }

      const data: EnrichResult = await res.json();

      const resolvedProvider = data.provider === "unknown" ? detectedProvider : data.provider;
      setProvider(resolvedProvider);
      setCanonicalUrl(data.canonicalUrl || null);
      setMetadata(data.metadata || {});

      // Check if enrichment failed or returned partial data
      const hasTitle = data.ok && data.title;
      const hasPoster = data.ok && data.posterUrl;

      if (!data.ok || !hasTitle) {
        // Open confirm dialog for user to fill missing data
        setConfirmInitial({
          url: url.trim(),
          provider: resolvedProvider,
          title: data.title,
          posterUrl: data.posterUrl,
          runtimeMinutes: data.runtimeMinutes,
          type: detectedProvider === "youtube" ? "video" : "movie",
          blocked: data.blocked,
          debugMessage: data.error?.message,
        });
        setConfirmOpen(true);
        return;
      }

      // Auto-fill form with successful enrichment
      const ogMetadata = data.metadata?.og as
        | {
            title?: string;
            image?: string;
            description?: string;
            siteName?: string;
            type?: string;
          }
        | undefined;

      if (!title.trim() && data.title) {
        setTitle(data.title);
      }

      if (!notes.trim() && ogMetadata?.description) {
        setNotes(ogMetadata.description);
      }

      if (!posterUrl.trim() && data.posterUrl) {
        setPosterUrl(data.posterUrl);
      }

      if (ogMetadata?.type?.includes("video")) {
        setType("video");
      } else if (ogMetadata?.type?.includes("episode")) {
        setType("episode");
      } else if (ogMetadata?.type?.includes("movie")) {
        setType("movie");
      } else if (detectedProvider === "youtube") {
        setType("video");
      }

      // Secondary enrichment: TMDB for movies/series, YouTube for videos
      const resolvedType =
        ogMetadata?.type?.includes("movie") ? "movie"
        : ogMetadata?.type?.includes("episode") ? "series"
        : detectedProvider === "youtube" ? "video"
        : type;

      if ((resolvedType === "movie" || resolvedType === "series") && data.title) {
        const tmdb = await enrichWithTMDB(
          data.title,
          resolvedType === "series" ? "tv" : "movie",
          null,
        );
        if (tmdb) {
          if (!posterUrl.trim() && tmdb.poster_url) setPosterUrl(tmdb.poster_url);
          if (tmdb.release_year && !releaseYear) setReleaseYear(tmdb.release_year);
          setMetadata((prev) => ({
            ...prev,
            tmdb_id: tmdb.tmdb_id,
            vote_average: tmdb.vote_average,
            backdrop_url: tmdb.backdrop_url,
          }));
        }
      } else if (resolvedType === "video" && detectedProvider === "youtube") {
        const videoId = extractYouTubeVideoId(url.trim());
        if (videoId) {
          const ytData = await enrichWithYouTube(videoId);
          if (ytData) {
            if (!title.trim() && ytData.title) setTitle(ytData.title);
            if (!posterUrl.trim() && ytData.thumbnail_url) setPosterUrl(ytData.thumbnail_url);
            if (!runtimeMinutes && ytData.duration_minutes) setRuntimeMinutes(ytData.duration_minutes);
            setMetadata((prev) => ({
              ...prev,
              channel_name: ytData.channel_name,
            }));
          }
        }
      }

      toast({
        title: "Details fetched",
        description: `Loaded metadata from ${ogMetadata?.siteName || detectedProvider}.`,
      });
    } catch (error: any) {
      // On complete failure, open confirm dialog
      setConfirmInitial({
        url: url.trim(),
        provider: detectedProvider,
        type: detectedProvider === "youtube" ? "video" : "movie",
        blocked: false,
        debugMessage: error?.message || "Unable to fetch metadata",
      });
      setConfirmOpen(true);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleConfirmMetadata = (data: {
    url: string;
    provider?: string;
    title: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
    type: Bookmark["type"];
  }) => {
    setTitle(data.title);
    if (data.posterUrl) setPosterUrl(data.posterUrl);
    if (data.runtimeMinutes) setRuntimeMinutes(data.runtimeMinutes);
    setType(data.type);
    
    toast({
      title: "Details confirmed",
      description: "You can now save the bookmark or add more details.",
    });
  };

  const handleMoodToggle = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for this bookmark.",
        variant: "destructive",
      });
      return;
    }

    createBookmarkMutation.mutate({
      title: title.trim(),
      type,
      provider,
      source_url: url || null,
      canonical_url: canonicalUrl,
      runtime_minutes: runtimeMinutes,
      release_year: releaseYear,
      poster_url: posterUrl || null,
      notes: notes || null,
      tags,
      mood_tags: selectedMoods,
      status: 'backlog',
      metadata,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold">Add Bookmark</h1>
            </div>
            <Button type="submit" form="bookmark-form" disabled={createBookmarkMutation.isPending}>
              {createBookmarkMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadProgress > 0
                    ? `Uploading ${uploadProgress}/${attachments.length}...`
                    : "Saving..."}
                </>
              ) : (
                "Save Bookmark"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <form id="bookmark-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">URL (optional)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="Paste a URL to auto-fill details..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleUrlPaste}
                disabled={!url.trim() || isEnriching}
              >
                {isEnriching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Fetch"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports YouTube, IMDb, Netflix, and more
            </p>
          </div>

          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Bookmark["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="runtime">Runtime (minutes)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="runtime"
                  type="number"
                  placeholder="90"
                  value={runtimeMinutes || ""}
                  onChange={(e) => setRuntimeMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Release Year</Label>
              <Input
                id="year"
                type="number"
                placeholder="2024"
                value={releaseYear || ""}
                onChange={(e) => setReleaseYear(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster">Poster URL</Label>
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="poster"
                  type="url"
                  placeholder="https://..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes or description..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Mood Tags */}
          <div className="space-y-3">
            <Label>Mood Tags</Label>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((mood) => (
                <Badge
                  key={mood}
                  variant={selectedMoods.includes(mood) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => handleMoodToggle(mood)}
                >
                  {getMoodEmoji(mood)} {mood}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Tags */}
          <div className="space-y-3">
            <Label htmlFor="tags">Custom Tags</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="tags"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                id="attachments"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="attachments" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images and PDFs supported
                </p>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="grid gap-2">
                {attachments.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {file.type.startsWith("image/") ? (
                        <Image className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAttachment(i)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Confirm Metadata Dialog */}
      <ConfirmMetadataDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        initial={confirmInitial}
        onConfirm={handleConfirmMetadata}
      />
    </div>
  );
};

export default NewBookmark;
