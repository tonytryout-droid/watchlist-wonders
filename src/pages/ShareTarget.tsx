import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TmdbCandidatePicker } from "@/components/bookmarks/TmdbCandidatePicker";
import { detectProvider } from "@/lib/utils";
import { bookmarkService } from "@/services/bookmarks";
import { captureShare, type CaptureShareResult } from "@/services/captureShare";
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

type ShareViewState = "capturing" | "needs_selection" | "saved" | "duplicate" | "unresolved" | "error";

const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewState, setViewState] = useState<ShareViewState>("capturing");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [captureResult, setCaptureResult] = useState<CaptureShareResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const captureStartedRef = useRef(false);

  const sharedUrl = searchParams.get("url") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedTitle = searchParams.get("title") ?? "";

  const targetUrl = useMemo(
    () => sharedUrl || extractUrlFromText(sharedText) || "",
    [sharedUrl, sharedText],
  );
  const hasSharePayload = Boolean(sharedUrl || sharedText || sharedTitle);
  const detectedProvider = useMemo<Bookmark["provider"]>(
    () => (targetUrl ? detectProvider(targetUrl) : "generic"),
    [targetUrl],
  );

  const bookmarkHref = captureResult?.bookmarkId ? `/b/${captureResult.bookmarkId}` : "/dashboard";

  const routeToBookmark = useCallback(() => {
    navigate(bookmarkHref, { replace: true });
  }, [bookmarkHref, navigate]);

  const persistPendingPayload = useCallback(() => {
    if (sharedUrl) sessionStorage.setItem("pendingShareUrl", sharedUrl);
    if (sharedTitle) sessionStorage.setItem("pendingShareTitle", sharedTitle);
    if (sharedText) sessionStorage.setItem("pendingShareText", sharedText);
  }, [sharedText, sharedTitle, sharedUrl]);

  useEffect(() => {
    if (sharedUrl || sharedText || sharedTitle) return;

    const pendingUrl = sessionStorage.getItem("pendingShareUrl");
    const pendingTitle = sessionStorage.getItem("pendingShareTitle");
    const pendingText = sessionStorage.getItem("pendingShareText");
    if (!pendingUrl && !pendingTitle && !pendingText) return;

    const params = new URLSearchParams();
    if (pendingUrl) params.set("url", pendingUrl);
    if (pendingTitle) params.set("title", pendingTitle);
    if (pendingText) params.set("text", pendingText);
    navigate(`/share-target?${params.toString()}`, { replace: true });

    sessionStorage.removeItem("pendingShareUrl");
    sessionStorage.removeItem("pendingShareTitle");
    sessionStorage.removeItem("pendingShareText");
  }, [navigate, sharedText, sharedTitle, sharedUrl]);

  useEffect(() => {
    if (authLoading || user) return;
    if (!hasSharePayload) return;

    persistPendingPayload();
    navigate(`/auth?redirect=${encodeURIComponent("/share-target")}`, { replace: true });
  }, [authLoading, hasSharePayload, navigate, persistPendingPayload, user]);

  useEffect(() => {
    if (captureResult?.status !== "auto_saved" && captureResult?.status !== "duplicate") return;
    if (!captureResult.bookmarkId) return;

    const timeout = window.setTimeout(() => {
      navigate(`/b/${captureResult.bookmarkId}`, { replace: true });
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [captureResult, navigate]);

  useEffect(() => {
    if (authLoading || !user || !hasSharePayload || captureStartedRef.current) return;

    captureStartedRef.current = true;
    setViewState("capturing");
    setCaptureError(null);
    setCaptureResult(null);

    void (async () => {
      try {
        const result = await captureShare({
          url: sharedUrl || undefined,
          text: sharedText || undefined,
          title: sharedTitle || undefined,
          surface: "pwa_share_target",
          clientTimestamp: new Date().toISOString(),
        });
        setCaptureResult(result);
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });

        switch (result.status) {
          case "auto_saved":
            setViewState("saved");
            toast({ title: "Saved", description: result.message ?? "Added to your watchlist." });
            break;
          case "duplicate":
            setViewState("duplicate");
            toast({ title: "Already saved", description: result.message ?? "This title is already in your watchlist." });
            break;
          case "needs_selection":
            setViewState("needs_selection");
            setPickerOpen(true);
            break;
          case "unresolved":
          default:
            setViewState("unresolved");
            toast({ title: "Saved for later", description: result.message ?? "We saved this capture for later review." });
            break;
        }
      } catch {
        captureStartedRef.current = false;
        setViewState("error");
        setCaptureError("Could not capture this share right now.");
      }
    })();
  }, [
    authLoading,
    hasSharePayload,
    queryClient,
    retryCount,
    sharedText,
    sharedTitle,
    sharedUrl,
    toast,
    user,
  ]);

  const handleRetry = () => {
    captureStartedRef.current = false;
    setCaptureError(null);
    setCaptureResult(null);
    setPickerOpen(false);
    setRetryCount((prev) => prev + 1);
  };

  const handleCandidateSelect = async (candidate: NonNullable<CaptureShareResult["candidates"]>[number]) => {
    if (!captureResult?.bookmarkId) return;
    setIsSelecting(true);
    try {
      await bookmarkService.selectResolutionCandidate(captureResult.bookmarkId, candidate);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Matched", description: `Saved as "${candidate.title}".` });
      navigate(`/b/${captureResult.bookmarkId}`, { replace: true });
    } catch {
      setCaptureError("Could not apply this match.");
      setViewState("error");
    } finally {
      setIsSelecting(false);
      setPickerOpen(false);
    }
  };

  if (!authLoading && user && !hasSharePayload) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-muted-foreground">No share data was found.</p>
          <p className="text-sm text-muted-foreground/80">
            If Watchmarks does not appear in your mobile share sheet yet, copy the link first, then open
            Watchmarks and paste it manually.
          </p>
        </div>
        <Button onClick={() => navigate("/new")}>Add manually</Button>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Could not capture share</p>
          <p className="text-sm text-muted-foreground">{captureError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
          <Button onClick={() => navigate(targetUrl ? `/new?url=${encodeURIComponent(targetUrl)}` : "/new")}>
            Add manually
          </Button>
        </div>
      </div>
    );
  }

  const headline =
    viewState === "saved"
      ? "Saved to Watchmarks"
      : viewState === "duplicate"
        ? "Already in your watchlist"
        : viewState === "unresolved"
          ? "Saved for later review"
          : viewState === "needs_selection"
            ? "Choose the right title"
            : `Saving from ${PROVIDER_LABELS[detectedProvider]}...`;
  const description =
    viewState === "saved"
      ? "We matched the title and stored it successfully."
      : viewState === "duplicate"
        ? "This capture already exists, so we linked you to the existing bookmark."
        : viewState === "unresolved"
          ? "We stored the capture, but the title still needs review."
          : viewState === "needs_selection"
            ? "Select the matching title to finish enrichment."
            : "Identifying content and preparing your save.";

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-sm font-semibold text-primary overflow-hidden">
          {captureResult?.posterUrl ? (
            <img src={captureResult.posterUrl} alt={captureResult.resolvedTitle ?? "Shared title"} className="w-full h-full object-cover" />
          ) : viewState === "saved" || viewState === "duplicate" || viewState === "unresolved" ? (
            <CheckCircle2 className="w-7 h-7" />
          ) : (
            PROVIDER_MARKS[detectedProvider]
          )}
        </div>

        {viewState === "capturing" ? (
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        ) : null}

        <div className="space-y-1 max-w-sm">
          <p className="text-lg font-semibold text-foreground">{headline}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {captureResult?.resolvedTitle ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[260px] max-w-sm">
            <p className="font-medium text-foreground">{captureResult.resolvedTitle}</p>
            <p className="text-xs text-muted-foreground">
              {captureResult.provider ? PROVIDER_LABELS[captureResult.provider as Bookmark["provider"]] : PROVIDER_LABELS[detectedProvider]}
            </p>
          </div>
        ) : null}

        {viewState === "saved" || viewState === "duplicate" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LinkIcon className="w-4 h-4" />
            Opening bookmark...
          </div>
        ) : null}

        {viewState === "needs_selection" ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button onClick={() => setPickerOpen(true)} disabled={isSelecting}>
              {isSelecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select title"}
            </Button>
            <Button variant="outline" onClick={routeToBookmark} disabled={!captureResult?.bookmarkId}>
              Review later
            </Button>
          </div>
        ) : null}

        {viewState === "unresolved" ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button onClick={routeToBookmark} disabled={!captureResult?.bookmarkId}>
              Open bookmark
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard", { replace: true })}>
              Go to dashboard
            </Button>
          </div>
        ) : null}
      </div>

      <TmdbCandidatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={captureResult?.candidates ?? []}
        extractedTitle={captureResult?.extractedTitle ?? sharedTitle}
        onSelect={(candidate) => { void handleCandidateSelect(candidate); }}
        onSkip={() => {
          setPickerOpen(false);
          routeToBookmark();
        }}
      />
    </>
  );
};

export default ShareTarget;
