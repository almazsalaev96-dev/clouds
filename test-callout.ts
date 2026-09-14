/* The marker that turns a quotation into a ranked fact.
 *
 * Revision notes are not prose, and the difference has to survive the round
 * trip: the model writes `> [!key]`, the renderer draws a box, and the
 * markdown underneath stays exactly what was written — because that is what
 * gets exported, edited, and sent back to a model next week.
 *
 *   npx jiti test-callout.ts */
import { calloutKind, withoutMarker } from "./lib/callout";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe five that get drawn");
{
  check(calloutKind("[!key]\nIonic bonds transfer electrons.") === "key", "a must-know fact");
  check(calloutKind("[!formula] v = u + at") === "formula", "a formula");
  check(calloutKind("[!mistake]\nConfusing mass with weight.") === "mistake", "the thing people get wrong");
  check(calloutKind("[!exam] four marks") === "exam", "how it is asked");
  check(calloutKind("[!recall] what is the unit?") === "recall", "and a question to ask yourself");
}

console.log("\nHowever a model happens to spell it");
{
  check(calloutKind("[!KEY] shouted") === "key", "cased however it likes");
  check(calloutKind("[! warning ] spaced out") === "mistake", "spaced however it likes");
  check(calloutKind("[!IMPORTANT]\nx") === "key", "and GitHub's own words map onto ours", "important → key");
  check(calloutKind("[!CAUTION] x") === "mistake", "caution is the same warning");
  check(calloutKind("[!TIP] x") === "tip", "tip and note stay themselves");
}

console.log("\nAnd an ordinary quotation is still a quotation");
{
  check(calloutKind("As Feynman put it, nature cannot be fooled.") === null,
    "a quote is not a callout, whatever it opens with");
  check(calloutKind("[!nonsense] x") === null, "nor is a marker nobody defined");
  check(calloutKind("") === null, "nor an empty one");
  /* The marker has to be at the start. A sentence that happens to mention
     the syntax is prose about the syntax. */
  check(calloutKind("the syntax is [!key] and it works") === null, "and it has to open the quote");
}

console.log("\nAnd the markdown keeps the marker it was written with");
{
  /* Stripped from what is drawn, never from what is stored: the page is
     exported, edited and sent back to a model, and a note that loses its own
     structure the moment it is rendered cannot be re-made. */
  check(withoutMarker("[!key]\nIonic bonds transfer electrons.") === "Ionic bonds transfer electrons.",
    "the drawn text loses the marker");
  check(withoutMarker("[!formula] v = u + at") === "v = u + at", "however it was spaced");
  check(withoutMarker("An ordinary quote.") === "An ordinary quote.", "and everything else is untouched");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
