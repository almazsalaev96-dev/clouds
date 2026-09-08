import { PROVIDERS } from "@/lib/models";
import type { ProviderId } from "@/lib/types";

export const runtime = "edge";

/**
 * Tells the UI which providers the server can already answer for, without ever
 * sending a key to the browser. The settings page needs to know *that* a key
 * exists, never what it is.
 */
export async function GET() {
  const configured: Record<string, boolean> = {};
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    const v = process.env[PROVIDERS[id].keyName];
    configured[id] = Boolean(v && v.trim());
  }
  return Response.json({ configured });
}
