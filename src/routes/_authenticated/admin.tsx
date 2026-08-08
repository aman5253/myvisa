import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/vi/app-shell";
import { TierBadge } from "@/components/vi/tier-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSource,
  adminOverview,
  claimAdmin,
  crawlSource,
  deleteSource,
  isAdmin,
  setSourceEnabled,
} from "@/lib/admin.functions";
import { DESTINATIONS, TIERS, freshnessLabel } from "@/lib/taxonomy";
import { getSystemStatus } from "@/lib/research.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Data console — MyVisa admin" },
      {
        name: "description",
        content:
          "Source registry, crawl queue, ingestion errors and freshness for the MyVisa evidence corpus.",
      },
      { property: "og:title", content: "Data console — MyVisa" },
      { property: "og:description", content: "Source registry, crawls and corpus freshness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const role = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const claim = useServerFn(claimAdmin);

  const claimIt = useMutation({
    mutationFn: () => claim({}),
    onSuccess: () => {
      toast.success("You are now the administrator");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role.isLoading) {
    return (
      <AppShell>
        <div className="p-10 text-center text-sm text-muted-foreground">Checking access…</div>
      </AppShell>
    );
  }

  if (!role.data?.isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="font-display text-2xl">Data console</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {role.data?.anyAdminExists
              ? "This workspace already has an administrator. Ask them to grant you access."
              : "No administrator exists yet. As the first signed-in user you can claim the role to manage the source registry and crawls."}
          </p>
          {!role.data?.anyAdminExists && (
            <Button className="mt-6" onClick={() => claimIt.mutate()} disabled={claimIt.isPending}>
              {claimIt.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Claim admin role
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  return <Console />;
}

function Console() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });
  const sysStatus = useQuery({ queryKey: ["status"], queryFn: () => getSystemStatus() });
  const crawl = useServerFn(crawlSource);
  const toggle = useServerFn(setSourceEnabled);
  const del = useServerFn(deleteSource);
  const add = useServerFn(addSource);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    url: "",
    tier: "1",
    source_type: "government",
    destination: "France",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  async function runCrawl(id: string) {
    setBusyId(id);
    try {
      const result = await crawl({ data: { id } });
      result.ok ? toast.success(result.message) : toast.error(result.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  async function crawlAll() {
    const list = (overview.data?.sources ?? []).filter((s) => s.enabled);
    toast.info(`Crawling ${list.length} sources — this runs one at a time.`);
    for (const s of list) {
      // eslint-disable-next-line no-await-in-loop
      await runCrawl(s.id);
    }
  }

  const addSrc = useMutation({
    mutationFn: () =>
      add({
        data: {
          title: form.title,
          url: form.url,
          tier: Number(form.tier),
          source_type: form.source_type,
          destination: form.destination,
        },
      }),
    onSuccess: () => {
      toast.success("Source added to registry");
      setForm({ ...form, title: "", url: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = overview.data;
  const stale = (data?.sources ?? []).filter(
    (s) => !s.last_crawled_at || freshnessLabel(s.last_crawled_at).tone === "stale",
  ).length;
  const errored = (data?.sources ?? []).filter((s) => s.crawl_status === "error").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl">Data console</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={crawlAll} disabled={Boolean(busyId)}>
              Crawl all enabled
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Sources" value={data?.sources.length ?? 0} />
          <Stat label="Documents" value={data?.documentCount ?? 0} />
          <Stat label="Chunks" value={data?.chunkCount ?? 0} />
          <Stat label="Stale / uncrawled" value={stale} />
          <Stat label="Errors" value={errored} />
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-xl">Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What is actually wired up. Anything marked not configured is inactive — the app never
            simulates it.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(sysStatus.data?.integrations ?? []).map((i) => (
              <div key={i.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium">{i.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      i.configured
                        ? "bg-[var(--success)]/10 text-[var(--success)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                {i.envKeys.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {i.envKeys.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-xl">Add a source</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only publicly accessible pages. The crawler checks robots.txt and never bypasses access
            controls or login walls.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="France-Visas — short stay"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t.tier} value={String(t.tier)}>
                      T{t.tier} — {t.short}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source type</Label>
              <Input
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Select
                value={form.destination}
                onValueChange={(v) => setForm({ ...form, destination: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => addSrc.mutate()}
                disabled={addSrc.isPending || !form.title || !form.url}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">
            Source registry
          </div>
          <div className="divide-y divide-border">
            {(data?.sources ?? []).map((s) => (
              <div key={s.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TierBadge tier={s.tier} />
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {s.title}
                    </a>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{s.domain}</p>
                  {s.last_error && (
                    <p className="mt-1 text-xs text-[var(--danger)]">{s.last_error}</p>
                  )}
                </div>
                <div className="w-40 text-xs text-muted-foreground">
                  <p className="font-mono">{s.crawl_status}</p>
                  <p>{freshnessLabel(s.last_crawled_at).label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={async (v) => {
                      await toggle({ data: { id: s.id, enabled: v } });
                      refresh();
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runCrawl(s.id)}
                    disabled={busyId === s.id}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Crawl
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Remove ${s.title} from the registry?`)) return;
                      await del({ data: { id: s.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">
              Recent crawls
            </div>
            <div className="max-h-96 divide-y divide-border overflow-y-auto text-xs">
              {(data?.crawls ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="font-mono">{c.status}</span>
                  <span className="text-muted-foreground">{c.http_status ?? "—"}</span>
                  <span className="flex-1 truncate text-muted-foreground">{c.error ?? ""}</span>
                  <span className="text-muted-foreground">
                    {new Date(c.started_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {(data?.crawls ?? []).length === 0 && (
                <p className="px-5 py-4 text-muted-foreground">No crawls yet.</p>
              )}
            </div>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Usage</div>
            <div className="p-5 text-sm">
              {Object.entries(
                (data?.events ?? []).reduce<Record<string, number>>((acc, e) => {
                  acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border py-2 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
              {(data?.events ?? []).length === 0 && (
                <p className="text-muted-foreground">No usage recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}