import { useState } from "react";
import { addDays, addWeeks, addMonths } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { scheduleService } from "@/services/schedules";
import type { Bookmark } from "@/types/database";

interface ScheduleDialogProps {
  bookmark: Bookmark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export function ScheduleDialog({ bookmark, open, onOpenChange, onScheduled }: ScheduleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleTime, setScheduleTime] = useState("20:00");
  const [reminderOffset, setReminderOffset] = useState("60");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookmark) throw new Error("No bookmark selected");
      const baseDate = new Date(`${scheduleDate}T${scheduleTime}`);

      // Create the primary schedule
      await scheduleService.createSchedule({
        bookmark_id: bookmark.id,
        scheduled_for: baseDate.toISOString(),
        reminder_offset_minutes: parseInt(reminderOffset),
        recurrence_type: recurrence,
      } as any);

      // Create 3 additional occurrences for recurring schedules
      if (recurrence !== 'none') {
        const dates: Date[] = [];
        for (let i = 1; i <= 3; i++) {
          if (recurrence === 'daily') dates.push(addDays(baseDate, i));
          else if (recurrence === 'weekly') dates.push(addWeeks(baseDate, i));
          else if (recurrence === 'monthly') dates.push(addMonths(baseDate, i));
        }
        await Promise.all(
          dates.map((d) =>
            scheduleService.createSchedule({
              bookmark_id: bookmark.id,
              scheduled_for: d.toISOString(),
              reminder_offset_minutes: parseInt(reminderOffset),
              recurrence_type: recurrence,
            } as any)
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onOpenChange(false);
      onScheduled?.();
      const recurrenceLabel = recurrence !== 'none' ? ` (+ 3 more ${recurrence})` : '';
      toast({
        title: "Scheduled!",
        description: `Added to your calendar${recurrenceLabel}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error scheduling",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule "{bookmark?.title}"</DialogTitle>
          <DialogDescription>Pick a date, time, and recurrence.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-time">Time</Label>
              <Input
                id="sched-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reminder</Label>
            <Select value={reminderOffset} onValueChange={setReminderOffset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="120">2 hours before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily (next 4 days)</SelectItem>
                <SelectItem value="weekly">Weekly (next 4 weeks)</SelectItem>
                <SelectItem value="monthly">Monthly (next 4 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !scheduleDate}
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
              ) : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
