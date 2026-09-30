/**
 * Which part of a long book: its outline found in its own headings, with
 * pages; a topic matched to the parts about it; the parts given in order
 * and said to be parts; a question answered from the passages about it.
 *
 *   npx jiti test-scope.ts
 */
import { outlineOf, matchTopic, pick, chosenLabel, forQuestion, pageCount, pagesLabel, LONG } from "./lib/scope";
import { chaptersOf } from "./lib/pdf";

let failed = 0;
await (async () => {})();
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const filler = (topic: string, n: number) => Array.from({ length: n }, (_, i) => `This paragraph ${i} is about ${topic}. ${topic} matters in biology for many reasons explained here at length, with examples and detail.`).join("\n\n");
let page = 0;
const pages = (body: string, per = 2_500) => {
  const out: string[] = [];
  for (let i = 0; i < body.length; i += per) out.push(`--- page ${++page} ---\n${body.slice(i, i + per)}`);
  return out.join("\n");
};
const book = [
  pages(`Contents\nChapter 1 Cells 3\nChapter 2 Enzymes 20\nChapter 3 Photosynthesis 41\n\nPreface\n\n${filler("studying", 6)}`),
  pages(`Chapter 1 Cells\n\n${filler("cell membranes and organelles", 420)}`),
  pages(`Chapter 2 Enzymes\n\n${filler("enzymes and activation energy", 420)}`),
  pages(`Chapter 3 Photosynthesis\n\n${filler("chlorophyll and light-dependent reactions", 420)}\n\nThe Calvin cycle fixes carbon dioxide into glucose using ATP and NADPH.`),
].join("\n");

console.log("\nThe outline, from the book's own headings");
{
  const o = outlineOf(book);
  const titles = o.map((s) => s.title);
  check(book.length > LONG, "a long book", `${book.length} characters`);
  check(titles.filter((t) => /^Chapter/.test(t)).length === 3 && titles.includes("Chapter 3 Photosynthesis"), "its three chapters", titles.join(" | "));
  check(!titles.some((t) => /Cells 3$/.test(t)), "the contents page is not taken for chapters");
  const ch3 = o.find((s) => s.title === "Chapter 3 Photosynthesis")!;
  check(ch3.from !== undefined && ch3.to === pageCount(book) && /^pp\. \d+–\d+$/.test(pagesLabel(ch3)), "each with its pages", pagesLabel(ch3));
  check(o.every((s, i) => i === 0 || s.start === o[i - 1].end) && o[o.length - 1].end === book.length, "the parts cover the book with no gaps");
}

console.log("\nA topic, matched to its part");
{
  const o = outlineOf(book);
  const m = matchTopic(book, o, "Calvin cycle glucose");
  check(m[0]?.title === "Chapter 3 Photosynthesis", "the chapter about it comes first", m.map((s) => s.title).join(", "));
  check(matchTopic(book, o, "enzymes")[0]?.title === "Chapter 2 Enzymes", "by its title too");
  check(matchTopic(book, o, "volcanoes").length === 0, "a topic the book does not cover matches nothing");
}

console.log("\nThe chosen parts, and only those");
{
  const o = outlineOf(book);
  const ch1 = o.find((s) => s.title === "Chapter 1 Cells")!;
  const ch3 = o.find((s) => s.title === "Chapter 3 Photosynthesis")!;
  const got = pick(book, [ch3, ch1], "bio.pdf", pageCount(book));
  check(got.startsWith("[Only part of bio.pdf of ") && got.indexOf("organelles") < got.indexOf("chlorophyll") && !got.includes("activation energy"), "in book order, said to be a part, the rest left out");
  const one = pick(book, [ch3], "bio.pdf");
  check(one.length < book.length / 2, "and one chapter is a fraction of the book", `${one.length} of ${book.length}`);
  check(chosenLabel([ch3]).startsWith("Chapter 3 Photosynthesis · pp.") && /^2 parts/.test(chosenLabel([ch1, ch3])), "a label for the chip", chosenLabel([ch3]));
}

console.log("\nA book with no headings, and one in Russian");
{
  const plain = pages(filler("history", 800));
  const o = outlineOf(plain);
  check(o.length >= 2 && o.every((s) => /^Pages \d+–\d+$/.test(s.title)), "no headings: even parts named by their pages", o.slice(0, 2).map((s) => s.title).join(", "));
  const ru = `Глава 1. Клетка\n\n${filler("клетка", 400)}\n\nГлава 2. Ферменты\n\n${filler("ферменты", 400)}`;
  check(outlineOf(ru).map((s) => s.title).join(" | ") === "Глава 1. Клетка | Глава 2. Ферменты", "Russian chapters are chapters", outlineOf(ru).map((s) => s.title).join(" | "));
}

console.log("\nA PDF's own bookmarks");
{
  let pg = 0;
  const bm = ["Cell biology", "Organisation", "Infection and response"].map((t) => Array.from({ length: 12 }, (_, i) => `--- page ${++pg} ---\n${i === 0 ? `--- chapter: ${t} ---\n` : ""}${filler(t.toLowerCase(), 12)}`).join("\n")).join("\n");
  const o = outlineOf(bm);
  check(o.map((s) => s.title).join(" | ") === "Cell biology | Organisation | Infection and response", "chapters from the bookmarks, where the pages have no headings", o.map((s) => s.title).join(" | "));
  check(pagesLabel(o[1]) === "pp. 13–24", "each starting on its bookmarked page", pagesLabel(o[1]));
}
{
  /* A fake document: one book entry with the chapters under it, one named and one direct destination. */
  const doc = {
    getOutline: async () => [{ title: "AQA Biology", dest: null, items: [{ title: "1  Cell biology", dest: "c1" }, { title: "2 Organisation", dest: [{ num: 40 }] }] }],
    getDestination: async (id: string) => (id === "c1" ? [{ num: 4 }] : null),
    getPageIndex: async (ref: { num: number }) => ref.num,
  };
  const at = await chaptersOf(doc);
  check(at.get(5)?.[0] === "1 Cell biology" && at.get(41)?.[0] === "2 Organisation", "read one level down when the outline is one book with chapters under it", JSON.stringify([...at]));
  const none = await chaptersOf({ getOutline: async () => null });
  check(none.size === 0, "and a PDF with no outline has none, without failing");
}

console.log("\nA question answered from the passages about it");
{
  const got = forQuestion(book, "bio.pdf", "How does the Calvin cycle make glucose?", 20_000);
  check(got.includes("Calvin cycle fixes carbon dioxide") && got.length <= 21_000, "the passage that answers it, within the budget", `${got.length} characters`);
  check(/\[page \d+\]/.test(got) && got.startsWith("[The passages of bio.pdf"), "marked with its page, and said to be passages");
  check(!got.includes("--- page"), "without the raw page markers");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
