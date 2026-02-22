import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SortableBookmarkRowProps {
  bookmarkId: string;
  position: number;
  title?: string;
  posterUrl?: string | null;
  type?: string;
  runtimeMinutes?: number | null;
  status?: string;
  onRemove: () => void;
  isRemoving?: boolean;
}

export function SortableBookmarkRow({
  bookmarkId,
  position,
  title,
  posterUrl,
  type,
  runtimeMinutes,
  status,
  onRemove,
  isRemoving,
}: SortableBookmarkRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmarkId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-colors"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Position */}
      <span className="text-xs text-muted-foreground w-5 text-center shrink-0">
        {position}
      </span>

      {/* Poster */}
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={title}
          className="w-8 h-12 object-cover rounded shrink-0"
        />
      ) : (
        <div className="w-8 h-12 bg-secondary rounded shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {title || "Unknown"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {type && <span className="capitalize">{type}</span>}
          {runtimeMinutes && <span>{runtimeMinutes} min</span>}
          {status && (
            <Badge variant="secondary" className="text-xs capitalize py-0">
              {status}
            </Badge>
          )}
        </div>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemove}
        disabled={isRemoving}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
