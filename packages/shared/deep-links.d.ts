import type { CaptureStatus } from "./capture";

export declare const APP_SCHEME: "watchmarks";
export declare function buildBookmarkDeepLink(bookmarkId: string): string;
export declare function buildPostCaptureDeepLink(bookmarkId: string, status: CaptureStatus): string;
export declare function buildSavedItemsDeepLink(): string;
