/* Working it out, rather than saying what it would be.
 *
 * A model asked for the average of two hundred numbers produces a number,
 * and it is close, and it is wrong, and it looks exactly like a right
 * answer. This is the detector and the sandbox that replace that guess with
 * an actual result — and the note that hands the result back, which is the
 * half that makes the first half worth having.
 *
 *   npx jiti test-compute.ts */
import { computeBlock, computeDoc, asNote, COMPUTE_TIMEOUT_MS } from "./lib/compute";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nA calculation is recognised, and only a calculation");
{
  const md = 'Working out the mean.\n\n```compute\nconsole.log(1 + 1);\n```\n\nThat is it.';
  check(computeBlock(md) === "console.log(1 + 1);", "a compute block comes back as its code", JSON.stringify(computeBlock(md)));
  check(computeBlock("```js\nconsole.log(1)\n```") === null, "an ordinary js block is code to read, not to run");
  check(computeBlock("```python\nprint(1)\n```") === null, "and so is any other language");
  check(computeBlock("no fences here") === null, "prose is prose");
  check(computeBlock("```compute\n\n```") === null, "an empty block is not a calculation");
  check(computeBlock("```compute\n" + "x;".repeat(20_000) + "\n```") === null, "and a program is not one either");
}

console.log("\nThe sandbox it runs in");
{
  const doc = computeDoc('console.log("hi");', "r1");
  check(/default-src 'none'/.test(doc), "nothing may be fetched, loaded or reached from inside it");
  check(doc.includes('console.log("hi");'), "the code is in it");
  check(doc.includes('"r1"'), "named by this run, so a late message from the last one is not read as this one's");
  check(/__armiComputeDone/.test(doc), "and it says when it has finished, so a loop can be told from a result");
  /* The bridge has to be installed before the code can throw. */
  check(doc.indexOf("__armiCompute") < doc.indexOf('console.log("hi");'),
    "the bridge is in place before anything can go wrong");
}

console.log("\nWhat the model is told afterwards");
{
  const ok = asNote({ lines: [{ level: "log", text: "mean 39.4" }], timedOut: false, ms: 12 });
  check(ok.includes("mean 39.4"), "the output, exactly as it printed");
  check(/Do not recompute them in your head/.test(ok), "with an instruction not to do the thing this exists to prevent");
  const bad = asNote({ lines: [{ level: "error", text: "TypeError: xs is not iterable" }], timedOut: false, ms: 8 });
  check(/ERROR: TypeError/.test(bad) && /errored/.test(bad), "an error is handed back as an error, not as a result");
  const slow = asNote({ lines: [], timedOut: true, ms: COMPUTE_TIMEOUT_MS });
  check(/did not finish/.test(slow), "and a calculation that never ended says so");
  const quiet = asNote({ lines: [], timedOut: false, ms: 3 });
  check(/printed nothing/.test(quiet) && /rather than inventing/.test(quiet), "so does one that printed nothing");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
