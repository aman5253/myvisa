import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Info,
  MessageCircle,
  Sparkle,
} from "lucide-react";
import { toast } from "sonner";
import type { Citation, ChecklistItem, ResearchAnswer } from "@/lib/research.functions";
import { TierBadge } from "./tier-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS: Record<ChecklistItem["status"], { label: string; color: string }> = {
  required: { label: "Required", color: "var(--tier-1)" },
  conditional: { label: "Conditional", color: "var(--warning)" },
  verify: { label: "Verify", color: "var(--tier-5)" },
};

export function AnswerView({
  answer,
  onFollowup,
  actions,
}: {
  answer: ResearchAnswer;
  onFollowup?: (q: string) => void;
  actions?: ReactNode;
}) {
  const byRef = new Map(answer.citations.map((c) => [c.ref, c]));

  function copy() {
    const lines = [
      answer.summary,
      "",
      "WHAT YOU NEED",
      ...answer.checklist.map(
        (c, i) =>
          `${i + 1}. ${c.documentName} — ${STATUS[c.status].label}. ${c.whatToPrepare}` +
          [
            c.issuer && `Issued by: ${c.issuer}`,
            c.period && `Period: ${c.period}`,
            c.formatOrSpecification && `Format: ${c.formatOrSpecification}`,
            c.validity && `Validity: ${c.validity}`,
          ]
            .filter(Boolean)
            .map((l) => `\n   ${l}`)
            .join(""),
      ),
      "",
      ...(answer.guidance.length ? ["WHAT THIS MEANS FOR YOU", ...answer.guidance.map((g) => `- ${g}`), ""] : []),
      "SOURCES",
      ...answer.citations.map((c) => `${c.title} — ${c.url}`),
      "",
      "Research assistance only — not legal advice. Verify with the relevant authority.",
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Answer copied");
  }

  if (answer.mode === "setup_required" || answer.mode === "no_evidence") {
    return (
      <div className="surface-card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="font-medium tracking-tight">
              {answer.mode === "setup_required"
                ? "Live answers aren't switched on yet"
                : "No trustworthy source could answer this yet"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer.notice}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              MyVisa won't answer a visa question it can't back with a real source.
            </p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    );
  }

  const hasDoubts = answer.conflicts.length > 0 || answer.missingFromCase.length > 0;

  return (
    <div className="space-y-5">
      {answer.mode === "demo" && (
        <div className="rounded-xl border border-[color-mix(in_oklch,var(--warning)_45%,transparent)] bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] px-4 py-2.5 text-sm">
          <strong>Demo mode.</strong> Sample data, clearly labelled — not current visa
          requirements.
        </div>
      )}

      {/* 2. Answer summary */}
      <div className="space-y-3">
        <p className="text-[15px] leading-relaxed sm:text-base">{answer.summary}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copy} className="h-7 px-2 text-xs">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>

      {/* 3. Checklist */}
      {answer.checklist.length > 0 && (
        <section className="surface-card overflow-hidden">
          <header className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold tracking-tight">What you need</h2>
            <span className="text-xs text-muted-foreground">
              {answer.checklist.length} items
            </span>
          </header>
          <ol className="divide-y divide-border">
            {answer.checklist.map((item, i) => (
              <ChecklistRow key={i} index={i + 1} item={item} byRef={byRef} />
            ))}
          </ol>
        </section>
      )}

      {/* 4. Guidance */}
      {answer.guidance.length > 0 && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2">
            <Sparkle className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold tracking-tight">What this means for you</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {answer.guidance.map((g, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Applicant experiences */}
      <section className="surface-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--tier-5)]" />
          <h2 className="text-sm font-semibold tracking-tight">Applicant experiences</h2>
          <span className="rounded-full bg-[color-mix(in_oklch,var(--warning)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]">
            Anecdotal — not an official requirement
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {answer.applicantExperiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No applicant reports are available for this question yet.
            </p>
          ) : (
            answer.applicantExperiences.map((e, i) => {
              const c = e.refs.map((r) => byRef.get(r)).find(Boolean);
              return (
                <article key={i} className="rounded-xl border border-border p-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Applicant report</span>
                    {c && <span>{c.domain}</span>}
                    {c?.publishedAt && <span>· {c.publishedAt.slice(0, 10)}</span>}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{e.text}</p>
                  {c && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      View report <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* 6. Double-check */}
      {hasDoubts ? (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
            <h2 className="text-sm font-semibold tracking-tight">Things to double-check</h2>
          </div>
          <div className="mt-3 space-y-3">
            {answer.conflicts.map((c, i) => (
              <div key={`c${i}`} className="rounded-xl border border-border p-3.5 text-sm">
                <p className="font-medium">{c.topic}</p>
                <p className="mt-1.5">
                  <span className="text-muted-foreground">Official position: </span>
                  {c.officialPosition}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Others report: {c.conflictingClaim}
                </p>
              </div>
            ))}
            {answer.missingFromCase.map((m, i) => (
              <div key={`m${i}`} className="rounded-xl border border-border p-3.5 text-sm">
                <p className="font-medium">{m.item}</p>
                <p className="mt-1 text-muted-foreground">{m.why}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
          Nothing contradictory came up in the sources used.
        </p>
      )}

      {/* 7. Sources, collapsed */}
      <SourcesPanel citations={answer.citations} />

      {answer.followups.length > 0 && onFollowup && (
        <div className="flex flex-wrap gap-2">
          {answer.followups.map((f) => (
            <button
              key={f}
              onClick={() => onFollowup(f)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Research and preparation assistance — not legal advice, and not a decision on your
        application.
      </p>
    </div>
  );
}

function ChecklistRow({
  index,
  item,
  byRef,
}: {
  index: number;
  item: ChecklistItem;
  byRef: Map<number, Citation>;
}) {
  const [open, setOpen] = useState(false);
  const sources = item.refs.map((r) => byRef.get(r)).filter(Boolean) as Citation[];
  const status = STATUS[item.status];
  const specs = [
    { label: "Issued by", value: item.issuer },
    { label: "Period", value: item.period },
    { label: "Format", value: item.formatOrSpecification },
    { label: "Validity", value: item.validity },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  return (
    <li className="flex gap-3.5 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{item.documentName}</h3>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
            style={{
              color: status.color,
              backgroundColor: `color-mix(in oklch, ${status.color} 12%, transparent)`,
            }}
          >
            {status.label}
          </span>
          {item.scope === "local" && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              Local requirement
            </span>
          )}
        </div>
        {item.whatToPrepare && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.whatToPrepare}</p>
        )}
        {specs.length > 0 && (
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {specs.map((s) => (
              <div key={s.label} className="flex gap-1.5">
                <dt className="shrink-0 text-muted-foreground">{s.label}:</dt>
                <dd className="min-w-0">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.preparationSteps.length > 0 && (
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
            {item.preparationSteps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular-nums">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {item.why && (
          <p className="mt-2 text-xs italic text-muted-foreground">Why: {item.why}</p>
        )}
        {sources.length > 0 && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Why / source
              <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="mt-2 space-y-1.5">
                {sources.map((c) => (
                  <a
                    key={c.ref}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-2 text-xs transition-colors hover:border-accent/50"
                  >
                    <TierBadge tier={c.tier} showLabel={false} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="text-muted-foreground">{c.domain}</span>
                    </span>
                    <ExternalLink className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function SourcesPanel({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;
  return (
    <section className="surface-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="text-sm font-medium tracking-tight">
          Sources &amp; evidence{" "}
          <span className="text-muted-foreground">({citations.length})</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-4 sm:p-5">
          {citations.map((c) => (
            <div key={c.ref} className="rounded-xl border border-border p-3.5">
              <TierBadge tier={c.tier} />
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm font-medium underline-offset-4 hover:underline"
              >
                {c.title}
              </a>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.domain}
                {c.publishedAt ? ` · published ${c.publishedAt.slice(0, 10)}` : ""} · retrieved{" "}
                {c.retrievedAt.slice(0, 10)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/70">{c.snippet}…</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
