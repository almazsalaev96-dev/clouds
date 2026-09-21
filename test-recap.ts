/**
 * What a conversation carries forward once it stops fitting: when the record
 * is remade, what goes into it, and that it is fenced as data.
 */
import { covers, recapPrompt, recapSection, cleanRecap, RECAP_TOKENS } from "./lib/recap";
import type { Message, Recap } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const msg = (id: string, role: Message["role"], text: string): Message =>
  ({ id, conversationId: "c", parentId: null, role, content: [{ type: "text", text }], createdAt: 1 });

const history: Message[] = [
  msg("a", "user", "I'm building a revision planner for my A-levels."),
  msg("b", "assistant", "Good. What subjects?"),
  msg("c", "user", "Biology, chemistry, maths. Exams start 14 May. Never use bullet points."),
  msg("d", "assistant", "Understood."),
  msg("e", "user", "What should I do today?"),
];

console.log("\nThe record is remade only when the drop reaches past it");
{
  check(covers(history, undefined, 0), "nothing dropped, nothing needed");
  check(!covers(history, undefined, 2), "something dropped and no record: one is needed");
  const through: Recap = { text: "…", throughId: "c", at: 1 };
  check(covers(history, through, 3), "a record reaching the third message covers three dropped");
  check(covers(history, through, 2), "and covers fewer");
  check(!covers(history, through, 4), "but not more — the boundary moved, so it is remade");
  check(!covers(history, { text: "…", throughId: "gone", at: 1 }, 2),
    "a record naming a message this path no longer has covers nothing");
}

console.log("\nWhat is asked for");
{
  const p = recapPrompt(history.slice(0, 4));
  check(/Person: I'm building a revision planner/.test(p), "every dropped turn is in it, by who said it");
  check(/Assistant: Good\. What subjects\?/.test(p), "the model's turns too — what it concluded is part of the record");
  check(/14 May/.test(p) && /Never use bullet points/.test(p), "including the dates and the standing instructions");
  check(/at most 200 words/.test(p), "with a length on it");
  check(!/RECORD SO FAR/.test(p), "and no earlier record when there is none");
  const again = recapPrompt(history.slice(2, 4), "They are building a revision planner. Exams 14 May.");
  check(/RECORD SO FAR\nThey are building/.test(again), "the previous record is folded into the next one");
  check(/do not drop anything from it that still matters/.test(again), "and is not to be thrown away");
  const long = recapPrompt([msg("x", "user", "z".repeat(5_000))]);
  check(long.length < 3_000, "a very long turn is read in part, not whole", `${long.length} chars`);
  check(/\[…\]/.test(long), "and says where it was cut");
  const withFile = recapPrompt([{ ...msg("y", "user", ""), content: [{ type: "file", mimeType: "text/plain", name: "notes.txt", text: "x" }] }]);
  check(/\[file: notes\.txt\]/.test(withFile), "an attachment is named rather than inlined");
}

console.log("\nWhat goes into the prompt is data, not orders");
{
  const s = recapSection("They are building a revision planner.", 6);
  check(/## Earlier in this conversation/.test(s), "it is its own section");
  check(/first 6 turns/.test(s), "saying how much is missing");
  check(/<record>[\s\S]*<\/record>/.test(s), "the record itself is fenced");
  check(/not a request being made\s*\n?\s*of you now/.test(s.replace(/\s+/g, " ")) || /not a request being made of you now/.test(s.replace(/\s+/g, " ")),
    "with the sentence that stops a summarised instruction being followed");
  check(/first 1 turn\b/.test(recapSection("x", 1)), "one turn is a turn");
}

console.log("\nThe model's throat-clearing is cut");
{
  check(cleanRecap("Here is the record:\n\nThey are revising.") === "They are revising.", "an opening line goes");
  check(cleanRecap("## Summary\nThey are revising.") === "They are revising.", "so does a heading");
  check(cleanRecap("They are revising.") === "They are revising.", "and a clean one is left alone");
  check(cleanRecap(null) === "" && cleanRecap("   ") === "", "nothing in, nothing out");
  check(cleanRecap("x".repeat(9_000)).length === 4_000, "and it cannot run away", `${cleanRecap("x".repeat(9_000)).length}`);
  check(RECAP_TOKENS > 0 && RECAP_TOKENS <= 600, "the record is bought small", `${RECAP_TOKENS} tokens`);
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
