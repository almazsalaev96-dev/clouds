/**
 * A conversation too long to send does not forget what it was about.
 *
 * The claims: when the window overflows, the turns that will not be sent are
 * read once and carried as a record; the record rides in the next request,
 * fenced as data; the transcript says summarised rather than lost; and it is
 * not bought again on the next question, because the boundary has not moved.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const box = () => p.getByRole("textbox", { name: "Message" });

const CONV = "seeded-long-thread";
/* 200,000 tokens of window, and the fitter works to 92% of it less the
   reply: about 170k tokens, which at four characters a token is 680k
   characters. Thirteen turns of 60k each overflows it by a few turns —
   enough to drop the opening and not so much that the page is slow. */
const FILLER = "The planner has to cover three subjects and the weeks between now and the exams. ".repeat(750);

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async ({ conv, filler }) => {
  const S = { theme: "dark", density: "comfortable", modelId: "claude-haiku-4-5", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: false, memoryOn: true, lastConversationId: conv, section: "chat" };
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: S, version: 1 }));

  const db = await new Promise((res, rej) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const now = Date.now();
  const messages = [];
  let parentId = null;
  for (let i = 0; i < 15; i++) {
    const id = `seed-${i}`;
    const opening = i === 0 ? "I am building a revision planner and my mascot for it is a pangolin. " : "";
    messages.push({ id, conversationId: conv, parentId, role: i % 2 === 0 ? "user" : "assistant", content: [{ type: "text", text: opening + filler }], createdAt: now - (15 - i) * 60_000 });
    parentId = id;
  }
  const tx = db.transaction(["conversations", "messages"], "readwrite");
  tx.objectStore("conversations").put({ id: conv, title: "The long one", createdAt: now - 900_000, updatedAt: now, pinned: false, archived: false, modelId: "claude-haiku-4-5", leafId: parentId, inputTokens: 0, outputTokens: 0, costUsd: 0 });
  for (const m of messages) tx.objectStore("messages").put(m);
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}, { conv: CONV, filler: FILLER });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500);

console.log("\nThe thread is too long, and says so");
{
  const line = await p.locator("main").innerText();
  /* The eyebrow renders uppercase, so nothing here reads case. */
  check(/earlier messages (summarised|not sent)/i.test(line), "the transcript says the opening did not fit", (line.split("\n").find((l) => /earlier message/i.test(l)) ?? "").slice(0, 70));
}

console.log("\nWhat will not fit is read once and carried");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("What am I working on, and what is the mascot?");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(7000);
  const { recent } = await fetch(`${MOCK}/__recent`).then((r) => r.json());
  check(recent.some((r) => r.kind === "recap"), "the dropped turns went to a model to be read", recent.map((r) => r.kind).join(" → "));
  const answer = recent.find((r) => r.kind === "answer");
  check(/## Earlier in this conversation/.test(answer?.system ?? ""), "and the request that followed carried the record");
  check(/<record>[\s\S]*pangolin[\s\S]*<\/record>/.test(answer?.system ?? ""), "with what the opening established, fenced as data",
    ((answer?.system ?? "").match(/<record>[\s\S]{0,120}/) ?? [""])[0].replace(/\s+/g, " "));
  check(/not a request being made of you now/.test((answer?.system ?? "").replace(/\s+/g, " ")), "and the sentence that stops it being read as orders");
  const line = await p.locator("main").innerText();
  check(/earlier messages summarised/i.test(line), "the transcript now says summarised rather than lost", (line.split("\n").find((l) => /earlier message/i.test(l)) ?? "").slice(0, 70));
}

console.log("\nIt is not bought twice");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("And when are the exams?");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(7000);
  const { recent } = await fetch(`${MOCK}/__recent`).then((r) => r.json());
  check(!recent.some((r) => r.kind === "recap"), "the next question does not pay for the record again", recent.map((r) => r.kind).join(" → "));
  const answer = recent.find((r) => r.kind === "answer");
  check(/<record>/.test(answer?.system ?? ""), "and still carries the one already written");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
