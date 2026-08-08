import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LetterDraft = { draft: string; assumptions: string[]; notes: string[] };
export type LetterReview = {
  verdict: string;
  missing: { item: string; why: string }[];
  inconsistencies: { item: string; why: string }[];
  suggestions: string[];
  revised: string | null;
};

const Context = z.object({
  question: z.string().max(2000).optional(),
  destination: z.string().nullable().optional(),
  visaType: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  residence: z.string().nullable().optional(),
  travelDate: z.string().nullable().optional(),
  durationDays: z.number().nullable().optional(),
  /** Requirement lines already researched, so the letter matches the evidence. */
  requirements: z.array(z.string()).max(40).optional(),
});

const DraftInput = Context;
const ReviewInput = Context.extend({ letter: z.string().min(30).max(20000) });

const NO_INVENTION = `You help a visa applicant with a cover letter.
ABSOLUTE RULES
- Never invent facts about the applicant: no names, passport numbers, addresses, employers, salaries, dates or bookings that were not supplied. Use clearly marked placeholders like [Full name as in passport] instead.
- Never claim a cover letter is legally mandatory unless the supplied requirements say so.
- This is a draft to be reviewed and edited by the applicant. It is not legal advice.`;

function contextBlock(d: z.infer<typeof Context>) {
  return [
    d.nationality && `Nationality: ${d.nationality}`,
    d.residence && `Residence: ${d.residence}`,
    d.destination && `Destination: ${d.destination}`,
    d.visaType && `Visa type: ${d.visaType}`,
    d.travelDate && `Travel date: ${d.travelDate}`,
    d.durationDays && `Trip length: ${d.durationDays} days`,
    d.question && `What the applicant said: ${d.question}`,
    d.requirements?.length && `Researched requirements:\n- ${d.requirements.join("\n- ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const draftCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DraftInput.parse(i))
  .handler(async ({ data }): Promise<LetterDraft> => {
    const { chatJson, aiConfigured, AiError } = await import("./ai.server");
    if (!aiConfigured()) throw new Error("AI provider is not configured, so no draft can be produced.");
    try {
      const out = await chatJson<{ draft?: string; assumptions?: string[]; notes?: string[] }>({
        system: `${NO_INVENTION}
Write a complete cover letter addressed to the relevant consulate/embassy, covering: purpose of travel, exact travel dates and duration, itinerary outline, accommodation, who is being visited if relevant, employment/study status and approved leave, how the trip is financed, and ties that mean the applicant will return. Keep it under 450 words, plain professional English, no flattery.
Reply as JSON: {"draft":string,"assumptions":[string],"notes":[string]} where assumptions lists every placeholder the applicant must fill and notes lists 2-4 short tips.`,
        user: contextBlock(data) || "No context supplied.",
      });
      return {
        draft: String(out.draft ?? "").trim(),
        assumptions: (out.assumptions ?? []).map(String).filter(Boolean).slice(0, 12),
        notes: (out.notes ?? []).map(String).filter(Boolean).slice(0, 6),
      };
    } catch (error) {
      if (error instanceof AiError) throw new Error(error.message);
      throw error;
    }
  });

export const reviewCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReviewInput.parse(i))
  .handler(async ({ data }): Promise<LetterReview> => {
    const { chatJson, aiConfigured, AiError } = await import("./ai.server");
    if (!aiConfigured()) throw new Error("AI provider is not configured, so no review can be produced.");
    try {
      const out = await chatJson<{
        verdict?: string;
        missing?: { item?: string; why?: string }[];
        inconsistencies?: { item?: string; why?: string }[];
        suggestions?: string[];
        revised?: string;
      }>({
        system: `${NO_INVENTION}
Review the applicant's cover letter against the case context and researched requirements. Separate what you DETECTED IN THE LETTER from what a REQUIREMENT asks for. Do not add facts the letter does not contain — flag them as missing instead.
Reply as JSON: {"verdict":string,"missing":[{"item":string,"why":string}],"inconsistencies":[{"item":string,"why":string}],"suggestions":[string],"revised":string} where revised is an improved version that keeps every factual claim from the original and uses placeholders for anything absent.`,
        user: `${contextBlock(data)}\n\nLETTER\n${data.letter}`,
      });
      const pairs = (v: { item?: string; why?: string }[] | undefined) =>
        (v ?? [])
          .map((x) => ({ item: String(x.item ?? "").trim(), why: String(x.why ?? "").trim() }))
          .filter((x) => x.item);
      return {
        verdict: String(out.verdict ?? "").trim(),
        missing: pairs(out.missing),
        inconsistencies: pairs(out.inconsistencies),
        suggestions: (out.suggestions ?? []).map(String).filter(Boolean).slice(0, 8),
        revised: String(out.revised ?? "").trim() || null,
      };
    } catch (error) {
      if (error instanceof AiError) throw new Error(error.message);
      throw error;
    }
  });