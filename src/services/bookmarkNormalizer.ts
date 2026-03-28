import type { Bookmark } from "@/types/database";

const KNOWN_STATUSES = new Set<Bookmark["status"]>([
  "backlog",
  "scheduled",
  "watching",
  "done",
  "dropped",
]);

const KNOWN_QUEUE_STATUSES = new Set<NonNullable<Bookmark["queue_status"]>>([
  "queued",
  "up_next",
  "in_progress",
  "completed",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asIsoString(value: unknown, fallback: string | null = null): string | null {
  const direct = asTrimmedString(value);
  if (direct) return direct;

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  const record = asRecord(value);
  const toDate = record.toDate;
  if (typeof toDate === "function") {
    try {
      const dateValue = toDate.call(value);
      if (dateValue instanceof Date && Number.isFinite(dateValue.getTime())) {
        return dateValue.toISOString();
      }
    } catch {
      // Ignore invalid Timestamp-like objects.
    }
  }

  const seconds = asFiniteNumber(record.seconds);
  if (seconds !== null) {
    const nanoseconds = asFiniteNumber(record.nanoseconds) ?? 0;
    const dateValue = new Date(seconds * 1000 + nanoseconds / 1_000_000);
    if (Number.isFinite(dateValue.getTime())) {
      return dateValue.toISOString();
    }
  }

  return fallback;
}

function normalizeStatus(value: unknown): Bookmark["status"] {
  return typeof value === "string" && KNOWN_STATUSES.has(value as Bookmark["status"])
    ? (value as Bookmark["status"])
    : "backlog";
}

function normalizeQueueStatus(value: unknown, status: Bookmark["status"]): Bookmark["queue_status"] {
  if (typeof value === "string" && KNOWN_QUEUE_STATUSES.has(value as NonNullable<Bookmark["queue_status"]>)) {
    return value as Bookmark["queue_status"];
  }
  if (status === "done") return "completed";
  if (status === "watching") return "in_progress";
  return "queued";
}

function clampPercent(value: unknown): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.min(100, parsed));
}

export function normalizeBookmark(id: string, raw: unknown): Bookmark {
  const data = asRecord(raw);
  const now = new Date().toISOString();
  const status = normalizeStatus(data.status);
  const createdAt = asIsoString(data.created_at, now) ?? now;
  const updatedAt = asIsoString(data.updated_at, createdAt) ?? createdAt;

  const metadata = asRecord(data.metadata);
  const availability =
    (asOptionalRecord(data.availability) ?? asOptionalRecord(metadata.availability)) as
      | Bookmark["availability"]
      | undefined;

  return {
    id,
    user_id: asTrimmedString(data.user_id) ?? "",
    title: asTrimmedString(data.title) ?? "Untitled",
    type: (asTrimmedString(data.type) ?? "other") as Bookmark["type"],
    provider: (asTrimmedString(data.provider) ?? "generic") as Bookmark["provider"],
    source_url: asTrimmedString(data.source_url),
    canonical_url: asTrimmedString(data.canonical_url),
    platform_label: asTrimmedString(data.platform_label),
    status,
    runtime_minutes: asFiniteNumber(data.runtime_minutes),
    release_year: asFiniteNumber(data.release_year),
    poster_url: asTrimmedString(data.poster_url),
    backdrop_url: asTrimmedString(data.backdrop_url),
    tags: asStringArray(data.tags),
    mood_tags: asStringArray(data.mood_tags),
    notes: asTrimmedString(data.notes),
    metadata,
    last_shown_at: asIsoString(data.last_shown_at),
    shown_count: asNonNegativeInteger(data.shown_count, 0),
    created_at: createdAt,
    updated_at: updatedAt,
    user_rating: asFiniteNumber(data.user_rating),
    user_review: asTrimmedString(data.user_review),
    watched_at: asIsoString(data.watched_at),
    is_public: asBoolean(data.is_public),
    share_token: asTrimmedString(data.share_token) ?? undefined,
    is_vaulted: asBoolean(data.is_vaulted),
    priority: asFiniteNumber(data.priority) ?? 100,
    queue_status: normalizeQueueStatus(data.queue_status, status),
    progress_percent: clampPercent(data.progress_percent),
    availability: availability ?? null,
  };
}
