/**
 * Central registry of every external integration the engine can use.
 * Nothing here performs a call — it only reports, honestly, what is wired up
 * so the UI can show "configured" vs "not configured" instead of pretending.
 */

export type IntegrationStatus = {
  id: string;
  label: string;
  kind: "ai" | "ingestion" | "community";
  configured: boolean;
  detail: string;
  /** Name of the env var(s) that would enable it. */
  envKeys: string[];
};

export function aiProvider(): { id: "gemini" | "lovable" | "none"; label: string } {
  if (process.env["GEMINI_API_KEY"]) return { id: "gemini", label: "Google Gemini (direct key)" };
  if (process.env["LOVABLE_API_KEY"]) return { id: "lovable", label: "Gemini via managed gateway" };
  return { id: "none", label: "Not configured" };
}

export function integrationStatuses(): IntegrationStatus[] {
  const ai = aiProvider();
  return [
    {
      id: "ai",
      label: "Answer synthesis provider",
      kind: "ai",
      configured: ai.id !== "none",
      detail:
        ai.id === "gemini"
          ? "Using a directly configured Gemini API key. Keys are read server-side only."
          : ai.id === "lovable"
            ? "Using the managed AI gateway. Add GEMINI_API_KEY to use your own Gemini key instead."
            : "No answer synthesis is possible. Live questions will refuse to answer rather than guess.",
      envKeys: ["GEMINI_API_KEY", "LOVABLE_API_KEY"],
    },
    {
      id: "web_ingestion",
      label: "Public web ingestion",
      kind: "ingestion",
      configured: true,
      detail:
        "Direct fetch of publicly accessible pages, robots.txt-checked, rate limited and stored with URL, hash and retrieval time. Sites behind bot protection are recorded as failed crawls, never faked.",
      envKeys: [],
    },
    {
      id: "search_provider",
      label: "Live web search (Tavily)",
      kind: "ingestion",
      configured: Boolean(process.env["TAVILY_API_KEY"]),
      detail: process.env["TAVILY_API_KEY"]
        ? "Tavily is configured. Live web search supplements a thin corpus and Tavily extract recovers pages that block direct crawling (HTTP 403 or JS-rendered). Results keep their real URL, domain tier and retrieval time."
        : "No search provider configured. Coverage is limited to URLs in the source registry; the engine will not invent results beyond them. Add TAVILY_API_KEY in Project Settings → Secrets to enable live web search and blocked-page extraction.",
      envKeys: ["TAVILY_API_KEY"],
    },
    {
      id: "reddit",
      label: "Reddit / community research",
      kind: "community",
      configured: Boolean(process.env["TAVILY_API_KEY"]),
      detail: process.env["TAVILY_API_KEY"]
        ? "Search enabled via web search. No Reddit login required for indexed public results. Threads are discovered through the search provider and always labelled tier 5 anecdote — never law."
        : "Community research runs on the web search provider. Add TAVILY_API_KEY in Project Settings → Secrets to enable it. No Reddit credentials are needed.",
      envKeys: ["TAVILY_API_KEY"],
    },
  ];
}

/** Community-source connector abstraction — implementations plug in here. */
export type CommunityConnector = {
  id: string;
  configured: () => boolean;
  /** Fetch permitted, public community posts. Throws when not configured. */
  fetchPosts: (query: string, limit: number) => Promise<
    { url: string; title: string; body: string; createdAt: string | null }[]
  >;
};

/**
 * Optional direct-API connector. Not used by the research flow: community
 * evidence is discovered through the web search provider instead, so no Reddit
 * credentials are required anywhere in the normal path.
 */
export const redditConnector: CommunityConnector = {
  id: "reddit",
  configured: () => false,
  async fetchPosts() {
    throw new Error(
      "Direct Reddit API access is not used. Community results come from the web search provider's publicly indexed pages.",
    );
  },
};
