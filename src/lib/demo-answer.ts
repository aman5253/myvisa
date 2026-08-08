import type { ResearchAnswer } from "./research.functions";

const RETRIEVED = "2026-01-15T09:00:00.000Z";

/**
 * Clearly-labelled sample payload used ONLY when the user explicitly turns on
 * demo mode. It never reaches the live answer path.
 */
export function demoAnswer(question: string): ResearchAnswer {
  return {
    mode: "demo",
    notice:
      "Demo mode — this is illustrative sample data, not current visa guidance. Citations point to real source homepages but the extracted text is a placeholder.",
    summary: `Sample answer for: "${question}". In demo mode the engine shows the shape of a real response: an official layer, an anecdotal layer, conflicts to verify, and gaps in your case. Turn demo mode off and crawl registry sources to get evidence-backed answers.`,
    confidence: "low",
    confidenceReason: "Demo mode never carries real confidence.",
    checklist: [
      {
        documentName: "Passport (sample item)",
        status: "required" as const,
        scope: "general" as const,
        whatToPrepare:
          "Sample item — in live mode this reads like 'Get your passport, plus a photocopy of the bio page'.",
        issuer: "Sample issuer",
        period: null,
        formatOrSpecification: "Sample format detail appears here when a source states one",
        validity: "Sample validity rule appears here when a source states one",
        preparationSteps: [],
        why: "Sample reason — why the authority asks for this document.",
        refs: [1],
      },
      {
        documentName: "Travel medical insurance certificate (sample item)",
        status: "required" as const,
        scope: "general" as const,
        whatToPrepare: "Sample item — insurance placeholder, not current guidance.",
        issuer: null,
        period: null,
        formatOrSpecification: null,
        validity: null,
        preparationSteps: [],
        why: null,
        refs: [1, 2],
      },
      {
        documentName: "Local application centre requirement (sample item)",
        status: "verify" as const,
        scope: "local" as const,
        whatToPrepare:
          "Sample item — local, document-level requirements appear here when real evidence exists.",
        issuer: null,
        period: null,
        formatOrSpecification: null,
        validity: null,
        preparationSteps: ["Sample step one", "Sample step two"],
        why: null,
        refs: [2],
      },
    ],
    guidance: [
      "Sample guidance — personalised notes derived from your question appear here in live mode.",
    ],
    officialRequirements: [
      { text: "Sample: a completed and signed application form is required.", refs: [1] },
      { text: "Sample: travel medical insurance covering the Schengen area.", refs: [1, 2] },
    ],
    applicantExperiences: [
      { text: "Sample anecdote: applicants report appointment scarcity in peak season.", refs: [3] },
    ],
    conflicts: [
      {
        topic: "Sample: required bank statement period",
        officialPosition: "Sample official position from a tier 1 source.",
        conflictingClaim: "Sample community claim that differs.",
        refs: [1, 3],
      },
    ],
    missingFromCase: [
      { item: "Proof of accommodation", why: "Sample gap: your case profile has no accommodation details." },
    ],
    followups: [
      "What financial evidence is accepted?",
      "How early can I book an appointment?",
    ],
    citations: [
      {
        ref: 1,
        title: "France-Visas — Official visa website of France",
        domain: "france-visas.gouv.fr",
        url: "https://france-visas.gouv.fr/en/web/france-visas/",
        tier: 1,
        publishedAt: null,
        retrievedAt: RETRIEVED,
        snippet: "Sample placeholder text — not fetched content.",
      },
      {
        ref: 2,
        title: "EU Visa Policy — Schengen short-stay visa",
        domain: "home-affairs.ec.europa.eu",
        url: "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en",
        tier: 3,
        publishedAt: null,
        retrievedAt: RETRIEVED,
        snippet: "Sample placeholder text — not fetched content.",
      },
      {
        ref: 3,
        title: "r/SchengenVisa — applicant experiences",
        domain: "reddit.com",
        url: "https://www.reddit.com/r/SchengenVisa/",
        tier: 5,
        publishedAt: null,
        retrievedAt: RETRIEVED,
        snippet: "Sample placeholder text — not fetched content.",
      },
    ],
    freshness: { oldestRetrievedAt: RETRIEVED, newestRetrievedAt: RETRIEVED },
  };
}