/* Which web tool a model is offered, and when none is.
 *
 * Two shapes exist on the wire and the wrong one is a 400 that reads, to a
 * person, exactly like a bad key. The line between them is the same line
 * that decides how a model is asked to think, so that is what is read.
 *
 *   npx jiti test-tools.ts */
import { webTools, canSearch, URL_RE } from "./lib/providers/tools";
import { getModel, MODELS } from "./lib/models";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const types = (m: ReturnType<typeof getModel>, hasUrl = false) => webTools(m, ["web_search", "web_fetch"], { hasUrl }).map((t) => t.type);

console.log("\nThe 2026 variants go to the models that take effort; the basic ones to the rest");
{
  check(types(getModel("claude-opus-5")).join() === "web_search_20260209", "Opus 5 gets the filtered search", types(getModel("claude-opus-5")).join());
  check(types(getModel("claude-sonnet-5")).join() === "web_search_20260209", "and Sonnet 5");
  check(types(getModel("claude-haiku-4-5")).join() === "web_search_20250305", "Haiku 4.5 gets the basic one", types(getModel("claude-haiku-4-5")).join());
  const every = MODELS.filter((m) => m.provider === "anthropic").map((m) => [m.id, types(m)[0]] as const);
  check(every.every(([id, t]) => (getModel(id).thinks === "effort") === (t === "web_search_20260209")),
    "and across the whole registry the variant follows `thinks: effort` exactly",
    every.filter(([id, t]) => (getModel(id).thinks === "effort") !== (t === "web_search_20260209")).map(([id]) => id).join(", ") || "all agree");
}

console.log("\nFetch is offered only when there is something to fetch");
{
  check(types(getModel("claude-opus-5"), false).length === 1, "no URL in the conversation: search alone");
  check(types(getModel("claude-opus-5"), true).join() === "web_search_20260209,web_fetch_20260209", "a URL present: search and fetch", types(getModel("claude-opus-5"), true).join());
  check(types(getModel("claude-haiku-4-5"), true).join() === "web_search_20250305,web_fetch_20250910", "and the basic pair on an older model");
  const fetchOnly = webTools(getModel("claude-opus-5"), ["web_fetch"], { hasUrl: true });
  check(fetchOnly.length === 1 && fetchOnly[0].citations !== undefined, "fetch asks for citations, so a fetched page can be quoted");
}

console.log("\nOnly one company here searches");
{
  check(canSearch(getModel("claude-opus-5")), "the one that does");
  check(!canSearch(getModel("gpt-5.6-sol")) && !canSearch(getModel("kimi-k3")) && !canSearch(getModel("deepseek-v4-pro")), "and none of the others");
  check(webTools(getModel("gpt-5.6-sol"), ["web_search"], { hasUrl: true }).length === 0, "so a request to one of them carries no tools rather than a tool it would reject");
  check(webTools(getModel("claude-opus-5"), [], { hasUrl: true }).length === 0, "and nothing asked for is nothing offered");
}

console.log("\nA URL is recognised where it stands");
{
  check(URL_RE.test("see https://example.org/a?b=c for the rest"), "in prose");
  check(URL_RE.test("(https://example.org)") && !"https://example.org)".match(URL_RE)![0].endsWith(")"), "inside brackets, without swallowing the bracket");
  check(!URL_RE.test("example.org has it"), "but a bare domain is not a URL the tool can fetch");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
