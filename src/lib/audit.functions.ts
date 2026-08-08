import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ caseId: z.string().uuid() });

const SYSTEM = `You audit a visa application package.

RULES
- Requirements may ONLY come from the numbered EVIDENCE block. Never rely on prior knowledge of visa rules.
- Findings about the applicant's paperwork may ONLY come from the DOCUMENTS block (extracted text or images the user uploaded).
- Every finding must clearly separate detected_from_document (what you saw in their files) from requirement_from_source (what the evidence demands, with a ref).
- If a document could not be machine-read, do not guess its contents: raise a finding with needs_human_verification true.
- Never state or imply an approval probability. Readiness score measures package completeness against retrieved requirements only.

Reply with a single JSON object:
{"readiness_score":number 0-100,"summary":string,
"findings":[{"severity":"critical"|"warning"|"info","category":"missing_document"|"inconsistency"|"date_validity"|"identity_mismatch"|"itinerary"|"general","title":string,"detected_from_document":string|null,"requirement_from_source":string|null,"ref":number|null,"needs_human_verification":boolean}],
"checklist":[{"label":string,"why":string,"ref":number|null}]}`;

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { aiConfigured, chatVisionJson, AiError } = await import("./ai.server");
    const { retrieveEvidence } = await import("./retrieval.server");

    if (!aiConfigured()) throw new Error("AI provider is not configured, so no audit can be run.");

    const { data: kase, error: cErr } = await context.supabase
      .from("cases")
      .select("*")
      .eq("id", data.caseId)
      .single();
    if (cErr || !kase) throw new Error("Case not found.");

    const { data: docs } = await context.supabase
      .from("case_documents")
      .select("*")
      .eq("case_id", data.caseId);
    const files = docs ?? [];
    if (files.length === 0) throw new Error("Upload at least one document before running an audit.");

    const evidence = await retrieveEvidence({
      question: `${kase.visa_type ?? "visa"} required documents checklist supporting documents ${kase.destination ?? ""} applicant from ${kase.nationality ?? ""}`,
      destination: kase.destination,
      visaType: kase.visa_type,
      limit: 18,
    });
    if (evidence.length === 0) {
      throw new Error(
        "No indexed requirements were found for this destination and visa type. Crawl the relevant registry sources first — the auditor will not invent requirements.",
      );
    }

    const parts: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [];

    const evidenceBlock = evidence
      .map(
        (e) =>
          `[${e.ref}] tier ${e.tier} | ${e.sourceTitle} (${e.domain}) | retrieved ${e.retrievedAt}\n${e.content}`,
      )
      .join("\n\n");

    parts.push({
      type: "text",
      text: `CASE\nNationality: ${kase.nationality ?? "unknown"}\nResidence: ${kase.residence_country ?? "unknown"}\nDestination: ${kase.destination ?? "unknown"}\nVisa type: ${kase.visa_type ?? "unknown"}\nTravel date: ${kase.travel_date ?? "unknown"}\nApplication date: ${kase.application_date ?? "unknown"}\nEmployment: ${kase.employment_status ?? "unknown"}\nFinances: ${kase.financial_summary ?? "unknown"}\nSponsor: ${kase.sponsor_info ?? "none"}\n\nEVIDENCE\n${evidenceBlock}\n\nDOCUMENTS`,
    });

    for (const f of files) {
      const isImage = (f.mime_type ?? "").startsWith("image/");
      if (isImage) {
        const { data: signed } = await context.supabase.storage
          .from("case-documents")
          .createSignedUrl(f.storage_path, 300);
        if (signed?.signedUrl) {
          parts.push({
            type: "text",
            text: `\nFile: ${f.file_name} (${f.doc_kind ?? "unspecified"}) — image below`,
          });
          parts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
          continue;
        }
      }
      parts.push({
        type: "text",
        text: `\nFile: ${f.file_name} (${f.doc_kind ?? "unspecified"})\n${
          f.extracted_text
            ? f.extracted_text.slice(0, 6000)
            : "[content not machine-readable in this environment — treat as unverified]"
        }`,
      });
    }

    parts.push({ type: "text", text: `\nToday is ${new Date().toISOString().slice(0, 10)}.` });

    type Raw = {
      readiness_score?: number;
      summary?: string;
      findings?: {
        severity?: string;
        category?: string;
        title?: string;
        detected_from_document?: string | null;
        requirement_from_source?: string | null;
        ref?: number | null;
        needs_human_verification?: boolean;
      }[];
      checklist?: { label?: string; why?: string; ref?: number | null }[];
    };

    let parsed: Raw;
    try {
      parsed = await chatVisionJson<Raw>({ system: SYSTEM, parts });
    } catch (error) {
      if (error instanceof AiError) throw new Error(error.message);
      throw error;
    }

    const byRef = new Map(evidence.map((e) => [e.ref, e]));
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.readiness_score ?? 0))));

    const { data: audit, error: aErr } = await context.supabase
      .from("audits")
      .insert({
        case_id: data.caseId,
        user_id: context.userId,
        readiness_score: score,
        summary: String(parsed.summary ?? ""),
      })
      .select("id")
      .single();
    if (aErr || !audit) throw new Error(aErr?.message ?? "Could not store the audit.");

    const findings = (parsed.findings ?? []).filter((f) => f.title).slice(0, 40);
    if (findings.length) {
      await context.supabase.from("audit_findings").insert(
        findings.map((f) => ({
          audit_id: audit.id,
          user_id: context.userId,
          severity: ["critical", "warning", "info"].includes(f.severity ?? "")
            ? f.severity!
            : "info",
          category: f.category ?? "general",
          title: String(f.title),
          detected_from_document: f.detected_from_document ?? null,
          requirement_from_source: f.requirement_from_source ?? null,
          source_url: f.ref ? (byRef.get(f.ref)?.url ?? null) : null,
          needs_human_verification: Boolean(f.needs_human_verification),
        })),
      );
    }

    const checklist = (parsed.checklist ?? []).filter((c) => c.label).slice(0, 40);
    if (checklist.length) {
      await context.supabase.from("checklist_items").delete().eq("case_id", data.caseId);
      await context.supabase.from("checklist_items").insert(
        checklist.map((c, position) => {
          const src = c.ref ? byRef.get(c.ref) : undefined;
          return {
            case_id: data.caseId,
            user_id: context.userId,
            label: String(c.label),
            why: c.why ?? null,
            position,
            source_url: src?.url ?? null,
            source_title: src?.sourceTitle ?? null,
            source_tier: src?.tier ?? null,
            last_verified_at: src?.retrievedAt ?? null,
          };
        }),
      );
    }

    await context.supabase.from("usage_events").insert({
      user_id: context.userId,
      event_type: "audit_run",
      metadata: { case_id: data.caseId, score },
    });

    return { auditId: audit.id, score };
  });