/* How to answer, read from who is asking and how.
 *
 * The model is chosen for you, the mode is read from the request, how hard
 * to think is read from the kind of work — and the style, which is the one
 * a reader actually notices, was a setting behind two menus almost nobody
 * opened. So every answer came out in the same register whether the person
 * had typed four words or four paragraphs.
 *
 *   npx jiti test-register.ts */
import { registerFor, AUTO_STYLE } from "./lib/register";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const id = (t: string, ctx = {}) => registerFor(t, ctx).id;

console.log("\nSaid outright, which beats everything inferred");
{
  check(id("quickly, what is a debounce") === "concise", "asking for it short gets it short");
  check(id("just tell me the answer") === "concise", "and so does asking for the answer and nothing else");
  check(id("tl;dr of the above?") === "concise", "and the internet's own word for it");
  check(id("why does a debounce need a timer?") === "explanatory", "asking why gets the reasoning");
  check(id("I don't understand closures") === "explanatory", "and so does saying you do not understand");
  check(id("explain it like I'm five") === "explanatory", "and the oldest request there is");
  check(id("write me an email to my landlord about the boiler") === "formal", "something going to somebody else is written properly");
  check(id("quiz me on the periodic table") === "practice", "and asking to be quizzed gets questions");
}

console.log("\nThe kind of work, where nothing was said");
{
  check(id("the opening paragraph for the annual report", { kind: "writing" }) === "formal", "writing for a reader is formal");
  check(id("closures in javascript", { kind: "learning" }) === "explanatory", "and somebody learning gets the explanation");
}

console.log("\nDone, rather than said");
{
  check(id("what is a monad", { tooLong: 2 }) === "concise",
    "twice saying an answer was too long is an instruction about how to write");
  check(id("what is a monad", { tooLong: 1 }) === "normal",
    "once is a sentence that happened to be long", registerFor("what is a monad", { tooLong: 1 }).id);
  check(registerFor("what is a monad", { tooLong: 2 }).why.includes("too long"),
    "and it says so in the words they used");
}

console.log("\nHow they write, where nothing else decides it");
{
  const clipped = { theirs: ["whats a closure", "and a promise", "ok and async"] };
  check(id("and await", clipped) === "concise", "short lines get short answers");
  const mixed = { theirs: ["whats a closure", "I have been reading about the event loop and I am not sure how microtasks are ordered relative to rendering"] };
  check(id("and await", mixed) === "normal", "one careful paragraph in there means they are willing to read", id("and await", mixed));
  check(id("hello", { theirs: ["hi"] }) === "normal", "and one short line on its own is not a pattern");
}

console.log("\nWhat it will never do on its own");
{
  /* The teaching stances withhold the answer on purpose. Withholding an
     answer nobody asked to have withheld is the rudest thing this could do
     unprompted, so only an explicit ask reaches them. */
  for (const t of [
    "what is the capital of France",
    "help me revise for my chemistry exam",
    "teach me about the water cycle",
    "I have a test tomorrow on trigonometry",
  ]) {
    const got = id(t);
    check(!["socratic", "exam", "teachback", "learning"].includes(got), `never withholds the answer unasked: ${JSON.stringify(t)}`, got);
  }
  check(id("") === "normal", "and nothing at all is the ordinary voice");
  check(AUTO_STYLE === "auto", "the thread says it is on auto with one word");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
