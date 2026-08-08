import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required.");
}

/** Bootstrap: the first signed-in user may claim admin when none exists yet. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists for this workspace.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [sources, crawls, docs, chunks, events] = await Promise.all([
      supabaseAdmin.from("sources").select("*").order("tier").order("title"),
      supabaseAdmin.from("crawls").select("*").order("started_at", { ascending: false }).limit(30),
      supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("document_chunks").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("usage_events")
        .select("event_type, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      sources: sources.data ?? [],
      crawls: crawls.data ?? [],
      documentCount: docs.count ?? 0,
      chunkCount: chunks.count ?? 0,
      events: events.data ?? [],
    };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    return { isAdmin: Boolean(data), anyAdminExists: (count ?? 0) > 0 };
  });

const SourceInput = z.object({
  title: z.string().min(2),
  url: z.string().url(),
  tier: z.number().int().min(1).max(6),
  source_type: z.string().min(2),
  destination: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  visa_types: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const addSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SourceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const domain = new URL(data.url).hostname.replace(/^www\./, "");
    const { error } = await supabaseAdmin.from("sources").insert({
      title: data.title,
      url: data.url,
      domain,
      tier: data.tier,
      source_type: data.source_type,
      destination: data.destination ?? null,
      country: data.country ?? null,
      visa_types: data.visa_types ?? [],
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSourceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sources")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Fetch a registry source, respect robots.txt, dedupe, chunk and index it. */
export const crawlSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ingest = await import("./ingest.server");

    const { data: source, error: sErr } = await supabaseAdmin
      .from("sources")
      .select("*")
      .eq("id", data.id)
      .single();
    if (sErr || !source) throw new Error(sErr?.message ?? "Source not found");

    const { data: crawl } = await supabaseAdmin
      .from("crawls")
      .insert({ source_id: source.id, status: "running" })
      .select("id")
      .single();
    const crawlId = crawl?.id;

    const fail = async (message: string, extra: Record<string, unknown> = {}) => {
      if (crawlId) {
        await supabaseAdmin
          .from("crawls")
          .update({ status: "failed", error: message, finished_at: new Date().toISOString(), ...extra })
          .eq("id", crawlId);
      }
      await supabaseAdmin
        .from("sources")
        .update({ crawl_status: "error", last_error: message, last_crawled_at: new Date().toISOString() })
        .eq("id", source.id);
      return { ok: false as const, message };
    };

    const robots = await ingest.robotsAllows(source.url);
    if (!robots.allowed) return fail(`Skipped: ${robots.reason}`, { robots_allowed: false });

    const { tavilyExtract, tavilyConfigured } = await import("./tavily.server");

    let page: { status: number; ok: boolean; body: string } | null = null;
    let fetchError: string | null = null;
    try {
      page = await ingest.fetchPage(source.url);
    } catch (e) {
      fetchError = `Fetch failed: ${(e as Error).message}`;
    }

    let text = page?.ok ? ingest.htmlToText(page.body) : "";
    let title = page ? ingest.extractTitle(page.body) : null;
    let publishedAt = page ? ingest.extractPublishedAt(page.body) : null;
    let via = "direct";

    // Blocked (403/4xx/5xx), unreachable, or JS-rendered pages fall back to
    // Tavily extract rather than being recorded as unusable.
    const needsFallback = !page || !page.ok || text.length < 400;
    if (needsFallback && tavilyConfigured()) {
      try {
        const extracted = await tavilyExtract(source.url);
        if (extracted && extracted.text.length >= 400) {
          text = extracted.text;
          title = extracted.title ?? title;
          via = "tavily-extract";
        }
      } catch (e) {
        console.error("tavily extract failed", (e as Error).message);
      }
    }

    if (text.length < 400) {
      const reason = fetchError
        ? fetchError
        : page && !page.ok
          ? `HTTP ${page.status}`
          : "Page contained too little extractable text (likely JS-rendered).";
      const suffix = tavilyConfigured()
        ? " Live extraction fallback also returned no usable text."
        : " Configure live web extraction (TAVILY_API_KEY) to recover blocked or JS-rendered pages.";
      return fail(reason + suffix, {
        robots_allowed: true,
        ...(page ? { http_status: page.status } : {}),
      });
    }

    const hash = await ingest.sha256(text);
    if (source.content_hash === hash) {
      if (crawlId) {
        await supabaseAdmin
          .from("crawls")
          .update({
            status: "unchanged",
            http_status: page?.status ?? 200,
            bytes: text.length,
            robots_allowed: true,
            finished_at: new Date().toISOString(),
          })
          .eq("id", crawlId);
      }
      await supabaseAdmin
        .from("sources")
        .update({
          crawl_status: "indexed",
          last_crawled_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", source.id);
      return { ok: true as const, message: "No change since last crawl.", chunks: 0 };
    }

    const { data: doc, error: dErr } = await supabaseAdmin
      .from("documents")
      .upsert(
        {
          source_id: source.id,
          url: source.url,
          title: title ?? source.title,
          content: text.slice(0, 400_000),
          content_hash: hash,
          published_at: publishedAt,
          retrieved_at: new Date().toISOString(),
        },
        { onConflict: "source_id,content_hash" },
      )
      .select("id")
      .single();
    if (dErr || !doc) return fail(`Store failed: ${dErr?.message}`);

    await supabaseAdmin.from("document_chunks").delete().eq("document_id", doc.id);
    const chunks = ingest.chunkText(text);
    if (chunks.length) {
      const { error: cErr } = await supabaseAdmin.from("document_chunks").insert(
        chunks.map((content, position) => ({
          document_id: doc.id,
          source_id: source.id,
          position,
          content,
          token_estimate: Math.ceil(content.length / 4),
        })),
      );
      if (cErr) return fail(`Chunk store failed: ${cErr.message}`);
    }

    if (crawlId) {
      await supabaseAdmin
        .from("crawls")
        .update({
          status: "indexed",
          http_status: page?.status ?? 200,
          bytes: text.length,
          robots_allowed: true,
          finished_at: new Date().toISOString(),
        })
        .eq("id", crawlId);
    }
    await supabaseAdmin
      .from("sources")
      .update({
        crawl_status: "indexed",
        last_crawled_at: new Date().toISOString(),
        content_hash: hash,
        last_error: null,
      })
      .eq("id", source.id);

    return {
      ok: true as const,
      message: `Indexed ${chunks.length} chunks${via === "tavily-extract" ? " via live extraction fallback" : ""}.`,
      chunks: chunks.length,
    };
  });