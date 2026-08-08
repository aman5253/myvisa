/**
 * Pure, dependency-free inference of case context from a free-text question.
 *
 * The research workspace is a single universal question box: users type any
 * visa situation in their own words and this module extracts what it can
 * (destination, nationality, residence, visa type, dates, duration). Anything
 * it cannot find is reported as missing so the UI can ask for just that, and
 * every inferred value stays overridable by the user.
 */

export type QuestionContext = {
  destination: string | null;
  nationality: string | null;
  residence: string | null;
  visaType: string | null;
  travelDate: string | null;
  durationDays: number | null;
};

export type ContextField = keyof QuestionContext;

export const EMPTY_CONTEXT: QuestionContext = {
  destination: null,
  nationality: null,
  residence: null,
  visaType: null,
  travelDate: null,
  durationDays: null,
};

/** country name -> [demonym/adjective and common aliases] */
const COUNTRY_ALIASES: Record<string, string[]> = {
  India: ["indian"],
  Pakistan: ["pakistani"],
  Bangladesh: ["bangladeshi"],
  "Sri Lanka": ["sri lankan"],
  Nepal: ["nepali", "nepalese"],
  Nigeria: ["nigerian"],
  Ghana: ["ghanaian"],
  Kenya: ["kenyan"],
  "South Africa": ["south african"],
  Egypt: ["egyptian"],
  Morocco: ["moroccan"],
  Ethiopia: ["ethiopian"],
  Philippines: ["filipino", "philippine", "the philippines"],
  Indonesia: ["indonesian"],
  Vietnam: ["vietnamese"],
  Thailand: ["thai"],
  Malaysia: ["malaysian"],
  Singapore: ["singaporean"],
  China: ["chinese"],
  "Hong Kong": ["hongkonger"],
  Japan: ["japanese"],
  "South Korea": ["korean", "korea"],
  Taiwan: ["taiwanese"],
  Turkey: ["turkish", "turkiye"],
  Iran: ["iranian"],
  Iraq: ["iraqi"],
  "Saudi Arabia": ["saudi"],
  "United Arab Emirates": ["uae", "emirati", "dubai", "abu dhabi"],
  Qatar: ["qatari"],
  Kuwait: ["kuwaiti"],
  Oman: ["omani"],
  Israel: ["israeli"],
  Russia: ["russian"],
  Ukraine: ["ukrainian"],
  Brazil: ["brazilian"],
  Argentina: ["argentine", "argentinian"],
  Colombia: ["colombian"],
  Chile: ["chilean"],
  Peru: ["peruvian"],
  Mexico: ["mexican"],
  Canada: ["canadian"],
  "United States": ["usa", "u.s.", "u.s.a", "us ", "america", "american", "united states of america"],
  "United Kingdom": ["uk", "u.k.", "britain", "british", "england", "english", "scotland", "wales"],
  Ireland: ["irish"],
  France: ["french", "paris"],
  Germany: ["german", "berlin", "munich"],
  Netherlands: ["dutch", "holland", "amsterdam"],
  Belgium: ["belgian", "brussels"],
  Italy: ["italian", "rome", "milan"],
  Spain: ["spanish", "madrid", "barcelona"],
  Portugal: ["portuguese", "lisbon"],
  Greece: ["greek", "athens"],
  Austria: ["austrian", "vienna"],
  Switzerland: ["swiss", "zurich", "geneva"],
  Sweden: ["swedish", "stockholm"],
  Norway: ["norwegian", "oslo"],
  Denmark: ["danish", "copenhagen"],
  Finland: ["finnish", "helsinki"],
  Poland: ["polish", "warsaw"],
  "Czech Republic": ["czechia", "czech", "prague"],
  Hungary: ["hungarian", "budapest"],
  Croatia: ["croatian", "zagreb"],
  Estonia: ["estonian"],
  Iceland: ["icelandic", "reykjavik"],
  Luxembourg: ["luxembourgish"],
  Malta: ["maltese"],
  Slovenia: ["slovenian"],
  Slovakia: ["slovak"],
  Lithuania: ["lithuanian"],
  Latvia: ["latvian"],
  Romania: ["romanian"],
  Bulgaria: ["bulgarian"],
  Australia: ["australian", "sydney", "melbourne"],
  "New Zealand": ["kiwi", "auckland"],
  Schengen: ["schengen area", "schengen zone"],
};

/** Countries inside the Schengen area — used to widen retrieval. */
export const SCHENGEN = new Set([
  "France","Germany","Netherlands","Belgium","Italy","Spain","Portugal","Greece","Austria",
  "Switzerland","Sweden","Norway","Denmark","Finland","Poland","Czech Republic","Hungary",
  "Croatia","Estonia","Iceland","Luxembourg","Malta","Slovenia","Slovakia","Lithuania","Latvia",
]);

export const ALL_COUNTRIES = Object.keys(COUNTRY_ALIASES).sort();

const VISA_KEYWORDS: Record<string, string[]> = {
  tourism: ["tourist", "tourism", "holiday", "vacation", "visit", "visiting", "sightseeing", "leisure"],
  student: ["student", "study", "studying", "university", "college", "masters", "master's", "phd", "course"],
  work: ["work", "working", "employment", "job", "skilled worker", "blue card", "h-1b", "h1b", "intra-company"],
  business: ["business", "conference", "meeting", "trade fair", "client visit"],
  family: ["family", "spouse", "husband", "wife", "partner", "marriage", "dependent", "child", "parents", "reunification"],
  "digital nomad": ["digital nomad", "remote work", "remotely", "freelance visa", "nomad"],
  transit: ["transit", "layover", "connecting flight", "stopover"],
  medical: ["medical", "treatment", "surgery", "hospital"],
};

function matchCountry(text: string, from?: number): { name: string; index: number } | null {
  let best: { name: string; index: number } | null = null;
  for (const [name, aliases] of Object.entries(COUNTRY_ALIASES)) {
    for (const needle of [name.toLowerCase(), ...aliases]) {
      const idx = text.indexOf(needle, from ?? 0);
      if (idx === -1) continue;
      // require word-ish boundaries so "us" doesn't match inside "because"
      const before = idx === 0 ? " " : text[idx - 1]!;
      const after = text[idx + needle.length] ?? " ";
      if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;
      if (!best || idx < best.index || (idx === best.index && needle.length > best.name.length)) {
        best = { name, index: idx };
      }
    }
  }
  return best;
}

/** All country mentions in the order they appear. */
function allMentions(text: string): { name: string; index: number }[] {
  const found: { name: string; index: number }[] = [];
  for (const [name, aliases] of Object.entries(COUNTRY_ALIASES)) {
    for (const needle of [name.toLowerCase(), ...aliases]) {
      let from = 0;
      for (;;) {
        const idx = text.indexOf(needle, from);
        if (idx === -1) break;
        from = idx + needle.length;
        const before = idx === 0 ? " " : text[idx - 1]!;
        const after = text[idx + needle.length] ?? " ";
        if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;
        found.push({ name, index: idx });
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const NATIONALITY_CUES = [
  /\b(?:i am|i'm|as)\s+(?:an?\s+)?([a-z ]{3,20}?)\s+(?:citizen|national|passport holder|passport)/,
  /\b([a-z ]{3,20}?)\s+passport\b/,
  /\bcitizen of\s+(?:the\s+)?([a-z ]{3,25})/,
  /\bnationality[:\s]+([a-z ]{3,25})/,
  // "I am an Indian software engineer", "as a Brazilian…"
  /\b(?:i am|i'm|as)\s+(?:an?\s+)?([a-z]{3,20})\b/,
];

const RESIDENCE_CUES = [
  /\b(?:living|live|based|residing|resident|working)\s+in\s+(?:the\s+)?([a-z ]{3,25})/,
  /\bcurrently in\s+(?:the\s+)?([a-z ]{3,25})/,
  /\bresidence[:\s]+([a-z ]{3,25})/,
];

const DESTINATION_CUES = [
  /\b(?:visa|travel|travelling|traveling|go|going|fly|flying|move|moving|relocate|trip|holiday|vacation|study|studying|work)\s+(?:visa\s+)?(?:to|for|in)\s+(?:the\s+)?([a-z ]{3,25})/,
  /\b(?:visit|enter)\s+(?:the\s+)?([a-z ]{3,25})/,
  /\b([a-z ]{3,25})\s+(?:tourist|student|work|business|schengen)\s+visa\b/,
];

function fromCue(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m?.[1]) continue;
    const hit = matchCountry(` ${m[1].trim()} `);
    if (hit) return hit.name;
  }
  return null;
}

/** ISO date for phrases like "in March", "next month" is deliberately NOT guessed. */
function findDate(text: string): string | null {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return iso[0];
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const m = new RegExp(`\\b(\\d{1,2})\\s+(${months.join("|")})\\s+(20\\d{2})\\b`).exec(text);
  if (m) {
    const month = String(months.indexOf(m[2]!) + 1).padStart(2, "0");
    return `${m[3]}-${month}-${m[1]!.padStart(2, "0")}`;
  }
  return null;
}

export function inferContext(question: string): QuestionContext {
  const text = ` ${question.toLowerCase().replace(/\s+/g, " ")} `;

  const nationality = fromCue(text, NATIONALITY_CUES);
  const residence = fromCue(text, RESIDENCE_CUES);
  let destination = fromCue(text, DESTINATION_CUES);

  if (!destination) {
    // Fall back to the first mentioned country that isn't the applicant's own.
    const mentions = allMentions(text).filter(
      (m) => m.name !== nationality && m.name !== residence,
    );
    destination = mentions[0]?.name ?? null;
  }

  let visaType: string | null = null;
  let bestIdx = Number.MAX_SAFE_INTEGER;
  for (const [type, words] of Object.entries(VISA_KEYWORDS)) {
    for (const w of words) {
      const idx = text.indexOf(w);
      if (idx !== -1 && idx < bestIdx) {
        bestIdx = idx;
        visaType = type;
      }
    }
  }

  const dur = /\b(\d{1,3})\s*(?:-|\s)?\s*(day|days|night|nights|week|weeks|month|months)\b/.exec(text);
  let durationDays: number | null = null;
  if (dur) {
    const n = Number(dur[1]);
    const unit = dur[2]!;
    durationDays = unit.startsWith("week") ? n * 7 : unit.startsWith("month") ? n * 30 : n;
  }

  return {
    destination,
    nationality,
    residence: residence ?? nationality,
    visaType,
    travelDate: findDate(text),
    durationDays,
  };
}

/** Fields the engine really wants before it can research well. */
export const REQUIRED_FIELDS: ContextField[] = ["destination", "nationality", "visaType"];

export const FIELD_LABELS: Record<ContextField, string> = {
  destination: "Destination country",
  nationality: "Your nationality",
  residence: "Country of residence",
  visaType: "Visa type",
  travelDate: "Intended travel date",
  durationDays: "Trip length",
};

export function missingFields(ctx: QuestionContext): ContextField[] {
  return REQUIRED_FIELDS.filter((f) => !ctx[f]);
}

/** Merge inferred context with saved case values and explicit user overrides. */
export function mergeContext(
  inferred: QuestionContext,
  caseValues: Partial<QuestionContext>,
  overrides: Partial<QuestionContext>,
): QuestionContext {
  const out = { ...EMPTY_CONTEXT };
  for (const key of Object.keys(EMPTY_CONTEXT) as ContextField[]) {
    const value = overrides[key] ?? inferred[key] ?? caseValues[key] ?? null;
    // @ts-expect-error homogeneous key/value assignment across a union of value types
    out[key] = value;
  }
  return out;
}
