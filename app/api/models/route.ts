import type { NextRequest } from "next/server";
import { PROVIDERS } from "@/lib/models";
import type { ProviderId } from "@/lib/types";
import { plusGating, plusOffer, validatePass } from "@/lib/plus.server";

export const runtime = "edge";

/**
 * Tells the UI which providers the server can already answer for, without ever
 * sending a key to the browser. The settings page needs to know *that* a key
 * exists, never what it is.
 */
export async function GET(req: NextRequest) {
  const configured: Record<string, boolean> = {};
  /* With Armi Plus on, the server's keys are for members — so they are
     reported as held only to a browser whose Plus key checks out, and the
     answer carries what Plus is and costs for everyone else. */
  const plusKey = new URL(req.url).searchParams.get("plus")?.trim() || undefined;
  const valid = plusKey ? await validatePass(plusKey) : undefined;
  const open = !plusGating() || valid === true;
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    const v = process.env[PROVIDERS[id].keyName];
    configured[id] = open && Boolean(v && v.trim());
  }
  return Response.json({ configured, plus: plusOffer(valid) });
}
