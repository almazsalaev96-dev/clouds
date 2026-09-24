import type { NextRequest } from "next/server";
import { claimKey, plusConfigured } from "@/lib/plus.server";

export const runtime = "edge";

/** Back from checkout: the key, found from the session, where Dodo lets us. */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ key: null }, { status: 404 });
  let body: { sessionId?: string; paymentId?: string } = {};
  try { body = (await req.json()) as { sessionId?: string; paymentId?: string }; } catch { /* handled below */ }
  const sessionId = (body.sessionId ?? "").trim();
  const paymentId = (body.paymentId ?? "").trim();
  if (!sessionId && !paymentId) return Response.json({ key: null }, { status: 400 });
  const key = await claimKey({ sessionId, paymentId });
  return Response.json({ key });
}
