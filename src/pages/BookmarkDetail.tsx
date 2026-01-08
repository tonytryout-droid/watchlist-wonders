import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, Play, Calendar, Check, Trash2, Edit2, 
  Clock, Tag, ExternalLink, Loader2, Save, X 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { cn, formatRuntime, getMoodEmoji } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

const STATUS_OPTIONS: { value: Bookmark["status"]; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "watching", label: "Watching" },
  { value: "done", label: "Done" },
  { value: "dropped", label: "Dropped" },
];

const BookmarkDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Bookmark["status"]>("backlog");

  const { data: bookmark, isLoading, error } = useQuery({
    queryKey: ['bookmark', id],
    queryFn: () => bookmarkService.getBookmark(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Bookmark>) => bookmarkService.updateBookmark(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setIsEditing(false);
      toast({
        title: "Bookmark updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating bookmark",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookmarkService.deleteBookmark(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Bookmark deleted",
        description: "The bookmark has been removed.",
      });
      navigate("/dashboard");
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-destructive mb-4">Bookmark not found</p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const imageUrl = bookmark.backdrop_url || bookmark.poster_url;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero/Backdrop */}
      <div className="relative h-[40vh] md:h-[50vh] bg-secondary">
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/80 backdrop-blur"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur"
            onClick={handleStartEdit}
          >
            <Edit2 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 lg:px-8 -mt-32 relative z-10 pb-16">
        <div className="max-w-3xl">
          {isEditing ? (
            // Edit Mode
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
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
                <Label htmlFor="edit-notes">Notes</Label>
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
            // View Mode
            <>
              <h1 className="text-4xl font-bold text-foreground mb-4">{bookmark.title}</h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-6">
                <span className="capitalize">{bookmark.type}</span>
                <span>•</span>
                <span className="capitalize">{bookmark.provider}</span>
                {bookmark.release_year && (
                  <>
                    <span>•</span>
                    <span>{bookmark.release_year}</span>
                  </>
                )}
                {bookmark.runtime_minutes && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatRuntime(bookmark.runtime_minutes)}
                    </span>
                  </>
                )}
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                <Select value={bookmark.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[180px]">
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

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mb-8">
                {bookmark.source_url && (
                  <Button onClick={() => window.open(bookmark.source_url!, "_blank")}>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Watch Now
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange("done")}
                  disabled={bookmark.status === "done"}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Done
                </Button>
              </div>

              {/* Mood Tags */}
              {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Mood</h3>
                  <div className="flex flex-wrap gap-2">
                    {bookmark.mood_tags.map((mood) => (
                      <Badge key={mood} variant="outline">
                        {getMoodEmoji(mood)} {mood}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
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

              {/* Notes */}
              {bookmark.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  <p className="text-foreground whitespace-pre-wrap">{bookmark.notes}</p>
                </div>
              )}

              {/* Source Link */}
              {bookmark.source_url && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Source</h3>
                  <a
                    href={bookmark.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {bookmark.source_url}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarkDetail;
