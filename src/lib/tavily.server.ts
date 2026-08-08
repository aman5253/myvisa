/**
 * Tavily integration — live web search + page extraction.
 *
 * The API key is read from process.env inside each call so it never reaches a
 * client bundle. When the key is absent every entry point reports
 * "not configured" instead of returning invented results.
 */

const SEARCH_URL = "https://api.tavily.com/search";
const EXTRACT_URL = "https://api.tavily.com/extract";

export function tavilyKey(): string | null {
  return process.env["TAVILY_API_KEY"] ?? null;
}

export function tavilyConfigured() {
  return Boolean(tavilyKey());
}

export class TavilyError extends Error {}

export type TavilyResult = {
  url: string;
  title: string;
  content: string;
  publishedAt: string | null;
  score: number;
  domain: string;
  tier: number;
};

/** Reliability tier inferred from the domain, mirroring the source registry ladder. */
export function tierForDomain(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (/(^|\.)((gov)(\.[a-z]{2})?|gov\.[a-z]{2}|gc\.ca|govt\.nz)$/.test(d)) return 1;
  if (/(^|\.)(europa\.eu|schengenvisainfo\.eu)$/.test(d)) return 3;
  if (/(diplo\.de|esteri\.it|diplomatie\.gouv\.fr|exteriores\.gob\.es|minbuza\.nl|gov\.uk|state\.gov|canada\.ca|homeaffairs\.gov\.au|mfa\.|embassy|consulate|immigration\.)/.test(d))
    return 1;
  if (/(vfsglobal|blsinternational|tlscontact|visametric|biometrics)/.test(d)) return 2;
  if (/(law|legis|eur-lex)/.test(d)) return 3;
  if (/(reddit\.com|quora\.com|trip advisor|tripadvisor\.com|forum)/.test(d)) return 5;
  if (/(\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|fragomen|deloitte|envoyglobal|newlandchase)/.test(d)) return 4;
  return 6;
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

type RawResult = {
  url?: string;
  title?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string | null;
};

async function post<T>(url: string, key: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new TavilyError("Tavily rejected the API key. Check TAVILY_API_KEY in project secrets.");
  }
  if (res.status === 429) throw new TavilyError("Tavily rate limit reached. Retry shortly.");
  if (!res.ok) {
    const text = await res.text();
    throw new TavilyError(`Tavily error (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type TavilySearchOptions = {
  maxResults?: number;
  /** Domains to try first — used to keep official sources on top. */
  includeDomains?: string[];
  depth?: "basic" | "advanced";
  /**
   * Minimum body length for a result to be kept. Community lanes lower this so
   * a search-indexed page with only a snippet is still usable evidence.
   */
  minContentLength?: number;
};

/** Live web search. Returns [] only when Tavily genuinely returns nothing. */
export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilyResult[]> {
  const key = tavilyKey();
  if (!key) throw new TavilyError("Tavily is not configured (TAVILY_API_KEY missing).");

  const payload: Record<string, unknown> = {
    query: query.slice(0, 380),
    search_depth: options.depth ?? "advanced",
    max_results: Math.min(options.maxResults ?? 8, 20),
    include_answer: false,
    include_raw_content: true,
  };
  if (options.includeDomains?.length) payload["include_domains"] = options.includeDomains.slice(0, 20);

  const json = await post<{ results?: RawResult[] }>(SEARCH_URL, key, payload);
  return (json.results ?? [])
    .filter((r): r is RawResult & { url: string } => Boolean(r.url))
    .map((r) => {
      const domain = domainOf(r.url);
      const body = (r.raw_content || r.content || "").trim();
      return {
        url: r.url,
        title: (r.title || domain).slice(0, 300),
        content: body.slice(0, 6000),
        publishedAt: r.published_date ? normaliseDate(r.published_date) : null,
        score: typeof r.score === "number" ? r.score : 0,
        domain,
        tier: tierForDomain(domain),
      };
    })
    .filter((r) => r.content.length > (options.minContentLength ?? 120));
}

function normaliseDate(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Extract readable text for a specific URL. Used as the fallback when a direct
 * crawl is blocked (HTTP 403) or the page is JS-rendered and yields no text.
 */
export async function tavilyExtract(
  url: string,
): Promise<{ text: string; title: string | null } | null> {
  const key = tavilyKey();
  if (!key) throw new TavilyError("Tavily is not configured (TAVILY_API_KEY missing).");
  const json = await post<{
    results?: { url?: string; raw_content?: string; title?: string }[];
    failed_results?: unknown[];
  }>(EXTRACT_URL, key, { urls: [url], extract_depth: "advanced" });
  const first = json.results?.[0];
  const text = (first?.raw_content ?? "").trim();
  if (!text) return null;
  return { text, title: first?.title?.trim() || null };
}
