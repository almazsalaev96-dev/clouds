/** A preview is prose, and a month's recall rate is never NaN. */
import { plainLine } from "./lib/plain";
import { recallRate } from "./lib/plan";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA line of a page, as words");
{
  check(plainLine("## The three words\n- Hypotonic\n- Isotonic") === "The three words Hypotonic Isotonic", "headings and bullets lose their marks", plainLine("## The three words\n- Hypotonic\n- Isotonic"));
  check(plainLine("1. Write it down\n2) Compare") === "Write it down Compare", "numbered lists too");
  check(plainLine("**bold** and _em_ and `code`") === "bold and em and code", "emphasis and inline code");
  check(plainLine("see [the primer](https://x.y) now") === "see the primer now", "a link keeps its words and loses its address");
  check(plainLine("> quoted\n\n```js\nignored()\n```\nafter") === "quoted after", "quotes lose the bar; fenced code is left out entirely");
  check(plainLine("- [ ] todo\n- [x] done") === "todo done", "task boxes go");
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

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
