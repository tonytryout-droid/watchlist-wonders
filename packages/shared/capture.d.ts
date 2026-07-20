export type CaptureSurface =
  | "web_quick_add"
  | "pwa_share_target"
  | "ios_share_extension"
  | "android_share_intent";

export type CaptureStatus = "auto_saved" | "needs_selection" | "unresolved" | "duplicate";

export interface CaptureMatchCandidate {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  contentType?: "movie" | "series" | "episode";
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  voteAverage?: number;
  runtimeMinutes?: number;
  genres?: string[];
  score?: number;
  scoreBreakdown?: {
    title?: number;
    year?: number;
    type?: number;
    overview?: number;
    popularity?: number;
    embedding?: number;
    total?: number;
  };
}

export interface CaptureShareRequest {
  url?: string;
  text?: string;
  title?: string;
  surface: CaptureSurface;
  clientTimestamp: string;
  deviceId?: string;
}

export interface BookmarkOpenTarget {
  route: "bookmark";
  bookmarkId: string;
}

export interface PostCaptureOpenTarget {
  route: "post_capture";
  bookmarkId: string;
  status: CaptureStatus;
}

export type AppOpenTarget = BookmarkOpenTarget | PostCaptureOpenTarget;

export interface CaptureShareResult {
  status: CaptureStatus;
  bookmarkId?: string;
  duplicateOf?: string;
  resolvedTitle?: string;
  extractedTitle?: string;
  provider?: string;
  posterUrl?: string | null;
  candidateCount?: number;
  candidates?: CaptureMatchCandidate[];
  message?: string;
  openTarget?: AppOpenTarget;
}

export declare const CAPTURE_SURFACES: CaptureSurface[];
export declare const CAPTURE_STATUSES: CaptureStatus[];
export declare function isCaptureSurface(value: unknown): value is CaptureSurface;
export declare function isCaptureStatus(value: unknown): value is CaptureStatus;
