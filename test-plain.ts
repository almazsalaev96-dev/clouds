/** A preview is prose, and a month's recall rate is never NaN. */
import { plainLine } from "./lib/plain";
import { recallRate } from "./lib/plan";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA line of a page, as words");
{
  /* A dot between them, not a space. Three bullets glued together made one
     run-on sentence with no punctuation in it anywhere, and a reader had to
     guess where each ended. */
  check(plainLine("## The three words\n- Hypotonic\n- Isotonic") === "The three words · Hypotonic · Isotonic", "headings and bullets lose their marks, and stay separate things", plainLine("## The three words\n- Hypotonic\n- Isotonic"));
  check(plainLine("1. Write it down\n2) Compare") === "Write it down · Compare", "numbered lists too");
  /* …while a paragraph somebody hard-wrapped is still one sentence, because
     putting punctuation inside it is the opposite fault. */
  check(plainLine("Water moves from high\nto low water potential.") === "Water moves from high to low water potential.",
    "and a wrapped sentence is left as one sentence", plainLine("Water moves from high\nto low water potential."));
  check(plainLine("**bold** and _em_ and `code`") === "bold and em and code", "emphasis and inline code");
  check(plainLine("see [the primer](https://x.y) now") === "see the primer now", "a link keeps its words and loses its address");
  check(plainLine("> quoted\n\n```js\nignored()\n```\nafter") === "quoted after", "quotes lose the bar; fenced code is left out entirely");
  check(plainLine("- [ ] todo\n- [x] done") === "todo · done", "task boxes go, and the two tasks stay two");
  check(plainLine("x".repeat(300)).length === 120 && plainLine("x".repeat(300)).endsWith("…"), "and it is cut with an ellipsis", `${plainLine("x".repeat(300)).length}`);
  check(plainLine("   ") === "", "nothing in, nothing out");
}

console.log("\nThe month's recall rate");
{
  const now = Date.now();
  const day = (ago: number) => new Date(now - ago * 86_400_000).toISOString().slice(0, 10);
  const r = recallRate([{ day: day(1), answered: 10, right: 9 }, { day: day(2), answered: 10, right: 7 }], now);
  check(r.answered === 20 && r.rate === 0.8, "adds up", `${r.answered} answered, rate ${r.rate}`);
  const old = recallRate([{ day: day(1), answered: 10 } as never, { day: day(2), answered: 10, right: 5 }], now);
  check(old.rate === 0.25 && Number.isFinite(old.rate), "a row from before `right` existed counts as zero right, never as NaN", `${old.rate}`);
  check(recallRate([], now).rate === null, "and no answers is no rate rather than a division");
}

console.log("\nThe two that were showing their own file format");
{
  /* Seen in the Library, on a revision timetable somebody made: the row read
     "| Day | Subject | |---|---| | Mon | Biology |", which is a preview of
     markdown rather than of a timetable. */
  const table = plainLine("# Revision timetable\n\n| Day | Subject |\n|---|---|\n| Mon | Biology |\n| Tue | Maths |");
  check(!/\|/.test(table), "a table keeps no pipes", table);
  check(!/---/.test(table), "and no separator row");
  check(/Day · Subject/.test(table) && /Mon · Biology/.test(table), "it is read across, cell by cell", table);
  check(table.startsWith("Revision timetable"), "after the heading it sits under");

  /* And in the Notebook, on a page that links another page. */
  const wiki = plainLine("Water moves down the gradient. See [[Transport in plants]]");
  check(!/\[|\]/.test(wiki), "a link to another page keeps no brackets", wiki);
  check(/See Transport in plants/.test(wiki), "just its name");
  check(plainLine("See [[transport-in-plants|the transport page]]") === "See the transport page",
    "and where a name was written for the reader, that is the one shown",
    plainLine("See [[transport-in-plants|the transport page]]"));

  /* A table of nothing but a rule is not a table anybody wants previewed. */
  check(plainLine("|---|---|\n") === "", "a rule on its own leaves nothing", `"${plainLine("|---|---|")}"`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
