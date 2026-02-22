import { Trash2, Check, ListPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface WatchPlan {
  id: string;
  name: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  plans?: WatchPlan[];
  onDeleteAll: () => void;
  onMarkDone: () => void;
  onAddToPlan: (planId: string) => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  plans = [],
  onDeleteAll,
  onMarkDone,
  onAddToPlan,
  onClear,
}: BulkActionBarProps) {
  const [selectedPlanId, setSelectedPlanId] = useState("");

  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="container mx-auto px-4 lg:px-8 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground shrink-0">
          {selectedCount} selected
        </span>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteAll}
            className="gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onMarkDone}
            className="gap-1"
          >
            <Check className="w-4 h-4" />
            Mark Done
          </Button>

          {plans.length > 0 && (
            <div className="flex items-center gap-1">
              <Select
                value={selectedPlanId}
                onValueChange={(v) => {
                  setSelectedPlanId(v);
                  onAddToPlan(v);
                  setSelectedPlanId("");
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue placeholder="Add to plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1 text-muted-foreground"
        >
          <X className="w-4 h-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
