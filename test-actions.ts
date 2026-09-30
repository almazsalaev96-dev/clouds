/**
 * The rooms as tools: the wire shape of a tool round, the record of what
 * was done, which tools are offered where, and the two tools that need no
 * database.
 */
import { usableTurns, didOf } from "./lib/providers/shared";
import { actionSpecs, actionsSection, runAction, doingOf, ACTION_AREAS } from "./lib/actions";
import type { Message } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const msg = (over: Partial<Message>): Message => ({ id: "m", conversationId: "c", parentId: null, role: "user", content: [], createdAt: 1, ...over });

console.log("\nA tool round goes back whole, in the provider's own shape");
{
  const raw = [{ type: "text", text: "Sure." }, { type: "tool_use", id: "t1", name: "save_cards", input: { deck: "X", cards: [] } }];
  const history: Message[] = [
    msg({ role: "user", content: [{ type: "text", text: "make me cards" }] }),
    msg({ role: "assistant", content: [], raw: { provider: "anthropic", content: raw } }),
    msg({ role: "user", content: [{ type: "tool_result", toolUseId: "t1", name: "save_cards", text: "Saved 3 cards", ok: true }] }),
  ];
  const turns = usableTurns(history, "anthropic");
  check(turns.length === 3, "three turns: the ask, the model's blocks, the results", `${turns.length}`);
  check(turns[1].role === "assistant" && turns[1].raw === raw, "the assistant turn is the raw blocks, untouched");
  check(turns[2].role === "user" && turns[2].results?.[0].toolUseId === "t1", "the results answer the call by id");
  const elsewhere = usableTurns(history, "openai");
  check(elsewhere.length === 1, "another company's raw is not sent, and the results after it are dropped with it", `${elsewhere.length}`);
  const plain = usableTurns(history);
  check(plain.length === 1, "and with no provider named, likewise", `${plain.length}`);
}

console.log("\nWhat an answer did is told to the turns after it");
{
  const m = msg({ role: "assistant", content: [{ type: "text", text: "Here you are." }], actions: [
    { id: "a", name: "save_cards", summary: "Saved 3 cards to “X”", ok: true, at: 1 },
    { id: "b", name: "save_note", summary: "Wrote the page “Y”", ok: true, at: 2, undone: true },
    { id: "c", name: "calculate", summary: "nope", ok: false, at: 3 },
  ] });
  const line = didOf(m);
  check(/Saved 3 cards/.test(line), "a done action is on the line");
  check(!/Wrote the page/.test(line), "an undone one is not — the page is gone");
  check(!/nope/.test(line), "nor a failed one");
  const t = usableTurns([msg({ role: "user", content: [{ type: "text", text: "hi" }] }), m], "anthropic");
  check(/Done in this app: Saved 3 cards/.test(t[1].text), "and it rides on the assistant's text on the wire", t[1].text.slice(-50));
  check(didOf(msg({ role: "assistant", content: [] })) === "", "nothing done, nothing said");
}

console.log("\nWhich tools are offered where");
{
  const all = actionSpecs({ conversationId: "c", projectId: "p", temporary: false, memoryOn: true }).map((s) => s.name);
  check(all.length === 25, "a full room offers the lot", `${all.length}: ${all.join(", ")}`);
  for (const name of ["read_note", "append_note", "read_made", "schedule_routine", "create_assistant", "list_memories", "forget", "convert_units", "search_sources", "read_web_page", "set_exam_date", "make_presentation", "make_document", "make_spreadsheet"]) check(all.includes(name), `including ${name}`);
  check(!all.includes("create_project"), "inside a project there is no second project to make");
  const loose = actionSpecs({ conversationId: "c", temporary: false, memoryOn: true }).map((s) => s.name);
  check(loose.includes("create_project") && loose.length === 25, "outside one, making a project takes the place of adding to it", `${loose.length}`);
  const temp = actionSpecs({ conversationId: "c", temporary: true, memoryOn: true }).map((s) => s.name);
  check(!temp.includes("remember") && !temp.includes("forget") && !temp.includes("list_memories"), "a temporary chat cannot remember, or read or change what is remembered");
  check(!temp.includes("save_to_project"), "and outside a project there is no project to add to");
  for (const name of ["schedule_routine", "create_project", "create_assistant", "set_exam_date"]) check(!temp.includes(name), `a temporary chat leaves nothing behind: no ${name}`);
  const off = actionSpecs({ conversationId: "c", temporary: false, memoryOn: false }).map((s) => s.name);
  check(!off.includes("remember"), "memory off is memory off");
  check(new Set(all).size === all.length, "no two tools share a name");
  const bad = actionSpecs({ conversationId: "c", temporary: false, memoryOn: true }).filter((s) => !/^[a-z_]+$/.test(s.name) || !s.description || (s.schema as { type?: string }).type !== "object");
  check(bad.length === 0, "every tool has a plain name, a description and an object schema", bad.map((b) => b.name).join(","));
  check(ACTION_AREAS.length === 17, "seventeen areas of the app are reachable", ACTION_AREAS.join(", "));
  const section = actionsSection(actionSpecs({ conversationId: "c", temporary: false, memoryOn: true }));
  check(/save_cards/.test(section) && /Do not use a writing tool unasked/.test(section), "the prompt names the tools and the manners");
  check(actionsSection([]) === "", "and says nothing when there are none");
  check(doingOf("save_cards") === "Saving cards" && doingOf("zzz") === "Working", "each tool has a line for the wait");
}

console.log("\nThe two tools that need no database");
(async () => {
  const ctx = { conversationId: "c", temporary: false, memoryOn: true };
  const sum = await runAction({ id: "1", name: "calculate", input: { expression: "123456789 * 987654321" } }, ctx);
  check(sum.ok && /121,932,631,112,635,269/.test(sum.text), "a big product is exact", sum.text);
  const bad = await runAction({ id: "2", name: "calculate", input: { expression: "fetch(x)" } }, ctx);
  check(!bad.ok && /Not a sum/.test(bad.text), "and something that is not a sum is refused, not evaluated", bad.text.slice(0, 40));
  const miles = await runAction({ id: "4", name: "convert_units", input: { value: 26.2, from: "miles", to: "km" } }, ctx);
  check(miles.ok && /26\.2 miles = 42\.16 km/.test(miles.text), "units convert exactly", miles.text);
  const hot = await runAction({ id: "5", name: "convert_units", input: { value: 100, from: "°C", to: "°F" } }, ctx);
  check(hot.ok && /= 212 °F/.test(hot.text), "temperatures too, offset and all", hot.text);
  const odd = await runAction({ id: "6", name: "convert_units", input: { value: 1, from: "kg", to: "m" } }, ctx);
  check(!odd.ok && /do not convert/.test(odd.text), "and a mass is not turned into a length", odd.text);
  const now = await runAction({ id: "3", name: "now", input: {} }, ctx);
  check(now.ok && /\d{4}/.test(now.text) && /\(/.test(now.text), "the clock gives a date and a zone", now.text);
  const none = await runAction({ id: "4", name: "delete_everything", input: {} }, ctx);
  check(!none.ok && /No tool called/.test(none.text), "an unknown tool is an error the model can read, not a throw");
  const shut = await runAction({ id: "5", name: "remember", input: { fact: "x" } }, { ...ctx, temporary: true });
  check(!shut.ok && /not available/.test(shut.text), "a tool not offered here is refused even if asked for");
  const late = await runAction({ id: "6", name: "schedule_routine", input: { prompt: "Quiz me", hour: 25 } }, ctx);
  check(!late.ok && /0 to 23/.test(late.text), "a routine at hour 25 is refused with the rule, not written", late.text);
  const mute = await runAction({ id: "7", name: "schedule_routine", input: { hour: 7 } }, ctx);
  check(!mute.ok && /needs the prompt/.test(mute.text), "and one with nothing to send is refused");
  const nameless = await runAction({ id: "8", name: "create_assistant", input: { instructions: "Be brief." } }, ctx);
  check(!nameless.ok && /needs a name/.test(nameless.text), "an assistant without a name is refused");
  const thin = await runAction({ id: "9", name: "make_presentation", input: { title: "Osmosis", slides: [{ layout: "title", title: "Osmosis" }] } }, ctx);
  check(!thin.ok && /at least two slides/.test(thin.text), "a presentation of one slide is refused before anything is written", thin.text);
  const bare = await runAction({ id: "10", name: "make_document", input: { title: "Report", markdown: "short" } }, ctx);
  check(!bare.ok && /needs a title and its content/.test(bare.text), "a document with nothing in it is refused before anything is written", bare.text);
  const empty = await runAction({ id: "11", name: "make_spreadsheet", input: { title: "Budget", sheets: [{ name: "x", rows: [] }] } }, ctx);
  check(!empty.ok && /at least one sheet with columns/.test(empty.text), "a spreadsheet with no columns is refused before anything is written", empty.text);
  console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
  process.exit(failed ? 1 : 0);
})();
