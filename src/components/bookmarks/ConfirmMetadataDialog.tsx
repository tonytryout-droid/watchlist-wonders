"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Film, Tv, Play, FileText, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Bookmark } from "@/types/database";

export type ConfirmMetadataPayload = {
  url: string;
  provider?: string;
  title?: string;
  posterUrl?: string;
  runtimeMinutes?: number | null;
  type?: Bookmark["type"];
  blocked?: boolean;
  debugMessage?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ConfirmMetadataPayload;
  onConfirm: (data: {
    url: string;
    provider?: string;
    title: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
    type: Bookmark["type"];
  }) => void;
};

const TYPE_OPTIONS: { value: Bookmark["type"]; label: string; icon: React.ElementType }[] = [
  { value: "movie", label: "Movie", icon: Film },
  { value: "series", label: "Series", icon: Tv },
  { value: "episode", label: "Episode", icon: Play },
  { value: "video", label: "Video", icon: Play },
  { value: "doc", label: "Document", icon: FileText },
  { value: "other", label: "Other", icon: LinkIcon },
];

const RUNTIME_PRESETS = [
  { label: "Short (≤20m)", value: 15 },
  { label: "Episode (20–60m)", value: 45 },
  { label: "Movie (90–150m)", value: 120 },
];

export function ConfirmMetadataDialog({ open, onOpenChange, initial, onConfirm }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [posterUrl, setPosterUrl] = React.useState(initial.posterUrl ?? "");
  const [runtime, setRuntime] = React.useState(initial.runtimeMinutes?.toString() ?? "");
  const [type, setType] = React.useState<Bookmark["type"]>(initial.type ?? "video");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setTitle(initial.title ?? "");
    setPosterUrl(initial.posterUrl ?? "");
    setRuntime(initial.runtimeMinutes?.toString() ?? "");
    setType(initial.type ?? "video");
  }, [initial]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/posters/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("attachments")
        .getPublicUrl(fileName);

      setPosterUrl(publicUrl);
      toast({
        title: "Image uploaded",
        description: "Poster image has been uploaded successfully.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const canSave = title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm bookmark details</DialogTitle>
          <DialogDescription>
            {initial.blocked
              ? "This platform blocks previews sometimes. Add a title/poster manually and we'll still save it."
              : "We found some metadata. Confirm or adjust before saving."}
          </DialogDescription>
        </DialogHeader>

        {/* Preview row */}
        <div className="flex gap-4 items-start py-4 border-b border-border">
          <div className="w-16 h-24 rounded-md bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt="Poster preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{initial.url}</p>
            {initial.provider && (
              <p className="text-sm text-foreground mt-1">
                Provider: <span className="capitalize">{initial.provider}</span>
              </p>
            )}
            {initial.debugMessage && (
              <p className="text-xs text-amber-500 mt-1">Note: {initial.debugMessage}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-title">Title *</Label>
            <Input
              id="confirm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Bear S02E01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Bookmark["type"])}>
              <SelectTrigger id="confirm-type">
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
            <Label htmlFor="confirm-poster">Poster / Thumbnail</Label>
            <div className="flex gap-2">
              <Input
                id="confirm-poster"
                type="url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a URL or click the upload button to add an image
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-runtime">Runtime minutes (optional)</Label>
            <Input
              id="confirm-runtime"
              type="text"
              inputMode="numeric"
              value={runtime}
              onChange={(e) => setRuntime(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 42"
            />
            <div className="flex gap-2 pt-1">
              {RUNTIME_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setRuntime(preset.value.toString())}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSave || isUploading}
            onClick={() => {
              onConfirm({
                url: initial.url,
                provider: initial.provider,
                title: title.trim(),
                posterUrl: posterUrl.trim() || undefined,
                runtimeMinutes: runtime ? Number(runtime) : null,
                type,
              });
              onOpenChange(false);
            }}
          >
            Save bookmark
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
