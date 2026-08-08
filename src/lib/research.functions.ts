import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Citation = {
  ref: number;
  title: string;
  domain: string;
  url: string;
  tier: number;
  publishedAt: string | null;
  retrievedAt: string;
  snippet: string;
};

export type ResearchAnswer = {
  mode: "live" | "demo" | "no_evidence" | "setup_required";
  notice?: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  checklist: ChecklistItem[];
  guidance: string[];
  officialRequirements: { text: string; refs: number[] }[];
  applicantExperiences: { text: string; refs: number[] }[];
  conflicts: { topic: string; officialPosition: string; conflictingClaim: string; refs: number[] }[];
  missingFromCase: { item: string; why: string }[];
  followups: string[];
  citations: Citation[];
  freshness: { oldestRetrievedAt: string | null; newestRetrievedAt: string | null };
};

export type ChecklistItem = {
  documentName: string;
  status: "required" | "conditional" | "verify";
  scope: "general" | "local";
  whatToPrepare: string;
  issuer: string | null;
  period: string | null;
  formatOrSpecification: string | null;
  validity: string | null;
  preparationSteps: string[];
  why: string | null;
  refs: number[];
};

const Input = z.object({
  question: z.string().min(3).max(2000),
  caseId: z.string().uuid().nullable().optional(),
  destination: z.string().nullable().optional(),
  visaType: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  residence: z.string().nullable().optional(),
  travelDate: z.string().nullable().optional(),
  applicationDate: z.string().nullable().optional(),
  demo: z.boolean().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(10)
    .optional(),
});

export const getSystemStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { aiConfigured } = await import("./ai.server");
  const { aiProvider, integrationStatuses } = await import("./providers.server");
  const { publicServerClient } = await import("./supabase-public.server");
  const supabase = publicServerClient();
  const [{ count: sourceCount }, { count: docCount }, { count: chunkCount }] = await Promise.all([
    supabase.from("sources").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("document_chunks").select("id", { count: "exact", head: true }),
  ]);
  return {
    aiConfigured: aiConfigured(),
    provider: aiProvider(),
    integrations: integrationStatuses(),
    sources: sourceCount ?? 0,
    documents: docCount ?? 0,
    chunks: chunkCount ?? 0,
  };
});

const SYSTEM = `You are the synthesis stage of an evidence engine for visa and immigration research.

ABSOLUTE RULES
- You may ONLY state facts that appear in the numbered EVIDENCE block. Never use prior knowledge about current visa rules.
- Every requirement or claim must carry at least one ref number from the EVIDENCE block. Never invent a ref number.
- Source tiers: 1 government/embassy, 2 official application centre, 3 law/regulation/official guidance, 4 reputable professional, 5 applicant experience (anecdotal), 6 general web.
- Tier 1-3 always override tiers 4-6. If they disagree, record it under conflicts and state the official position as authoritative.
- NEVER refuse to answer just because tier 1-3 evidence is silent on the topic. Answer from the best available evidence and say plainly where it sits on the ladder. The correct shape is: "Official sources in the evidence do not state that X is mandatory. Several reputable sources and applicant reports recommend it, so treat X as recommended rather than required." Prefer that over "the evidence does not contain information, verify with the embassy".
- Weight corroboration: if several independent tier 4-6 sources agree, say so. If only one weak source claims something, say it is a single unconfirmed claim.
- Content from tier 5 belongs ONLY in applicantExperiences and must be phrased as an anecdotal report, never as a rule.
- If the evidence does not answer part of the question, say so plainly instead of filling the gap.
- You are not a lawyer and must not predict approval.
- Never fabricate a source, applicant, quote, statistic or requirement.

CHECKLIST QUALITY (most important output)
- Each checklist item is ONE physical/digital document the applicant must actually obtain. NEVER output a category label such as "Employment and leave evidence", "Financial proof", "Accommodation proof" or "Travel itinerary". Break each category into the individual documents the evidence names — an employer letter on company letterhead, the latest 3 months' salary slips and a leave/NOC letter are THREE items, not one.
- Write each item at document level: what exactly it is, who issues it, what period it covers, what format/size/stamp/signature/copies it needs, how long it must stay valid, and what the applicant does with it (attach, paste, sign, upload, print).
- NEVER invent specifics. If a source only says "proof of accommodation" and nothing gives the format, output document_name "Proof of accommodation", status "verify", and say plainly that the source does not specify the exact booking format and the local checklist must be verified. Leave issuer/period/format/validity null rather than guessing. If a local mission or application-centre source gives the exact detail, use that exact detail and set scope "local".
- De-duplicate and merge: never keep a vague umbrella item alongside the concrete documents it covers. Prefer the concrete documents.
- Investigate these categories against the evidence and enumerate the concrete documents inside each one the evidence supports: passport/travel document, application form, photographs, biometrics/appointment, travel medical insurance, flight/travel itinerary, accommodation or host/invitation proof, employment or student status and leave approval, financial means and bank statements, tax/income proof, purpose-of-trip evidence, ties to home country / return evidence, minors or family documents, fee payment, and any local consulate/application-centre requirement.
- status: "required" when official evidence states it is mandatory; "conditional" when it applies only in certain situations (state the condition in detail); "verify" when the evidence is unclear, indirect, or possibly outdated — never omit a plausible document silently, mark it "verify" instead.
- scope: "general" for EU/Schengen-wide or destination-wide rules, "local" for rules specific to the applicant's country of residence, a named consulate, or the application centre. Do not present general EU rules as the exact local checklist.
- Field rules per item:
  document_name: the exact document, e.g. "Employer letter on company letterhead", "Latest 3 months' salary slips", "Hotel reservation covering every night of the trip".
  what_to_prepare: 1-2 sentences starting with an action verb (Get, Request from your employer, Obtain from your bank, Download, Print, Attach, Sign, Upload) saying exactly what to collect and what it must show. No ref numbers, no jargon.
  issuer: who must issue or sign it (employer, bank, hotel, insurer, tax authority, host), or null if the evidence does not say.
  period: e.g. "latest 3 months", "last 3 financial years" — ONLY if the evidence states it, otherwise null.
  format_or_specification: size, colour, letterhead, stamp/signature, original vs copy, number of copies, where to attach or paste it — ONLY if the evidence states it, otherwise null.
  validity: e.g. "valid 3 months beyond the return date", "issued within the last 30 days" — ONLY if the evidence states it, otherwise null.
  preparation_steps: 0-4 very short ordered steps when the process matters (book an appointment, pay a fee, get the bank stamp). Omit when obvious.
  why: one short clause explaining why the authority asks for it.
- "guidance" is 2-5 short, practical, personalised bullets derived from what the user said about themselves (job, income, trip length, who they are visiting, dates). No citations needed; do not invent facts about the user.

Reply with a single JSON object exactly matching:
{"summary":string,"confidence":"high"|"medium"|"low","confidence_reason":string,
"checklist":[{"document_name":string,"status":"required"|"conditional"|"verify","scope":"general"|"local","what_to_prepare":string,"issuer":string|null,"period":string|null,"format_or_specification":string|null,"validity":string|null,"preparation_steps":[string],"why":string|null,"refs":[number]}],
"guidance":[string],
"official_requirements":[{"text":string,"refs":[number]}],
"applicant_experiences":[{"text":string,"refs":[number]}],
"conflicts":[{"topic":string,"official_position":string,"conflicting_claim":string,"refs":[number]}],
"missing_from_case":[{"item":string,"why":string}],
"followups":[string]}
Set confidence low when evidence is thin, older than a year, or tier 4-6 only.
"summary" is 2-3 sentences of plain language answering the question directly. Never mention evidence IDs, corpus, retrieval or tiers in prose.`;

export const researchQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<ResearchAnswer> => {
    const { aiConfigured, chatJson, AiError } = await import("./ai.server");
    const { retrieveEvidence, liveWebEvidence } = await import("./retrieval.server");
    const { demoAnswer } = await import("./demo-answer");

    const persist = async (answer: ResearchAnswer) => {
      if (!data.caseId) return answer;
      const { error } = await context.supabase.from("case_messages").insert([
        {
          case_id: data.caseId,
          user_id: context.userId,
          role: "user",
          content: data.question,
          mode: answer.mode,
        },
        {
          case_id: data.caseId,
          user_id: context.userId,
          role: "assistant",
          content: answer.summary,
          answer: JSON.parse(JSON.stringify(answer)),
          citations: JSON.parse(JSON.stringify(answer.citations)),
          mode: answer.mode,
        },
      ]);
      // Saving the transcript is best-effort: never lose a produced answer
      // because the case row was deleted or RLS rejected the write.
      if (error) console.error("case_messages insert failed", error.message);
      return answer;
    };

    if (data.demo) return persist(demoAnswer(data.question));

    if (!aiConfigured()) {
      return {
        ...emptyAnswer("setup_required"),
        notice:
          "No AI provider key is configured, so no live answer can be produced. Use demo mode to explore the interface with clearly labelled sample data.",
        summary: "AI provider not configured.",
      };
    }

    let evidence: Awaited<ReturnType<typeof retrieveEvidence>>;
    try {
      evidence = await retrieveEvidence({
        question: `${data.question} ${data.visaType ?? ""} ${data.destination ?? ""}`,
        destination: data.destination ?? null,
        visaType: data.visaType ?? null,
      });
    } catch (error) {
      console.error("retrieval failed", error);
      throw new Error(
        "Evidence retrieval failed while querying the indexed corpus. Nothing was answered from memory. Retry in a moment.",
      );
    }

    // Live web search supplements a thin or empty corpus. It never replaces
    // indexed evidence and every result keeps its real URL and retrieval time.
    let usedLiveWeb = false;
    // Live web research is the default, not a last resort: the indexed corpus
    // is always incomplete for the long tail of document-level questions.
    {
      try {
        const live = await liveWebEvidence({
          question: data.question,
          destination: data.destination ?? null,
          visaType: data.visaType ?? null,
          nationality: data.nationality ?? null,
          residence: data.residence ?? null,
          startRef: evidence.length + 1,
          limit: evidence.length >= 12 ? 14 : 26,
        });
        if (live.length > 0) {
          usedLiveWeb = true;
          evidence = [...evidence, ...live];
        }
      } catch (error) {
        console.error("live web search failed", (error as Error).message);
      }
    }

    if (evidence.length === 0) {
      const { tavilyConfigured } = await import("./tavily.server");
      return {
        ...emptyAnswer("no_evidence"),
        notice: tavilyConfigured()
          ? "Live web research ran but returned nothing usable for this question, and the indexed corpus has no match. Rather than guess, the engine stops here — try rephrasing with the destination and visa type."
          : "Live web research is not configured (no search provider key), so only the small indexed corpus was available and it has no match for this question. Add a search provider key to research beyond the seeded sources.",
        summary: "No indexed evidence available for this question.",
      };
    }

    const evidenceBlock = evidence
      .map(
        (e) =>
          `[${e.ref}] tier ${e.tier} | ${e.sourceTitle} (${e.domain})\nURL: ${e.url}\nPublished: ${e.publishedAt ?? "unknown"} | Retrieved: ${e.retrievedAt}\n---\n${e.content}`,
      )
      .join("\n\n");

    const caseBlock = [
      data.nationality && `Nationality: ${data.nationality}`,
      data.residence && `Country of residence: ${data.residence}`,
      data.destination && `Destination: ${data.destination}`,
      data.visaType && `Visa type: ${data.visaType}`,
      data.travelDate && `Intended travel date: ${data.travelDate}`,
      data.applicationDate && `Intended application date: ${data.applicationDate}`,
    ]
      .filter(Boolean)
      .join("\n");

    const historyBlock = (data.history ?? [])
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    let parsed: RawAnswer;
    try {
      parsed = await chatJson<RawAnswer>({
        system: SYSTEM,
        user: `CASE CONTEXT\n${caseBlock || "(none provided)"}\n\nEARLIER CONVERSATION\n${historyBlock || "(none)"}\n\nQUESTION\n${data.question}\n\nEVIDENCE\n${evidenceBlock}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`,
      });
    } catch (error) {
      if (error instanceof AiError) throw new Error(error.message);
      throw error;
    }

    const valid = new Set(evidence.map((e) => e.ref));
    const clean = (refs: unknown) =>
      Array.isArray(refs) ? refs.map(Number).filter((r) => valid.has(r)) : [];

    const officialRequirements = (parsed.official_requirements ?? [])
      .map((r) => ({ text: String(r.text ?? ""), refs: clean(r.refs) }))
      .filter((r) => r.text && r.refs.length > 0);
    const text = (v: unknown) => {
      const s = String(v ?? "").trim();
      return s && !/^(n\/?a|none|null|unknown|not specified)$/i.test(s) ? s : null;
    };
    const seen = new Set<string>();
    const checklist: ChecklistItem[] = (parsed.checklist ?? [])
      .map((c) => ({
        documentName: String(c.document_name ?? c.name ?? "").trim(),
        status: (["required", "conditional", "verify"] as const).includes(c.status!)
          ? c.status!
          : "verify",
        scope: c.scope === "local" ? ("local" as const) : ("general" as const),
        whatToPrepare: String(c.what_to_prepare ?? c.detail ?? "").trim(),
        issuer: text(c.issuer),
        period: text(c.period),
        formatOrSpecification: text(c.format_or_specification),
        validity: text(c.validity),
        preparationSteps: Array.isArray(c.preparation_steps)
          ? c.preparation_steps.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 5)
          : [],
        why: text(c.why),
        refs: clean(c.refs),
      }))
      .filter((c) => {
        if (!c.documentName) return false;
        // Collapse duplicate documents the model may emit under slightly
        // different wording, keeping the first (most specific) occurrence.
        const key = c.documentName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const guidance = (parsed.guidance ?? []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    const applicantExperiences = (parsed.applicant_experiences ?? [])
      .map((r) => ({ text: String(r.text ?? ""), refs: clean(r.refs) }))
      .filter((r) => r.text && r.refs.length > 0);
    const conflicts = (parsed.conflicts ?? [])
      .map((c) => ({
        topic: String(c.topic ?? ""),
        officialPosition: String(c.official_position ?? ""),
        conflictingClaim: String(c.conflicting_claim ?? ""),
        refs: clean(c.refs),
      }))
      .filter((c) => c.topic);

    const usedRefs = new Set<number>([
      ...officialRequirements.flatMap((r) => r.refs),
      ...checklist.flatMap((c) => c.refs),
      ...applicantExperiences.flatMap((r) => r.refs),
      ...conflicts.flatMap((c) => c.refs),
    ]);

    const citations: Citation[] = evidence
      .filter((e) => usedRefs.has(e.ref) || usedRefs.size === 0)
      .map((e) => ({
        ref: e.ref,
        title: e.documentTitle ?? e.sourceTitle,
        domain: e.domain,
        url: e.url,
        tier: e.tier,
        publishedAt: e.publishedAt,
        retrievedAt: e.retrievedAt,
        snippet: e.content.slice(0, 320),
      }));

    const retrievals = citations.map((c) => c.retrievedAt).sort();

    const answer: ResearchAnswer = {
      mode: "live",
      ...(usedLiveWeb
        ? {
            notice:
              "Part of this answer draws on live web results retrieved just now, in addition to the indexed corpus. Check the tier on each citation — official sources outrank community pages.",
          }
        : {}),
      summary: String(parsed.summary ?? "").trim(),
      confidence: (["high", "medium", "low"] as const).includes(parsed.confidence!)
        ? parsed.confidence!
        : "low",
      confidenceReason: String(parsed.confidence_reason ?? ""),
      checklist,
      guidance,
      officialRequirements,
      applicantExperiences,
      conflicts,
      missingFromCase: (parsed.missing_from_case ?? [])
        .map((m) => ({ item: String(m.item ?? ""), why: String(m.why ?? "") }))
        .filter((m) => m.item),
      followups: (parsed.followups ?? []).map(String).filter(Boolean).slice(0, 4),
      citations,
      freshness: {
        oldestRetrievedAt: retrievals[0] ?? null,
        newestRetrievedAt: retrievals[retrievals.length - 1] ?? null,
      },
    };

    await context.supabase.from("usage_events").insert({
      user_id: context.userId,
      event_type: "research_answer",
      metadata: {
        destination: data.destination ?? null,
        visa_type: data.visaType ?? null,
        citations: citations.length,
      },
    });

    return persist(answer);
  });

type RawAnswer = {
  summary?: string;
  confidence?: "high" | "medium" | "low";
  confidence_reason?: string;
  checklist?: {
    document_name?: string;
    name?: string;
    status?: "required" | "conditional" | "verify";
    what_to_prepare?: string;
    detail?: string;
    scope?: string;
    issuer?: unknown;
    period?: unknown;
    format_or_specification?: unknown;
    validity?: unknown;
    preparation_steps?: unknown;
    why?: unknown;
    refs?: unknown;
  }[];
  guidance?: string[];
  official_requirements?: { text?: string; refs?: unknown }[];
  applicant_experiences?: { text?: string; refs?: unknown }[];
  conflicts?: {
    topic?: string;
    official_position?: string;
    conflicting_claim?: string;
    refs?: unknown;
  }[];
  missing_from_case?: { item?: string; why?: string }[];
  followups?: string[];
};

function emptyAnswer(mode: ResearchAnswer["mode"]): ResearchAnswer {
  return {
    mode,
    summary: "",
    confidence: "low",
    confidenceReason: "No evidence was retrieved.",
    checklist: [],
    guidance: [],
    officialRequirements: [],
    applicantExperiences: [],
    conflicts: [],
    missingFromCase: [],
    followups: [],
    citations: [],
    freshness: { oldestRetrievedAt: null, newestRetrievedAt: null },
  };
}