import { createServerFn } from "@tanstack/react-start";

/** Public evidence explorer feed — no auth, RLS-respected publishable reads. */
export const listSources = createServerFn({ method: "GET" }).handler(async () => {
  const { publicServerClient } = await import("./supabase-public.server");
  const supabase = publicServerClient();
  const { data, error } = await supabase
    .from("sources")
    .select(
      "id, title, url, domain, tier, source_type, country, destination, visa_types, crawl_status, last_crawled_at, enabled, notes",
    )
    .order("tier")
    .order("title");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const searchEvidence = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const v = i as { q?: string; destination?: string | null; tier?: number | null };
    return {
      q: String(v?.q ?? "").slice(0, 300),
      destination: v?.destination ?? null,
      tier: v?.tier ?? null,
    };
  })
  .handler(async ({ data }) => {
    const { retrieveEvidence } = await import("./retrieval.server");
    if (!data.q.trim()) return [];
    const results = await retrieveEvidence({
      question: data.q,
      destination: data.destination,
      limit: 30,
    });
    return data.tier ? results.filter((r) => r.tier === data.tier) : results;
  });