import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { bookmarkService } from "@/services/bookmarks";
import { detectProvider } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Bookmark } from "@/types/database";

const PROVIDER_LABELS: Record<Bookmark["provider"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X / Twitter",
  tiktok: "TikTok",
  reddit: "Reddit",
  letterboxd: "Letterboxd",
  rottentomatoes: "Rotten Tomatoes",
  netflix: "Netflix",
  imdb: "IMDb",
  generic: "the web",
};

const PROVIDER_MARKS: Record<Bookmark["provider"], string> = {
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

function resolveFallbackTitle(url: string, provider: Bookmark["provider"]): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    const sourceLabel =
      provider !== "generic" ? PROVIDER_LABELS[provider] : hostname || PROVIDER_LABELS.generic;
    return `Shared from ${sourceLabel}`;
  } catch {
    return `Shared from ${PROVIDER_LABELS[provider]}`;
  }
}

function resolveType(provider: Bookmark["provider"]): Bookmark["type"] {
  const videoProviders = ["youtube", "instagram", "tiktok", "facebook", "x", "twitch"];
  if (videoProviders.includes(provider)) return "video";
  return "movie";
}

type SaveState = "saving" | "saved" | "error";

const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [saveState, setSaveState] = useState<SaveState>("saving");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const saveStartedRef = useRef(false);

  const sharedUrl = searchParams.get("url") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedTitle = searchParams.get("title") ?? "";

  const targetUrl = useMemo(
    () => sharedUrl || extractUrlFromText(sharedText) || "",
    [sharedUrl, sharedText],
  );
  const detectedProvider = useMemo<Bookmark["provider"]>(
    () => (targetUrl ? detectProvider(targetUrl) : "generic"),
    [targetUrl],
  );

  const saveShare = useCallback(async () => {
    if (!targetUrl) return;

    const trimmedTitle = sharedTitle.trim();
    const trimmedText = sharedText.trim();
    const note =
      trimmedText.length > 0 && trimmedText !== targetUrl ? trimmedText.slice(0, 500) : null;

    await bookmarkService.createBookmark({
      title: trimmedTitle || resolveFallbackTitle(targetUrl, detectedProvider),
      type: resolveType(detectedProvider),
      provider: detectedProvider,
      source_url: targetUrl,
      status: "backlog",
      notes: note,
      metadata: {
        share_target: true,
        share_raw_title: trimmedTitle || null,
        share_raw_text: trimmedText || null,
        share_received_at: new Date().toISOString(),
      },
    });
  }, [detectedProvider, sharedText, sharedTitle, targetUrl]);

  // Restore pending share payload from sessionStorage when we return from auth.
  useEffect(() => {
    if (sharedUrl || sharedText || sharedTitle) return;

    const pendingUrl = sessionStorage.getItem("pendingShareUrl");
    const pendingTitle = sessionStorage.getItem("pendingShareTitle");
    const pendingText = sessionStorage.getItem("pendingShareText");
    if (!pendingUrl) return;

    const params = new URLSearchParams();
    params.set("url", pendingUrl);
    if (pendingTitle) params.set("title", pendingTitle);
    if (pendingText) params.set("text", pendingText);
    navigate(`/share-target?${params.toString()}`, { replace: true });

    sessionStorage.removeItem("pendingShareUrl");
    sessionStorage.removeItem("pendingShareTitle");
    sessionStorage.removeItem("pendingShareText");
  }, [navigate, sharedText, sharedTitle, sharedUrl]);

  // If not logged in, persist payload and hand off to auth.
  useEffect(() => {
    if (authLoading || user) return;

    if (targetUrl) {
      sessionStorage.setItem("pendingShareUrl", targetUrl);
      if (sharedTitle) sessionStorage.setItem("pendingShareTitle", sharedTitle);
      if (sharedText) sessionStorage.setItem("pendingShareText", sharedText);
    }

    navigate(`/auth?redirect=${encodeURIComponent("/share-target")}`, { replace: true });
  }, [authLoading, navigate, sharedText, sharedTitle, targetUrl, user]);

  // Save immediately once auth is ready. Enrichment happens asynchronously server-side.
  useEffect(() => {
    if (authLoading || !user || !targetUrl || saveStartedRef.current) return;

    saveStartedRef.current = true;
    setSaveState("saving");
    setSaveError(null);

    void (async () => {
      try {
        await saveShare();
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        setSaveState("saved");
        toast({ title: "Saved", description: "Added to your watchlist." });
        navigate("/dashboard", { replace: true });
      } catch {
        saveStartedRef.current = false;
        setSaveState("error");
        setSaveError("Could not save this share right now.");
      }
    })();
  }, [authLoading, navigate, queryClient, saveShare, targetUrl, toast, user, retryCount]);

  const handleRetry = () => {
    if (!targetUrl) return;
    saveStartedRef.current = false;
    setSaveState("saving");
    setSaveError(null);
    setRetryCount((prev) => prev + 1);
  };

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

  if (saveState === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Could not save share</p>
          <p className="text-sm text-muted-foreground">{saveError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
          <Button onClick={() => navigate(`/new?url=${encodeURIComponent(targetUrl)}`)}>
            Add manually
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-sm font-semibold text-primary">
        {PROVIDER_MARKS[detectedProvider]}
      </div>
      <Loader2 className="w-7 h-7 text-primary animate-spin" />
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-foreground">
          Saving from {PROVIDER_LABELS[detectedProvider]}...
        </p>
        <p className="text-sm text-muted-foreground">
          Capturing now, details will enrich in the background.
        </p>
      </div>
      {saveState === "saved" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LinkIcon className="w-4 h-4" />
          Redirecting...
        </div>
      )}
    </div>
  );
};

export default ShareTarget;
