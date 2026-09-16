/* Reading a question like an examiner.   npx jiti test-exam.ts */
import { commandWordOf, marksOf, looksLikeExamQuestion, examNote, COMMAND_WORDS } from "./lib/exam";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe command word");
check(commandWordOf("Describe the process of osmosis.")?.word === "describe", "found as a whole word, in any case");
check(commandWordOf("Describe and explain how the rate changes")?.word === "describe", "the first one sets the shape");
check(commandWordOf("Explain why the rate increases. [3]")?.word === "explain", "with marks after it");
check(commandWordOf("What is the capital of France?") === null, "and none for a question without one");
check(commandWordOf("The defined term is…") === null, "'defined' is not 'define'");
check(COMMAND_WORDS.length >= 25 && COMMAND_WORDS.every((c) => c.means && c.marks), "every word has a meaning and a thing to mark for", `${COMMAND_WORDS.length} words`);

console.log("\nThe marks");
check(marksOf("Explain why. [4]") === 4, "in square brackets");
check(marksOf("Evaluate the policy. (6 marks)") === 6, "in round brackets with the word");
check(marksOf("Calculate the mean. 2 marks") === 2, "as a bare count");
check(marksOf("Outline the causes. [Total: 8]") === 8, "as a total");
check(marksOf("I got 90 marks in the mock") === null, "and not a score someone mentions");
check(marksOf("Describe it.") === null, "or nothing at all");

console.log("\nWhat counts as an exam question");
check(looksLikeExamQuestion("Explain how enzymes are affected by temperature. [4]"), "a command word and marks");
check(looksLikeExamQuestion("How does the heart work? [3]"), "marks alone, in a short question");
check(!looksLikeExamQuestion("Can you explain how you got to that answer?"), "a command word in conversation is not one");
check(!looksLikeExamQuestion("explain eigenvalues like I have forgotten the algebra"), "nor an ordinary request to explain");

console.log("\nWhat the model is told");
{
  const n = examNote("Evaluate the view that the Treaty of Versailles caused the Second World War. [8]") ?? "";
  check(/command word is "evaluate"/.test(n) && /8 numbered mark points/.test(n), "the word, its meaning, and the marks to account for", n.slice(0, 80));
  check(/mark points first/.test(n) && /model answer/.test(n) && /marked against/.test(n), "in the examiner's order: points, answer, then the invitation");
  check(examNote("tell me about the treaty") === undefined, "and nothing for a conversation");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
