export const APP_SCHEME = "watchmarks";

function cleanSegment(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

export function buildBookmarkDeepLink(bookmarkId) {
  return `${APP_SCHEME}://bookmark/${cleanSegment(bookmarkId)}`;
}

export function buildPostCaptureDeepLink(bookmarkId, status) {
  return `${APP_SCHEME}://capture/${cleanSegment(status)}?bookmarkId=${cleanSegment(bookmarkId)}`;
}

export function buildSavedItemsDeepLink() {
  return `${APP_SCHEME}://saved`;
}
