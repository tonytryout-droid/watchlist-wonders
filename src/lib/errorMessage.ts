type ErrorLike = {
  code?: unknown;
  message?: unknown;
};

const ERROR_CODE_MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in and try again.",
  "permission-denied": "You do not have permission to perform this action.",
  unavailable: "The service is temporarily unavailable. Please try again.",
  "deadline-exceeded": "The request timed out. Please try again.",
  "resource-exhausted": "The service is busy right now. Please try again shortly.",
  "invalid-argument": "Some input values are invalid. Please review and try again.",
  "failed-precondition": "This action cannot be completed right now.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/requires-recent-login": "Please sign out and sign back in, then try again.",
};

function normalizeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = (error as ErrorLike).code;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return normalized || null;
}

export function getSafeErrorMessage(error: unknown, fallback: string): string {
  const code = normalizeErrorCode(error);
  if (!code) return fallback;
  return ERROR_CODE_MESSAGES[code] ?? fallback;
}
