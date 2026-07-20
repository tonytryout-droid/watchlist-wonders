"use strict";

const APP_SCHEME = "watchmarks";

function cleanSegment(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

function buildBookmarkDeepLink(bookmarkId) {
  return `${APP_SCHEME}://bookmark/${cleanSegment(bookmarkId)}`;
}

function buildPostCaptureDeepLink(bookmarkId, status) {
  return `${APP_SCHEME}://capture/${cleanSegment(status)}?bookmarkId=${cleanSegment(bookmarkId)}`;
}

function buildSavedItemsDeepLink() {
  return `${APP_SCHEME}://saved`;
}

module.exports = {
  APP_SCHEME,
  buildBookmarkDeepLink,
  buildPostCaptureDeepLink,
  buildSavedItemsDeepLink,
};
