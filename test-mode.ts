/* Which mode a request is in, decided from the request.
 *
 * It used to be a switch in the composer — a question about the machine, asked
 * before the person had said what they wanted, answerable only by someone who
 * already knew what the two settings did. The ones who most need the built
 * thing were the least likely to have found the toggle.
 *
 * So both directions, and the second one is the whole job: the request that
 * must build something, and the request that sounds like it and must not.
 *
 *   npx jiti test-mode.ts */
import { modeFor } from "./lib/modes";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  \u2713" : "  \u2717"} ${l}${d ? " \u2014 " + d : ""}`); };
const makes = (t: string) => modeFor(t) === "creative";

console.log("\nAsking for a thing builds the thing");
{
  for (const t of [
    "build me a timer for my workout",
    "make me a web app that tracks my reading",
    "create a landing page for a bakery",
    "generate a quiz about the solar system",
    "design a dashboard for these numbers",
    "give me a calculator for compound interest",
    "make a countdown to new year",
    "build a flashcards app for spanish verbs",
    "put together a checklist for moving house",
    "write me a little game where you guess the number",
  ]) check(makes(t), JSON.stringify(t.slice(0, 42)));
}

console.log("\nAnd so does saying run");
{
  for (const t of ["run it", "run this", "run that for me", "can you run the page", "make it run"])
    check(makes(t), JSON.stringify(t));
}

console.log("\nA question about a thing is not a request for one");
{
  for (const t of [
    "how does a debounce timer work",
    "what is the difference between a tracker and a planner",
    "why do calculators use floating point",
    "explain how a countdown is implemented",
    "when should I use a dashboard rather than a report",
  ]) check(!makes(t), JSON.stringify(t.slice(0, 42)));
}

console.log("\nAnd neither is asking for words");
{
  for (const t of [
    "write me an email to my landlord",
    "write an essay about the tides",
    "make me a summary of this paper",
    "give me a poem about the sea",
    "draft a message to the team",
  ]) check(!makes(t), JSON.stringify(t.slice(0, 42)));
}

console.log("\nEditing is not building, however imperative it sounds");
{
  for (const t of [
    "make it shorter",
    "make this clearer",
    "make them sound less formal",
    "make that more specific",
  ]) check(!makes(t), JSON.stringify(t));
  check(makes("make it run in the browser"), "though 'make it run' still is");
}

console.log("\nAnd nothing a person can type makes it throw");
{
  for (const t of ["", "   ", "?", "a".repeat(50000), "\u4f60\u597d", "```\n```", "make"]) {
    let ok = true;
    try { modeFor(t); } catch { ok = false; }
    check(ok, `survives ${JSON.stringify(t.slice(0, 12))}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
