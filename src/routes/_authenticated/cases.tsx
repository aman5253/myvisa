import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Plus,
  ShieldQuestion,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/vi/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { runAudit } from "@/lib/audit.functions";
import { COUNTRIES, DESTINATIONS, VISA_TYPES, freshnessLabel } from "@/lib/taxonomy";

export const Route = createFileRoute("/_authenticated/cases")({
  head: () => ({
    meta: [
      { title: "Case workspace — MyVisa" },
      {
        name: "description",
        content:
          "Save your case profile, upload documents, run an application audit and keep a source-linked checklist.",
      },
      { property: "og:title", content: "Case workspace — MyVisa" },
      {
        property: "og:description",
        content: "Case profile, document audit and source-linked checklist.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasesPage,
});

const BLANK = {
  name: "",
  nationality: "India",
  residence_country: "India",
  destination: "France",
  visa_type: "tourism",
  travel_date: "",
  application_date: "",
  employment_status: "",
  financial_summary: "",
  sponsor_info: "",
  travel_history: "",
};

function CasesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof BLANK | null>(null);

  const cases = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const current = cases.data?.find((c) => c.id === selected) ?? null;

  const save = useMutation({
    mutationFn: async (values: typeof BLANK) => {
      const payload = {
        ...values,
        travel_date: values.travel_date || null,
        application_date: values.application_date || null,
      };
      if (selected) {
        const { error } = await supabase.from("cases").update(payload).eq("id", selected);
        if (error) throw error;
        return selected;
      }
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cases")
        .insert({ ...payload, user_id: user.user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Case saved");
      setDraft(null);
      setSelected(id);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case and its data deleted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const values = draft ?? (current ? { ...BLANK, ...stripNulls(current) } : null);

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <Button
            className="w-full"
            onClick={() => {
              setSelected(null);
              setDraft({ ...BLANK, name: "New case" });
            }}
          >
            <Plus className="h-4 w-4" />
            New case
          </Button>
          {cases.isLoading && <p className="p-2 text-sm text-muted-foreground">Loading…</p>}
          {cases.data?.length === 0 && !draft && (
            <p className="p-2 text-sm text-muted-foreground">
              No cases yet. Create one to personalise research and run audits.
            </p>
          )}
          {(cases.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setDraft(null);
                setSelected(c.id);
              }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                c.id === selected ? "border-accent/50 bg-card" : "border-border hover:bg-card/60"
              }`}
            >
              <span className="block font-medium">{c.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {c.nationality} → {c.destination} · {c.visa_type}
              </span>
            </button>
          ))}
        </aside>

        <section className="min-w-0 space-y-6">
          {!values ? (
            <div className="surface-card p-8 text-center">
              <h1 className="font-display text-2xl">Case workspace</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                A case stores only what is needed to personalise research: route, dates and a short
                free-text summary of your situation. You can delete it, and everything attached to
                it, at any time.
              </p>
            </div>
          ) : (
            <>
              <div className="surface-card space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="font-display text-2xl">{values.name || "Untitled case"}</h1>
                  {selected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this case, its documents and audits?"))
                          remove.mutate(selected);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Case name">
                    <Input
                      value={values.name}
                      onChange={(e) => setDraft({ ...values, name: e.target.value })}
                    />
                  </F>
                  <F label="Visa type">
                    <Pick
                      value={values.visa_type}
                      onChange={(v) => setDraft({ ...values, visa_type: v })}
                      options={[...VISA_TYPES]}
                    />
                  </F>
                  <F label="Nationality">
                    <Pick
                      value={values.nationality}
                      onChange={(v) => setDraft({ ...values, nationality: v })}
                      options={COUNTRIES}
                    />
                  </F>
                  <F label="Country of residence">
                    <Pick
                      value={values.residence_country}
                      onChange={(v) => setDraft({ ...values, residence_country: v })}
                      options={COUNTRIES}
                    />
                  </F>
                  <F label="Destination">
                    <Pick
                      value={values.destination}
                      onChange={(v) => setDraft({ ...values, destination: v })}
                      options={DESTINATIONS}
                    />
                  </F>
                  <div className="grid grid-cols-2 gap-3">
                    <F label="Travel date">
                      <Input
                        type="date"
                        value={values.travel_date}
                        onChange={(e) => setDraft({ ...values, travel_date: e.target.value })}
                      />
                    </F>
                    <F label="Application date">
                      <Input
                        type="date"
                        value={values.application_date}
                        onChange={(e) => setDraft({ ...values, application_date: e.target.value })}
                      />
                    </F>
                  </div>
                  <F label="Employment / student status">
                    <Input
                      value={values.employment_status}
                      onChange={(e) => setDraft({ ...values, employment_status: e.target.value })}
                      placeholder="e.g. Salaried, 4 years at current employer"
                    />
                  </F>
                  <F label="Sponsor or invitation">
                    <Input
                      value={values.sponsor_info}
                      onChange={(e) => setDraft({ ...values, sponsor_info: e.target.value })}
                      placeholder="e.g. Self-funded, or host invitation from cousin"
                    />
                  </F>
                </div>
                <F label="Financial situation (summary only — no account numbers)">
                  <Textarea
                    rows={2}
                    value={values.financial_summary}
                    onChange={(e) => setDraft({ ...values, financial_summary: e.target.value })}
                    placeholder="e.g. Approx. 6 months of salary credits, savings sufficient for a 10-day trip"
                  />
                </F>
                <F label="Previous travel / visa history (optional)">
                  <Textarea
                    rows={2}
                    value={values.travel_history}
                    onChange={(e) => setDraft({ ...values, travel_history: e.target.value })}
                    placeholder="e.g. Previous Schengen visa 2023, UK visa 2019, no refusals"
                  />
                </F>
                <div className="flex items-center gap-3">
                  <Button onClick={() => save.mutate(values)} disabled={save.isPending}>
                    {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save case
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Avoid entering document numbers or anything you would not want stored.
                  </p>
                </div>
              </div>

              {selected && <CaseDocuments caseId={selected} />}
              {selected && <Checklist caseId={selected} />}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function CaseDocuments({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const audit = useServerFn(runAudit);
  const [uploading, setUploading] = useState(false);

  const docs = useQuery({
    queryKey: ["case-docs", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const latestAudit = useQuery({
    queryKey: ["audit", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audits")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: findings } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", data.id);
      return { ...data, findings: findings ?? [] };
    },
  });

  const run = useMutation({
    mutationFn: () => audit({ data: { caseId } }),
    onSuccess: () => {
      toast.success("Audit complete");
      qc.invalidateQueries({ queryKey: ["audit", caseId] });
      qc.invalidateQueries({ queryKey: ["checklist", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user!.id;
      for (const file of Array.from(files)) {
        const path = `${uid}/${caseId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("case-documents").upload(path, file);
        if (error) throw error;
        const { error: dbError } = await supabase.from("case_documents").insert({
          case_id: caseId,
          user_id: uid,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (dbError) throw dbError;
      }
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(id: string, path: string) {
    await supabase.storage.from("case-documents").remove([path]);
    await supabase.from("case_documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Application auditor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Documents are compared against retrieved requirements. Findings always separate what was
            detected in your file from what a source demands.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
              <input
                type="file"
                multiple
                className="hidden"
                accept="application/pdf,image/*"
                onChange={(e) => upload(e.target.files)}
              />
            </label>
          </Button>
          <Button
            size="sm"
            onClick={() => run.mutate()}
            disabled={run.isPending || (docs.data?.length ?? 0) === 0}
          >
            {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Run audit
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {docs.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No documents uploaded. PDFs and images are supported; files stay private to your
            account.
          </p>
        )}
        {(docs.data ?? []).map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{d.file_name}</span>
            <span className="text-xs text-muted-foreground">
              {Math.round((d.size_bytes ?? 0) / 1024)} KB
            </span>
            <button
              onClick={() => removeDoc(d.id, d.storage_path)}
              className="text-muted-foreground hover:text-[var(--danger)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {latestAudit.data && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-medium">{latestAudit.data.readiness_score}</div>
            <div>
              <p className="text-sm font-medium">Readiness score</p>
              <p className="text-xs text-muted-foreground">
                Package completeness against retrieved requirements — not an approval prediction.
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{latestAudit.data.summary}</p>
          <div className="mt-4 space-y-2">
            {latestAudit.data.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="h-3.5 w-3.5"
                    style={{
                      color:
                        f.severity === "critical"
                          ? "var(--danger)"
                          : f.severity === "warning"
                            ? "var(--warning)"
                            : "var(--muted-foreground)",
                    }}
                  />
                  <span className="font-medium">{f.title}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.category}</span>
                </div>
                {f.detected_from_document && (
                  <p className="mt-2 text-xs">
                    <span className="text-muted-foreground">Detected in your document: </span>
                    {f.detected_from_document}
                  </p>
                )}
                {f.requirement_from_source && (
                  <p className="mt-1 text-xs">
                    <span className="text-[var(--tier-1)]">Requirement from source: </span>
                    {f.requirement_from_source}
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 underline underline-offset-4"
                      >
                        link
                      </a>
                    )}
                  </p>
                )}
                {f.needs_human_verification && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--warning)]">
                    <ShieldQuestion className="h-3 w-3" />
                    Needs human or official verification
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Checklist({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["checklist", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("case_id", caseId)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  async function toggle(id: string, status: string) {
    await supabase
      .from("checklist_items")
      .update({ status: status === "done" ? "todo" : "done" })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["checklist", caseId] });
  }

  if (!items.data?.length) return null;

  return (
    <div className="surface-card p-5">
      <h2 className="font-display text-xl">Checklist</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Generated from the sources retrieved for this exact case. Each line keeps its source and
        last-verified date.
      </p>
      <ul className="mt-4 space-y-2">
        {items.data.map((i) => (
          <li key={i.id} className="flex gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={i.status === "done"}
              onChange={() => toggle(i.id, i.status)}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
            />
            <div className="min-w-0 flex-1 text-sm">
              <p className={i.status === "done" ? "line-through opacity-60" : ""}>{i.label}</p>
              {i.why && <p className="mt-1 text-xs text-muted-foreground">{i.why}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {i.source_url ? (
                  <a
                    href={i.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {i.source_title ?? "source"}
                  </a>
                ) : (
                  "no source linked"
                )}{" "}
                · {freshnessLabel(i.last_verified_at).label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Pick({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function stripNulls(row: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}