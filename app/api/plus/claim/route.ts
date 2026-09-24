import type { NextRequest } from "next/server";
import { claimPass, plusConfigured } from "@/lib/plus.server";

export const runtime = "edge";

/**
 * Back from checkout, or a payment id off the receipt: the payment is
 * looked up at Dodo and, if it stands, a signed pass comes back.
 */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ pass: null, error: "Armi Plus is not switched on for this installation." }, { status: 404 });
  let body: { sessionId?: string; paymentId?: string; subscriptionId?: string; email?: string; any?: string } = {};
  try { body = (await req.json()) as typeof body; } catch { /* handled below */ }
  const sessionId = (body.sessionId ?? "").trim();
  let paymentId = (body.paymentId ?? "").trim();
  let subscriptionId = (body.subscriptionId ?? "").trim();
  let email = (body.email ?? "").trim();
  /* One box in Settings takes whichever the person has: sorted by shape. */
  const any = (body.any ?? "").trim();
  if (any) {
    if (/^pay_/i.test(any)) paymentId = any;
    else if (/^sub_/i.test(any)) subscriptionId = any;
    else if (any.includes("@")) email = any;
    else return Response.json({ pass: null, error: "That is not a payment id (pay_…), a subscription id (sub_…) or an email address." });
  }
  if (!sessionId && !paymentId && !subscriptionId && !email) return Response.json({ pass: null, error: "Paste the email you paid with, or the payment id." }, { status: 400 });
  const out = await claimPass({ sessionId, paymentId, subscriptionId, email });
  console.log(`plus claim: ${paymentId || subscriptionId || sessionId || (email ? "email" : "?")} → ${out ? `pass for ${out.customerId}` : "no pass"}`);
  if (!out) return Response.json({ pass: null, error: email && !paymentId && !subscriptionId
    ? "No active Armi Plus subscription was found under that email at Dodo Payments. Check it is the email you paid with — and that the app's Dodo key is a live-mode key."
    : "No successful payment for Armi Plus was found under that id. Check it against the receipt from Dodo Payments." });
  return Response.json(out);
}
