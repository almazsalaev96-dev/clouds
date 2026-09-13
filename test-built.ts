/* When an answer is a thing rather than an answer about one.
 *
 * The model is told to reply with one complete HTML document when someone asks
 * for a timer, because this app can run one. What it must not do is lift every
 * fence that happens to contain markup: somebody asking what a meta tag looks
 * like wants to read it in the transcript, where they can point at a line.
 *
 *   npx jiti test-built.ts */
import { builtDocument, building, titleOf, withoutBuild } from "./lib/built";

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

console.log("\nThe shapes a model actually answers in");
{
  const frag = '<style>\n.card { padding: 1rem }\n.card.on { background: red }\n</style>\n<main>\n  <h1>Deck</h1>\n  <div class="card" id="c">front</div>\n  <button id="flip">Flip</button>\n</main>\n<script>\n  document.getElementById("flip").onclick = () => document.getElementById("c").classList.toggle("on");\n</script>';
  const lifted = builtDocument(fence(frag));
  check(lifted !== null && /^<!doctype html>/i.test(lifted) && lifted.includes('id="flip"'), "a fragment with its own style and script is a page in all but its wrapper, and is wrapped");
  check(builtDocument("```html title=\"index.html\"\n" + DOC + "\n```") !== null, "a fence with a title on it still counts");
  const split = "Three parts.\n\n```html\n<main>\n  <h1>Timer</h1>\n  <output id=\"t\">02:00</output>\n  <button id=\"go\">Start</button>\n</main>\n```\n\n```css\nmain { text-align: center }\n```\n\n```js\ndocument.getElementById(\"go\").onclick = () => {};\n```";
  const folded = builtDocument(split);
  check(folded !== null && folded.includes("<style>") && folded.includes("text-align: center") && folded.includes("<script>") && folded.includes("onclick"), "html, css and js in fences of their own are folded into one document");
  const linked = "```html\n<!doctype html>\n<html><head><link rel=\"stylesheet\" href=\"style.css\"></head><body><p>x</p><script src=\"app.js\"></script></body></html>\n```\n```css\np { color: red }\n```\n```js\nconsole.log(1)\n```";
  const inl = builtDocument(linked) ?? "";
  check(!/<link/.test(inl) && inl.includes("color: red") && !/src=/.test(inl) && inl.includes("console.log(1)"), "and a document that links to files it does not have gets them inlined");
  check(builtDocument("```html\n<button>Go</button>\n```\n\nThat is a button.") === null, "one short line of markup with nothing beside it is still an example");
  check(withoutBuild(fence(DOC)) === "Here you go.\n\nTweak the list at the top.", "what is left without the build is the sentence around it", JSON.stringify(withoutBuild(fence(DOC))));
  check(withoutBuild("Just words.") === "Just words.", "an answer with nothing built is returned whole");
}

console.log("\nWhile it is still arriving");
{
  check(building("Here you go.\n\n```html\n<!doctype html>\n<html>\n<head><title>Deck</title>") ?.title === "Deck", "an open html fence with a doctype in it is a build, named from its title as soon as there is one");
  check(building("Here you go.\n\n```html\n")?.title === "Something", "and before anything has arrived inside it, a build with no name yet");
  check(building("Here you go.\n\n```html\n<!doctype html>")?.before === "Here you go.\n\n", "the sentence before it is kept for the reader");
  check(building("A meta tag looks like this:\n\n```html\n<meta name=\"viewport\" content=\"width=device-width\">") === null, "an example opening on a meta tag streams as code");
  check(building("Words only, no fence.") === null, "and prose is prose");
  check(building(fence(DOC)) !== null, "once the fence has closed the whole answer decides, and a document is still a build");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
