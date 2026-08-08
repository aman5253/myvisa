import { aiProvider } from "./providers.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = "google/gemini-3.6-flash";
/** Model id used when a direct Gemini key is configured. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function aiConfigured() {
  return aiProvider().id !== "none";
}

export class AiError extends Error {
  constructor(
    message: string,
    public code: "no_key" | "rate_limit" | "no_credits" | "upstream" = "upstream",
  ) {
    super(message);
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type VisionPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Gemini direct call. Same contract as the gateway path: JSON object out. */
async function geminiGenerate(key: string, system: string, parts: unknown[]): Promise<string> {
  const model = process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL;
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (res.status === 429) throw new AiError("Rate limited by Gemini.", "rate_limit");
  if (!res.ok) {
    const body = await res.text();
    throw new AiError(`Gemini error (${res.status}): ${body.slice(0, 400)}`);
  }
  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (payload.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

function toGeminiParts(parts: VisionPart[]) {
  return parts.map((p) => {
    if (p.type === "text") return { text: p.text };
    const match = /^data:([^;]+);base64,(.*)$/.exec(p.image_url.url);
    if (!match) return { text: `[image at ${p.image_url.url}]` };
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });
}

/**
 * Single provider abstraction point. Swap the base URL / headers here to move
 * to a different gateway or a direct Gemini key without touching callers.
 */
export async function chatJson<T>(opts: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const provider = aiProvider();
  if (provider.id === "none") throw new AiError("AI provider is not configured.", "no_key");
  if (provider.id === "gemini") {
    const raw = await geminiGenerate(process.env["GEMINI_API_KEY"]!, opts.system, [
      { text: opts.user },
    ]);
    return parseJson<T>(raw);
  }
  const key = process.env["LOVABLE_API_KEY"]!;

  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new AiError("Rate limited by the AI provider.", "rate_limit");
  if (res.status === 402) throw new AiError("AI credits exhausted.", "no_credits");
  if (!res.ok) {
    const body = await res.text();
    throw new AiError(`AI provider error (${res.status}): ${body.slice(0, 400)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  return parseJson<T>(raw);
}

export async function chatVisionJson<T>(opts: {
  system: string;
  parts: VisionPart[];
  model?: string;
}): Promise<T> {
  const provider = aiProvider();
  if (provider.id === "none") throw new AiError("AI provider is not configured.", "no_key");
  if (provider.id === "gemini") {
    const raw = await geminiGenerate(
      process.env["GEMINI_API_KEY"]!,
      opts.system,
      toGeminiParts(opts.parts),
    );
    return parseJson<T>(raw);
  }
  const key = process.env["LOVABLE_API_KEY"]!;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.parts },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new AiError("Rate limited by the AI provider.", "rate_limit");
  if (res.status === 402) throw new AiError("AI credits exhausted.", "no_credits");
  if (!res.ok) {
    const body = await res.text();
    throw new AiError(`AI provider error (${res.status}): ${body.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson<T>(payload.choices?.[0]?.message?.content ?? "");
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new AiError("The AI provider returned an unreadable response.");
  }
}