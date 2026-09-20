/* The matched line is the row.
 *
 * A search result that does not contain what you typed reads as a bug, every
 * time, however good the ranking underneath it is. These are the cases where
 * that happens: a hit deep inside a paragraph, a hit on a line of its own, a
 * message whose text is buried in blocks beside a picture.
 *
 *   npx jiti test-find.ts */
import { bestHit, matchLine, textOf } from "./lib/find";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe line shown is a line the query is actually in");
{
  const deep = "x".repeat(400) + " the mitochondrion is the powerhouse " + "y".repeat(400);
  const h = matchLine(deep, "mitochondrion")!;
  check(Boolean(h), "a hit four hundred characters in is found");
  check(h.line.includes("mitochondrion"),
    "and the line handed back contains it, rather than the paragraph's opening",
    h.line.slice(0, 60));
  check(h.line.startsWith("…") && h.line.endsWith("…"),
    "with the cut marked at both ends", h.line.slice(0, 12) + " … " + h.line.slice(-12));
  check(h.line.length < 140, "and short enough for a row", String(h.line.length));
  check(h.line.slice(h.at, h.at + h.length).toLowerCase() === "mitochondrion",
    "the offset points at the match, so it can be marked",
    JSON.stringify(h.line.slice(h.at, h.at + h.length)));
}

console.log("\nA line break is a better edge than a character count");
{
  const doc = "First heading\nthe krebs cycle happens in the matrix\nSomething else entirely";
  const h = matchLine(doc, "krebs")!;
  check(h.line === "the krebs cycle happens in the matrix",
    "the whole line, and nothing from the lines either side", JSON.stringify(h.line));
  check(!h.line.includes("…"), "and no ellipsis, because nothing was cut");
  check(h.line.slice(h.at, h.at + h.length) === "krebs", "offset still points at the match");
}

console.log("\nAnd it refuses to match on nothing");
{
  check(matchLine("anything at all", "a") === null,
    "one letter is in every document, so it ranks by nothing and is refused");
  check(matchLine("", "abc") === null, "empty text has no line");
  check(matchLine("abc", "zzz") === null, "and a miss is a miss");
  check(matchLine("The Krebs cycle", "krebs") !== null, "case is not a miss");
}

console.log("\nEarlier is worth more, but a late hit still counts");
{
  const early = matchLine("krebs is first here", "krebs")!;
  const late = matchLine("z".repeat(600) + " krebs", "krebs")!;
  check(early.score > late.score, "what a thing opens with ranks above what it mentions in passing",
    `${early.score} vs ${late.score}`);
  check(late.score > 0, "and a late hit is still worth more than no hit", String(late.score));
}

console.log("\nA message is blocks, not a string");
{
  const content = [
    { type: "image", source: "…" },
    { type: "text", text: "the answer is osmosis" },
  ] as { type: string; text?: string }[];
  check(textOf(content) === "the answer is osmosis", "only the text blocks come out", JSON.stringify(textOf(content)));
  /* The thing this prevents: stringifying the blocks would match "image" in
     every message that carried a picture. */
  check(matchLine(textOf(content), "image") === null,
    "so a search for “image” does not hit every message with a picture in it");
  check(textOf(undefined) === "" && textOf([] as never) === "", "and nothing in is nothing out");
}

console.log("\nThe best of several fields wins, without the caller knowing which");
{
  const h = bestHit(["a title with no hit", "a body mentioning osmosis late on"], "osmosis")!;
  check(h.line.includes("osmosis"), "the field that matched is the one shown", h.line);
  const front = bestHit(["What is osmosis?", "water moving across a membrane"], "osmosis")!;
  const back = bestHit(["What is diffusion?", "osmosis is the water one"], "osmosis")!;
  check(front.score > back.score, "and an earlier match outranks a later one across fields",
    `${front.score} vs ${back.score}`);
  check(bestHit([undefined, ""], "osmosis") === null, "nothing to search is no hit");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
