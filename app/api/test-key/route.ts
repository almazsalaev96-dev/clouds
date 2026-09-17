import type { NextRequest } from "next/server";
import { classifyError, baseUrlFor } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const runtime = "edge";

/**
 * A real round trip, so "Test" in settings reports a real answer and a real
 * latency instead of a hopeful green dot.
 *
 * Addressed the same way the chat is. These hosts used to be written out
 * here, which quietly made the dot a lie for everybody the base URLs exist
 * for: point `OPENAI_BASE_URL` at a gateway, Azure or a local model and Test
 * went on asking api.openai.com, so a gateway token came back rejected while
 * a real OpenAI key came back good and then failed on the first message. A
 * test that does not use the route it is vouching for is not a test.
 */
const PROBES: Record<ProviderId, (key: string) => Promise<Response>> = {
  /* A single token, because Anthropic has no free way to say "this key is
     good" — the other three answer that from their catalogue for nothing. */
  anthropic: (key) =>
    fetch(`${baseUrlFor("anthropic", "https://api.anthropic.com")}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    }),
  openai: (key) =>
    fetch(`${baseUrlFor("openai", "https://api.openai.com/v1")}/models`, { headers: { authorization: `Bearer ${key}` } }),
  moonshot: (key) =>
    fetch(`${baseUrlFor("moonshot", "https://api.moonshot.ai/v1")}/models`, { headers: { authorization: `Bearer ${key}` } }),
  deepseek: (key) =>
    fetch(`${baseUrlFor("deepseek", "https://api.deepseek.com/v1")}/models`, { headers: { authorization: `Bearer ${key}` } }),
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
