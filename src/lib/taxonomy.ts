export const TIERS = [
  {
    tier: 1,
    label: "Government / embassy",
    short: "Government",
    description: "Immigration authority, ministry of foreign affairs, embassy or consulate.",
  },
  {
    tier: 2,
    label: "Official application centre",
    short: "Application centre",
    description: "Officially appointed visa application partner (VFS, BLS, TLScontact).",
  },
  {
    tier: 3,
    label: "Law, regulation, official guidance",
    short: "Law / regulation",
    description: "Statutes, regulations and consolidated official guidance.",
  },
  {
    tier: 4,
    label: "Reputable professional / educational",
    short: "Professional",
    description: "Law firms, universities, established institutions. Interpretation, not law.",
  },
  {
    tier: 5,
    label: "Applicant experiences",
    short: "Anecdotal",
    description: "Reddit, forums and community reports. Anecdotal — never treated as law.",
  },
  {
    tier: 6,
    label: "General web",
    short: "General web",
    description: "Everything else. Lowest weight, used only for orientation.",
  },
] as const;

export function tierMeta(tier: number) {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[5];
}

export function tierColor(tier: number) {
  return `var(--tier-${Math.min(Math.max(tier, 1), 6)})`;
}

export const VISA_TYPES = [
  "tourism",
  "business",
  "student",
  "work",
  "family",
  "digital nomad",
  "transit",
  "medical",
] as const;

export const DESTINATIONS = [
  "Schengen",
  "France",
  "Germany",
  "Netherlands",
  "Italy",
  "Spain",
  "Portugal",
  "Austria",
  "Switzerland",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "Japan",
  "United Arab Emirates",
];

export const COUNTRIES = [
  "India",
  "Nigeria",
  "Philippines",
  "Pakistan",
  "Bangladesh",
  "Brazil",
  "China",
  "Egypt",
  "Indonesia",
  "Kenya",
  "Mexico",
  "Morocco",
  "South Africa",
  "Turkey",
  "Vietnam",
  "United Kingdom",
  "United States",
];

export function freshnessLabel(iso?: string | null) {
  if (!iso) return { label: "Never retrieved", tone: "stale" as const, days: null };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 14) return { label: `Verified ${days}d ago`, tone: "fresh" as const, days };
  if (days <= 90) return { label: `Verified ${days}d ago`, tone: "aging" as const, days };
  return { label: `Stale — ${days}d old`, tone: "stale" as const, days };
}