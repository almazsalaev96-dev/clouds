import { diagnose } from "@/lib/plus.server";

export const runtime = "edge";

/** For whoever hosts it, while `DODO_PLUS_DEBUG` is set: is the Dodo side wired right? */
export async function GET() {
  if (!process.env.DODO_PLUS_DEBUG?.trim()) return new Response("Not found", { status: 404 });
  return Response.json(await diagnose(), { headers: { "cache-control": "no-store" } });
}
