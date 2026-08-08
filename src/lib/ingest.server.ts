const UA = "VisaIntelligenceBot/0.1 (+research assistant; respects robots.txt)";

export async function robotsAllows(target: string): Promise<{ allowed: boolean; reason: string }> {
  const url = new URL(target);
  try {
    const res = await fetch(`${url.origin}/robots.txt`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { allowed: true, reason: "No robots.txt published" };
    const text = await res.text();

    // Parse the * group (and our own UA group) for Disallow rules.
    const lines = text.split(/\r?\n/).map((l) => l.split("#")[0]!.trim());
    let active = false;
    const disallow: string[] = [];
    const allow: string[] = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) continue;
      const key = rawKey.toLowerCase().trim();
      const value = rest.join(":").trim();
      if (key === "user-agent") {
        active = value === "*" || UA.toLowerCase().includes(value.toLowerCase());
      } else if (active && key === "disallow" && value) disallow.push(value);
      else if (active && key === "allow" && value) allow.push(value);
    }
    const path = url.pathname + url.search;
    const match = (rule: string) => path.startsWith(rule.replace(/\*$/, ""));
    const blocked = disallow.some(match);
    const allowed = allow.some(match);
    if (blocked && !allowed) return { allowed: false, reason: "Disallowed by robots.txt" };
    return { allowed: true, reason: "Allowed by robots.txt" };
  } catch {
    // Fail closed only on explicit disallow; network errors shouldn't block.
    return { allowed: true, reason: "robots.txt unreachable — proceeding conservatively" };
  }
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function htmlToText(html: string) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return decodeEntities(m[1]).replace(/\s+/g, " ").trim().slice(0, 300) || null;
}

export function extractPublishedAt(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']last-modified["'][^>]+content=["']([^"']+)["']/i,
    /"dateModified"\s*:\s*"([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const d = new Date(m[1]);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

export async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function chunkText(text: string, size = 1200, overlap = 150) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > size && current.length > 200) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap)) + "\n\n" + p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim().length > 80) chunks.push(current.trim());
  return chunks.slice(0, 80);
}

export async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}