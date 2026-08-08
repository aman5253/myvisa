/**
 * Turns anything thrown by the research server function into a safe, useful
 * description. Server functions surface failures as plain Errors over RPC, so
 * the browser only ever sees a message string — we classify it here rather
 * than showing a bare "Failed to fetch".
 */
export type ResearchErrorCategory =
  | "network"
  | "session"
  | "rate_limit"
  | "credits"
  | "provider"
  | "validation"
  | "unknown";

export type ResearchErrorInfo = {
  category: ResearchErrorCategory;
  title: string;
  detail: string;
  hint: string | null;
  retryable: boolean;
  raw: string;
};

export function describeResearchError(error: unknown): ResearchErrorInfo {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected error";
  const m = raw.toLowerCase();

  const base = { raw, hint: null as string | null };

  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return {
      ...base,
      category: "network",
      title: "Could not reach the research service",
      detail:
        "The request never completed. This is usually a dropped connection or the app being redeployed mid-request.",
      hint: "Check your connection and retry — nothing was saved.",
      retryable: true,
    };
  }
  if (m.includes("unauthorized") || m.includes("401") || m.includes("jwt") || m.includes("session")) {
    return {
      ...base,
      category: "session",
      title: "Your session expired",
      detail: "The research service could not verify your sign-in for this request.",
      hint: "Sign in again, then re-run the question.",
      retryable: false,
    };
  }
  if (m.includes("rate limit")) {
    return {
      ...base,
      category: "rate_limit",
      title: "The AI provider is rate limiting",
      detail: "Too many requests reached the provider in a short window.",
      hint: "Wait a few seconds and retry.",
      retryable: true,
    };
  }
  if (m.includes("credits")) {
    return {
      ...base,
      category: "credits",
      title: "AI credits exhausted",
      detail: "The configured AI provider rejected the request for billing reasons.",
      hint: "Top up the workspace credits or configure a direct provider key.",
      retryable: false,
    };
  }
  if (m.includes("ai provider") || m.includes("gemini") || m.includes("unreadable response")) {
    return {
      ...base,
      category: "provider",
      title: "The AI provider returned an error",
      detail: raw,
      hint: "This is usually transient — retry once before changing anything.",
      retryable: true,
    };
  }
  if (m.includes("invalid") || m.includes("expected") || m.includes("parse")) {
    return {
      ...base,
      category: "validation",
      title: "The request was rejected",
      detail: raw,
      hint: "Adjust the question or details and try again.",
      retryable: false,
    };
  }
  return {
    ...base,
    category: "unknown",
    title: "The research request failed",
    detail: raw,
    hint: "Retry; if it keeps failing, check the integrations panel in Admin.",
    retryable: true,
  };
}
