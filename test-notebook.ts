/**
 * The Notebook's connections and comforts (lib/notebook.ts).
 *
 *   npx jiti test-notebook.ts
 */
import {
  appendFromChat, applyInsert, lastTranscript, mentionAt, pagesSection, relevantPages, slashAt,
  slashFilter, taskCount, titleMatches, toggleTask, transcriptHeading, wikiAt,
} from "./lib/notebook";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const pages = [
  { id: "a", title: "Osmosis", content: "Osmosis is the movement of water across a partially permeable membrane. Pure water has a water potential of zero kilopascals." },
  { id: "b", title: "History essay", content: "The causes of the First World War: militarism, alliances, imperialism and nationalism." },
  { id: "c", title: "Empty", content: "short" },
];

console.log("\nThe pages that bear on a question, and only those");
{
  const hits = relevantPages("what is the water potential of pure water", pages);
  check(hits.length === 1 && hits[0].id === "a", "the page about it is found", hits.map((h) => h.title).join(","));
  check(relevantPages("water", pages).length === 0, "one shared word is not enough");
  check(relevantPages("tell me about militarism and alliances before the war", pages)[0]?.id === "b", "a different question finds a different page");
  check(relevantPages("water potential osmosis", pages, { exclude: new Set(["a"]) }).length === 0, "a page already sent another way is not sent twice");
  const section = pagesSection(hits);
  check(/## From their notebook/.test(section) && /<page title="Osmosis">/.test(section) && /quoted as data/.test(section), "sent fenced, named, and as data");
  check(pagesSection([]) === "", "nothing found, nothing sent");
}

console.log("\nChecklists are ticked where they are read");
{
  const md = "- [ ] one\n```\n- [ ] in code\n```\n- [x] two\n1. [ ] three";
  check(taskCount(md).total === 3 && taskCount(md).done === 1, "tasks in code are not counted", JSON.stringify(taskCount(md)));
  const once = toggleTask(md, 0);
  check(once.startsWith("- [x] one"), "the first is ticked");
  check(/- \[ \] in code/.test(once), "the one in code is left alone");
  check(toggleTask(md, 1).includes("- [ ] two"), "the second, counted past the code, is unticked");
  check(toggleTask(md, 2).includes("1. [x] three"), "numbered tasks too");
}

console.log("\nThe slash menu, the link menu and @");
{
  check(slashAt("Hello\n/che", 10)?.query === "che", "a slash at the start of a line is a command", JSON.stringify(slashAt("Hello\n/che", 10)));
  check(slashAt("see /che", 8) === null, "a slash mid-line is only a slash");
  check(slashAt("http://x", 8) === null, "and a URL is not a command");
  check(slashFilter("check")[0].id === "todo", "“check” finds the checklist", slashFilter("check")[0].id);
  check(slashFilter("record")[0].action === "record", "and “record” the lecture");
  check(wikiAt("see [[Osm", 9)?.query === "Osm", "“[[” opens the link menu");
  check(wikiAt("see [[Osmosis]] then", 20) === null, "a closed link does not");
  check(mentionAt("explain @Hist", 13)?.query === "Hist", "“@” opens the page menu");
  check(mentionAt("mail me@example.com", 19) === null, "an email address does not");
  const r = applyInsert("x\n/todo", 2, 7, "- [ ] ¦");
  check(r.text === "x\n- [ ] " && r.caret === r.text.length, "an insert replaces the command and puts the caret where marked", JSON.stringify(r));
  check(titleMatches("hist", pages.map((p) => ({ id: p.id, title: p.title })))[0]?.id === "b", "titles match by their start first");
}

console.log("\nAn answer added to a page, and a lecture on it");
{
  const out = appendFromChat("# Notes\n\nMine.", "The answer.", "Photosynthesis", Date.UTC(2026, 8, 28));
  check(out.startsWith("# Notes\n\nMine.") && /---/.test(out) && /From the chat “Photosynthesis”/.test(out) && out.trim().endsWith("The answer."), "added at the end, marked with where it came from");
  check(!appendFromChat("", "A.", "C").startsWith("\n"), "to an empty page, without a leading rule");
  const page = `# Bio\n\n${transcriptHeading()}\n\nOsmosis moves water.\n\n## Later\n\nOther.`;
  check(/Osmosis moves water\./.test(lastTranscript(page)) && !/Other\./.test(lastTranscript(page)), "the transcript is read up to the next section");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
