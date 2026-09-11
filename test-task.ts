/* What kind of work a request is, on its own. No browser, no model, no network.

   The interesting cases here are the ones where the classifier should *decline*.
   A classifier that is right most of the time and confident every time is worse
   than none, because the misses are invisible: an answer shaped for the wrong
   job reads exactly like an answer shaped for the right one.

     npx jiti test-task.ts */
import { CHECKS, taskOf, type TaskKind } from "./lib/task";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const kind = (text: string, extra = "") => taskOf(text, extra).kind;

console.log("\nThe six kinds, each read from what the request actually is");
{
  check(kind("teach me how compound interest works") === "learning", "somebody trying to understand", kind("teach me how compound interest works"));
  check(kind("fix this stack trace, it throws a type error on line 4") === "coding", "code");
  check(kind("is it true that the Roman concrete recipe is lost — cite your sources") === "research", "a claim that needs evidence");
  check(kind("write me an email to my landlord about the boiler") === "writing", "prose for somebody else");
  check(kind("what's the correlation between these two columns in my csv") === "data", "numbers");
  check(kind("make this feel more premium — the typography is fighting the layout") === "design", "how it looks");
}

console.log("\nAnd it says “general” rather than guessing");
{
  check(kind("hi") === "general", "a greeting is not a kind of work");
  check(kind("what do you think?") === "general", "nor is an open question");
  check(kind("explain") === "general",
    "and one leaning word decides nothing — “explain” appears in every kind of request ever typed",
    taskOf("explain").why);
  check(taskOf("hello there").signals === 0, "with no signals claimed when there are none");
}

console.log("\nOne strong signal, or two weak ones");
{
  check(kind("something about data") === "general", "a single weak word is not evidence", taskOf("something about data").why);
  check(kind("the trend in this data is odd") === "data", "two are", taskOf("the trend in this data is odd").why);
  check(kind("```js\nconst x = 1\n```") === "coding", "and a code fence is strong on its own");
}

console.log("\nWhat came with the request counts, and is usually the stronger evidence");
{
  check(kind("is this right?") === "general", "on its own this says nothing at all");
  check(kind("is this right?", "function go() { return null }\nconst x = 1;") === "coding",
    "the same words over four hundred lines of TypeScript say everything",
    taskOf("is this right?", "function go() { return null }\nconst x = 1;").why);
}

console.log("\nA request that is genuinely two things is not forced into one");
{
  /* Picking between two equal readings would be picking by alphabet. A question
     that is both a coding question and a teaching question should be answered as
     both, which is what the default already does. */
  const both = taskOf("teach me why this regex is wrong, I don't understand it — help me understand the lookahead");
  check(both.kind === "general" || both.kind === "learning" || both.kind === "coding",
    "it lands somewhere defensible", `${both.kind} — ${both.why}`);
  /* A genuine dead heat, and a sentence somebody might type: two weak signals
     for numbers, two for prose, nothing strong either way. */
  const tie = taskOf("tidy the draft paragraph about the data table");
  check(tie.kind === "general", "and a dead heat collapses to general rather than to whichever sorts first", tie.why);
  check(/equal measure/.test(tie.why), "saying so", tie.why);
}

console.log("\nThe same request reads the same way twice");
{
  const q = "refactor this function and explain why the loop was wrong";
  check(taskOf(q).kind === taskOf(q).kind && taskOf(q).why === taskOf(q).why,
    "because a classifier nobody can predict is one nobody can correct");
}

console.log("\nChecking means something different for each kind");
{
  const kinds: TaskKind[] = ["learning", "coding", "research", "writing", "data", "design"];
  for (const k of kinds) check(CHECKS[k].length > 0, `${k} has its own checks`, String(CHECKS[k].length));
  check(CHECKS.general.length === 0,
    "and general has none — the standing rules already say “is it right”, and saying it twice only tells the model somebody was worried");
  check(/recompute/i.test(CHECKS.data.join(" ")), "data is told to redo the arithmetic");
  check(/empty list|null|boundary/i.test(CHECKS.coding.join(" ")), "code is told to find the input that breaks it");
  check(/cited for|does not exist/i.test(CHECKS.research.join(" ")), "research is told to check the citation says what it is cited for");
  check(/intuition/i.test(CHECKS.learning.join(" ")), "and teaching is told that technically-right-but-misleading is the failure that matters");
  const all = new Set(kinds.flatMap((k) => CHECKS[k]));
  check(all.size === kinds.reduce((n, k) => n + CHECKS[k].length, 0),
    "with no check repeated across two kinds, which would mean it belonged in the standing rules");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
