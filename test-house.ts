/* The house rules every answer is written under.
 *
 * Rewritten on 3 October 2026 around four things: right, complete, made
 * rather than described, and honest about where it came from. These checks
 * hold the shape, so a later edit cannot quietly drop one.
 *
 *   npx jiti test-house.ts */
import { HOUSE, HOUSE_RULES, COMPUTE_RULE } from "./lib/answer";
import { composeSystemPrompt } from "./lib/prompt";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe four things, each a rule");
{
  check(/Correct before anything else/.test(HOUSE_RULES) && /never invented to look complete/.test(HOUSE_RULES), "right: nothing unsure said as fact, nothing invented to look complete");
  check(/official source where there is one/.test(HOUSE_RULES) && /exam board's specification and mark schemes/.test(HOUSE_RULES) && /official documentation/.test(HOUSE_RULES), "from the official source, in its terms — boards, docs, standards");
  check(/Complete means everything the person needs/.test(HOUSE_RULES) && /A question with three parts gets all three answered/.test(HOUSE_RULES), "complete: all of what is needed, every part of the question");
  check(/Make the thing, not words about it/.test(HOUSE_RULES) && /one complete HTML document/.test(HOUSE_RULES) && /save_cards/.test(HOUSE_RULES) && /make_document, make_spreadsheet or make_presentation/.test(HOUSE_RULES), "make the thing: a page that runs, cards, a document — never 'here is how you could'");
  check(/exactly the tools listed with this request/.test(HOUSE_RULES) && /never imply that you did/.test(HOUSE_RULES), "honest about tools: use what is offered, say so, never pretend");
  check(!/You cannot browse the web/.test(HOUSE_RULES), "the old line saying it cannot browse or run code is gone — it was false");
}

console.log("\nWhat was right before is kept");
{
  for (const s of ["Answer in the language the person wrote in", "Understand what the person means", "Open with the answer", "Write in prose", "say what to do", "Keep caveats short", "ask the one question that separates them"])
    check(HOUSE_RULES.includes(s), `kept: ${s}`);
  check(/write to be remembered, not only read/.test(HOUSE_RULES) && /one question at the end for them to answer from memory/.test(HOUSE_RULES), "and studying has its own line: remembered, not only read");
  check(/Russian to Russian, Kazakh to Kazakh/.test(HOUSE_RULES), "Kazakh is named with Russian");
}

console.log("\nComposed, it is still the floor");
{
  check(HOUSE.startsWith("## How answers work here") && HOUSE.includes(COMPUTE_RULE), "the block opens as before and carries the compute rule");
  const out = composeSystemPrompt({ who: "Almaz" } as never);
  const i = out.text.indexOf("## How answers work here");
  check(i >= 0 && i < 1_500, "it is the first block after the identity", `at ${i}`);
  check(HOUSE_RULES.split("\n").length <= 16, "and it is sixteen lines or fewer — a rule the model has to hold is one it can hold", `${HOUSE_RULES.split("\n").length}`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
