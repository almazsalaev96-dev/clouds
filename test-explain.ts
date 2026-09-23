/* Why, briefly: the quotation is set apart from the sentences.
 *   npx jiti test-explain.ts */
import { splitQuote } from "./lib/explain";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nAn explanation and its quote");
{
  const r = splitQuote("Water moves to where solutes are.\nPeople think it is the solute that moves.\n\n> Water moves down a water-potential gradient.");
  check(r.body === "Water moves to where solutes are.\nPeople think it is the solute that moves.", "the sentences are kept as written", JSON.stringify(r.body));
  check(r.quote === "Water moves down a water-potential gradient.", "the quote loses its mark and its quotation marks", r.quote);
  check(splitQuote("Just the sentences.").quote === undefined, "no quote line, no quote");
  check(splitQuote("Body\n> “Quoted, in curly marks.”").quote === "Quoted, in curly marks.", "curly quotation marks come off too");
  check(splitQuote("Body\n> short").quote === undefined && splitQuote("Body\n> short").body === "Body", "a quote too short to be one is dropped, and the body is kept");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
