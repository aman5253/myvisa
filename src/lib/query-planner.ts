/**
 * Pure query planner for live web research.
 *
 * A single generic search ("Italy visa requirements") rarely surfaces the page
 * that answers a specific question such as "is a cover letter required?".
 * This module turns the user's own words plus inferred case context into a
 * small set of focused queries across the whole trust ladder: official
 * missions and application centres, EU law/guidance, reputable specialist
 * sources, general web, and public applicant experiences.
 *
 * It never invents facts — it only produces search strings.
 */

export type PlanInput = {
  question: string;
  destination?: string | null;
  visaType?: string | null;
  nationality?: string | null;
  residence?: string | null;
};

export type PlannedQuery = {
  query: string;
  /** "official" | "guidance" | "specialist" | "community" */
  lane: "official" | "guidance" | "specialist" | "community";
};

/** Document/topic vocabulary; matching terms sharpen every generated query. */
const TOPICS: Record<string, RegExp> = {
  "cover letter": /\bcover(ing)? letter\b|\bmotivation letter\b|\bletter of intent\b/i,
  "invitation letter": /\binvitation letter\b|\bhost invitation\b|\bsponsor letter\b/i,
  "bank statement": /\bbank statement|\bbank balance|\bfunds\b|\bfinancial (means|proof)\b/i,
  "income tax return ITR": /\bitr\b|\bincome tax\b|\btax return|\btax challan\b/i,
  "salary slips": /\bsalary slip|\bpayslip|\bpay slip|\bsalary certificate\b/i,
  "NOC leave letter employer": /\bnoc\b|\bno objection\b|\bleave letter\b|\bemployer letter\b|\bemployment certificate\b/i,
  "hotel booking accommodation proof": /\bhotel\b|\baccommodation\b|\bbooking\b|\bstay(ing)? with\b/i,
  "flight reservation itinerary": /\bflight\b|\bitinerary\b|\bticket\b|\breservation\b/i,
  "travel medical insurance": /\binsurance\b|\bmedical cover/i,
  "appointment booking": /\bappointment\b|\bslot\b|\bbooking centre\b|\bvfs appointment\b/i,
  biometrics: /\bbiometric|\bfingerprint/i,
  photograph: /\bphoto|\bphotograph/i,
  "application form": /\bapplication form\b|\bform\b/i,
  "processing time": /\bprocessing time|\bhow long\b|\btimeline\b/i,
  "visa fee": /\bfee\b|\bcost\b|\bhow much\b/i,
  "refusal appeal": /\brefus|\breject|\bappeal\b|\bdenied\b/i,
  "sponsorship": /\bsponsor/i,
  "minor child documents": /\bminor\b|\bchild\b|\bunder 18\b/i,
};

/** Topics explicitly named in the question, most specific first. */
export function extractTopics(question: string): string[] {
  return Object.entries(TOPICS)
    .filter(([, re]) => re.test(question))
    .map(([topic]) => topic)
    .slice(0, 4);
}

function clean(q: string) {
  return q.replace(/\s+/g, " ").trim().slice(0, 380);
}

export function planQueries(input: PlanInput): PlannedQuery[] {
  const dest = input.destination?.trim() || "";
  const from = (input.residence || input.nationality || "").trim();
  const type = input.visaType?.trim() || "";
  const visa = type ? `${type} visa` : "visa";
  const topics = extractTopics(input.question);
  const topic = topics[0] ?? "";

  const out: PlannedQuery[] = [];
  const push = (lane: PlannedQuery["lane"], q: string) => {
    const query = clean(q);
    if (query.length > 8) out.push({ query, lane });
  };

  // The user's own wording always gets searched verbatim (plus context).
  push("specialist", [input.question, dest, type].filter(Boolean).join(" "));

  if (topic) {
    push("official", `${dest} ${visa} ${topic} requirement${from ? ` ${from} applicants` : ""} official`);
    push("official", `${dest} embassy consulate${from ? ` in ${from}` : ""} ${visa} ${topic}`);
    if (from) push("official", `VFS Global ${dest} ${visa} ${from} ${topic} checklist`);
    push("specialist", `is a ${topic} mandatory for a ${dest} ${visa}${from ? ` from ${from}` : ""}`);
    push("specialist", `how to write ${topic} for ${dest} ${visa}${from ? ` from ${from}` : ""}`);
    push("community", `site:reddit.com ${dest} ${visa}${from ? ` ${from}` : ""} ${topic} experience`);
    push("community", `site:reddit.com ${input.question}`);
    for (const extra of topics.slice(1, 3)) {
      push("official", `${dest} ${visa} ${extra} requirement official`);
    }
  }

  if (dest) {
    push("official", `official ${dest} ${visa} requirements${from ? ` for applicants in ${from}` : ""}`);
    push("official", `${dest} embassy consulate ${visa}${from ? ` ${from}` : ""} required documents`);
    if (!topic && from) push("official", `VFS Global ${dest} visa application centre ${from} document checklist`);
    push("guidance", `${dest} ${visa} rules EU Visa Code official guidance`);
  } else {
    push("official", `official ${input.question} government immigration requirements`);
  }

  if (!topic) {
    push("community", `site:reddit.com applicant experience ${dest || ""} ${visa}${from ? ` from ${from}` : ""}`);
    push("community", `site:reddit.com ${input.question}`);
  }

  // Deduplicate while preserving lane of first occurrence.
  const seen = new Set<string>();
  return out
    .filter((q) => {
      const key = q.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 11);
}