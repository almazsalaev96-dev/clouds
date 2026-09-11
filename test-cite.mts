/* The matcher, checked on its own before any of it is wired to a screen.
   The interesting cases are the ones a PDF actually produces. */
import { extractCitations, citeScore, findIn, normalise } from "./lib/cite.ts";

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
  /* A PDF read by this app keeps its page boundaries, so the page is a lookup
     rather than a guess. Page 3 here is deliberately short and page 4 long:
     even division would put the quote on neither. */
  const body = [
    "--- page 1 ---\n" + "a ".repeat(2000),
    "--- page 2 ---\n" + "b ".repeat(2000),
    "--- page 3 ---\nthe decisive passage is here",
    "--- page 4 ---\n" + "c ".repeat(6000),
  ].join("\n\n");
  const out = extractCitations('X [[cite: book.pdf | the decisive passage is here]].', [src(body, { pages: 4 })]);
  check(out.citations[0].at?.page === 3, "which page, exactly, from the markers the extractor left", String(out.citations[0].at?.page));
  const at = out.citations[0].at!;
  check(body.slice(at.start, at.end).trim() === "the decisive passage is here",
    "and offsets that index the real text, not the normalised one",
    JSON.stringify(body.slice(at.start, at.end)));
}
{
  /* The truncation case. `extractPdf` stops at 400k characters, so a 900-page
     book arrives as its first 300 pages with `pages: 900` on the row. Even
     division sent every citation in it to somewhere near the back. */
  const body = "--- page 1 ---\nthe opening argument is set out here\n\n--- page 2 ---\nmore";
  const out = extractCitations('X [[cite: book.pdf | the opening argument is set out here]].', [src(body, { pages: 900 })]);
  check(out.citations[0].at?.page === 1,
    "and a book cut short at extraction still says the page it really is on, not the page the ratio implies",
    String(out.citations[0].at?.page));
}
{
  const out = extractCitations('X [[cite: notes.txt | the opening argument is set out here]].',
    [src("the opening argument is set out here", { name: "notes.txt", pages: undefined })]);
  check(out.citations[0].found && out.citations[0].at?.page === undefined,
    "something with no page boundaries in it gets no page number rather than an invented one");
}

console.log("\nThe three outcomes, kept apart");
{
  const t = src("the quick brown fox jumps over the lazy dog");
  const missing = extractCitations('X [[cite: book.pdf | the slow purple cat sleeps under the warm sun]].', [t]);
  check(missing.citations[0].why === "missing", "words that are not there are missing", missing.citations[0].why);
  const short = extractCitations('X [[cite: book.pdf | the fox]].', [t]);
  check(short.citations[0].why === "short",
    "a quote too short to be evidence was not checked, which is not the same as not found",
    short.citations[0].why);
  const unnamed = extractCitations('X [[cite: other.pdf | the quick brown fox jumps over]].',
    [t, src("x", { id: "s2", name: "second.pdf" })]);
  check(unnamed.citations[0].why === "unnamed",
    "and a file this page does not hold was never looked in", unnamed.citations[0].why);
  const score = citeScore([...missing.citations, ...short.citations, ...unnamed.citations]);
  check(score.missing === 1 && score.unchecked === 2,
    "counted apart, because they call for different sentences", `${score.missing} missing, ${score.unchecked} unchecked`);
}

console.log("\nThe ways a near-match goes wrong");
{
  const a = src("the twenty-three findings are set out below", { id: "a", name: "notes-2023.pdf" });
  const b = src("the twenty-four findings are set out below", { id: "b", name: "notes-2024.pdf" });
  const out = extractCitations('X [[cite: notes | the twenty-three findings are set out below]].', [a, b]);
  check(!out.citations[0].found && out.citations[0].why === "unnamed",
    "a name matching two files names neither — the old code took the first and checked against the wrong book",
    `${out.citations[0].sourceName} / ${out.citations[0].why}`);
  const one = extractCitations('X [[cite: notes-2023 | the twenty-three findings are set out below]].', [a, b]);
  check(one.citations[0].sourceId === "a", "but a name matching exactly one is a name", one.citations[0].sourceId);
  const long = extractCitations('X [[cite: chapter 3 of notes-2024.pdf | the twenty-four findings are set out below]].', [a, b]);
  check(long.citations[0].sourceId === "b", "and so is a filename inside a phrase", long.citations[0].sourceId);
  const empty = extractCitations('X [[cite: | the twenty-three findings are set out below]].', [a, b]);
  check(empty.citations[0].sourceName === "unknown",
    "an empty name renders as unknown rather than as nothing at all", JSON.stringify(empty.citations[0].sourceName));
}

console.log("\nThe same rules on both sides");
{
  /* The desync that reported verbatim quotes fabricated: the quote was folded
     by one set of rules and the source by another. */
  const dash = src("profits — and losses — were higher than anyone expected that year");
  const out = extractCitations('X [[cite: book.pdf | profits -- and losses -- were higher than anyone expected that year]].', [dash]);
  check(out.citations[0].found, "a spaced dash is punctuation on both sides, not a deleted character");
  /* An accent written two ways is one accent. A PDF extractor and a model
     disagree about this constantly, and a citation failing over it is a
     fabrication warning about a quote lifted verbatim. */
  const nfc = "the café opened in the résumé district that spring";
  const composed = extractCitations(`X [[cite: book.pdf | ${nfc.normalize("NFD")}]].`, [src(nfc)]);
  check(composed.citations[0].found, "a composed accent matches a decomposed one");
  const decomposed = extractCitations(`X [[cite: book.pdf | ${nfc}]].`, [src(nfc.normalize("NFD"))]);
  const at2 = decomposed.citations[0].at!;
  check(decomposed.citations[0].found && nfc.normalize("NFD").slice(at2.start, at2.end).normalize("NFC") === nfc,
    "and the other way round, with offsets that still point at the words");
  const turkish = src("İSTANBUL grew fast. the decisive passage is here, at the end.");
  const t2 = extractCitations('X [[cite: book.pdf | the decisive passage is here]].', [turkish]);
  const at = t2.citations[0].at!;
  check(t2.citations[0].found && turkish.text.slice(at.start, at.end) === "the decisive passage is here",
    "and a capital İ — two characters when lowercased — does not slide every offset after it",
    JSON.stringify(turkish.text.slice(at.start, at.end)));
}
{
  /* Bullets. A markdown source is a source, and "- " at the start of a line is
     the most common hyphen there is. The old loop deleted it along with the
     newline after it, which did two things at once: it made every quote that
     kept its bullet unfindable, and it welded consecutive list items into one
     run of text, so a "quote" spanning two separate bullets verified as
     contiguous and got a green marker. */
  const list = src("Key findings:\n- Revenue grew twenty-seven percent.\n- Churn fell to three percent.");
  const kept = extractCitations('X [[cite: book.pdf | - Revenue grew twenty-seven percent.]].', [list]);
  check(kept.citations[0].found, "a quote that keeps its bullet is still a quote");
  const across = extractCitations('X [[cite: book.pdf | Revenue grew twenty-seven percent. Churn fell to three percent.]].', [list]);
  check(!across.citations[0].found,
    "and two separate list items are not one quotation, however close together they are printed");
  const spaced = src("The result - a record for the decade - was confirmed by three teams.");
  const out = extractCitations('X [[cite: book.pdf | The result - a record for the decade - was confirmed]].', [spaced]);
  check(out.citations[0].found, "a dash with spaces around it survives on both sides");
  const intraline = src("nobody could under- stand the result at the time");
  const it = extractCitations('X [[cite: book.pdf | nobody could under- stand the result at the time]].', [intraline]);
  check(it.citations[0].found, "and a hyphen mid-line is punctuation, joined by neither side");
}
{
  const code = src('the config reads arr[[0]] = true and nothing else matters here');
  const out = extractCitations('X [[cite: book.pdf | the config reads arr[[0]] = true and nothing else matters here]].', [code]);
  check(out.citations[0].found,
    "a quote with ]] inside it is not truncated at the first one it happens to contain",
    out.citations[0].quote);
  check(!out.text.includes("]]"), "and nothing of the body leaks onto the page", out.text);
}
{
  const t = src("the quick brown fox jumps over the lazy dog");
  const raw = 'A [[cite: book.pdf | the quick brown fox jumps over B';
  const out = extractCitations(raw, [t]);
  check(out.text === raw && out.citations.length === 0,
    "a citation nobody closed is left on the page as written rather than swallowing the rest of it", out.text);
  const two = extractCitations(
    'A [[cite: book.pdf | the quick brown fox jumps]] B [[cite: book.pdf | over the lazy dog]] C', [t]);
  check(two.text === "A [1](#armi-cite-1) B [2](#armi-cite-2) C",
    "and two citations in a row do not run into each other", two.text);
}

console.log("\nHighlighting what was matched");
{
  const context = "…he wrote that the market grew\n  by twenty-seven percent, and left it there…";
  const hit = findIn(context, "The market grew by twenty-seven percent")!;
  check(context.slice(hit.start, hit.end) === "the market grew\n  by twenty-seven percent",
    "the highlight covers the words that matched, whatever whitespace is between them",
    JSON.stringify(context.slice(hit.start, hit.end)));
  check(findIn(context, "the market shrank") === null, "and nothing is marked when nothing matched");
  check(normalise("Under-\nstand  “this”") === 'understand "this"', "folding is one function", normalise("Under-\nstand  “this”"));
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
