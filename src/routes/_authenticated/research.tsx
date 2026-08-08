import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/vi/app-shell";
import { AnswerView } from "@/components/vi/answer-view";
import { LetterWorkshop } from "@/components/vi/letter-workshop";
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
import { getSystemStatus, researchQuestion, type ResearchAnswer } from "@/lib/research.functions";
import { describeResearchError, type ResearchErrorInfo } from "@/lib/research-errors";
import {
  ALL_COUNTRIES,
  EMPTY_CONTEXT,
  FIELD_LABELS,
  inferContext,
  mergeContext,
  missingFields,
  type ContextField,
  type QuestionContext,
} from "@/lib/question-context";
import { VISA_TYPES } from "@/lib/taxonomy";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Research workspace — MyVisa" },
      {
        name: "description",
        content:
          "Describe your visa situation in your own words and get an evidence-backed answer with official requirements, applicant experience, conflicts and citations.",
      },
      { property: "og:title", content: "Research workspace — MyVisa" },
      { property: "og:description", content: "Evidence-backed visa research with citations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchPage,
});

type Turn = {
  question: string;
  context: QuestionContext;
  demo: boolean;
  answer: ResearchAnswer | null;
  error?: ResearchErrorInfo | undefined;
};

const EXAMPLES = [
  "I'm an Indian software engineer living in India. I want to visit Italy for 10 days. What documents should I prepare?",
  "Do I need a visa to visit Japan?",
  "What do I need for a UK student visa?",
];

const CONTEXT_ORDER: ContextField[] = [
  "nationality",
  "residence",
  "destination",
  "visaType",
  "durationDays",
  "travelDate",
];

function contextSummary(ctx: QuestionContext): string {
  const route =
    ctx.nationality && ctx.destination
      ? `${ctx.nationality} → ${ctx.destination}`
      : (ctx.destination ?? ctx.nationality ?? null);
  const parts = [
    route,
    ctx.visaType ? `${ctx.visaType} visit` : null,
    ctx.durationDays ? `${ctx.durationDays} days` : null,
    ctx.travelDate,
  ].filter(Boolean);
  return parts.join(" · ");
}

function ResearchPage() {
  const status = useQuery({ queryKey: ["status"], queryFn: () => getSystemStatus() });
  const research = useServerFn(researchQuestion);

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [caseId, setCaseId] = useState<string>("none");
  const [overrides, setOverrides] = useState<Partial<QuestionContext>>({});
  const [editOpen, setEditOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

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

  const activeCase = cases.data?.find((c) => c.id === caseId) ?? null;
  const caseValues: Partial<QuestionContext> = activeCase
    ? {
        destination: activeCase.destination,
        nationality: activeCase.nationality,
        residence: activeCase.residence_country,
        visaType: activeCase.visa_type,
        travelDate: activeCase.travel_date,
      }
    : {};

  // The submitted text always drives context; a saved case only fills gaps.
  const liveContext = mergeContext(inferContext(question), caseValues, overrides);
  const lastTurn = turns[turns.length - 1] ?? null;
  const shownContext = lastTurn ? mergeContext(lastTurn.context, {}, overrides) : liveContext;
  const missing = useMemo(() => missingFields(shownContext), [shownContext]);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const ask = useMutation({
    mutationFn: async (turn: Turn) =>
      research({
        data: {
          question: turn.question,
          caseId: caseId === "none" ? null : caseId,
          destination: turn.context.destination,
          visaType: turn.context.visaType,
          nationality: turn.context.nationality,
          residence: turn.context.residence,
          travelDate: turn.context.travelDate,
          applicationDate: null,
          demo: turn.demo,
          history: turns
            .filter((t) => t.answer)
            .slice(-3)
            .flatMap((t) => [
              { role: "user" as const, content: t.question },
              { role: "assistant" as const, content: t.answer!.summary },
            ]),
        },
      }),
    onSuccess: (answer) => {
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, answer } : turn)));
    },
    onError: (error: unknown) => {
      const info = describeResearchError(error);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: info } : turn)));
      toast.error(info.title, { description: info.hint ?? undefined });
    },
  });

  function submit(text?: string, demo = false) {
    const q = (text ?? question).trim();
    if (q.length < 3 || ask.isPending) return;
    const turn: Turn = {
      question: q,
      context: mergeContext(inferContext(q), caseValues, overrides),
      demo,
      answer: null,
    };
    setTurns((t) => [...t, turn]);
    setQuestion("");
    setEditOpen(false);
    ask.mutate(turn);
  }

  function retry(index: number) {
    const turn = turns[index];
    if (!turn) return;
    const updated: Turn = { ...turn, context: mergeContext(turn.context, {}, overrides) };
    setTurns((t) => t.map((x, i) => (i === index ? { ...updated, error: undefined, answer: null } : x)));
    ask.mutate(updated);
  }

  function setField(field: ContextField, value: string) {
    setOverrides((o) => ({
      ...o,
      [field]:
        value === "any" || value === ""
          ? null
          : field === "durationDays"
            ? Number(value) || null
            : value,
    }));
  }

  async function applyCase(id: string) {
    setCaseId(id);
    setOverrides({});
    if (id === "none") {
      setTurns([]);
      return;
    }
    const { data, error } = await supabase
      .from("case_messages")
      .select("role, content, answer, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Could not load this case's saved conversation.");
      return;
    }
    const restored: Turn[] = [];
    for (const m of data ?? []) {
      if (m.role === "user")
        restored.push({ question: m.content, context: EMPTY_CONTEXT, demo: false, answer: null });
      else if (restored.length)
        restored[restored.length - 1]!.answer = (m.answer as unknown as ResearchAnswer) ?? null;
    }
    setTurns(restored);
  }

  const started = turns.length > 0;

  const composer = (
    <div className="surface-card p-2.5 shadow-[var(--shadow-soft)] sm:p-3">
      <Textarea
        ref={boxRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={
          started
            ? "Ask a follow-up…"
            : "Describe your situation in your own words — nationality, where you live, where you're going, why, and for how long."
        }
        rows={started ? 2 : 4}
        className="resize-none border-0 bg-transparent p-2 text-base shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <button
          onClick={() => setEditOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          {editOpen ? "Hide context" : "Edit context"}
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Enter to send</span>
          <Button
            size="sm"
            disabled={ask.isPending || question.trim().length < 3}
            onClick={() => submit()}
          >
            {ask.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
            Research
          </Button>
        </div>
      </div>
      {editOpen && (
        <ContextFields
          context={shownContext}
          caseId={caseId}
          cases={cases.data ?? []}
          onCase={applyCase}
          onField={setField}
        />
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {!started ? (
          <div className="py-4 sm:py-10">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Ask anything about visas.
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              One box. Any nationality, destination or visa type. MyVisa reads your situation from
              what you write, retrieves the official sources it has indexed, and cites every claim.
            </p>

            <div className="mt-5">{composer}</div>

            <div className="mt-6 space-y-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setQuestion(e);
                    boxRef.current?.focus();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-border px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
                >
                  <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {e}
                </button>
              ))}
            </div>

            {(cases.data ?? []).length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Continue a case:</span>
                {(cases.data ?? []).slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => applyCase(c.id)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-accent/50 hover:text-foreground"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <StatusLine
              status={status.data}
              loading={status.isLoading}
              failed={status.isError}
              onDemo={() => submit(question || EXAMPLES[0], true)}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {turns.map((turn, i) => {
              const ctx = i === turns.length - 1 ? shownContext : turn.context;
              const summary = contextSummary(ctx);
              return (
                <div key={i} className="space-y-3">
                  <p className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                    {turn.question}
                  </p>
                  {summary && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">Understood as</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground capitalize">
                        {summary}
                      </span>
                      {i === turns.length - 1 && (
                        <button
                          onClick={() => setEditOpen(true)}
                          className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                  {turn.answer ? (
                    <AnswerView
                      answer={turn.answer}
                      onFollowup={(q) => submit(q, turn.demo)}
                      actions={
                        turn.answer.mode === "no_evidence" ||
                        turn.answer.mode === "setup_required" ? (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link to="/admin">Open the source registry</Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => submit(turn.question, true)}
                            >
                              Show a labelled demo answer
                            </Button>
                          </>
                        ) : undefined
                      }
                    />
                  ) : turn.error ? (
                    <ErrorCard info={turn.error} onRetry={() => retry(i)} />
                  ) : (
                    <div className="surface-card flex items-center gap-3 p-5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reading official sources and building your checklist…
                    </div>
                  )}
                  {turn.answer && !turn.demo && /cover(ing)? letter|motivation letter|letter of intent/i.test(turn.question) && (
                    <LetterWorkshop
                      context={ctx}
                      question={turn.question}
                      requirements={[
                        ...turn.answer.officialRequirements.map((r) => r.text),
                        ...turn.answer.checklist.map(
                          (c) => `${c.documentName}: ${c.whatToPrepare}`,
                        ),
                      ]}
                    />
                  )}
                </div>
              );
            })}

            {!ask.isPending && missing.length > 0 && lastTurn?.answer && (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm">
                <p className="text-muted-foreground">
                  One thing would sharpen this:{" "}
                  <span className="text-foreground">
                    {FIELD_LABELS[missing[0]!].toLowerCase()}
                  </span>
                  . Tell me in the box, or{" "}
                  <button className="underline" onClick={() => setEditOpen(true)}>
                    set it directly
                  </button>
                  .
                </p>
              </div>
            )}

            <div ref={endRef} />
            <div className="sticky bottom-4 z-30">{composer}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ContextFields({
  context,
  caseId,
  cases,
  onCase,
  onField,
}: {
  context: QuestionContext;
  caseId: string;
  cases: { id: string; name: string }[];
  onCase: (id: string) => void;
  onField: (field: ContextField, value: string) => void;
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        Optional. Everything here is inferred from your question — change it only if MyVisa read
        something wrong.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CountryField
          label={FIELD_LABELS.nationality}
          value={context.nationality}
          onChange={(v) => onField("nationality", v)}
        />
        <CountryField
          label={FIELD_LABELS.residence}
          value={context.residence}
          onChange={(v) => onField("residence", v)}
        />
        <CountryField
          label={FIELD_LABELS.destination}
          value={context.destination}
          onChange={(v) => onField("destination", v)}
        />
        <Field label={FIELD_LABELS.visaType}>
          <Select value={context.visaType ?? "any"} onValueChange={(v) => onField("visaType", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Not specified</SelectItem>
              {VISA_TYPES.map((v) => (
                <SelectItem key={v} value={v} className="capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={FIELD_LABELS.travelDate}>
          <Input
            type="date"
            value={context.travelDate ?? ""}
            onChange={(e) => onField("travelDate", e.target.value)}
          />
        </Field>
        <Field label="Save to case (optional)">
          <Select value={caseId} onValueChange={onCase}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No case — ad-hoc question</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function ErrorCard({ info, onRetry }: { info: ResearchErrorInfo; onRetry: () => void }) {
  return (
    <div className="surface-card space-y-3 border-[var(--danger)]/30 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
        <div className="min-w-0">
          <p className="font-medium">{info.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{info.detail}</p>
          {info.hint && <p className="mt-2 text-xs text-muted-foreground">{info.hint}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {info.retryable && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {info.category === "session" && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/auth">Sign in again</Link>
          </Button>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">{info.category}</span>
      </div>
    </div>
  );
}

function StatusLine({
  status,
  loading,
  failed,
  onDemo,
}: {
  status: Awaited<ReturnType<typeof getSystemStatus>> | undefined;
  loading: boolean;
  failed: boolean;
  onDemo: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (loading) return <p className="mt-6 text-xs text-muted-foreground">Checking engine…</p>;

  const ready = !!status && status.aiConfigured && status.chunks > 0;
  const dot = failed || !status ? "bg-[var(--danger)]" : ready ? "bg-[var(--success)]" : "bg-[var(--warning)]";
  const label = failed || !status ? "Engine status unavailable" : ready ? "Live research available" : "Limited: evidence corpus is empty";

  return (
    <div className="mt-6 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-border p-3 leading-relaxed text-muted-foreground">
          {status ? (
            <>
              <p>
                AI provider: {status.provider.label} · {status.documents} documents ·{" "}
                {status.chunks} chunks indexed.
              </p>
              {!ready && (
                <p>
                  Questions still run end to end, but MyVisa will refuse to answer rather than cite
                  sources it does not have. Crawl registry sources from{" "}
                  <Link to="/admin" className="underline">
                    Admin
                  </Link>
                  , or open a clearly labelled demo answer built only from sample data.
                </p>
              )}
              {!ready && (
                <Button size="sm" variant="outline" onClick={onDemo}>
                  Show a labelled demo answer
                </Button>
              )}
            </>
          ) : (
            <p>The backend did not respond to the status check. Answers may fail until it recovers.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CountryField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? "any"} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="any">Not specified</SelectItem>
          {ALL_COUNTRIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
