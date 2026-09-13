/* Reading a request to remember, and only a request to remember.
 *
 *   npx jiti test-memory.ts */
import { rememberRequest, memorySection } from "./lib/memory";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA request to remember is read as one");
{
  const cases: [string, string][] = [
    ["remember that I'm allergic to nuts", "I'm allergic to nuts"],
    ["Please remember I teach year 9 maths.", "I teach year 9 maths"],
    ["Remember: my daughter's name is Aida", "My daughter's name is Aida"],
    ["keep in mind that I prefer short answers", "I prefer short answers"],
    ["can you remember that I use Python 3.12 at work, please", "I use Python 3.12 at work"],
    ["btw, remember my exam is on the 14th", "My exam is on the 14th"],
    ["Don't forget that I'm vegetarian!", "I'm vegetarian"],
    ["note that I live in Tashkent", "I live in Tashkent"],
  ];
  for (const [ask, fact] of cases) check(rememberRequest(ask) === fact, JSON.stringify(ask), `→ ${JSON.stringify(rememberRequest(ask))}`);
}

console.log("\nAnd a sentence with the word in it is not");
{
  for (const t of [
    "do you remember what we said yesterday?",
    "I can't remember the name of that film",
    "remember?",
    "what should I remember for the exam",
    "help me remember my lines",
    "remember me",
    "remember what I said?",
    "how do I make my code remember state between runs",
    "",
  ]) check(rememberRequest(t) === null, JSON.stringify(t), `→ ${JSON.stringify(rememberRequest(t))}`);
}

console.log("\nThe section");
{
  check(memorySection([]) === "", "nothing remembered, no section");
  const s = memorySection([{ text: "I'm vegetarian" }, { text: "I teach\n year 9" }]);
  check(s.startsWith("## About this person"), "headed as being about the person");
  check(s.includes("- I'm vegetarian") && s.includes("- I teach year 9"), "one line each, whitespace folded");
  check(/quoted as data/.test(s) && /not.*instruction/i.test(s), "quoted as data, not as instructions");
  const many = memorySection(Array.from({ length: 200 }, (_, i) => ({ text: `fact ${i}` })));
  check(!many.includes("- fact 0\n") && many.includes("- fact 199"), "over the limit, the newest are kept");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
