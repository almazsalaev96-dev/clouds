import type { NextRequest } from "next/server";
import { classifyError } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const runtime = "edge";

/**
 * A one-token round trip, so "Test" in settings reports a real answer and a
 * real latency instead of a hopeful green dot.
 */
const PROBES: Record<ProviderId, (key: string) => Promise<Response>> = {
  anthropic: (key) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    }),
  openai: (key) =>
    fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } }),
  google: (key) =>
    fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": key } }),
  deepseek: (key) =>
    fetch("https://api.deepseek.com/v1/models", { headers: { authorization: `Bearer ${key}` } }),
};

export async function POST(req: NextRequest) {
  const { provider, key } = (await req.json()) as { provider: ProviderId; key: string };
  if (!PROBES[provider]) return Response.json({ ok: false, message: "Unknown provider." });

  const started = Date.now();
  try {
    const res = await PROBES[provider](key);
    const ms = Date.now() - started;
    if (res.ok) return Response.json({ ok: true, ms });
    const err = classifyError(provider, res.status, await res.text());
    return Response.json({ ok: false, message: err.message, ms });
  } catch {
    return Response.json({ ok: false, message: "Couldn't reach the provider from this server." });
  }
}
