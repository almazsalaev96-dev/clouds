/* The transcript, in the shape a provider will actually accept.
 *
 * This is the regression test for the worst bug this app has had. A chat is
 * rows in a database and a database holds things an API refuses: an answer
 * that thought and said nothing, a question whose answer failed and was
 * never stored, a row emptied by an abort. Sent as they are they become an
 * empty text block and two questions in a row, Anthropic rejects both, and
 * the first failure in a thread killed every turn after it — in the chat, in
 * the canvas, in the notebook, everywhere, because it all comes through here.
 *
 *   npx jiti test-turns.ts */
import { usableTurns } from "./lib/providers/shared";
import type { Message } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

let n = 0;
const msg = (role: Message["role"], text: string | null, extra: Partial<Message> = {}): Message => ({
  id: `m${n++}`, conversationId: "c", parentId: null, role,
  content: text === null ? [] : [{ type: "text", text }],
  createdAt: n, ...extra,
} as Message);
const shape = (ms: Message[]) => usableTurns(ms).map((t) => `${t.role[0]}:${t.text}`).join(" | ");

console.log("\nAn ordinary conversation is unchanged");
{
  const t = usableTurns([msg("user", "hi"), msg("assistant", "hello"), msg("user", "more")]);
  check(shape([msg("user", "hi"), msg("assistant", "hello"), msg("user", "more")]) === "u:hi | a:hello | u:more", "three turns, in order");
  check(t.length === 3 && t[0].images.length === 0, "and nothing invented");
}

console.log("\nWhat the database holds and an API refuses");
{
  /* The answer that thought and said nothing. It is stored — the reasoning
     is worth keeping — and it used to go out as {"type":"text","text":""}. */
  const reasoned = msg("assistant", null, { reasoning: "thinking out loud" });
  check(shape([msg("user", "hi"), reasoned, msg("user", "still there?")]) === "u:hi\n\nstill there?",
    "an answer with no words is not a turn, and the two questions around it become one",
    shape([msg("user", "hi"), reasoned, msg("user", "still there?")]).replace(/\n/g, "\\n"));
  check(shape([msg("user", "a"), msg("user", "b")]) === "u:a\n\nb", "two questions in a row are one question");
  check(shape([msg("assistant", "x"), msg("user", "a")]) === "u:a", "a leading answer is dropped — there is nothing for it to answer");
  check(shape([msg("user", "  \n "), msg("user", "real")]) === "u:real", "whitespace is not content");
  check(usableTurns([]).length === 0, "and nothing in is nothing out");
  check(usableTurns([msg("assistant", "only this")]).length === 0, "as is an answer on its own");
}

console.log("\nThe failure that started it");
{
  /* A turn fails: the question is stored, the answer never is. Every send
     after that used to carry user,user to a provider that rejects it — so
     the retry failed identically, and so did the next question, forever. */
  const dead = [msg("user", "make me a timer"), msg("user", "make me a timer")];
  const t = usableTurns(dead);
  check(t.length === 1 && t[0].role === "user", "a retry after a failed turn is one question, not two", `${t.length} turn`);
  const long = [msg("user", "q1"), msg("assistant", "a1"), msg("user", "q2"), msg("assistant", null), msg("user", "q3")];
  const shaped = usableTurns(long);
  check(shaped.map((x) => x.role).join(",") === "user,assistant,user", "and a thread with a hole in it still alternates", shaped.map((x) => x.role).join(","));
  check(shaped[shaped.length - 1].role === "user", "ending on the question, which is what a model is asked to answer");
}

console.log("\nImages ride along");
{
  const withImage = msg("user", "what is this", {
    content: [{ type: "image", mimeType: "image/png", data: "AAA" }, { type: "text", text: "what is this" }],
  } as Partial<Message>);
  const t = usableTurns([withImage]);
  check(t.length === 1 && t[0].images.length === 1 && t[0].text === "what is this", "a question with a picture keeps both");
  const merged = usableTurns([withImage, msg("user", "and this")]);
  check(merged.length === 1 && merged[0].images.length === 1 && merged[0].text.includes("and this"), "and merging two questions keeps the picture");
  const answerImage = msg("assistant", "look", {
    content: [{ type: "image", mimeType: "image/png", data: "AAA" }, { type: "text", text: "look" }],
  } as Partial<Message>);
  check(usableTurns([msg("user", "q"), answerImage])[1].images.length === 0, "a picture in an answer is not sent back as one");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
