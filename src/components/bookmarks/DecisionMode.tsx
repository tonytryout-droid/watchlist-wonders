import { useState, useEffect, useMemo } from "react";
import { X, Play, Shuffle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { bookmarkService } from "@/services/bookmarks";
import { formatRuntime } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

interface DecisionModeProps {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
}

export function DecisionMode({ open, onClose, bookmarks }: DecisionModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const candidates = useMemo(() => {
    const upNext = bookmarks.filter(
      (b) => b.status === "backlog" && b.queue_status === "up_next"
    );
    const rest = bookmarks.filter(
      (b) => b.status === "backlog" && b.queue_status !== "up_next"
    );
    const sortByPriority = (arr: Bookmark[]) =>
      [...arr].sort((a, b) => {
        const pd = (b.priority ?? 0) - (a.priority ?? 0);
        return pd !== 0 ? pd : b.created_at.localeCompare(a.created_at);
      });
    return [...sortByPriority(upNext), ...sortByPriority(rest)];
  }, [bookmarks]);

  // Reset index when opened
  useEffect(() => {
    if (open) setCurrentIndex(0);
  }, [open]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handlePlay();
      } else if (e.key === "ArrowRight" || e.key === "n") {
        handleSwap();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, "watching"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, status: "watching" } : b))
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const handlePlay = () => {
    const item = candidates[currentIndex];
    if (!item) return;
    if (item.source_url?.startsWith("http")) window.open(item.source_url, "_blank", "noopener,noreferrer");
    setWatchingMutation.mutate(item.id);
    onClose();
  };

  const handleSwap = () => {
    if (candidates.length <= 1) return;
    const next = currentIndex + 1;
    if (next >= candidates.length) {
      setCurrentIndex(0);
      toast({ description: "Back to the top" });
    } else {
      setCurrentIndex(next);
    }
  };

  const item = candidates[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="fixed inset-0 z-50 max-w-none w-screen h-screen m-0 p-0 rounded-none border-0 bg-background/95 backdrop-blur-sm flex flex-col translate-x-0 translate-y-0 top-0 left-0">

        {/* Top bar */}
        <div className="flex items-center justify-between p-4 shrink-0">
          <span className="text-sm text-muted-foreground">
            {candidates.length === 0
              ? "Pick for me"
              : `Pick for me · ${currentIndex + 1} of ${candidates.length}`}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9" aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
          {candidates.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Your backlog is empty.</p>
              <Button asChild onClick={onClose}>
                <Link to="/new">Add something to watch</Link>
              </Button>
            </div>
          ) : (
            <div
              className="w-full max-w-sm space-y-6 animate-fade-in"
              key={item?.id}
            >
              {/* Poster */}
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-wm-surface shadow-2xl mx-auto max-h-[45vh]">
                {item.poster_url || item.backdrop_url ? (
                  <img
                    src={item.poster_url || item.backdrop_url!}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl font-bold text-muted-foreground">
                      {item.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-bold">{item.title}</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{item.type}</Badge>
                  {item.runtime_minutes && (
                    <span>{formatRuntime(item.runtime_minutes)}</span>
                  )}
                  {item.release_year && <span>{item.release_year}</span>}
                </div>
                {(item.mood_tags || []).length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 pt-1">
                    {(item.mood_tags || []).slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        {candidates.length > 0 && (
          <div className="p-6 flex flex-col gap-3 max-w-sm mx-auto w-full shrink-0">
            <Button size="lg" className="w-full h-14 text-base" onClick={handlePlay}>
              <Play className="mr-2 w-5 h-5 fill-current" />
              Play
            </Button>
            {candidates.length > 1 && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={handleSwap}
              >
                <Shuffle className="mr-2 w-4 h-4" />
                Try another
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
