export const runtime = "edge";

/**
 * The pass-through for a connector's calls.
 *
 * A browser cannot talk to most MCP endpoints directly: almost none of them
 * send the CORS headers a cross-origin `fetch` requires, so the request fails
 * for a reason that has nothing to do with the person's setup and that they
 * cannot fix from their side. So the call goes out from here instead.
 *
 * This holds nothing and remembers nothing. The URL and the token arrive with
 * each call, are used once, and are gone when the response is written — the
 * same posture as `/api/chat`, which is the only reason this app can say what
 * it says about keys. A connector's *data* is a different matter and the
 * Connectors panel says so plainly: this is the one part of the app where
 * what you type reaches a machine that is neither yours nor a model provider's.
 */

/* Where a call may be sent.
   ---------------------------------------------------------------------
   An open proxy is a gift to anybody who finds it: a POST with a URL in it
   would let a stranger use this deployment to reach anything the server can
   reach, including addresses on its own network that are not on the
   internet at all. So: https only, and never a private or loopback host.
   This is not a substitute for the person trusting the server they added —
   it is the floor under it. */
const PRIVATE =
  /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|::1$|\[::1\]$|172\.(1[6-9]|2[0-9]|3[01])\.|.*\.local$|.*\.internal$)/i;

function refuse(reason: string, status = 400): Response {
  return Response.json({ error: reason }, { status });
}

export async function POST(req: Request) {
  let body: { url?: string; token?: string; rpc?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return refuse("That was not a request this can read.");
  }
  const { url, token, rpc } = body;
  if (typeof url !== "string" || !rpc) return refuse("A connector needs an address and a call.");

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return refuse("That is not an address.");
  }
  if (target.protocol !== "https:") return refuse("A connector has to be reached over https.");
  if (PRIVATE.test(target.hostname)) return refuse("That address is on a private network, so it is not somewhere this can reach.");

  /* MCP servers answer either as JSON or as a single SSE frame depending on
     what they were built with, and a client that only reads one of the two
     works against half of them. Both are asked for and both are read. */
  let res: Response;
  try {
    res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(rpc),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return refuse(`Could not reach that server — ${why.slice(0, 160)}`, 502);
  }

  const text = await res.text();
  if (!res.ok) {
    /* The server's own words, trimmed. "401" alone sends somebody to check
       their address; "token expired" sends them to the right place. */
    return refuse(`The server answered ${res.status}. ${text.slice(0, 300)}`.trim(), 502);
  }

  const parsed = readEither(text);
  if (!parsed) return refuse("The server answered with something that is not a JSON-RPC reply.", 502);
  return Response.json(parsed);
}

/** A JSON body, or the last `data:` frame of an event stream. */
function readEither(text: string): Record<string, unknown> | null {
  const direct = tryJson(text);
  if (direct) return direct;
  const frames = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => tryJson(l.slice(5).trim()))
    .filter(Boolean) as Record<string, unknown>[];
  return frames.length ? frames[frames.length - 1] : null;
}

function tryJson(s: string): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
