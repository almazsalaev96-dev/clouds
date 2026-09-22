/* Connectors: whose tool is whose, and where a call may be sent.
 *
 * Two things here can go wrong quietly, which is why they are the two
 * things tested. A server offering a tool called `search` would shadow, or
 * be shadowed by, the room tool of the same name — and whichever lost would
 * fail on a turn that looked perfectly normal. And a proxy that forwards
 * wherever it is pointed is an open door onto whatever the server can
 * reach, including addresses on its own network that are not on the
 * internet at all.
 *
 *   npx jiti test-plugins.ts */
import { connectorSpecs, ownerOf, slug, toolNameFor, type Connector } from "./lib/mcp";
import { actionSpecs } from "./lib/actions";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const conn = (name: string, tools: string[], enabled = true): Connector => ({
  id: name, name, url: "https://example.com/mcp", enabled, addedAt: 0,
  tools: tools.map((t) => ({ name: t, description: `does ${t}`, schema: { type: "object", properties: {} } })),
});

console.log("\nNo connector can be mistaken for a room");
{
  const gmail = conn("Gmail", ["search", "send"]);
  const specs = connectorSpecs([gmail]);
  check(specs.length === 2, "every tool of a switched-on service is offered", `${specs.length}`);
  check(specs[0].name === "gmail__search", "under a name that says whose it is", specs[0].name);
  /* The collision this exists to prevent. `search_notes` is a room tool; a
     server's own `search` must not land anywhere near it. */
  const rooms = actionSpecs({ conversationId: "c", temporary: false, memoryOn: true }).map((t) => t.name);
  check(!rooms.includes("search"), "and the rooms have no bare `search` for it to have collided with");
  const both = new Set([...rooms, ...specs.map((s) => s.name)]);
  check(both.size === rooms.length + specs.length, "so nothing in the combined list shadows anything else",
    `${both.size} of ${rooms.length + specs.length}`);
  /* Two services with the same name would collide with each other, which is
     the same fault one level up. */
  check(toolNameFor(conn("My Notes", ["read"]), "read") === "my_notes__read", "a name with a space still makes one word", toolNameFor(conn("My Notes", ["read"]), "read"));
  check(slug("!!!") === "connector", "and a name made only of punctuation still makes a name", slug("!!!"));
}

console.log("\nA tool belongs to exactly one service, and only while it is on");
{
  const gmail = conn("Gmail", ["search"]);
  const drive = conn("Drive", ["search"]);
  const owner = ownerOf("drive__search", [gmail, drive]);
  check(owner?.conn.name === "Drive" && owner.tool === "search", "the prefix picks the right one out", `${owner?.conn.name}/${owner?.tool}`);
  check(ownerOf("gmail__search", [gmail, drive])?.conn.name === "Gmail", "and the other one out");
  check(ownerOf("save_cards", [gmail, drive]) === null, "a room tool belongs to no service");
  check(ownerOf("nobody__at_all", [gmail, drive]) === null, "and a name nobody owns is owned by nobody");
  /* Switched off means not offered — but still recognised, so a call that
     arrives anyway is answered with why rather than with "no such tool". */
  const off = conn("Gmail", ["search"], false);
  check(connectorSpecs([off]).length === 0, "a service that is off offers nothing");
  check(ownerOf("gmail__search", [off])?.conn.name === "Gmail", "and is still recognised, so it can say it is off");
}

console.log("\nThe proxy refuses what it must");
{
  /* Mirrors the guard in app/api/mcp/route.ts. A change to one without the
     other is the kind of drift this whole file exists to stop. */
  const PRIVATE = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|::1$|\[::1\]$|172\.(1[6-9]|2[0-9]|3[01])\.|.*\.local$|.*\.internal$)/i;
  for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.1", "db.internal", "printer.local"]) {
    check(PRIVATE.test(host), `${host} is refused`, host);
  }
  /* 169.254.169.254 is the one that matters most: it is where a cloud
     machine keeps its own credentials. */
  check(PRIVATE.test("169.254.169.254"), "including the address a cloud host keeps its own credentials on");
  for (const host of ["example.com", "mcp.notion.so", "api.githubcopilot.com"]) {
    check(!PRIVATE.test(host), `${host} is allowed through`, host);
  }
}

console.log("\nThe wire, both ways a server may answer it");
{
  /* MCP servers reply either as plain JSON or as a single event-stream
     frame, depending on what they were built with, and a client that reads
     only one of the two works against half of them. No network: `fetch` is
     replaced and the proxy's own shape is what the stub returns. */
  const real = globalThis.fetch;
  let sent: Record<string, any>[] = [];
  const stub = (result: (m: string) => unknown) => {
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.rpc.id, result: result(body.rpc.method) }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  };
  try {
    sent = [];
    stub((m) =>
      m === "initialize"
        ? { serverInfo: { name: "Bookshelf" } }
        : { tools: [{ name: "find_book", description: "Find a book", inputSchema: { type: "object", properties: { title: { type: "string" } } } }] });
    const { connect: doConnect, callTool: doCall } = await import("./lib/mcp");
    const hello = await doConnect({ url: "https://example.com/mcp", token: "t" });
    check(hello.name === "Bookshelf", "the server's own name is what the connector is called", hello.name);
    check(hello.tools.length === 1 && hello.tools[0].name === "find_book", "and its tools come back named", hello.tools[0]?.name);
    check(hello.tools[0].schema !== undefined && (hello.tools[0].schema as Record<string, unknown>).type === "object",
      "with the schema the model needs to call them");
    check(sent.length === 2 && sent[0].rpc.method === "initialize" && sent[1].rpc.method === "tools/list",
      "asked in the order the protocol wants", sent.map((x) => x.rpc.method).join(" then "));
    check(sent[0].token === "t" && sent[0].url === "https://example.com/mcp",
      "and the address and token ride with the call rather than being kept anywhere");

    /* A call, and the text out of the content blocks. */
    stub(() => ({ content: [{ type: "text", text: "Found it: shelf 3" }] }));
    const said = await doCall(
      { id: "c", name: "Bookshelf", url: "https://example.com/mcp", enabled: true, tools: [], addedAt: 0 },
      "find_book", { title: "Dune" });
    check(said === "Found it: shelf 3", "a tool's answer comes back as text", said);

    /* A block that is not text is named rather than dropped: an answer
       written from this must not silently omit that something came back. */
    stub(() => ({ content: [{ type: "image", data: "…" }] }));
    const pic = await doCall(
      { id: "c", name: "B", url: "https://example.com/mcp", enabled: true, tools: [], addedAt: 0 }, "shot", {});
    check(/image returned/.test(pic), "and something that is not text says so rather than vanishing", pic);

    /* A tool that reports a failure raises, so the room says why. */
    stub(() => ({ isError: true, content: [{ type: "text", text: "that token is expired" }] }));
    let raised = "";
    await doCall({ id: "c", name: "B", url: "https://example.com/mcp", enabled: true, tools: [], addedAt: 0 }, "x", {})
      .catch((e) => { raised = e instanceof Error ? e.message : String(e); });
    check(raised === "that token is expired", "a refusal keeps the server's own words", raised);
  } finally {
    globalThis.fetch = real;
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
