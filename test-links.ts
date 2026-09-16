/* Pages that point at each other, and what a page says about itself.
 *
 *   npx jiti test-links.ts */
import { linksIn, resolveTitle, withLinks, readLink, backlinksTo, outlineOf, wordCount, readingTime, tagsIn, tagCounts } from "./lib/links";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const pages = [
  { id: "a", title: "Krebs cycle", content: "Feeds the [[Electron transport chain]]. See also [[glycolysis|the glycolysis page]]." },
  { id: "b", title: "Electron transport chain", content: "Takes what the [[Krebs Cycle]] hands it." },
  { id: "c", title: "Glycolysis", content: "No links here." },
];

console.log("\nA link is a title in double brackets");
{
  const links = linksIn(pages[0].content);
  check(links.length === 2, "two links found", String(links.length));
  check(links[0].title === "Electron transport chain" && links[0].shown === "Electron transport chain", "the title is what is shown by default");
  check(links[1].title === "glycolysis" && links[1].shown === "the glycolysis page", "and a bar gives it other words to show");
  check(linksIn("[[A]] and [[a]] and [[ A ]]").length === 1, "the same title in three spellings is one link");
  check(linksIn("nothing [here] or [[]] or [[ ]]").length === 0, "and empty brackets are not links");
}

console.log("\nResolved by title, without regard to case");
{
  check(resolveTitle("krebs CYCLE", pages)?.id === "a", "found in any case");
  check(resolveTitle("Photosynthesis", pages) === null, "and a page that does not exist is null, not a guess");
}

console.log("\nRewritten into anchors the renderer already draws");
{
  const md = withLinks(pages[0].content, pages);
  check(/\[Electron transport chain\]\(#armi-note-b\)/.test(md), "a page that exists points at its id", md);
  check(/\[the glycolysis page\]\(#armi-note-c\)/.test(md), "with the shown words kept");
  const fresh = withLinks("See [[Photosynthesis]]", pages);
  check(/\(#armi-new-Photosynthesis\)/.test(fresh), "and a page that does not exist yet is a link to make it", fresh);
  const code = withLinks("`[[not a link]]` and\n```\n[[nor this]]\n```\nbut [[Glycolysis]]", pages);
  check(!/armi-note-.*not a link|armi-new-nor/.test(code) && /armi-note-c/.test(code),
    "brackets inside code are left alone", code.replace(/\n/g, "⏎"));
  check(readLink("#armi-note-b")?.kind === "note", "an anchor reads back as a page");
  const n = readLink("#armi-new-Photosynthesis");
  check(n?.kind === "new" && n.title === "Photosynthesis", "or as a page to make, with its title");
  check(readLink("#armi-cite-3") === null && readLink("https://x") === null, "and anything else is not one of ours");
}

console.log("\nThe other direction");
{
  const back = backlinksTo(pages[0], pages);
  check(back.length === 1 && back[0].id === "b", "the Krebs page is named by the chain page, in its own spelling", back.map((p) => p.title).join(", "));
  check(backlinksTo(pages[2], pages).length === 1, "and glycolysis is named once, through the bar form");
  check(backlinksTo(pages[1], pages).length === 1 && backlinksTo(pages[1], pages)[0].id === "a", "a page never lists itself");
}

console.log("\nWhere a long page can be stood on");
{
  const md = "# Title\n\nprose\n\n## First\n\n```\n# not a heading\n```\n\n### Deeper ###\n\n## Second **bold**";
  const o = outlineOf(md);
  check(o.length === 4, "four headings, none from inside the fence", o.map((h) => h.text).join(" / "));
  check(o[0].level === 1 && o[1].level === 2 && o[2].level === 3, "with their depths");
  check(o[2].text === "Deeper" && o[3].text === "Second bold", "closing hashes and emphasis marks stripped");
  check(o.map((h) => h.index).join("") === "0123", "numbered in order, for scrolling to");
}

console.log("\nHow long it is");
{
  check(wordCount("  one two\nthree  ") === 3 && wordCount("") === 0, "words, as a person counts them");
  check(readingTime("word ".repeat(1000)) === "5 min read", "two hundred words a minute", readingTime("word ".repeat(1000)));
  check(readingTime("a few words") === "1 min read", "and never zero for a page with anything on it");
  check(readingTime("") === "", "but nothing at all for an empty one");
}

console.log("\nA word with a hash in front of it");
{
  const md = "# Heading\n\nNotes on #biology and #cell-respiration, see issue #12 and `#not-a-tag`.\n\n```\n#nor-this\n```\n\n#Biology again, and a/b#c is not one.";
  const tags = tagsIn(md);
  check(tags.join(",") === "biology,cell-respiration", "tags are found, lowercased, once each", tags.join(","));
  check(!tags.includes("12") && !tags.includes("not-a-tag") && !tags.includes("nor-this") && !tags.includes("c"),
    "and a number, a code span, a fence, a heading and an anchor are not tags");
  check(tagsIn("#a #b").length === 0, "nor is a single letter — a tag is a word");
  check(tagsIn("See [the cell](#cell-structure) and [intro](#intro).").length === 0, "nor an in-page link's anchor");
  const counts = tagCounts([{ content: "#maths #bio" }, { content: "#bio" }, { content: "#Bio #chem" }]);
  check(counts[0].tag === "bio" && counts[0].n === 3 && counts.length === 3, "counted across pages, most used first", counts.map((c) => `${c.tag}:${c.n}`).join(" "));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
