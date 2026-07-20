export const CAPTURE_SURFACES = [
  "web_quick_add",
  "pwa_share_target",
  "ios_share_extension",
  "android_share_intent",
];

export const CAPTURE_STATUSES = [
  "auto_saved",
  "needs_selection",
  "unresolved",
  "duplicate",
];

export function isCaptureSurface(value) {
  return typeof value === "string" && CAPTURE_SURFACES.includes(value);
}

export function isCaptureStatus(value) {
  return typeof value === "string" && CAPTURE_STATUSES.includes(value);
}
