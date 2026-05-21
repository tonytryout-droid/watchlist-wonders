import { httpsCallable } from "firebase/functions";
import { fbFunctions } from "@/lib/firebase";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

export type CaptureSurface =
  | "web_quick_add"
  | "pwa_share_target"
  | "ios_share_extension"
  | "android_share_intent";

export type CaptureStatus = "auto_saved" | "needs_selection" | "unresolved" | "duplicate";

export interface CaptureShareRequest {
  url?: string;
  text?: string;
  title?: string;
  surface: CaptureSurface;
  clientTimestamp: string;
  deviceId?: string;
}

export interface CaptureShareResult {
  status: CaptureStatus;
  bookmarkId?: string;
  duplicateOf?: string;
  resolvedTitle?: string;
  extractedTitle?: string;
  provider?: string;
  posterUrl?: string | null;
  candidateCount?: number;
  candidates?: EnrichmentMatchCandidate[];
  message?: string;
}

export async function captureShare(input: CaptureShareRequest): Promise<CaptureShareResult> {
  const callable = httpsCallable<CaptureShareRequest, CaptureShareResult>(fbFunctions, "captureShare");
  const result = await callable(input);
  return result.data;
}
