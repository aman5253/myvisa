# MyVisa

**Know what to submit. Know why. Know what to trust.**

MyVisa is an evidence-first visa and immigration research assistant. You ask a question in
plain language — *"I'm an Indian software engineer visiting Italy for 10 days, what do I need?"* —
and MyVisa assembles an answer from authoritative official sources, clearly separated from
real-world applicant experiences, with a citation behind every important claim.

---

## The problem

Visa information is scattered across embassy pages, visa-centre providers, regulations,
blog posts and forum threads. Much of it is outdated, contradictory, or country-specific in
ways that are easy to miss. Applicants routinely get rejected for avoidable documentation
mistakes — a bank statement covering the wrong period, an insurance policy below the
required coverage, a cover letter that never mentions the sponsor.

MyVisa does not try to be an oracle. It tries to be a **research engine you can audit**:
every requirement it states is traceable to a source, dated, ranked by reliability, and
flagged when sources disagree.

---

## Core capabilities

- **Universal research box** — one natural-language question, no forced dropdown funnels.
  Nationality, residence, destination, visa type and travel dates are inferred from the
  question and shown as editable chips; only genuinely missing details are asked for.
- **Document-level checklists** — not "proof of funds", but *"Bank statements for the last
  3 months, stamped by the bank, showing the closing balance"*, with issuer, format,
  validity window and preparation steps.
- **Separated applicant experiences** — community reports are retrieved and shown, always
  labelled anecdotal and always below official requirements.
- **Conflict and freshness surfacing** — when sources disagree or evidence is stale, that is
  shown rather than silently averaged away.
- **Source drawer** — every answer can be expanded into the underlying evidence: title,
  domain, source tier, publication date, retrieval date, clickable link.
- **Case workspace** — save a case profile (nationality, residence, destination, visa type,
  dates, status) and personalise follow-up research while keeping context.
- **Cover-letter workshop** — draft or review a visa cover letter grounded in the retrieved
  requirements for that specific case.
- **Application auditor foundation** — upload documents and compare them against the
  retrieved requirements to produce a readiness view, missing items and inconsistencies.
- **Source explorer & admin console** — browse the indexed corpus, filter by country, visa
  type, tier and freshness; manage the source registry, trigger refreshes, inspect
  ingestion errors and integration health.

---

## Trust model

Sources are ranked into an explicit tier ladder, and higher tiers always override lower
ones when they conflict:

| Tier | Source type |
| ---- | ----------- |
| 1 | Government, embassy, immigration authority |
| 2 | Official visa application centre / provider |
| 3 | Laws, regulations, official guidance |
| 4 | Reputable professional or educational sources |
| 5 | Public applicant experiences (forums, communities) |
| 6 | General web |

Community content is never presented as law. Citations are never invented — if the
evidence is thin, the answer says so and points at what must be verified officially.

---

## Research architecture (high level)

```text
question
   -> query planner        entity extraction (nationality, destination, visa type,
                           dates, intent) -> multiple focused queries across lanes:
                           official / guidance / specialist / community
   -> retrieval            parallel web search + extraction, plus the internal
                           indexed corpus; per-lane dedupe and rate control
   -> reliability ranking  domain-based tier assignment, recency weighting
   -> conflict detection   cross-source comparison of requirement claims
   -> synthesis            checklist-first answer generation, strictly grounded
                           in the retrieved evidence
   -> citations            every claim carries source refs, tiers and dates
```

**Ingestion** is a separate, pluggable layer: a source registry (type, country, destination,
URL, crawl status, last crawled, content hash, freshness, reliability tier, error state),
polite fetching that respects `robots.txt` and rate limits, extraction fallback when a page
is blocked or JS-rendered, deduplication, chunking and metadata storage designed so vector
search can be enabled cleanly. Login-gated content and access controls are never bypassed.

Community discovery uses the web-search provider over publicly indexed pages — no private
API credentials and no scraping around anti-bot protections. When only a search snippet is
retrievable, the result is kept and labelled as such rather than fabricated.

---

## Main user flow

1. Land on the public page, try the interactive demo question.
2. Sign in.
3. Ask a question in the research workspace; confirm or correct the inferred context chips.
4. Read the answer: summary -> numbered document checklist -> what this means for you ->
   applicant experiences -> things to double-check -> sources & evidence.
5. Save it as a case, generate a checklist, draft or review a cover letter.
6. Upload documents to audit them against the retrieved requirements.
7. Export, copy or share the answer; ask follow-ups with case context preserved.

---

## Technology stack

- **React 19** + **TypeScript**
- **TanStack Start** (SSR, file-based routing) on **Vite 7**
- **TanStack Router** and **TanStack Query**
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)
- **Supabase / PostgreSQL** — auth, row-level-security-scoped user data, source registry,
  documents, chunks, citations, cases, checklists, audits
- **Server functions** (`createServerFn`) for all privileged work — API keys never reach the
  browser
- **Gemini** for synthesis (provider-abstracted) and **Tavily** for live web search and
  extraction

---

## Local development

Requirements: Node.js 20+ (or Bun) and a Supabase project.

```sh
git clone <this-repository-url>
cd myvisa
npm install          # or: bun install
cp .env.example .env # fill in your own values
npm run dev
```

The app runs on http://localhost:8080.

Database schema lives in `supabase/migrations` and can be applied with the Supabase CLI:

```sh
supabase db push
```

### Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build (useful for verifying SSR/prerender) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## Environment variables

Names only — never commit actual values. Client-exposed variables are prefixed `VITE_`;
everything else is server-only and read inside server functions.

| Variable | Scope | Purpose |
| -------- | ----- | ------- |
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Supabase publishable/anon key |
| `VITE_SUPABASE_PROJECT_ID` | client | Supabase project reference |
| `SUPABASE_URL` | server | Supabase project URL for server functions |
| `SUPABASE_PUBLISHABLE_KEY` | server | Publishable key for user-scoped server reads |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Privileged key for admin/ingestion tasks only |
| `GEMINI_API_KEY` | server | Answer synthesis provider key |
| `GEMINI_MODEL` | server | Optional model override |
| `TAVILY_API_KEY` | server | Live web search and page extraction |

Without AI/search credentials the app does not fabricate results: it shows a clearly
labelled setup state, and demo mode is visibly marked as sample data.

---

## Deployment

The project builds to a standard SSR bundle and targets an edge/serverless runtime
(Cloudflare Workers-compatible; `nodejs_compat` assumed). Deploy steps:

1. `npm run build`
2. Configure the environment variables above as platform secrets — server-only keys must
   never be exposed to the client bundle.
3. Apply database migrations to the target Supabase project.
4. Point your domain at the deployment and verify auth redirect URLs match the public origin.

---

## Responsible use and legal disclaimer

MyVisa is a **research and preparation aid**. It is **not** a law firm, immigration
consultant, government authority, visa application service, or approval predictor, and it
does **not** provide legal advice. Visa rules change frequently and vary by consulate,
nationality and individual circumstances.

Always confirm requirements with the official embassy, consulate or immigration authority
for your case before applying. Community and forum content shown in the app is anecdotal
and may be inaccurate or outdated. Nothing in the app guarantees a visa outcome.

Users control their own data: cases and uploaded documents can be deleted at any time, and
only the information needed for research is collected.

---

## License

Released under the MIT License. See `LICENSE`.
