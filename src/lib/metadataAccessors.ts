import type { Bookmark } from "@/types/database";

/** Resolves tmdb_id from bookmark metadata, handling both camelCase and snake_case legacy keys. */
export function getTmdbId(bookmark: Bookmark | null | undefined): number | null {
  if (!bookmark?.metadata) return null;
  const raw = bookmark.metadata.tmdb_id ?? bookmark.metadata.tmdbId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Reads the first numeric value found under any of the given keys. */
export function getMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Reads the first non-empty string found under any of the given keys. */
export function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}
