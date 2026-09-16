/* Marking a typed answer — forgiving in the right places, and never the last word.
 *
 *   npx jiti test-grade.ts */
import { normalise, distance, mark } from "./lib/grade";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nWhat is not marked");
{
  check(normalise("The Mitochondria!") === "mitochondria", "case, articles and punctuation come off", normalise("The Mitochondria!"));
  check(normalise("  a   debounce  ") === "debounce", "and stray space");
  check(normalise("l'Hôpital's rule") === "l'hôpital's rule", "but letters with marks stay letters", normalise("l'Hôpital's rule"));
}

console.log("\nHow far apart two answers are");
{
  check(distance("kitten", "sitting") === 3, "the textbook case is three", String(distance("kitten", "sitting")));
  check(distance("teh", "the") === 1, "and two neighbours swapped is one slip, not two");
  check(distance("", "abc") === 3 && distance("abc", "abc") === 0, "and the edges behave");
}

console.log("\nThe verdict");
{
  check(mark("mitochondria", "The mitochondria").mark === "right", "the same answer, differently dressed, is right");
  check(mark("it's the mitochondria, the powerhouse", "mitochondria").mark === "right", "an answer that contains the expected one is right");
  check(mark("mitocondria", "mitochondria").mark === "close", "one letter off a long word is close, not wrong", mark("mitocondria", "mitochondria").why);
  check(mark("Lutetia", "Paris / Lutetia").mark === "right", "any one of several listed answers is right");
  check(mark("London", "Paris").mark === "wrong", "a different answer is wrong");
  check(mark("", "Paris").mark === "wrong", "and nothing typed is wrong, not close");
  check(mark("1789", "1789").mark === "right" && mark("1798", "1789").mark === "close", "a number is marked like a word — a transposition is close");
  check(mark("cat", "car").mark === "close" && mark("cat", "dog").mark === "wrong", "short answers allow one edit and no more");
  /* Not "contains" for tiny answers: "a" is inside almost anything. */
  check(mark("the answer is no idea", "no").mark !== "right", "a two-letter answer is not found inside a sentence about not knowing");
  check(mark("A", "A").mark === "right" && mark("the", "the").mark === "right", "an answer that is an article is still an answer");
  check(normalise("Vitamin A") === "vitamin a", "and 'Vitamin A' keeps its A", normalise("Vitamin A"));
  check(mark("timeout fires", "It waits until input stops or a timeout fires").mark !== "right",
    "a clause of a sentence with 'or' in it is not the answer to the sentence");
  check(mark("h", "km/h").mark !== "right", "nor is half a unit");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
