/**
 * Rail Generator — Phase 3 cinematic rail engine.
 *
 * generateRails(bookmarks, context) → RailConfig[]
 *
 * Rules:
 *  - Never render an empty rail
 *  - Maximum 8 rails total
 *  - Every rail has a subtitle explaining its origin
 *  - Time-aware (morning / evening / weekend context)
 *  - Platform rails only when ≥ 3 items from same platform
 *  - Smart rails: Forgotten, Quick Hits, Best Next Picks
 */

import type { Bookmark } from "@/types/database";

export interface RailConfig {
  id: string;
  title: string;
  subtitle?: string;
  bookmarks: Bookmark[];
  variant?: "poster" | "backdrop";
  reason?: string;
}

interface UserContext {
  now?: Date;
}

const MAX_RAILS = 8;
const MIN_RAIL_SIZE = 2;

const PLATFORM_LABELS: Record<string, string> = {
  netflix:        "On Netflix",
  youtube:        "On YouTube",
  imdb:           "On IMDB",
  letterboxd:     "On Letterboxd",
  instagram:      "On Instagram",
  facebook:       "On Facebook",
  x:              "On X / Twitter",
  tiktok:         "On TikTok",
  reddit:         "On Reddit",
  rottentomatoes: "On Rotten Tomatoes",
};

/** Return a rail only if it has enough items, otherwise null. */
function maybeRail(
  config: Omit<RailConfig, "bookmarks"> & { bookmarks: Bookmark[] },
  minSize = MIN_RAIL_SIZE,
): RailConfig | null {
  if (config.bookmarks.length < minSize) return null;
  return config as RailConfig;
}

export function generateRails(
  bookmarks: Bookmark[],
  context: UserContext = {},
): RailConfig[] {
  const rails: RailConfig[] = [];
  const now = context.now ?? new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isEvening = hour >= 17 || hour < 4;

  // ── Partition ──────────────────────────────────────────────────────────────
  const backlog  = bookmarks.filter((b) => b.status === "backlog");
  const watching = bookmarks.filter((b) => b.status === "watching");
  const done     = bookmarks.filter((b) => b.status === "done");

  // ── 1. Up Next (explicitly promoted) ──────────────────────────────────────
  const upNext = backlog
    .filter((b) => b.queue_status === "up_next")
    .sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100))
    .slice(0, 8);
  const r1 = maybeRail({
    id: "up-next",
    title: "Up Next",
    subtitle: "Your priority picks",
    bookmarks: upNext,
    reason: "Manually added to Up Next",
  }, 1); // show even with 1 item
  if (r1) rails.push(r1);

  // ── 2. Continue Watching ───────────────────────────────────────────────────
  const r2 = maybeRail({
    id: "continue-watching",
    title: "Continue Watching",
    subtitle: "Pick up where you left off",
    bookmarks: watching,
    variant: "backdrop",
    reason: "In progress",
  }, 1);
  if (r2) rails.push(r2);

  if (rails.length >= MAX_RAILS) return rails;

  // ── 3. Quick Hits (< 20 min) ───────────────────────────────────────────────
  const quickHits = backlog
    .filter((b) => b.runtime_minutes != null && b.runtime_minutes < 20)
    .slice(0, 12);
  const r3 = maybeRail({
    id: "quick-hits",
    title: "Quick Hits",
    subtitle: "Under 20 minutes",
    bookmarks: quickHits,
    reason: "Short enough for any break",
  });
  if (r3) rails.push(r3);

  if (rails.length >= MAX_RAILS) return rails;

  // ── 4. Tonight (30–120 min) — evening context ─────────────────────────────
  if (isEvening) {
    const tonight = backlog
      .filter((b) => b.runtime_minutes != null && b.runtime_minutes >= 30 && b.runtime_minutes <= 120)
      .slice(0, 12);
    const r4 = maybeRail({
      id: "tonight",
      title: "Tonight",
      subtitle: "Perfect evening length",
      bookmarks: tonight,
      reason: "Runtime fits your evening",
    });
    if (r4) rails.push(r4);
  }

  if (rails.length >= MAX_RAILS) return rails;

  // ── 5. Weekend Watches (> 120 min) — weekends or mornings ─────────────────
  if (isWeekend || hour < 12) {
    const longWatches = backlog
      .filter((b) => b.runtime_minutes != null && b.runtime_minutes > 120)
      .slice(0, 12);
    const r5 = maybeRail({
      id: "weekend",
      title: "Long Watches",
      subtitle: "When you have the time",
      bookmarks: longWatches,
      reason: "Longer content for relaxed viewing",
    });
    if (r5) rails.push(r5);
  }

  if (rails.length >= MAX_RAILS) return rails;

  // ── 6. Platform rails (≥ 3 items per platform, max 2 rails) ───────────────
  const byProvider: Record<string, Bookmark[]> = {};
  backlog.forEach((b) => {
    if (b.provider && b.provider !== "generic") {
      if (!byProvider[b.provider]) byProvider[b.provider] = [];
      byProvider[b.provider].push(b);
    }
  });

  const platformRails = Object.entries(byProvider)
    .filter(([, items]) => items.length >= 3)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 2)
    .map(([provider, items]) =>
      maybeRail({
        id: `platform-${provider}`,
        title: PLATFORM_LABELS[provider] ?? `On ${provider}`,
        subtitle: `${items.length} saved`,
        bookmarks: items.slice(0, 14),
        reason: `All from ${provider}`,
      }, 3)
    )
    .filter((r): r is RailConfig => r !== null);

  for (const pr of platformRails) {
    if (rails.length >= MAX_RAILS) break;
    rails.push(pr);
  }

  if (rails.length >= MAX_RAILS) return rails;

  // ── 7. Forgotten Saves (not touched in 30+ days) ──────────────────────────
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const forgotten = backlog
    .filter(
      (b) =>
        b.created_at < cutoff &&
        (!b.last_shown_at || b.last_shown_at < cutoff),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at)) // oldest first
    .slice(0, 12);
  const r7 = maybeRail({
    id: "forgotten",
    title: "Forgotten Saves",
    subtitle: "Added over a month ago",
    bookmarks: forgotten,
    reason: "Not visited in 30+ days",
  });
  if (r7) rails.push(r7);

  if (rails.length >= MAX_RAILS) return rails;

  // ── 8. Because You Watched X (mood-based) ─────────────────────────────────
  const watchedMoods = new Set(
    done.flatMap((b) => b.mood_tags ?? []).map((m) => m.toLowerCase()),
  );
  if (watchedMoods.size > 0) {
    const seedTitle =
      [...done]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .find((b) => b.title)?.title ?? "your favorites";

    const moodMatches = backlog
      .filter((b) =>
        (b.mood_tags ?? []).some((m) => watchedMoods.has(m.toLowerCase())),
      )
      .slice(0, 14);
    const r8 = maybeRail({
      id: "because-you-watched",
      title: `Because you watched ${seedTitle}`,
      subtitle: "More in your lane",
      bookmarks: moodMatches,
      reason: "Matches your watch history",
    });
    if (r8) rails.push(r8);
  }

  return rails.slice(0, MAX_RAILS);
}
