/**
 * The models work on the same page.
 *
 * The claims: on a full cast (Astro) the brief, every council seat and
 * the check all carry the project's document, the attachment and the
 * exchange before, not the question alone; council notes are headed by
 * the seat, once; an assistant is a way of working and not a second
 * identity; the study stance and Learn mode agree on one question; a
 * "thanks, shorter" follow-up is answered without a second model's check;
 * and the tools paragraph says when run_code and a compute block each
 * apply.
 *
 *   bash /tmp/claude-0/two.sh e2e-together   (needs both companies on the mock)
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "astro", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "Always show units.", rules: ["british"], name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true, lastConversationId: "cv1", section: "chat" };
const recent = async () => (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async (s) => {
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 }));
  const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
  const now = Date.now();
  const tx = db.transaction(["projects", "projectFiles", "assistants", "conversations"], "readwrite");
  tx.objectStore("projects").put({ id: "pr1", name: "Timetable review", description: "", instructions: "We are a UK secondary school of 900 pupils. Money is in pounds.", createdAt: now, updatedAt: now });
  tx.objectStore("projectFiles").put({ id: "pf1", projectId: "pr1", name: "budget.md", mimeType: "text/markdown", text: "# Budget\n\nStaffing £4.2m. Transport £310k. Energy £190k a year, of which Fridays are about 18%.", size: 90, createdAt: now });
  tx.objectStore("assistants").put({ id: "as1", name: "Chem coach", short: "chem-coach", icon: "⚗️", instructions: "Start every answer with a one-line safety note.", createdAt: now, updatedAt: now, uses: 0 });
  tx.objectStore("conversations").put({ id: "cv1", title: "Timetable", createdAt: now, updatedAt: now, pinned: false, archived: false, modelId: "astro", leafId: null, inputTokens: 0, outputTokens: 0, costUsd: 0, projectId: "pr1", assistantId: "as1" });
  await new Promise((res) => { tx.oncomplete = res; });
}, S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA full cast, all on the same page");
{
  check(await p.getByRole("button", { name: "Answering as Chem coach" }).isVisible(), "the seeded conversation is open, answering as the assistant");
  await fetch(`${MOCK}/__reset`);
  await p.locator('input[aria-label="Choose photos and files to attach"]').setInputFiles([{ name: "staff-survey.txt", mimeType: "text/plain", buffer: Buffer.from("Survey: 61% of staff would take a four-day week at the same pay.") }]).catch(() => {});
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: "Message" }).fill("Should the school move to a four-day week next year? Weigh the money, the staff, and the exam results, and tell me what you would do.");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(14000);
  const calls = await recent();
  const kinds = calls.map((r) => r.kind);
  check(kinds.includes("brief") && kinds.filter((k) => k === "council").length >= 2 && kinds.includes("verify"), "the turn briefed, convened and checked", kinds.join(" "));
  const brief = calls.find((r) => r.kind === "brief");
  const seats = calls.filter((r) => r.kind === "council");
  const verify = calls.find((r) => r.kind === "verify");
  check(Boolean(brief?.shared) && brief.sharedParts.includes("Project documents"), "the brief carries the project's document", (brief?.sharedParts ?? []).join(", "));
  check(seats.every((s) => s.shared && s.sharedParts.includes("Project documents")), "so does every council seat", seats.map((s) => (s.sharedParts ?? []).join("+")).join(" | "));
  check(Boolean(verify?.shared) && verify.sharedParts.includes("Project documents"), "and the check reads the same document before it objects", (verify?.sharedParts ?? []).join(", "));
  check(Boolean(brief?.sharedParts?.includes("Attached to the question")) && Boolean(verify?.sharedParts?.includes("Attached to the question")), "the attachment rides along too", `brief ${brief?.sharedParts?.join("+")} · check ${verify?.sharedParts?.join("+")}`);
  const answers = calls.filter((r) => r.kind === "answer");
  const sys = answers[0]?.system ?? "";
  check(/### On the reasoning/.test(sys) && !/On on/.test(sys), "council notes are headed by the seat, once", sys.match(/### On[^\n]*/g)?.join(" · "));
  check(/## Working as Chem coach/.test(sys) && /you are still Armi/.test(sys) && !/## You are Chem coach/.test(sys), "the assistant is a way of working, under the identity, not a second one");
  check(/run_code runs now/.test(sys) && /compute block runs after your reply/.test(sys), "the tools paragraph says when run_code and a compute block each apply");
  const rules = sys.indexOf("## Your rules");
  const asst = sys.indexOf("## Working as Chem coach");
  const proj = sys.indexOf("## Project:");
  check(rules > 0 && rules < asst && asst < proj, "in order: your rules, then the assistant, then the project", `${rules} < ${asst} < ${proj}`);
  check(answers.length === 2, "and the objection brought one revised answer, not more", `${answers.length} answers`);
}

console.log("\nA follow-up that only reshapes the answer is not checked again");
{
  await p.waitForTimeout(1500);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("thanks, can you make it shorter");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(9000);
  const calls = await recent();
  const kinds = calls.map((r) => r.kind);
  check(kinds.includes("answer") && !kinds.includes("verify"), "one answer, no second model reading a shortened version", kinds.join(" "));
  check(!kinds.includes("brief") && !kinds.includes("council"), "and no brief or council for three words", kinds.join(" "));
}

console.log("\nStudy: the stance and the mode agree");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("/study explain how a debounce works and why it matters for a search box");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(9000);
  const calls = await recent();
  const sys = calls.find((r) => r.kind === "answer")?.system ?? "";
  check(/## Mode: Learn/.test(sys), "Learn mode is on");
  check(/End with one short question/.test(sys) && !/three short questions/.test(sys), "and the teaching stance asks for one question, as the mode does", sys.match(/End with [^.]*\./)?.[0]);
  const brief = calls.find((r) => r.kind === "brief");
  check(Boolean(brief) && !brief.shared, "a brief with nothing extra to carry carries nothing", brief ? `shared ${brief.shared}` : "no brief");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
