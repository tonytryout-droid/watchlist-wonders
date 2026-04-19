/**
 * Shared UI constants — single source of truth for filter/picker options.
 * Previously duplicated across FilterPanel, MoodPicker, ScheduleDialog, QuickScheduleSheet, NewBookmark.
 */

export const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "animation", "family",
  "relaxing", "inspiring", "intense", "thoughtful", "nostalgic",
  "uplifting", "dark", "quirky", "epic", "emotional", "fun", "educational",
] as const;

export type MoodOption = typeof MOOD_OPTIONS[number];

export const GENRE_OPTIONS = [
  "action", "adventure", "animation", "comedy", "crime",
  "documentary", "drama", "family", "fantasy", "history",
  "horror", "music", "mystery", "romance", "scifi",
  "thriller", "war", "western",
] as const;

export const RUNTIME_PRESETS = [
  { label: "Any",    min: null, max: null },
  { label: "< 30m",  min: null, max: 30  },
  { label: "30–90m", min: 30,   max: 90  },
  { label: "90m+",   min: 90,   max: null },
] as const;

export type RuntimePresetLabel = typeof RUNTIME_PRESETS[number]["label"];

export const REMINDER_OPTIONS = [
  { value: "15",  label: "15 minutes before" },
  { value: "30",  label: "30 minutes before" },
  { value: "60",  label: "1 hour before" },
  { value: "120", label: "2 hours before" },
] as const;
