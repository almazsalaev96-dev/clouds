/**
 * The document engine, without a browser: what it refuses to let through,
 * and how it sets a worksheet.
 */
import { docHtml } from "./lib/document";
import { markdownToPrintHtml } from "./lib/print";
import { RETIRED, RULES, rulesCount, rulesText } from "./lib/rules";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nNothing in a title or a body becomes a script");
{
  const evil = docHtml({ title: "</style><script>alert(1)</script>", markdown: "Hello <script>alert(2)</script> [x](javascript:alert(3))" });
  check(!/<script>alert/.test(evil), "no script from the title or the body", (evil.match(/<script[^>]*>[^<]{0,20}/g) ?? []).join(" "));
  check(!/href="javascript:/i.test(evil), "and no javascript: link");
  check((evil.match(/<\/style>/g) ?? []).length === 1, "the stylesheet ends once, where it should");
}

console.log("\nA worksheet keeps its numbers and its writing space");
{
  const ws = docHtml({ title: "Fractions", kind: "worksheet", markdown: "1. What is 1/2 + 1/4?\n[lines:3]\n2. Simplify 6/8.\n[lines:2]\n3. Explain why 2/3 > 3/5. ______" });
  check(/<ol start="2">/.test(ws) && /<ol start="3">/.test(ws), "question 2 is 2, not 1 again");
  check(!/<p><div class="lines"/.test(ws) && (ws.match(/<div class="lines" style="--n:\d+"><\/div>/g) ?? []).length === 2, "writing space is a block of its own");
  check(/class="blank"/.test(ws), "and a blank to fill in");
}

console.log("\nPlain notes stay plain");
{
  const html = markdownToPrintHtml("> [!note] Key idea\n> Water moves.\n\n> [!tip] One line only");
  check(/<strong class="callout-title">Key idea<\/strong>Water moves/.test(html), "a callout keeps its title");
  check(/<blockquote class="callout tip">One line only<\/blockquote>/.test(html), "a one-line callout is its text, not a title over nothing");
  const cert = docHtml({ title: "Notes", kind: "notes", markdown: "The SSL certificate expired. Dear reader, see the report." });
  check(!/class="cert"/.test(cert) && !/class="letterhead"/.test(cert) && !/class="cover"/.test(cert), "notes are notes, whatever words are in them");
}

console.log("\nA rule somebody had on does not vanish when it stops being offered");
{
  const text = rulesText(["ask-first", "british"], "");
  check(/ask one short clarifying question/.test(text) && /British English/.test(text), "a retired rule still in force, beside a current one");
  check(rulesCount(["ask-first"], "") === 1, "and counted");
  check(!RULES.some((r) => RETIRED.some((x) => x.id === r.id)), "but not offered to anyone new");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
