/** A revision pack: three recipes that ask, a title scheme, and one file. */
import { CORNELL, EXAM, ORGANISER, PACK, packMarkdown, packOf, packSourceOf, packTitle, sourceName } from "./lib/revision";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe recipes ask rather than summarise");
{
  check(/Must know/.test(ORGANISER.instruction) && /Common mistakes/.test(ORGANISER.instruction) && /How it is asked/.test(ORGANISER.instruction), "the organiser ranks, names the mistakes and says how it is asked");
  check(/\[!mistake\]/.test(ORGANISER.instruction) && /\[!key\]/.test(ORGANISER.instruction), "with the callouts the renderer draws");
  check(/Cue \| Notes/.test(CORNELL.instruction) && /Summary:/.test(CORNELL.instruction), "Cornell notes carry a cue column and a summary line");
  check(/Do not write a cue whose answer is the sentence before it/.test(CORNELL.instruction), "and forbid the cue that tests recognition");
  check(/Recall/.test(EXAM.instruction) && /Apply/.test(EXAM.instruction) && /Evaluate/.test(EXAM.instruction), "exam questions come in three tiers");
  check(/Mark scheme/.test(EXAM.instruction) && /Model answer/.test(EXAM.instruction) && /Where marks are lost/.test(EXAM.instruction), "each with a scheme, a model answer and the mistake");
  check(/evaluate \('however/.test(EXAM.instruction) || /evaluate \(/.test(EXAM.instruction), "and the command words carry their marking meaning", (EXAM.instruction.match(/evaluate \([^)]*\)/) ?? [""])[0]);
  for (const r of PACK) check(/Where the source is unclear, say so|where the source is unclear, say so/i.test(r.instruction), `${r.label}: honest about gaps in the source`);
  check(!PACK.some((r) => /Replace this page/.test(r.instruction)), "none of them replaces the page they are asked from — they are new pages");
}

console.log("\nTitles, and the pack they name");
{
  check(packTitle("Osmosis", ORGANISER) === "Osmosis — Knowledge organiser", "a page is named for its source and its recipe");
  check(packSourceOf("Osmosis — Cornell notes") === "Osmosis", "and the source is read back off the title");
  check(packSourceOf("Osmosis") === null && packSourceOf("Osmosis — Summary") === null, "a page that is not a pack page is not one");
  const pages = [
    { title: "Osmosis — Exam questions" }, { title: "Krebs — Knowledge organiser" }, { title: "Osmosis — Knowledge organiser" },
    { title: "Osmosis", }, { title: "Osmosis — Cornell notes" },
  ];
  const pack = packOf({ title: "Osmosis — Cornell notes" }, pages).map((p) => p.title);
  check(pack.join(" | ") === "Osmosis — Knowledge organiser | Osmosis — Cornell notes | Osmosis — Exam questions", "the pack is the three pages of one source, in reading order, and nothing else", pack.join(" | "));
  check(packOf({ title: "Osmosis" }, pages).length === 0, "a plain page has no pack");
  check(sourceName([{ name: "chapter_3-osmosis.pdf" }]) === "chapter 3 osmosis", "a file name becomes a source name", sourceName([{ name: "chapter_3-osmosis.pdf" }]));
  check(sourceName([]) === "Notes", "and no file is still a name");
}

console.log("\nOne file to download");
{
  const md = packMarkdown("Osmosis", [{ title: "Osmosis — Knowledge organiser", content: "## Must know\n- a" }, { title: "Osmosis — Exam questions", content: "### Q1" }]);
  check(md.startsWith("# Osmosis — revision pack"), "titled for the source");
  check(/Reading this again is the one thing that does not work/.test(md), "and says how to use it, because a pack read as a summary is a summary");
  check(md.indexOf("# Osmosis — Knowledge organiser") < md.indexOf("# Osmosis — Exam questions"), "pages in order");
  check(/## Must know\n- a/.test(md) && /### Q1/.test(md), "with their content whole");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
