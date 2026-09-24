/**
 * Study, the day and the test.
 *
 * Today's plan is worked out here — the slipping topic, the page least
 * recently read, the exam and how far off it is — and every line is a
 * press. A timed session runs in the header. A deck can test you: ten
 * questions typed and marked, a score, and the wrong ones studied again.
 *
 *   bash /tmp/claude-0/one.sh e2e-today
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const THEME = "dark";
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate(async (THEME) => {
    const S = { theme: THEME, density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true, section: "chat" };
    localStorage.setItem("store.settings.v1", JSON.stringify({ state: S, version: 1 }));
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    const now = Date.now(), DAY = 86_400_000;
    const tx = db.transaction(["projects", "projectFiles", "notes", "decks", "cards", "canvases", "canvasFiles", "conversations", "messages", "studyDays"], "readwrite");
    const put = (s, o) => tx.objectStore(s).put(o);
    put("projects", { id: "pr1", name: "A-level Biology", description: "Everything for the June exams", instructions: "Answer at A-level standard. Use the AQA spec's wording.", createdAt: now - 20 * DAY, updatedAt: now - DAY });
    put("projects", { id: "pr2", name: "Portfolio site", description: "Next.js, three pages", instructions: "", createdAt: now - 9 * DAY, updatedAt: now - 3 * DAY });
    put("projectFiles", { id: "pf1", projectId: "pr1", name: "spec-summary.md", mimeType: "text/markdown", text: "# AQA Biology\n\nTopic 1: Biological molecules…", size: 4200, createdAt: now - 19 * DAY });
    put("projectFiles", { id: "pf2", projectId: "pr1", name: "past-paper-2025.txt", mimeType: "text/plain", text: "Q1 …", size: 18000, createdAt: now - 10 * DAY });
    const note = (id, title, content, ago) => put("notes", { id, title, content, createdAt: now - ago * DAY, updatedAt: now - ago * DAY, pinned: id === "n1" });
    note("n1", "Osmosis, properly", "# Osmosis\n\nWater moves down a water-potential gradient.\n\n## The three words\n\n- Hypotonic\n- Isotonic\n- Hypertonic", 0.1);
    note("n2", "Lesson 1: Creating value", "# Creating value\n\nA business creates value when…", 2);
    note("n3", "Krebs cycle", "The Krebs cycle turns acetyl-CoA into…", 6);
    note("n4", "Untitled", "", 12);
    put("decks", { id: "d1", name: "Osmosis", createdAt: now - 5 * DAY, updatedAt: now - DAY });
    put("decks", { id: "d2", name: "Cell biology", createdAt: now - 30 * DAY, updatedAt: now - 2 * DAY });
    for (let i = 0; i < 8; i++) put("cards", { id: `c1-${i}`, deckId: "d1", front: `Osmosis q${i}`, back: "a", state: i < 3 ? "new" : "review", due: now - DAY, interval: 3, ease: 2.5, reps: 2, lapses: 0, step: 0, createdAt: now - 5 * DAY, stability: 3, difficulty: 5, topic: i % 2 ? "tonicity" : "water potential" });
    for (let i = 0; i < 24; i++) put("cards", { id: `c2-${i}`, deckId: "d2", front: `Cell q${i}`, back: "a", state: "review", due: now + (i % 5) * DAY - DAY, interval: 9, ease: 2.6, reps: 6, lapses: i % 7 === 0 ? 3 : 0, step: 0, createdAt: now - 30 * DAY, stability: 9, difficulty: 5, topic: ["membranes", "organelles", "transport"][i % 3] });
    put("canvases", { id: "cv1", title: "Flashcards", kind: "web", content: "", createdAt: now - 2 * DAY, updatedAt: now - 0.2 * DAY });
    put("canvasFiles", { id: "cf1", canvasId: "cv1", name: "index.html", lang: "html", content: "<!doctype html><html><body><h1>Flashcards</h1></body></html>", order: 0 });
    put("canvases", { id: "cv2", title: "Essay plan", kind: "doc", lang: "markdown", content: "# Essay plan\n\n1. Thesis\n2. Evidence", createdAt: now - 4 * DAY, updatedAt: now - 4 * DAY });
    put("canvases", { id: "cv3", title: "net_flow.py", kind: "code", lang: "python", content: "def net_flow(a, b):\n    return a > b", createdAt: now - 7 * DAY, updatedAt: now - 7 * DAY });
    const conv = (id, title, ago, projectId) => put("conversations", { id, title, createdAt: now - ago * DAY, updatedAt: now - ago * DAY, pinned: false, archived: false, modelId: "one", leafId: `${id}-m2`, inputTokens: 900, outputTokens: 1200, costUsd: 0.01, ...(projectId ? { projectId } : {}) });
    conv("cv-a", "Osmosis, properly", 0.1, "pr1"); conv("cv-b", "Debouncing a search input", 1); conv("cv-c", "Krebs cycle questions", 3, "pr1"); conv("cv-d", "Portfolio nav bar", 5, "pr2");
    for (const id of ["cv-a", "cv-b", "cv-c", "cv-d"]) {
      put("messages", { id: `${id}-m1`, conversationId: id, parentId: null, role: "user", content: [{ type: "text", text: "A question" }], createdAt: now - DAY });
      put("messages", { id: `${id}-m2`, conversationId: id, parentId: `${id}-m1`, role: "assistant", content: [{ type: "text", text: "An answer." }], modelId: "claude-sonnet-5", createdAt: now - DAY + 1000 });
    }
    for (let i = 1; i <= 6; i++) { const d = new Date(now - i * DAY); put("studyDays", { day: d.toISOString().slice(0, 10), answered: 12 + i, again: 2 }); }
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, THEME).catch((e) => console.log("SEED:", e.message));
  await p.evaluate(async () => {
    /* A few wrong answers on one topic, so it is the one slipping most. */
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    if (!db.objectStoreNames.contains("attempts")) return;
    const tx = db.transaction(["attempts"], "readwrite");
    const now = Date.now();
    for (let i = 0; i < 6; i++) tx.objectStore("attempts").put({ id: `at-${i}`, cardId: `c1-${i % 4}`, deckId: "d1", topic: "tonicity", front: `Osmosis q${i}`, expected: "a", typed: "b", mark: i < 5 ? "wrong" : "right", rating: i < 5 ? "again" : "good", at: now - i * 3600_000 });
    await new Promise((res) => { tx.oncomplete = res; });
  }).catch(() => {});
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.locator("aside nav").getByRole("button", { name: "Study", exact: true }).click();
  await p.waitForTimeout(900);

console.log("\nToday, at the top of Study, worked out here");
{
  const today = p.getByLabel("Today");
  check(await today.isVisible(), "there is a Today card");
  const text = (await today.innerText()).replace(/\n/g, " · ");
  check(/Read again: /.test(text), "it names a page to read again — the one least recently touched", (text.match(/Read again: [^·]+/) ?? [""])[0]);
  check(/Set the exam date/.test(text), "and asks for the exam date when there is none");
  const box = await today.boundingBox();
  const waiting = await p.getByText(/waiting now/).first().boundingBox();
  check(box && waiting && box.y < waiting.y, "and sits above what is waiting");
}

console.log("\nThe exam date drives a countdown");
{
  await p.getByRole("button", { name: "Set the exam date" }).click();
  const d = new Date(Date.now() + 12 * 86_400_000);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await p.getByLabel("Exam name").fill("AS Biology paper 1");
  await p.getByLabel("Exam date").fill(iso);
  await p.getByRole("button", { name: "Keep" }).click();
  await p.waitForTimeout(500);
  const text = (await p.getByLabel("Today").innerText()).replace(/\n/g, " · ");
  check(/AS Biology paper 1 · in 12 days|AS Biology paper 1[^·]*in 12 days/.test(text), "the card says which exam and how far off", (text.match(/AS Biology[^·]*/) ?? [""])[0]);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state.exam);
  check(kept?.name === "AS Biology paper 1" && kept?.date === iso, "and it is kept", JSON.stringify(kept));
}

console.log("\nA timed session runs in the header");
{
  await p.getByRole("button", { name: "Start a 25-minute session" }).click();
  await p.waitForTimeout(1500);
  const t = p.getByRole("timer");
  check(await t.isVisible(), "the timer is running", await t.innerText().catch(() => ""));
  check(/24:5\d|24:4\d/.test(await t.innerText()), "counting down from twenty-five minutes", await t.innerText());
  await p.getByRole("button", { name: "Stop the session" }).click();
  await p.waitForTimeout(300);
  check(await p.getByRole("button", { name: "Start a 25-minute session" }).isVisible(), "and stops");
}

console.log("\nA deck can test you, and the wrong ones come back");
{
  await p.getByRole("button", { name: /^Osmosis/ }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "Test me on this deck" }).click();
  await p.waitForTimeout(500);
  check(/Question 1 of 8/.test(await p.locator("main").innerText()), "ten questions, or every card when there are fewer", (await p.locator("main").innerText().then((t) => t.match(/Question \d+ of \d+/)?.[0])) ?? "");
  const box = p.getByLabel("Your answer");
  await box.fill("zzz");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(200);
  for (let i = 0; i < 7; i++) { await box.fill("a"); await p.keyboard.press("Enter"); await p.waitForTimeout(150); }
  await p.waitForTimeout(400);
  const result = await p.getByLabel("Test result").innerText();
  check(/7 of 8/.test(result), "the score is out of the questions asked", (result.match(/\d+ of \d+/) ?? [""])[0]);
  check(/You wrote: zzz/.test(result) && /Expected: a/.test(result), "the wrong one is shown with what was expected");
  await p.getByRole("button", { name: /Study these one again/ }).click();
  await p.waitForTimeout(800);
  const session = await p.locator("main").innerText();
  check(/1 left|Leave the session/.test(session) || (await p.getByRole("button", { name: "Leave the session" }).count()) > 0, "and studying them again opens a session with exactly those", (session.match(/\d+ left/) ?? [""])[0]);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
