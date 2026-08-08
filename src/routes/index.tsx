import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  FileSearch,
  GitCompareArrows,
  Globe2,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/vi/brand";
import { TierBadge } from "@/components/vi/tier-badge";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/lib/taxonomy";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyVisa — Know what to submit. Know why. Know what to trust." },
      {
        name: "description",
        content:
          "A visa evidence engine: official requirements, applicant experience and conflicts, separated and cited. Research and prepare your application with sources you can check.",
      },
      { property: "og:title", content: "MyVisa — the visa evidence engine" },
      {
        property: "og:description",
        content:
          "Official requirements, applicant experience and conflicts — separated, dated and cited.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const DEMO_QUESTIONS = [
  {
    q: "I'm an Indian citizen applying for a French Schengen tourist visa. What financial evidence is expected?",
    official:
      "Official sources define the required means of subsistence and the supporting documents list for short-stay applications.",
    anecdotal:
      "Applicants describe how consulates and application centres handled bank statements in practice.",
    conflict:
      "Community posts often quote a fixed daily amount that the official source does not state in those terms.",
  },
  {
    q: "How early can I book a Schengen appointment for travel in June?",
    official: "Application windows and earliest submission dates are set in official guidance.",
    anecdotal: "Applicants report real appointment scarcity at specific centres and months.",
    conflict: "Third-party blogs and the official window frequently disagree.",
  },
  {
    q: "Does my passport need to be valid for 3 or 6 months after I return?",
    official: "Passport validity rules are stated by the destination authority and the Visa Code.",
    anecdotal: "Travellers report inconsistent checks at different counters.",
    conflict: "General web content mixes up entry rules for different destinations.",
  },
];

function Landing() {
  const [active, setActive] = useState(0);
  const { user } = useSession();
  const demo = DEMO_QUESTIONS[active]!;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#engine" className="transition-colors hover:text-foreground">
              Evidence engine
            </a>
            <a href="#ladder" className="transition-colors hover:text-foreground">
              Trust ladder
            </a>
            <a href="#auditor" className="transition-colors hover:text-foreground">
              Auditor
            </a>
            <Link to="/sources" className="transition-colors hover:text-foreground">
              Source explorer
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm">
                <Link to="/research">Open workspace</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Research your visa</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero-canvas relative overflow-hidden border-b border-border/70">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="animate-rise max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Evidence engine, not a chatbot
              </span>
              <h1 className="font-display mt-6 text-5xl leading-[1.05] md:text-7xl">
                Know what to submit.
                <br />
                Know why.
                <br />
                <span className="text-accent">Know what to trust.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                MyVisa answers visa questions from indexed official sources — then shows you the
                evidence. Government guidance stays separate from applicant folklore, conflicts are
                surfaced instead of smoothed over, and every claim carries a dated, clickable
                citation.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="lift-on-hover">
                  <Link to={user ? "/research" : "/auth"}>
                    Research your visa
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/sources">Browse the evidence corpus</Link>
                </Button>
              </div>
              <p className="mt-6 max-w-lg text-xs leading-relaxed text-muted-foreground">
                Research and preparation assistance only. MyVisa is not a law firm, immigration
                adviser or government authority, and it cannot guarantee or predict a visa outcome.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive demo */}
        <section id="engine" className="border-b border-border/70">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <SectionHeading
              eyebrow="The evidence engine"
              title="Retrieval first. Language second."
              body="A question is decomposed, matched against the indexed corpus, ranked by source reliability, checked for conflicts — and only then written up. The model never supplies facts of its own."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {DEMO_QUESTIONS.map((item, i) => (
                  <button
                    key={item.q}
                    onClick={() => setActive(i)}
                    className={`w-full rounded-xl border p-4 text-left text-sm transition-all duration-300 ${
                      i === active
                        ? "border-accent/50 bg-card shadow-[var(--shadow-soft)]"
                        : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-card/60"
                    }`}
                  >
                    {item.q}
                  </button>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  A preview of the answer structure. Live answers require indexed sources and are
                  produced in the workspace.
                </p>
              </div>

              <div className="surface-card overflow-hidden">
                <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
                  Answer structure
                </div>
                <div className="divide-y divide-border">
                  <DemoBlock
                    tone="official"
                    label="Official requirements"
                    tier={1}
                    text={demo.official}
                  />
                  <DemoBlock
                    tone="anecdotal"
                    label="Applicant experiences"
                    tier={5}
                    text={demo.anecdotal}
                  />
                  <DemoBlock
                    tone="conflict"
                    label="Conflicts / verify"
                    tier={6}
                    text={demo.conflict}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust ladder */}
        <section id="ladder" className="border-b border-border/70 bg-[var(--surface-sunken)]">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <SectionHeading
              eyebrow="Source trust ladder"
              title="Scraped text is never presented as law."
              body="Every indexed document sits on a fixed hierarchy. When tiers disagree, the official position wins and the disagreement is shown to you rather than hidden."
            />
            <ol className="mt-12 space-y-2">
              {TIERS.map((t) => (
                <li
                  key={t.tier}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:gap-5"
                >
                  <TierBadge tier={t.tier} className="self-start" />
                  <span className="min-w-56 font-medium">{t.label}</span>
                  <span className="text-sm text-muted-foreground">{t.description}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="auditor" className="border-b border-border/70">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <SectionHeading
              eyebrow="Beyond answers"
              title="Prepare and audit the actual application."
              body="Research is only useful if it changes what you put in the envelope."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Feature
                icon={FileSearch}
                title="Application auditor"
                body="Upload your documents and compare them against retrieved requirements. Every finding separates what was detected in your file from what the source demands."
              />
              <Feature
                icon={ListChecks}
                title="Living checklist"
                body="A checklist tied to your exact case and the source versions it came from, with a last-verified date on every line."
              />
              <Feature
                icon={GitCompareArrows}
                title="Conflict detection"
                body="When an official page and a community thread disagree, both are shown side by side with the official position marked authoritative."
              />
              <Feature
                icon={ShieldCheck}
                title="Freshness and confidence"
                body="Retrieval dates, publication dates and staleness are attached to every answer. Thin or old evidence lowers confidence instead of hiding it."
              />
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="ink-panel overflow-hidden rounded-2xl p-8 md:p-12">
              <div className="flex items-center gap-2 text-xs opacity-70">
                <Globe2 className="h-4 w-4" />
                Global coverage roadmap
              </div>
              <h2 className="font-display mt-4 max-w-2xl text-3xl md:text-4xl">
                Deep on one corridor first, architected for all of them.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80">
                Coverage grows corridor by corridor. Nothing here pretends to index the whole
                internet on day one — the registry shows exactly what has been crawled, when, and
                what has not.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <Stage
                  stage="Live"
                  title="India → Schengen"
                  body="Seeded with EU, French, German, Dutch, Italian and Spanish official sources plus official application centres."
                />
                <Stage
                  stage="Next"
                  title="India → UK, US, Canada"
                  body="Same pipeline, new registry entries. No code changes required to add a corridor."
                />
                <Stage
                  stage="Planned"
                  title="Any origin → any destination"
                  body="Country-agnostic schema, pluggable ingestion adapters and search providers."
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="hero-canvas">
          <div className="mx-auto max-w-3xl px-5 py-24 text-center">
            <h2 className="font-display text-4xl md:text-5xl">Start with a real question.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Create a case, ask in plain language, and check every citation yourself.
            </p>
            <Button asChild size="lg" className="mt-8 lift-on-hover">
              <Link to={user ? "/research" : "/auth"}>
                Research your visa
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-[var(--surface-sunken)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-3">
            <Brand />
            <p className="text-xs leading-relaxed">
              MyVisa provides research and application-preparation assistance. It is not legal
              advice, not immigration representation, and not a prediction of any visa decision.
              Always confirm requirements with the relevant embassy, consulate or immigration
              authority before applying.
            </p>
          </div>
          <div className="flex gap-10">
            <div className="space-y-2">
              <Link to="/sources" className="block transition-colors hover:text-foreground">
                Source explorer
              </Link>
              <Link to="/auth" className="block transition-colors hover:text-foreground">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 className="font-display mt-3 text-3xl md:text-4xl">{title}</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function DemoBlock({
  label,
  text,
  tier,
  tone,
}: {
  label: string;
  text: string;
  tier: number;
  tone: "official" | "anecdotal" | "conflict";
}) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <TierBadge tier={tier} showLabel={false} />
        {tone === "anecdotal" && (
          <span className="rounded-full bg-[color-mix(in_oklch,var(--warning)_16%,transparent)] px-2 py-0.5 text-[11px] text-[var(--warning)]">
            anecdotal
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{text}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileSearch;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-card lift-on-hover p-5">
      <Icon className="h-5 w-5 text-accent" />
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Stage({ stage, title, body }: { stage: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-5">
      <span className="text-[11px] uppercase tracking-[0.18em] opacity-70">{stage}</span>
      <h3 className="mt-2 font-medium">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed opacity-75">{body}</p>
    </div>
  );
}
