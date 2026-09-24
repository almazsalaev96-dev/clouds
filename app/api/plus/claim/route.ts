import type { NextRequest } from "next/server";
import { claimPass, plusConfigured } from "@/lib/plus.server";

export const runtime = "edge";

/**
 * Back from checkout, or a payment id off the receipt: the payment is
 * looked up at Dodo and, if it stands, a signed pass comes back.
 */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ pass: null, error: "Armi Plus is not switched on for this installation." }, { status: 404 });
  let body: { sessionId?: string; paymentId?: string; subscriptionId?: string } = {};
  try { body = (await req.json()) as typeof body; } catch { /* handled below */ }
  const sessionId = (body.sessionId ?? "").trim();
  const paymentId = (body.paymentId ?? "").trim();
  const subscriptionId = (body.subscriptionId ?? "").trim();
  if (!sessionId && !paymentId) return Response.json({ pass: null, error: "Paste the payment id first." }, { status: 400 });
  const out = await claimPass({ sessionId, paymentId, subscriptionId });
  if (!out) return Response.json({ pass: null, error: "No successful payment for Armi Plus was found under that id. Check it against the receipt from Dodo Payments." });
  return Response.json(out);
}
