const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|connection (?:was )?(?:closed|reset)|timeout/i;

const OPAQUE_ERROR_MESSAGES = new Set([
  "",
  "{}",
  "[object object]",
  "unknown authentication error",
]);

function readErrorMessage(error: unknown, depth = 0): string {
  if (depth > 2 || error == null) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (typeof error !== "object") return String(error).trim();

  const record = error as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description", "details", "error"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = readErrorMessage(value, depth + 1);
      if (nested) return nested;
    }
  }

  return "";
}

export function isRetryableAuthError(error: unknown): boolean {
  const message = readErrorMessage(error);
  return OPAQUE_ERROR_MESSAGES.has(message.toLowerCase()) || NETWORK_ERROR_PATTERN.test(message);
}

/** Convert Supabase/browser errors into safe, useful messages for the auth UI. */
export function getAuthErrorMessage(error: unknown): string {
  const message = readErrorMessage(error);
  const normalized = message.toLowerCase();

  // Supabase can wrap a browser fetch failure as AuthRetryableFetchError("{}").
  if (isRetryableAuthError(error)) {
    return (
      "FrameFlow could not reach the authentication service. " +
      "Check your internet connection, disable any VPN or blocker for this site, then try again."
    );
  }

  if (/email rate limit|over_email_send_rate_limit|too many requests/i.test(message)) {
    return "Too many verification emails were requested. Please wait a few minutes, then try again.";
  }

  if (/user already registered|already been registered|user_already_exists/i.test(message)) {
    return "An account with this email already exists. Please sign in instead.";
  }

  if (/signup.*disabled|signups not allowed/i.test(message)) {
    return "New account registration is temporarily unavailable. Please try again later.";
  }

  if (/invalid api key|no api key|invalid jwt|jwt malformed/i.test(message)) {
    return "FrameFlow authentication is not configured correctly. Please contact support.";
  }

  return message || "Unable to create your account. Please try again.";
}
