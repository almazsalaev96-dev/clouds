/* Everything the commitment gate declines.
 *
 * `parsePredict` is a parser over untrusted text — a model's output — and the
 * only interesting thing about it is what it refuses. A gate with one option is
 * not a question. A gate whose answer points past the end of its own list can
 * never be got right. A gate that is not JSON at all is a fence somebody typed
 * by hand. Each of those has to come back `null` so the renderer falls through
 * to a plain code block, because the failure that matters is not a missing gate
 * — it is a malformed gate that throws inside the renderer and takes the
 * surrounding answer down with it.
 *
 * That is the whole reason this lives in `lib/` rather than in the component:
 * the browser suite can prove a gate works, and only this can prove the ones
 * that do not work fail in the one direction that is safe.
 *
 *   npx jiti test-predict.ts */
import { parsePredict } from "./lib/predict";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const j = (o: unknown) => JSON.stringify(o);

console.log("\nA well-formed gate parses");
{
  const spec = parsePredict(j({ q: "What does this return on an empty list?", options: ["0", "undefined", "it throws"], answer: 2, why: "Nothing to start from." }));
  check(spec !== null, "the fence in the prompt's own example is accepted");
  check(spec?.options.length === 3, "with its options", String(spec?.options.length));
  check(spec?.answer === 2, "and the index of the right one", String(spec?.answer));
  check(spec?.why === "Nothing to start from.", "and the reason to show after");
}

console.log("\nThe reason is optional; the question and the options are not");
{
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: 0 })) !== null,
    "a gate with no reason still parses — the choice is the event, the reason is a bonus");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: 0 }))?.why === undefined,
    "and carries no reason rather than an empty one");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: 0, why: 42 }))?.why === undefined,
    "a reason that is not prose is dropped, not rendered as a number");
  check(parsePredict(j({ options: ["a", "b"], answer: 0 })) === null, "no question at all is not a gate");
  check(parsePredict(j({ q: "   ", options: ["a", "b"], answer: 0 })) === null, "and neither is a blank one");
}

console.log("\nA gate you cannot get wrong is not a gate");
{
  check(parsePredict(j({ q: "Which?", options: ["only"], answer: 0 })) === null,
    "one option is a statement wearing a button");
  check(parsePredict(j({ q: "Which?", options: [], answer: 0 })) === null, "no options at all is declined");
  check(parsePredict(j({ q: "Which?", options: ["a", "b", "c", "d", "e", "f"], answer: 0 })) === null,
    "and six is a menu — past about five the choice stops being a prediction and becomes a search");
  check(parsePredict(j({ q: "Which?", options: ["a", "b", "c", "d", "e"], answer: 4 })) !== null,
    "five is still a question");
}

console.log("\nA gate you cannot get right is worse");
{
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: 2 })) === null,
    "an answer past the end of its own list is declined");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: -1 })) === null, "and so is one before the start");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: 1.5 })) === null,
    "and so is an index between two options");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"] })) === null, "and a gate with no answer marked at all");
  check(parsePredict(j({ q: "Which?", options: ["a", "b"], answer: "1" })) === null,
    "an index written as text is not an index");
}

console.log("\nAn option has to say something");
{
  check(parsePredict(j({ q: "Which?", options: ["a", ""], answer: 0 })) === null, "an empty option is declined");
  check(parsePredict(j({ q: "Which?", options: ["a", "  "], answer: 0 })) === null, "and a blank one");
  check(parsePredict(j({ q: "Which?", options: ["a", 7], answer: 0 })) === null, "and one that is not text");
  check(parsePredict(j({ q: "Which?", options: ["a", null], answer: 0 })) === null, "and one that is nothing");
}

console.log("\nAnd nothing a model can emit makes it throw");
{
  const junk = [
    "", "   ", "not json at all", "{", "{}", "[]", "null", "true", "42", '"a string"',
    '{"q":"Which?","options":"a, b","answer":0}',
    '{"q":"Which?","options":{"0":"a","1":"b"},"answer":0}',
    "{q: 'Which?', options: ['a','b'], answer: 0}",           // JS, not JSON
    '```json\n{"q":"Which?","options":["a","b"],"answer":0}\n```', // fenced twice
    '{"q":"Which?","options":["a","b"],"answer":0}\n\nand some trailing prose',
    "a".repeat(20000),
    '{"q":"你好 — 🙂","options":["a","b"],"answer":0}',
  ];
  for (const src of junk) {
    let threw = false;
    let out: unknown = undefined;
    try { out = parsePredict(src); } catch { threw = true; }
    check(!threw, `survives ${j(src.slice(0, 26))}`);
    if (!threw && src.includes("你好")) check(out !== null, "  (and unicode is content, not corruption)");
    else if (!threw) check(out === null, "  and declines it rather than half-rendering it", j(out));
  }
}

console.log("\nThe declined ones are declined the same way every time");
{
  const bad = j({ q: "Which?", options: ["only"], answer: 0 });
  check(parsePredict(bad) === parsePredict(bad), "twice through gives the same verdict");
  check(parsePredict(bad) === null, "and it is null, not a partial spec the renderer would have to guard");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
