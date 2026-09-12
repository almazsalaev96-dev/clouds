/* When an answer is a thing rather than an answer about one.
 *
 * The model is told to reply with one complete HTML document when someone asks
 * for a timer, because this app can run one. What it must not do is lift every
 * fence that happens to contain markup: somebody asking what a meta tag looks
 * like wants to read it in the transcript, where they can point at a line.
 *
 *   npx jiti test-built.ts */
import { builtDocument, titleOf } from "./lib/built";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  \u2713" : "  \u2717"} ${l}${d ? " \u2014 " + d : ""}`); };
const fence = (body: string) => "Here you go.\n\n```html\n" + body + "\n```\n\nTweak the list at the top.";
const DOC = '<!doctype html>\n<html lang="en"><head><title>Kitchen timer</title></head><body><h1>Timer</h1></body></html>';

console.log("\nA whole document is a thing that runs");
{
  check(builtDocument(fence(DOC)) !== null, "a doctype document in a fence is lifted out");
  check(builtDocument(fence('<html><body><p>hi</p></body></html>')) !== null, "and one that opens on <html>");
  check((builtDocument(fence(DOC)) ?? "").startsWith("<!doctype"), "and it comes back whole, not with the fence on it");
}

console.log("\nA fragment is something to read where it is");
{
  check(builtDocument(fence('<meta name="viewport" content="width=device-width">')) === null,
    "a meta tag is an example, not an app");
  check(builtDocument(fence('<div class="card">\n  <p>hi</p>\n</div>')) === null, "and so is a snippet of markup");
  check(builtDocument("```css\nbody { margin: 0 }\n```") === null, "a stylesheet is not a document");
  check(builtDocument("```ts\nconst x = 1;\n```") === null, "and neither is code in another language");
  check(builtDocument("An <html> element is the root of a page.") === null,
    "and mentioning html in a sentence is not a fence at all");
  check(builtDocument(fence('<!doctype html>\n<html><body>unterminated')) === null,
    "a document that never closes is a truncated stream, not a thing to run");
}

console.log("\nIt is named by its author, not by its first line of markup");
{
  check(titleOf(DOC) === "Kitchen timer", "the document's own title wins", titleOf(DOC));
  check(titleOf('<html><body><h1>Reading log</h1></body></html>') === "Reading log", "then its first heading");
  check(titleOf("<html><body></body></html>", "Untitled") === "Untitled", "and otherwise the fallback");
  check(!titleOf(DOC).includes("doctype"), "never the doctype");
}

console.log("\nAnd nothing a stream can end on makes it throw");
{
  for (const t of ["", "```", "```html", "```html\n", "<!doctype html>", "a".repeat(60000), "\u4f60\u597d"]) {
    let ok = true;
    try { builtDocument(t); titleOf(t); } catch { ok = false; }
    check(ok, `survives ${JSON.stringify(t.slice(0, 14))}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
