import type { NextRequest } from "next/server";
import { createCheckout, plusConfigured } from "@/lib/plus.server";

export const runtime = "edge";

/** Where to pay. The person is sent to Dodo's hosted checkout and comes back to the app. */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ error: "Armi Plus is not switched on for this installation." }, { status: 404 });
  let body: { email?: string } = {};
  try { body = (await req.json()) as { email?: string }; } catch { /* no body is fine */ }
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const out = await createCheckout(`${origin}/?plus=done`, body.email?.trim() || undefined);
  if (!out) return Response.json({ error: "Couldn't start the checkout. Try again in a moment." }, { status: 502 });
  return Response.json({ url: out.url, sessionId: out.sessionId });
}
