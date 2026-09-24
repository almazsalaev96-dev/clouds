import type { NextRequest } from "next/server";
import { activateKey, plusConfigured, validateKey } from "@/lib/plus.server";

export const runtime = "edge";

/**
 * A key, checked with Dodo and bound to this browser. Says which product it
 * is for, so a key for something else is not quietly accepted.
 */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ valid: false, error: "Armi Plus is not switched on for this installation." }, { status: 404 });
  let body: { key?: string; device?: string } = {};
  try { body = (await req.json()) as { key?: string; device?: string }; } catch { /* handled below */ }
  const key = (body.key ?? "").trim();
  if (!key) return Response.json({ valid: false, error: "Paste the key first." }, { status: 400 });
  const valid = await validateKey(key);
  if (!valid) return Response.json({ valid: false, error: "That key is not active. Check it against the email from Dodo Payments." });
  const bound = await activateKey(key, body.device?.slice(0, 80) || "Armi");
  const product = process.env.DODO_PLUS_PRODUCT_ID?.trim();
  if (bound?.productId && product && bound.productId !== product) {
    return Response.json({ valid: false, error: "That key is for something else, not Armi Plus." });
  }
  return Response.json({ valid: true, customerId: bound?.customerId, productId: bound?.productId, instanceId: bound?.instanceId });
}
