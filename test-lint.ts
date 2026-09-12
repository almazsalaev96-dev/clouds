/* The rules the app sets for answers, read back off a finished answer.
 *
 * Eight rules are stated in `lib/answer.ts` and nothing had ever checked one.
 * That is a strange gap in a codebase that measures contrast against WCAG for
 * every pair it renders and every control against 44pt in three densities: the
 * container is measured exhaustively and the content — the thing the app
 * exists to deliver — was not measured at all.
 *
 * Half of this file is the other half of the job. A linter that fires on good
 * writing is a linter everyone learns to ignore, so every rule here is tested
 * in both directions: the sentence that should trip it, and the sentence that
 * looks like it should and must not.
 *
 *   npx jiti test-lint.ts */
import { lintAnswer, clean } from "./lib/lint";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const fires = (md: string, rule: string, q?: string) => lintAnswer(md, q).some((f) => f.rule === rule);

console.log("\nAn answer opens with the answer");
{
  check(fires("## What a debounce is\n\nIt waits for silence.", "open with the answer"),
    "a header before the answer is caught");
  check(fires("Great question! A debounce waits for silence.", "open with the answer"),
    "and so is a pleasantry");
  check(fires("Short answer: it waits for silence.", "open with the answer"),
    "and so is a label announcing the answer");
  check(!fires("A debounce waits for silence: the call fires once the input has stopped.", "open with the answer"),
    "an answer that is an answer passes");
  check(!fires("Because the loop rebuilds the array on every pass, it is quadratic.\n\n## Why that matters\n\nIt shows up at scale.", "open with the answer"),
    "and a header further down is structure, not a preamble");
}

console.log("\nAnd not with the question again");
{
  const q = "what is the difference between a debounce and a throttle";
  check(fires("The difference between a debounce and a throttle is worth understanding.", "open with the answer", q),
    "a first sentence that restates the question is caught");
  check(!fires("A debounce waits for silence; a throttle enforces a floor between calls.", "open with the answer", q),
    "but one that answers it is not, even using the same words");
  check(!fires("The difference between a debounce and a throttle is that one waits for the input to stop and the other lets a call through at a fixed rate no matter what.", "open with the answer", q),
    "and neither is a restatement that carries the answer with it");
}

console.log("\nIt does not describe itself");
{
  check(fires("Let me explain how this works. It waits.", "do not describe your own answer"),
    "announcing what is coming is caught");
  check(fires("It waits for silence.\n\nI hope this helps!", "do not describe your own answer"),
    "and so is the closing offer");
  check(fires("It waits.\n\nLet me know if you'd like the throttle version too.", "do not describe your own answer"),
    "however it is phrased");
  check(!fires("It waits for silence, which is why a search box uses one.", "do not describe your own answer"),
    "an answer that just answers passes");
  check(!fires("The compiler will explain the type error better than I can here.", "do not describe your own answer"),
    "and 'explain' about something else is not the app talking about itself");
}

console.log("\nA probability word carries a number");
{
  check(fires("The cache will probably help here.", "a probability word carries a number"),
    "a bare 'probably' is caught");
  check(!fires("The cache helps about nine times in ten, so it will probably help here.", "a probability word carries a number"),
    "but not one with the odds beside it");
  check(!fires("It likely helps — around 70% of requests hit the prefix.", "a probability word carries a number"),
    "a percentage in the same sentence is enough");
  check(!fires("It waits for silence.", "a probability word carries a number"),
    "and an answer with no hedge in it has nothing to find");
}

console.log("\nStructure has to be earned");
{
  const bulleted = [
    "Here are the considerations:",
    "- **Speed**: it is faster",
    "- **Cost**: it is cheaper",
    "- **Risk**: it is riskier",
    "- **Effort**: it is more work",
    "- **Timing**: it is sooner",
    "- **Scope**: it is bigger",
  ].join("\n");
  check(fires(bulleted, "write in prose"), "an answer that is mostly marks is caught");

  const prose =
    "The loop rebuilds the array on every pass, which makes it quadratic in the number of items. " +
    "Pushing instead of concatenating fixes it without changing what the function returns, because " +
    "the copy was never doing anything except costing time. The same shape shows up whenever a reduce " +
    "spreads its accumulator, and it is worth recognising rather than memorising the one case.";
  check(!fires(prose, "write in prose"), "and prose with no marks in it passes");

  const mixed =
    "Push instead of concat: the copy is the whole cost. The three places this shows up are a reduce " +
    "that spreads its accumulator, a filter inside a map, and a sort that rebuilds its comparator. " +
    "Each is the same mistake wearing different clothes, and each is fixed the same way — do the work " +
    "in place, and let the shape of the data stay still while you work on it rather than rebuilding it.";
  check(!fires(mixed, "write in prose"), "and an answer with a list said in a sentence is prose");
}

console.log("\nThe whole thing, on an answer that does everything wrong");
{
  const bad = "## Great question!\n\nLet me explain. It probably helps.\n\nI hope this helps!";
  const found = lintAnswer(bad, "does the cache help");
  check(found.length >= 4, "every rule it breaks is named", `${found.length} findings`);
  check(new Set(found.map((f) => f.rule)).size >= 3, "across more than one rule", [...new Set(found.map((f) => f.rule))].join(", "));
  check(found.every((f) => f.found && f.why), "each one quotes what it found and says why it matters");
}

console.log("\nAnd on one that does not");
{
  const good =
    "A debounce waits for silence: the call fires once the input has stopped changing for a set interval. " +
    "A throttle is the other shape — it lets a call through at a fixed rate however much the input moves. " +
    "Use a debounce for a search box, where only the last keystroke matters, and a throttle for a scroll " +
    "handler, where you want steady updates rather than one at the end.";
  check(clean(good, "what is a debounce"), "it says nothing", JSON.stringify(lintAnswer(good, "what is a debounce")));
}

console.log("\nIt never throws on what a model can actually produce");
{
  for (const md of ["", "   ", "```\nunclosed", "# ".repeat(500), "a".repeat(20000), "— – … 你好 🙂"]) {
    let ok = true;
    try { lintAnswer(md, "why"); } catch { ok = false; }
    check(ok, `survives ${JSON.stringify(md.slice(0, 14))}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
