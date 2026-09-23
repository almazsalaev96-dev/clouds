import type { NextRequest } from "next/server";
import { classifyError } from "@/lib/providers";
import { baseUrlFor } from "@/lib/providers/shared";
import { PROVIDERS } from "@/lib/models";

export const runtime = "edge";
export const maxDuration = 120;

/**
 * A picture from a description.
 *
 * The one thing every flagship assistant does that a text model cannot:
 * "draw me the water cycle" comes back as a drawing. It runs on OpenAI's
 * image model, with the same key the chat uses — a server-side key wins,
 * the browser's own key is the fallback, and with neither the answer is an
 * honest "no key" rather than a 500. The bytes come back base64, exactly as
 * an attached picture is stored, so the thread keeps it the way it keeps
 * everything else and it needs no bucket, no URL and no expiry.
 */
export async function POST(req: NextRequest) {
  let body: { prompt?: string; clientKey?: string; size?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: { kind: "unknown", message: "Bad request.", action: "none" } }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 4000);
  if (!prompt) return Response.json({ error: { kind: "unknown", message: "Say what to draw.", action: "none" } }, { status: 400 });

  const env = process.env[PROVIDERS.openai.keyName];
  const key = (env && env.trim()) || body.clientKey;
  if (!key) {
    return Response.json({
      error: { kind: "no_key", message: "Making pictures needs an OpenAI key. Add one in Settings.", action: "add_key" },
    });
  }

  const size = ["1024x1024", "1536x1024", "1024x1536"].includes(body.size ?? "") ? body.size : "1024x1024";
  try {
    const res = await fetch(`${baseUrlFor("openai", "https://api.openai.com/v1")}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size, quality: "medium", output_format: "png" }),
      signal: req.signal,
    });
    if (!res.ok) {
      return Response.json({ error: classifyError("openai", res.status, await res.text()) });
    }
    const out = (await res.json()) as { data?: { b64_json?: string; revised_prompt?: string }[] };
    const b64 = out.data?.[0]?.b64_json;
    if (!b64) return Response.json({ error: { kind: "unknown", message: "No picture came back.", action: "retry" } });
    return Response.json({ b64, mime: "image/png" });
  } catch (err) {
    return Response.json({
      error: {
        kind: "network",
        message: "Couldn't reach OpenAI.",
        action: "retry",
        detail: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
