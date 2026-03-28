type ErrorContext = Record<string, unknown>;

export function reportError(error: unknown, context: ErrorContext = {}): void {
  // Placeholder sink for centralized monitoring integrations (Sentry, Datadog, etc).
  console.error("[error-monitoring]", { error, context });
}
