import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Brand } from "@/components/vi/brand";
import { TierBadge } from "@/components/vi/tier-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSources, searchEvidence } from "@/lib/sources.functions";
import { TIERS, freshnessLabel } from "@/lib/taxonomy";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Source explorer — MyVisa evidence corpus" },
      {
        name: "description",
        content:
          "Browse and search every indexed visa source by country, visa type, trust tier and freshness. Each entry links to the original page.",
      },
      { property: "og:title", content: "Source explorer — MyVisa" },
      {
        property: "og:description",
        content: "Every indexed visa source, ranked by trust tier and dated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => listSources(),
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
  component: SourcesPage,
});

type SourceRow = {
  id: string;
  title: string;
  url: string;
  domain: string;
  tier: number;
  source_type: string;
  country: string | null;
  destination: string | null;
  crawl_status: string;
  last_crawled_at: string | null;
  notes: string | null;
};

function SourcesPage() {
  const sources = Route.useLoaderData() as SourceRow[];
  const [tier, setTier] = useState("all");
  const [destination, setDestination] = useState("all");
  const [q, setQ] = useState("");
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const search = useServerFn(searchEvidence);

  const evidence = useQuery({
    queryKey: ["evidence", evidenceQuery],
    enabled: evidenceQuery.length > 2,
    queryFn: () => search({ data: { q: evidenceQuery } }),
  });

  const destinations = useMemo(
    () => Array.from(new Set(sources.map((s) => s.destination).filter(Boolean) as string[])).sort(),
    [sources],
  );

  const filtered = sources.filter(
    (s) =>
      (tier === "all" || String(s.tier) === tier) &&
      (destination === "all" || s.destination === destination) &&
      (q === "" ||
        `${s.title} ${s.domain} ${s.country ?? ""} ${s.notes ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Brand />
          <Button asChild size="sm" variant="outline">
            <Link to="/research">Open workspace</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-4xl">Source explorer</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The registry is deliberately visible. What has been crawled, what has not, when it was
          last fetched and how much each source is trusted.
        </p>

        <div className="surface-card mt-8 p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={evidenceQuery}
              onChange={(e) => setEvidenceQuery(e.target.value)}
              placeholder="Search indexed evidence text (e.g. travel insurance minimum cover)"
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          {evidenceQuery.length > 2 && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {evidence.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
              {evidence.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No indexed passages match. The corpus grows as sources are crawled.
                </p>
              )}
              {(evidence.data ?? []).map((r, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <TierBadge tier={r.tier} />
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {r.documentTitle ?? r.sourceTitle}
                    </a>
                    <span className="font-mono text-[11px] text-muted-foreground">{r.domain}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.content.slice(0, 300)}…</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-end gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter registry"
            className="max-w-xs"
          />
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {TIERS.map((t) => (
                <SelectItem key={t.tier} value={String(t.tier)}>
                  T{t.tier} — {t.short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All destinations</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} sources</span>
        </div>

        <div className="mt-4 space-y-2 pb-16">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="surface-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={s.tier} />
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {s.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{s.domain}</p>
                {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
              </div>
              <div className="text-xs text-muted-foreground sm:text-right">
                <p>{s.destination ?? s.country ?? "Global"}</p>
                <p className="mt-1">
                  {s.last_crawled_at
                    ? `Crawled ${freshnessLabel(s.last_crawled_at).label}`
                    : "Not crawled yet"}
                </p>
                <p className="mt-1 font-mono">{s.crawl_status}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sources match these filters.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}