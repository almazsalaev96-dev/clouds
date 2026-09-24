import { PLUS_PRICE } from "@/lib/plus";
import { USED_UP, balance, debit, passCustomer, plusGating, validatePass } from "@/lib/plus.server";
import { serverKeyFor } from "@/lib/serverKeys";
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
  let body: { prompt?: string; clientKey?: string; plusKey?: string; plusCustomer?: string; size?: string; image?: { mime: string; data: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: { kind: "unknown", message: "Bad request.", action: "none" } }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 4000);
  if (!prompt) return Response.json({ error: { kind: "unknown", message: "Say what to draw.", action: "none" } }, { status: 400 });

  const env = serverKeyFor("openai");
  /* The same rule as the chat route: with Armi Plus on, the server's key is
     for members. A picture is a fixed few cents off the allowance. */
  const plusKey = body.plusKey?.trim();
  const viaPlus = Boolean(plusKey && plusGating() && (await validatePass(plusKey)));
  const key = viaPlus || !plusGating() ? (env && env.trim()) || body.clientKey : body.clientKey;
  if (!key) {
    return Response.json({
      error: { kind: "no_key", message: plusGating() ? `Making pictures needs an OpenAI key. Add one in Settings, or Armi Plus for ${PLUS_PRICE}.` : "Making pictures needs an OpenAI key. Add one in Settings.", action: "add_key" },
    });
  }
  /* Who to bill comes off the signed pass, never off the request body. */
  const member = viaPlus && plusKey ? await passCustomer(plusKey) : undefined;
  if (member) {
    const left = await balance(member);
    if (left !== null && left <= 0) return Response.json({ error: { kind: "quota", message: USED_UP, action: "add_key" } });
    void debit(member, 0.04, "image").catch(() => undefined);
  }

  const size = ["1024x1024", "1536x1024", "1024x1536"].includes(body.size ?? "") ? body.size : "1024x1024";
  const base = baseUrlFor("openai", "https://api.openai.com/v1");
  try {
    /* With a picture attached the words are a change to it, not a new one:
       the same model, on its edits endpoint, which takes the picture as a
       file beside the prompt. */
    let res: Response;
    if (body.image?.data) {
      const bytes = Uint8Array.from(atob(body.image.data), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.set("model", "gpt-image-1");
      form.set("prompt", prompt);
      form.set("n", "1");
      form.set("size", size!);
      form.set("image", new Blob([bytes], { type: body.image.mime || "image/png" }), "picture.png");
      res = await fetch(`${base}/images/edits`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal: req.signal });
    } else {
      res = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size, quality: "medium", output_format: "png" }),
        signal: req.signal,
      });
    }
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
