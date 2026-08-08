import { publicServerClient } from "./supabase-public.server";

export type Evidence = {
  ref: number;
  chunkId: string;
  content: string;
  sourceId: string;
  sourceTitle: string;
  domain: string;
  tier: number;
  url: string;
  documentTitle: string | null;
  publishedAt: string | null;
  retrievedAt: string;
};

const STOP = new Set([
  "the","a","an","for","and","or","to","of","in","on","is","are","do","i","my","me","what","which","how","need","with","from","can","should","be","it","this","that","have","has","if","at","as","by",
]);

export function keywords(question: string) {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  ).slice(0, 12);
}

type RetrieveArgs = {
  question: string;
  destination?: string | null;
  visaType?: string | null;
  limit?: number;
};

/**
 * Lexical retrieval over the indexed corpus. The schema (document_chunks with
 * an embedding_status column) is ready for pgvector: add an `embedding` column
 * and swap this ranking step for a hybrid query without changing callers.
 */
export async function retrieveEvidence(args: RetrieveArgs): Promise<Evidence[]> {
  const supabase = publicServerClient();
  const limit = args.limit ?? 24;
  const terms = keywords(args.question);

  let query = supabase
    .from("document_chunks")
    .select(
      "id, content, position, documents!inner(id, url, title, published_at, retrieved_at), sources!inner(id, title, domain, tier, destination, visa_types, enabled)",
    )
    .eq("sources.enabled", true)
    .limit(300);

  if (args.destination) {
    query = query.or(
      `destination.eq.${args.destination},destination.eq.Schengen,destination.is.null`,
      { referencedTable: "sources" },
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    content: string;
    documents: {
      id: string;
      url: string;
      title: string | null;
      published_at: string | null;
      retrieved_at: string;
    };
    sources: { id: string; title: string; domain: string; tier: number };
  };

  const rows = (data ?? []) as unknown as Row[];

  const scored = rows
    .map((row) => {
      const text = row.content.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const hits = text.split(term).length - 1;
        if (hits > 0) score += 1 + Math.min(hits, 4) * 0.25;
      }
      if (args.visaType && text.includes(args.visaType.toLowerCase())) score += 1.5;
      // Reliability weighting: tier 1 outranks tier 5 at similar relevance.
      const tierWeight = [0, 1.5, 1.3, 1.25, 1.0, 0.7, 0.55][row.sources.tier] ?? 0.6;
      return { row, score: score * tierWeight };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s, i) => ({
    ref: i + 1,
    chunkId: s.row.id,
    content: s.row.content.slice(0, 1400),
    sourceId: s.row.sources.id,
    sourceTitle: s.row.sources.title,
    domain: s.row.sources.domain,
    tier: s.row.sources.tier,
    url: s.row.documents.url,
    documentTitle: s.row.documents.title,
    publishedAt: s.row.documents.published_at,
    retrievedAt: s.row.documents.retrieved_at,
  }));
}
/**
 * Live web evidence via Tavily. Used when the indexed corpus cannot answer a
 * question. Results carry their real URL, domain, tier and retrieval time —
 * nothing is synthesised. Official tiers are ranked above community pages so
 * the trust ladder is preserved end to end.
 */
export async function liveWebEvidence(args: {
  question: string;
  destination?: string | null;
  visaType?: string | null;
  nationality?: string | null;
  residence?: string | null;
  startRef?: number;
  limit?: number;
}): Promise<Evidence[]> {
  const { tavilySearch, tavilyConfigured } = await import("./tavily.server");
  if (!tavilyConfigured()) return [];

  const results = await multiSearch(tavilySearch, args);
  const retrievedAt = new Date().toISOString();
  const tierWeight = [0, 1.5, 1.3, 1.25, 1.0, 0.7, 0.55];

  const now = Date.now();
  const ranked = results
    .map((r) => {
      // Freshness nudge: a page published in the last year outranks an
      // equally relevant page from years ago. Undated pages are neutral.
      let fresh = 1;
      if (r.publishedAt) {
        const ageDays = (now - new Date(r.publishedAt).getTime()) / 86_400_000;
        fresh = ageDays < 365 ? 1.15 : ageDays < 1095 ? 1 : 0.85;
      }
      return { r, rank: (r.score || 0.1) * (tierWeight[r.tier] ?? 0.6) * fresh };
    })
    .sort((a, b) => b.rank - a.rank);

  // Guarantee the answer sees community reports too: they are ranked below
  // official pages but must not be squeezed out of the window entirely.
  const limit = args.limit ?? 24;
  const official = ranked.filter((x) => x.r.tier <= 4).slice(0, limit - 4);
  const community = ranked.filter((x) => x.r.tier >= 5).slice(0, 6);
  const picked = [...official, ...community].slice(0, limit);

  return picked
    .map(({ r }, i) => ({
      ref: (args.startRef ?? 1) + i,
      chunkId: `live:${r.url}`,
      content: r.content.slice(0, 1400),
      sourceId: `live:${r.domain}`,
      sourceTitle: r.title,
      domain: r.domain,
      tier: r.tier,
      url: r.url,
      documentTitle: r.title,
      publishedAt: r.publishedAt,
      retrievedAt,
    }));
}

/**
 * Query-aware fan-out driven by the query planner. Several targeted searches
 * run in parallel across official, guidance, specialist and community lanes,
 * then results are deduplicated by URL. Nothing is synthesised: every result
 * is a real page Tavily returned.
 */
async function multiSearch(
  search: (typeof import("./tavily.server"))["tavilySearch"],
  args: {
    question: string;
    destination?: string | null;
    visaType?: string | null;
    nationality?: string | null;
    residence?: string | null;
  },
) {
  const { planQueries } = await import("./query-planner");
  const plan = planQueries(args);

  const settled = await Promise.allSettled(
    plan.map((p) =>
      search(p.query, {
        maxResults: p.lane === "community" ? 6 : 8,
        depth: "advanced",
        ...(p.lane === "community"
          ? {
              includeDomains: ["reddit.com", "www.reddit.com", "quora.com", "tripadvisor.com"],
              // Reddit pages often return only a search snippet; keep them
              // rather than dropping the whole community lane.
              minContentLength: 0,
            }
          : {}),
      }),
    ),
  );

  const byUrl = new Map<string, Awaited<ReturnType<typeof search>>[number]>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      const existing = byUrl.get(r.url);
      if (!existing || r.content.length > existing.content.length) byUrl.set(r.url, r);
    }
  }
  // Mark community results whose full thread text could not be retrieved, so
  // the answer never implies we read more than the indexed snippet.
  for (const [url, r] of byUrl) {
    if (r.tier >= 5 && r.content.trim().length < 200) {
      byUrl.set(url, {
        ...r,
        content: `Search-indexed Reddit result — full thread content unavailable.\n\n${r.content.trim()}`,
      });
    }
  }
  // Drop near-identical pages (same domain + same leading text).
  const seenBody = new Set<string>();
  return Array.from(byUrl.values()).filter((r) => {
    const key = `${r.domain}|${r.content.slice(0, 200).toLowerCase().replace(/\W+/g, "")}`;
    if (seenBody.has(key)) return false;
    seenBody.add(key);
    return true;
  });
}
