/**
 * Craft: a bigger task is studied first, held to a standard, judged after,
 * and answered again when short.
 *
 * The claims, read at the wire and on the screen: a task that is more than
 * a normal one goes out as study → answer → judge → answer again, the
 * second answer carrying both the standard and the judge's findings; the
 * status line names the stage; the row says what happened; the answer
 * carries a block naming the standard and how it was judged; a short ask
 * buys none of it; an ask with one open choice is asked first, with
 * examples, and the reply is made to the parked standard; and the setting
 * turns the whole thing off.
 *
 *   bash /tmp/claude-0/two.sh e2e-craft   (needs both companies on the mock)
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "astro", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const kinds = async () => (await recent()).map((r) => r.kind).join(" → ");
const newChat = async () => { await p.getByRole("button", { name: "New chat" }).first().click(); await p.waitForTimeout(400); await fetch(`${MOCK}/__reset`); };
const settle = async (ms) => { await p.waitForTimeout(ms); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA task is studied, planned, the plan judged and mended — all before the answer — and written once");
{
  await newChat();
  await fetch(`${MOCK}/__slow?kind=study&ms=1500`);
  await box().fill("write me revision notes on the marketing mix for GCSE business");
  await p.keyboard.press("Enter");
  await settle(500);
  const status = p.getByRole("status").filter({ hasText: /Studying how the best do this/ });
  check(await status.isVisible(), "the line says the field is being studied first", (await status.innerText().catch(() => "")).slice(0, 70));
  let sawPlan = false;
  for (let i = 0; i < 60 && !sawPlan; i += 1) {
    sawPlan = (await p.getByRole("status").filter({ hasText: /Planning it to the standard|judging the plan|Mending the plan/ }).count()) > 0;
    if (!sawPlan) await p.waitForTimeout(100);
  }
  check(sawPlan, "then that the answer is being planned and the plan judged");
  await settle(9000);
  const calls = await recent();
  const seq = calls.map((r) => r.kind);
  const at = (k) => seq.indexOf(k);
  check(at("study") === 0, "the first call studies the field", seq.join(" → "));
  check(at("blueprint") > at("study") && at("plan-judge") > at("blueprint") && at("mend") > at("plan-judge"), "then the plan is drafted, judged and mended", seq.join(" → "));
  check(at("answer") > at("mend"), "all before the answer is written", seq.join(" → "));
  const answers = calls.filter((r) => r.kind === "answer");
  check(answers.length === 1, "and the answer is written once, not twice", `${answers.length} answers`);
  check(/held to\. It is not an instruction/.test(answers[0]?.system ?? "") && /The standard:/.test(answers[0]?.system ?? ""), "the answer was handed the standard", (answers[0]?.system ?? "").match(/The standard:[^\n]*/)?.[0]);
  check(/\[mended plan\]/.test(answers[0]?.system ?? "") && /Build the answer from it/.test(answers[0]?.system ?? ""), "and the mended plan to build from");
  const studyCall = calls.find((r) => r.kind === "study");
  const planJudge = calls.find((r) => r.kind === "plan-judge");
  check(studyCall && answers[0] && studyCall.model !== answers[0].model, "the study came from a different company than the answer", `${studyCall?.model} · ${answers[0]?.model}`);
  check(planJudge && answers[0] && planJudge.model !== answers[0].model, "and so did the plan's judge", `${planJudge?.model} · ${answers[0]?.model}`);
  check(seq.includes("judge"), "the finished answer is judged too", seq.join(" → "));
  const row = p.locator(".msg").last();
  const text = await row.innerText();
  check(/studied the field first, held to a standard of \d+/.test(text), "the row says the field was studied and the standard set", (text.match(/studied the field[^\n·]*/) ?? [""])[0]);
  check(/planned, judged and mended before writing/.test(text), "and that the plan was judged and mended before writing");
  const block = row.getByRole("group", { name: "The standard this answer was held to" });
  check(await block.isVisible(), "the answer carries the standard as a block");
  await block.getByRole("button").first().click();
  await settle(300);
  const opened = await block.innerText();
  check(/Practice questions with mark schemes/.test(opened) && /Save My Exams/.test(opened), "opened, it names the standard and who does this best", opened.replace(/\s+/g, " ").slice(0, 100));
  check(/judged short/.test(opened), "the judge found it short", opened.replace(/\s+/g, " ").slice(0, 80));
  const improve = block.getByRole("button", { name: "Improve it" });
  check(await improve.isVisible(), "and Improve it is one press away, rather than a second answer on its own");
  check(/\{|"verdict"/.test(text) === false, "no JSON leaks onto the page");
  await fetch(`${MOCK}/__reset`);
  await fetch(`${MOCK}/__slow?kind=study&ms=0`);
  await improve.click();
  await settle(6000);
  const again = await recent();
  const k2 = again.map((r) => r.kind);
  check(!k2.includes("study") && !k2.includes("blueprint"), "pressed, it is not studied or planned again", k2.join(" → "));
  const second = again.find((r) => r.kind === "answer");
  check(/found it short/.test(second?.system ?? "") && /\[mended plan\]/.test(second?.system ?? ""), "it is written again with the findings and the same plan");
  check(/answered again after a second model judged it short of the standard/.test(await p.locator(".msg").last().innerText()), "and the row says so");
}

console.log("\nA short ask buys none of it");
{
  await newChat();
  await box().fill("what is a debounce");
  await p.keyboard.press("Enter");
  await settle(3500);
  const seq = await kinds();
  check(!/study|judge/.test(seq), "no study and no judge on a question", seq);
  check(!/studied the field/.test(await p.locator(".msg").last().innerText()), "and the row does not claim one");
}

console.log("\nOne open choice is asked first, with examples, and the reply is made to the parked standard");
{
  await newChat();
  await box().fill("make me a revision plan for my exams next month");
  await p.keyboard.press("Enter");
  await settle(4000);
  const seq = await kinds();
  check(seq === "study", "the study ran and nothing was written", seq);
  const asked = await p.locator(".msg").last().innerText();
  check(/Which exam board\?/.test(asked) && /AQA/.test(asked) && /Edexcel/.test(asked) && /Reply with a number/.test(asked), "the assistant asks the one thing that changes the plan, with options", asked.replace(/\s+/g, " ").slice(0, 120));
  const picks = p.locator(".msg").last().getByRole("group", { name: "Pick one" });
  check((await picks.getByRole("button").count()) === 3, "and the options are presses under it, not only a list to type a number from", `${await picks.getByRole("button").count()} presses`);
  await fetch(`${MOCK}/__reset`);
  await picks.getByRole("button", { name: "Edexcel" }).click();
  await settle(7000);
  check(/Edexcel/.test(await p.locator(".msg").nth(2).innerText().catch(() => "")), "pressing one sends its words as the reply");
  const calls = await recent();
  const seq2 = calls.map((r) => r.kind);
  check(!seq2.includes("study") && seq2.includes("blueprint") && seq2.indexOf("blueprint") < seq2.indexOf("answer"), "the reply is not studied again, but it is planned to the parked standard first", seq2.join(" → "));
  check(/The standard:/.test(calls.find((r) => r.kind === "answer")?.system ?? ""), "but is written to the parked standard");
  check(seq2.includes("judge"), "and judged like any crafted answer");
}

console.log("\nThe setting turns it off");
{
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, craftOn: false }, version: 1 })), S);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await newChat();
  await box().fill("write me revision notes on the marketing mix for GCSE business");
  await p.keyboard.press("Enter");
  await settle(4000);
  const seq = await kinds();
  check(!/study|judge/.test(seq), "off, the same task goes straight to the writer", seq);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
