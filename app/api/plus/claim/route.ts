import type { NextRequest } from "next/server";
import { claimKey, plusConfigured } from "@/lib/plus.server";

export const runtime = "edge";

/** Back from checkout: the key, found from the session, where Dodo lets us. */
export async function POST(req: NextRequest) {
  if (!plusConfigured()) return Response.json({ key: null }, { status: 404 });
  let body: { sessionId?: string } = {};
  try { body = (await req.json()) as { sessionId?: string }; } catch { /* handled below */ }
  const id = (body.sessionId ?? "").trim();
  if (!id) return Response.json({ key: null }, { status: 400 });
  const key = await claimKey(id);
  return Response.json({ key });
}
