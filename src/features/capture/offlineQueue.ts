import type { CaptureBookmarkRequest } from "@watchmarks/shared/capture";
import { storage } from "@/lib/storage";
import { captureAndWait } from "@/services/captureShare";

const OFFLINE_CAPTURE_QUEUE = "watchmarks.capture.offline.v1";

function validateQueue(raw: unknown): CaptureBookmarkRequest[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter((item): item is CaptureBookmarkRequest => {
    if (!item || typeof item !== "object") return false;
    const value = item as Partial<CaptureBookmarkRequest>;
    return typeof value.requestId === "string" && typeof value.url === "string" && value.url.length > 0;
  });
  return valid.length === raw.length ? valid : null;
}

export function getOfflineCaptures(): CaptureBookmarkRequest[] {
  return storage.get(OFFLINE_CAPTURE_QUEUE, { fallback: [], validate: validateQueue });
}

export function queueOfflineCapture(request: CaptureBookmarkRequest): void {
  const queued = getOfflineCaptures();
  if (!queued.some((item) => item.requestId === request.requestId)) {
    storage.set(OFFLINE_CAPTURE_QUEUE, [...queued, request]);
  }
}

export async function flushOfflineCaptures(): Promise<number> {
  const queued = getOfflineCaptures();
  let completed = 0;
  for (const request of queued) {
    try {
      await captureAndWait(request);
      completed += 1;
    } catch {
      break;
    }
  }
  storage.set(OFFLINE_CAPTURE_QUEUE, queued.slice(completed));
  return completed;
}
