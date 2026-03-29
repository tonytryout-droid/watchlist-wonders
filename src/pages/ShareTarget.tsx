import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { Loader2, Link as LinkIcon, AlertCircle } from "lucide-react";
import { fbFunctions } from "@/lib/firebase";
import { bookmarkService } from "@/services/bookmarks";
import { detectProvider } from "@/lib/utils";
import { buildSmartFillData } from "@/lib/enrichmentSmartFill";
import { ConfirmMetadataDialog, type ConfirmMetadataPayload } from "@/components/bookmarks/ConfirmMetadataDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Bookmark } from "@/types/database";

const PROVIDER_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X / Twitter",
  tiktok: "TikTok",
  reddit: "Reddit",
  letterboxd: "Letterboxd",
  rottentomatoes: "Rotten Tomatoes",
  netflix: "Netflix",
  imdb: "IMDB",
  generic: "the web",
};

const PROVIDER_MARKS: Record<string, string> = {
  youtube: "YT",
  instagram: "IG",
  facebook: "FB",
  x: "X",
  tiktok: "TT",
  reddit: "R",
  letterboxd: "LB",
  rottentomatoes: "RT",
  netflix: "N",
  imdb: "IMDB",
  generic: "WEB",
};

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match?.[0]) return null;
  return match[0].replace(/[.,!?]+$/, "");
}

type EnrichState = "idle" | "loading" | "done";

function buildCreatePayloadFromShare(
  data: {
    title: string;
    type: Bookmark["type"];
    provider: string;
    url: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
  },
  smartFill: ReturnType<typeof buildSmartFillData> | null,
) {
  return {
    title: data.title,
    type: data.type,
    provider: data.provider as Bookmark["provider"],
    source_url: data.url || null,
    poster_url: data.posterUrl || null,
    runtime_minutes: data.runtimeMinutes,
    release_year: smartFill?.releaseYear ?? null,
    canonical_url: smartFill?.canonicalUrl ?? null,
    status: "backlog" as const,
    tags: smartFill?.tags ?? [],
    mood_tags: smartFill?.moodTags ?? [],
    metadata: smartFill?.metadata ?? {},
  };
}

const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const enrichedRef = useRef(false);
  const [enrichState, setEnrichState] = useState<EnrichState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitial, setConfirmInitial] = useState<ConfirmMetadataPayload | null>(null);
  const [enrichedRaw, setEnrichedRaw] = useState<Record<string, unknown> | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sharedUrl = searchParams.get("url") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedTitle = searchParams.get("title") ?? "";

  // Prefer explicit url param; fallback to first URL found in text
  const targetUrl = sharedUrl || extractUrlFromText(sharedText) || "";
  const detectedProvider = targetUrl ? detectProvider(targetUrl) : null;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof bookmarkService.createBookmark>[0]) =>
      bookmarkService.createBookmark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Saved!", description: "Added to your watchlist." });
      navigate("/dashboard", { replace: true });
    },
    onError: () => {
      setIsSubmitting(false);
      toast({
        title: "Save failed",
        description: "Could not save bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Restore pending share URL/title from sessionStorage if searchParams are empty
  useEffect(() => {
    // Only proceed if no URL params are set
    if (sharedUrl || sharedText || sharedTitle) return;

    const pendingUrl = sessionStorage.getItem("pendingShareUrl");
    const pendingTitle = sessionStorage.getItem("pendingShareTitle");

    if (pendingUrl) {
      // Build query string and navigate to populate searchParams
      const params = new URLSearchParams();
      params.set("url", pendingUrl);
      if (pendingTitle) params.set("title", pendingTitle);
      
      // Navigate with the restored params
      navigate(`/share-target?${params.toString()}`, { replace: true });
      
      // Clean up sessionStorage
      sessionStorage.removeItem("pendingShareUrl");
      sessionStorage.removeItem("pendingShareTitle");
    }
  }, []); // Empty deps to run only once on mount

  // Auth guard: if not logged in, persist the URL and redirect to auth
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (targetUrl) {
        sessionStorage.setItem("pendingShareUrl", targetUrl);
        if (sharedTitle) sessionStorage.setItem("pendingShareTitle", sharedTitle);
      }
      navigate(`/auth?redirect=${encodeURIComponent("/share-target")}`, { replace: true });
    }
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-enrich once user is confirmed
  useEffect(() => {
    if (authLoading || !user || !targetUrl || enrichedRef.current) return;
    enrichedRef.current = true;
    doEnrich(targetUrl);
  }, [authLoading, user, targetUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const doEnrich = async (url: string) => {
    setEnrichState("loading");
    setEnrichError(null);
    const dp = detectProvider(url);

    try {
      const enrichCallable = httpsCallable(fbFunctions, "enrich");
      const result = await enrichCallable({ url });
      const data = result.data as Record<string, unknown>;
      setEnrichedRaw(data);
      const smartFill = buildSmartFillData(data);

      const resolvedProvider =
        typeof data.provider === "string" && data.provider !== "unknown"
          ? data.provider
          : dp;

      let type: Bookmark["type"] = dp === "youtube" ? "video" : "movie";
      if (data.mediaType === "movie") type = "movie";
      else if (data.mediaType === "tv") type = "series";

      const resolvedTitle = typeof data.title === "string" ? data.title.trim() : "";
      const canAutoSave =
        resolvedTitle.length > 0 &&
        !data.blocked &&
        smartFill.matchConfidence !== "low";

      if (canAutoSave) {
        setIsSubmitting(true);
        createMutation.mutate(
          buildCreatePayloadFromShare(
            {
              title: resolvedTitle,
              type,
              provider: resolvedProvider,
              url,
              posterUrl: typeof data.posterUrl === "string" ? data.posterUrl : undefined,
              runtimeMinutes:
                typeof data.runtimeMinutes === "number" ? data.runtimeMinutes : null,
            },
            smartFill,
          ),
          {
            onSettled: () => setIsSubmitting(false),
          },
        );
        return;
      }

      setConfirmInitial({
        url,
        provider: resolvedProvider,
        title: resolvedTitle || sharedTitle,
        posterUrl: typeof data.posterUrl === "string" ? data.posterUrl : undefined,
        runtimeMinutes:
          typeof data.runtimeMinutes === "number" ? data.runtimeMinutes : undefined,
        type,
        blocked: !data.title,
        debugMessage:
          !data.title ? "Could not fetch details for this link." : undefined,
      });
      setConfirmOpen(true);
    } catch {
      setEnrichedRaw(null);
      setConfirmInitial(null);
      setEnrichError("Could not fetch details for this link. Try again or add it manually.");
    } finally {
      setEnrichState("done");
    }
  };

  const handleConfirm = (data: {
    url: string;
    provider?: string;
    title: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
    type: Bookmark["type"];
  }) => {
    const smartFill = enrichedRaw ? buildSmartFillData(enrichedRaw) : null;
    setIsSubmitting(true);
    createMutation.mutate(
      buildCreatePayloadFromShare(
        {
          title: data.title,
          type: data.type,
          provider: data.provider || "generic",
          url: data.url,
          posterUrl: data.posterUrl,
          runtimeMinutes: data.runtimeMinutes,
        },
        smartFill,
      ),
      {
        onSettled: () => setIsSubmitting(false),
      },
    );
  };

  const handleDialogClose = (open: boolean) => {
    setConfirmOpen(open);
    if (!open && !isSubmitting && !createMutation.isPending) {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleManualFallback = () => {
    if (!targetUrl) {
      navigate("/new");
      return;
    }
    navigate(`/new?url=${encodeURIComponent(targetUrl)}`);
  };

  // No URL provided
  if (!authLoading && user && !targetUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <p className="text-muted-foreground">No link was found in the shared content.</p>
        <Button onClick={() => navigate("/new")}>Add manually</Button>
      </div>
    );
  }

  if (enrichError && enrichState === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Could not auto-fetch details</p>
          <p className="text-sm text-muted-foreground">{enrichError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => doEnrich(targetUrl)}>
            Retry
          </Button>
          <Button onClick={handleManualFallback}>Add manually</Button>
        </div>
      </div>
    );
  }

  // Loading state (auth check + enrichment)
  if (authLoading || enrichState === "loading" || isSubmitting || createMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-sm font-semibold text-primary">
          {PROVIDER_MARKS[detectedProvider ?? "generic"] ?? PROVIDER_MARKS.generic}
        </div>
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-foreground">
            Saving from{" "}
            {PROVIDER_LABELS[detectedProvider ?? ""] ?? "the web"}...
          </p>
          <p className="text-sm text-muted-foreground">Fetching details automatically</p>
        </div>
      </div>
    );
  }

  // Confirmation dialog (rendered over a plain background)
  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LinkIcon className="w-8 h-8" />
          <p className="text-sm">Opening WatchMarks...</p>
        </div>
      </div>
      {confirmInitial && (
        <ConfirmMetadataDialog
          open={confirmOpen}
          onOpenChange={handleDialogClose}
          initial={confirmInitial}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
};

export default ShareTarget;
