/* The matcher, checked on its own before any of it is wired to a screen.
   The interesting cases are the ones a PDF actually produces. */
import { extractCitations, citeScore } from "./lib/cite.ts";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const src = (text: string, over: Record<string, unknown> = {}) => ({
  id: "s1", noteId: "n1", name: "book.pdf", text, size: text.length, addedAt: 0, ...over,
} as never);

console.log("\nFinding what was actually quoted");
{
  const text = "Chapter one.\n\nThe market grew by twenty-seven percent in the third quarter, which nobody had forecast.\n\nChapter two.";
  const out = extractCitations(
    'Growth was strong [[cite: book.pdf | The market grew by twenty-seven percent in the third quarter]].',
    [src(text)],
  );
  check(out.citations.length === 1, "the citation is taken out of the prose");
  check(out.citations[0].found, "and the quote is found in the source");
  check(/\[1\]\(#armi-cite-1\)/.test(out.text), "leaving a marker a reader can press", out.text.slice(-30));
  check(!out.text.includes("[[cite:"), "and nothing of the machinery on the page");
  check((out.citations[0].context ?? "").includes("nobody had forecast"),
    "with enough either side to read it as part of something");
}

console.log("\nThe noise a PDF makes is not a difference");
{
  const text = "the market grew  by\n  twenty-seven percent in the third\nquarter";
  const out = extractCitations('X [[cite: book.pdf | The market grew by twenty-seven percent in the third quarter]].', [src(text)]);
  check(out.citations[0].found, "line breaks and doubled spaces still match");
}
{
  const text = "It was, he said, an “unrepeatable” result — the best in a decade.";
  const out = extractCitations('X [[cite: book.pdf | it was, he said, an "unrepeatable" result -- the best in a decade]].', [src(text)]);
  check(out.citations[0].found, "curly quotes and dashes still match");
}
{
  const text = "nobody could under-\nstand the result at the time";
  const out = extractCitations('X [[cite: book.pdf | nobody could understand the result at the time]].', [src(text)]);
  check(out.citations[0].found, "a word hyphenated across a line break is one word");
}

console.log("\nBut the words themselves are");
{
  const text = "The market grew by twenty-seven percent in the third quarter.";
  const out = extractCitations('X [[cite: book.pdf | The market grew by forty percent in the third quarter]].', [src(text)]);
  check(!out.citations[0].found, "a number that was never there does not match");
  check(/\[1\?\]/.test(out.text), "and the marker says so rather than looking like the others", out.text.slice(-24));
}
{
  const out = extractCitations('X [[cite: book.pdf | it was good]].', [src("it was good")]);
  check(!out.citations[0].found, "a quote too short to be evidence is refused, not matched");
}

console.log("\nSaying where it is");
{
  const body = "a".repeat(4000) + " the decisive passage is here " + "b".repeat(4000);
  const out = extractCitations('X [[cite: book.pdf | the decisive passage is here]].', [src(body, { pages: 100 })]);
  check(out.citations[0].at?.page === 50, "roughly which page, when there are pages", String(out.citations[0].at?.page));
  const at = out.citations[0].at!;
  check(body.slice(at.start, at.end).trim() === "the decisive passage is here",
    "and offsets that index the real text, not the normalised one",
    JSON.stringify(body.slice(at.start, at.end)));
}

console.log("\nSeveral sources, and a model that names the wrong one");
{
  const a = src("alpha says the sky is blue on tuesdays", { id: "a", name: "a.pdf" });
  const b = src("beta says the sea is green on fridays", { id: "b", name: "b.pdf" });
  const out = extractCitations(
    'One [[cite: b.pdf | beta says the sea is green on fridays]] and two [[cite: a.pdf | alpha says the sky is blue on tuesdays]].',
    [a, b],
  );
  check(out.citations[0].sourceId === "b" && out.citations[1].sourceId === "a", "each goes to the source it named");
  const wrong = extractCitations('X [[cite: nonexistent.pdf | beta says the sea is green on fridays]].', [a, b]);
  check(!wrong.citations[0].found, "a source that does not exist is a failed citation, not a lucky guess");
  const only = extractCitations('X [[cite: | beta says the sea is green on fridays]].', [b]);
  check(only.citations[0].found, "but with one source, a missing name is not held against it");
}

console.log("\nCounting");
{
  const t = src("the quick brown fox jumps over the lazy dog");
  const out = extractCitations(
    'A [[cite: book.pdf | the quick brown fox jumps over]] B [[cite: book.pdf | the slow purple cat sleeps under]].',
    [t],
  );
  const score = citeScore(out.citations);
  check(score.found === 1 && score.total === 2, "how much of a page could actually be traced", `${score.found}/${score.total}`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
