import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Bookmark } from "@/types/database";

const STATUS_OPTIONS: { value: Bookmark["status"]; label: string }[] = [
  { value: "backlog", label: "Want to Watch" },
  { value: "watching", label: "Currently Watching" },
  { value: "done", label: "Watched" },
  { value: "dropped", label: "Not for Me" },
  { value: "scheduled", label: "Scheduled" },
];

interface BookmarkEditFormProps {
  title: string;
  notes: string;
  status: Bookmark["status"];
  isPending: boolean;
  onTitleChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onStatusChange: (v: Bookmark["status"]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function BookmarkEditForm({
  title, notes, status, isPending,
  onTitleChange, onNotesChange, onStatusChange,
  onSave, onCancel,
}: BookmarkEditFormProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <Select value={status} onValueChange={(v) => onStatusChange(v as Bookmark["status"])}>
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
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
        />
      </div>
      <div className="flex gap-2 pt-4">
        <Button onClick={onSave} disabled={isPending}>
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
