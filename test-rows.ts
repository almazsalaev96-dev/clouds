/* What a restore is allowed to put in the database.
 *
 * The interesting half of this predicate is everything it refuses, and the
 * reason to test it at all is that the cost of getting it wrong is not a bad
 * row — it is an app that never opens again. `restoreBackup` asked one
 * question, is the id a string, and a message whose `content` came back as a
 * string rather than an array of blocks passed it, reached `blockText`, and
 * threw during render on every load from then on.
 *
 * So both directions, as always: the row that must be refused, and the
 * perfectly ordinary row that looks like it should be and must not.
 *
 *   npx jiti test-rows.ts */
import { admits, ROW_SHAPE } from "./lib/rows";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const none = new Set<string>();
const msg = (over: Record<string, unknown> = {}) => ({
  id: "m1", conversationId: "c1", role: "assistant",
  content: [{ type: "text", text: "hello" }], createdAt: 1, ...over,
});

console.log("\nThe row that made the app unopenable");
{
  check(!admits("messages", msg({ content: "a string, not blocks" }), none),
    "content as a string is refused — this is the one that threw in blockText");
  check(!admits("messages", msg({ content: null }), none), "and content as nothing");
  check(!admits("messages", msg({ content: {} }), none), "and content as an object that is not a list");
  check(!admits("messages", msg({ content: ["raw text"] }), none),
    "and a list of strings, which maps fine and then has no .type");
  check(admits("messages", msg(), none), "while an ordinary message is admitted");
  check(admits("messages", msg({ content: [] }), none),
    "and so is an empty one — a message with nothing in it renders as nothing, which is not a crash");
}

console.log("\nAnd the fields the render path reads without a guard");
{
  check(!admits("messages", msg({ role: "tool" }), none), "a role nothing knows how to draw is refused");
  check(!admits("messages", msg({ conversationId: undefined }), none), "and a message belonging to no conversation");
  check(!admits("conversations", { id: "c1", title: 42 }, none), "a title that is a number is refused");
  check(admits("conversations", { id: "c1" }, none), "but a conversation with no title yet is fine");
  check(!admits("canvasFiles", { id: "f1", path: "a.ts" }, none), "a file with no contents is refused");
  check(admits("canvasFiles", { id: "f1", path: "a.ts", content: "" }, none), "an empty file is not the same thing");
  check(!admits("sources", { id: "s1" }, none), "a source attached to no note is refused — nobody could ever delete it");
}

console.log("\nAnd the questions it asks of every table");
{
  check(!admits("messages", null, none), "nothing is not a row");
  check(!admits("messages", "a string", none), "and neither is a string");
  check(!admits("messages", [], none), "and neither is a list");
  check(!admits("messages", msg({ id: undefined }), none), "a row with no id is refused");
  check(!admits("messages", msg({ id: "" }), none), "and one with an empty id");
  check(!admits("messages", msg({ id: 7 }), none), "and one whose id is a number");
  check(!admits("messages", msg(), new Set(["m1"])), "and one already in the table, so a second import adds nothing");
}

console.log("\nA table with no rule of its own is not thereby unguarded");
{
  check(admits("notes", { id: "n1", body: "anything" }, none), "it still has to be an object with an id");
  check(!admits("notes", { body: "anything" }, none), "and without one it is refused like the rest");
  check(ROW_SHAPE.notes === undefined, "notes deliberately has no shape rule", "nothing in it is dereferenced unguarded");
}

console.log("\nAnd nothing a corrupt file can contain makes it throw");
{
  /* Everything `JSON.parse` can produce, which is the whole input domain: the
     only caller is `restoreBackup(parseBackup(await file.text()))`. A hostile
     getter is not in this list because a parsed file cannot contain one, and a
     guard against an input that cannot occur is dead code pretending to be
     caution. */
  const junk: unknown[] = [undefined, null, 0, NaN, "", [], {}, { id: {} }, { id: "x", content: NaN },
    Object.create(null), { id: "x", content: [[[[]]]] }, { id: "x".repeat(50000) }];
  for (const r of junk) {
    let ok = true;
    try { admits("messages", r, none); } catch { ok = false; }
    check(ok, `survives ${typeof r === "object" && r ? Object.prototype.toString.call(r) : JSON.stringify(r)}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
