"use strict";

const CAPTURE_SURFACES = [
  "web_quick_add",
  "pwa_share_target",
  "ios_share_extension",
  "android_share_intent",
];

const CAPTURE_STATUSES = [
  "auto_saved",
  "needs_selection",
  "unresolved",
  "duplicate",
];

function isCaptureSurface(value) {
  return typeof value === "string" && CAPTURE_SURFACES.includes(value);
}

function isCaptureStatus(value) {
  return typeof value === "string" && CAPTURE_STATUSES.includes(value);
}

module.exports = {
  CAPTURE_SURFACES,
  CAPTURE_STATUSES,
  isCaptureSurface,
  isCaptureStatus,
};
