import type { NextRequest } from "next/server";
import { passCustomer, plusConfigured, validatePass } from "@/lib/plus.server";

export const runtime = "edge";

/** A pass, checked: our signature, and the subscription still standing at Dodo. */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ valid: false, error: "Armi Plus is not switched on for this installation." }, { status: 404 });
  let body: { key?: string } = {};
  try { body = (await req.json()) as { key?: string }; } catch { /* handled below */ }
  const key = (body.key ?? "").trim();
  if (!key) return Response.json({ valid: false, error: "No pass was sent." }, { status: 400 });
  const valid = await validatePass(key);
  if (!valid) return Response.json({ valid: false, error: "That subscription is no longer active." });
  return Response.json({ valid: true, customerId: await passCustomer(key) });
}
