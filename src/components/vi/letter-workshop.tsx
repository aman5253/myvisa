import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, FileText, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  draftCoverLetter,
  reviewCoverLetter,
  type LetterDraft,
  type LetterReview,
} from "@/lib/letter.functions";
import type { QuestionContext } from "@/lib/question-context";

/** Shown when a question is about a cover letter: research plus a real action. */
export function LetterWorkshop({
  context,
  question,
  requirements,
}: {
  context: QuestionContext;
  question: string;
  requirements: string[];
}) {
  const [tab, setTab] = useState<"create" | "review">("create");
  const [letter, setLetter] = useState("");
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [review, setReview] = useState<LetterReview | null>(null);

  const base = {
    question,
    destination: context.destination,
    visaType: context.visaType,
    nationality: context.nationality,
    residence: context.residence,
    travelDate: context.travelDate,
    durationDays: context.durationDays,
    requirements: requirements.slice(0, 40),
  };

  const create = useServerFn(draftCoverLetter);
  const check = useServerFn(reviewCoverLetter);

  const createM = useMutation({
    mutationFn: () => create({ data: base }),
    onSuccess: setDraft,
    onError: (e: Error) => toast.error(e.message),
  });
  const reviewM = useMutation({
    mutationFn: () => check({ data: { ...base, letter } }),
    onSuccess: setReview,
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <section className="surface-card space-y-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <h3 className="font-semibold">Cover letter</h3>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {(["create", "review"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 capitalize ${
                tab === t ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "create" ? "Create a draft" : "Review mine"}
            </button>
          ))}
        </div>
      </header>

      {tab === "create" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            MyVisa writes a draft from what you told it and the requirements found above. Anything
            it does not know stays a placeholder — it never invents facts about you.
          </p>
          <Button size="sm" onClick={() => createM.mutate()} disabled={createM.isPending}>
            {createM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {draft ? "Regenerate draft" : "Create a draft"}
          </Button>
          {draft && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Draft — review and edit before you submit it
                </p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {draft.draft}
                </pre>
              </div>
              {draft.assumptions.length > 0 && (
                <Bullets title="Fill these in" items={draft.assumptions} />
              )}
              {draft.notes.length > 0 && <Bullets title="Notes" items={draft.notes} />}
              <Button size="sm" variant="outline" onClick={() => copy(draft.draft)}>
                <Copy className="h-3.5 w-3.5" />
                Copy draft
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder="Paste your cover letter here…"
            className="min-h-40"
          />
          <Button
            size="sm"
            onClick={() => reviewM.mutate()}
            disabled={reviewM.isPending || letter.trim().length < 30}
          >
            {reviewM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Review my letter
          </Button>
          {review && (
            <div className="space-y-3 text-sm">
              {review.verdict && <p className="leading-relaxed">{review.verdict}</p>}
              {review.missing.length > 0 && (
                <Pairs title="Missing from your letter" items={review.missing} />
              )}
              {review.inconsistencies.length > 0 && (
                <Pairs title="Possible inconsistencies" items={review.inconsistencies} />
              )}
              {review.suggestions.length > 0 && (
                <Bullets title="Suggested edits" items={review.suggestions} />
              )}
              {review.revised && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-border bg-secondary/40 p-4">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Suggested revision — draft only
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {review.revised}
                    </pre>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(review.revised!)}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy revision
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="list-disc space-y-1 pl-5 leading-relaxed">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Pairs({ title, items }: { title: string; items: { item: string; why: string }[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((i, k) => (
          <li key={k} className="leading-relaxed">
            <span className="font-medium">{i.item}</span>
            {i.why && <span className="text-muted-foreground"> — {i.why}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}