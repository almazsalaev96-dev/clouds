import type { ToolSpec } from "./types";

/**
 * Outside services, as tools the model may reach for.
 *
 * "Plugins", in the word everybody uses. Built on the Model Context Protocol
 * rather than one hand-written integration per company, and that is the whole
 * design decision:
 *
 *  - It is what the connectors in the tools this is compared against actually
 *    run on underneath. Writing a bespoke Gmail client and a bespoke Drive
 *    client and a bespoke Notion client is writing the same adapter three
 *    times against three APIs that will each change.
 *  - It fits what this app already is. Somebody brings a server and a token
 *    the way they bring an API key; nothing here is registered with anybody,
 *    and this app holds no client secret it could leak.
 *  - It is honest about reach. Every tool a connector offers is listed, by
 *    name and description, before it is turned on — because a connector is
 *    the one thing in this app that sends what you type somewhere the
 *    privacy panel cannot otherwise promise about.
 *
 * The wire is JSON-RPC 2.0 over HTTP. Three calls are enough: `initialize` to
 * say hello and learn the server's name, `tools/list` to find out what it can
 * do, `tools/call` to do it.
 */

export interface Connector {
  id: string;
  /** What the person calls it. Seeded from the server's own name. */
  name: string;
  url: string;
  /** A bearer token, where the server wants one. Kept like a key is kept. */
  token?: string;
  enabled: boolean;
  /** What it offered when it was last asked, so the list survives a reload. */
  tools: ConnectorTool[];
  addedAt: number;
  /** What went wrong last time, if anything did. */
  trouble?: string;
}

export interface ConnectorTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/* Every tool a connector offers is renamed before the model sees it.
   ---------------------------------------------------------------------
   Two reasons, and both are about not lying. A server offering `search`
   would otherwise shadow or be shadowed by a room tool of the same name,
   and whichever lost would fail silently on a turn that looked fine. And a
   model that calls `search` has not been told whose search it is reaching
   for — `gmail__search` has, and says so in the chip the reader sees. */
export const toolNameFor = (conn: Connector, tool: string): string =>
  `${slug(conn.name)}__${tool}`;

export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "connector";

/** Which connector a prefixed name belongs to, and what it is called there. */
export function ownerOf(
  name: string,
  connectors: Connector[],
): { conn: Connector; tool: string } | null {
  for (const conn of connectors) {
    const prefix = `${slug(conn.name)}__`;
    if (name.startsWith(prefix)) return { conn, tool: name.slice(prefix.length) };
  }
  return null;
}

/** The tools of every connector that is switched on, in the app's own shape. */
export function connectorSpecs(connectors: Connector[]): ToolSpec[] {
  return connectors
    .filter((c) => c.enabled)
    .flatMap((c) =>
      c.tools.map((t) => ({
        name: toolNameFor(c, t.name),
        /* Whose it is, said in the description as well as the name, because
           the name is what the model matches on and the description is what
           it reasons about. */
        description: `${t.description} (via ${c.name}, an outside service)`,
        schema: t.schema,
      })),
    );
}

/* ------------------------------------------------------------- the wire -- */

let nextId = 1;

/**
 * One JSON-RPC call, through this app's own server.
 *
 * Not straight from the browser: almost no MCP endpoint sends the CORS
 * headers a cross-origin `fetch` needs, so a direct call fails for a reason
 * that has nothing to do with the person's setup and cannot be fixed from
 * this side. The proxy also keeps the token out of a preflight that a
 * browser would otherwise broadcast.
 */
async function rpc(
  conn: Pick<Connector, "url" | "token">,
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      url: conn.url,
      token: conn.token || undefined,
      rpc: { jsonrpc: "2.0", id: nextId++, method, params },
    }),
  });
  const body = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (!res.ok) {
    throw new Error(String(body?.error ?? `The server answered ${res.status}.`));
  }
  if (body?.error) {
    /* The server's own words. A connector that refuses says why, and the
       person can act on "that token is expired" where they cannot act on
       "something went wrong". */
    const e = body.error as { message?: string; code?: number };
    throw new Error(e.message ? String(e.message) : `The server refused (${e.code ?? "no code"}).`);
  }
  return (body?.result ?? {}) as Record<string, unknown>;
}

/**
 * Say hello, and find out what it can do.
 *
 * Both calls, because a server that answers `initialize` and then offers no
 * tools is connected and useless, and the person should be told that when
 * they add it rather than the first time they ask for something.
 */
export async function connect(
  conn: Pick<Connector, "url" | "token">,
  signal?: AbortSignal,
): Promise<{ name: string; tools: ConnectorTool[] }> {
  const hello = await rpc(
    conn,
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "Armi", version: "1" },
    },
    signal,
  );
  const info = (hello.serverInfo ?? {}) as { name?: string };
  const listed = await rpc(conn, "tools/list", {}, signal);
  const tools = ((listed.tools ?? []) as Record<string, any>[])
    .filter((t) => typeof t.name === "string")
    .map((t) => ({
      name: String(t.name),
      description: String(t.description ?? "").slice(0, 400),
      schema: (t.inputSchema ?? t.input_schema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    }));
  return { name: (info.name || hostOf(conn.url)).slice(0, 40), tools };
}

/** Run one of a connector's tools and hand back what it said, as text. */
export async function callTool(
  conn: Connector,
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const out = await rpc(conn, "tools/call", { name: tool, arguments: args }, signal);
  /* A result is a list of content blocks, and only the text ones mean
     anything to a model reading a transcript. An image or a resource is
     named rather than dropped, so an answer written from this cannot
     silently omit that something came back. */
  const blocks = (out.content ?? []) as Record<string, any>[];
  const said = blocks
    .map((b) => (b.type === "text" ? String(b.text ?? "") : `[${String(b.type ?? "something")} returned]`))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (out.isError) throw new Error(said || "The tool reported a failure.");
  return said || "The tool returned nothing.";
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
};
