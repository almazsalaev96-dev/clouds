/**
 * Every room with something in it.
 *
 * The rooms were only ever looked at empty, and empty rooms hide four bugs
 * that a seeded one shows in a second: a "NaN%" recall line from a study
 * day written before `right` existed; notebook and artifact rows showing
 * "## " and "# " from the markdown they preview; a deck of numbered cards
 * listed q0, q1, q10, q11; and project rows that name the project without
 * saying what is in it.
 */
import { chromium } from "playwright";
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1366, height: 1024 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
const go = async (label) => { await p.getByRole("button", { name: label }).first().click(); await p.waitForTimeout(900); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async () => {
  const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true, section: "chat" };
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
}).catch((e) => console.log("SEED:", e.message));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const main = () => p.locator("main").innerText();

console.log("\nProjects: a row says what is inside");
{
  await go("Projects");
  const t = await main();
  check(/2 files · 2 chats/.test(t), "files and chats are counted on the row", (t.match(/2 files[^\n]*/) ?? [""])[0]);
  check(/yesterday|today|days ago/.test(t), "and when it was last touched");
  await p.getByText("A-level Biology").first().click();
  await p.waitForTimeout(900);
  const open = await main();
  check(/About [\d,]+ tokens — all of it reaches the model/.test(open), "a small knowledge set is not called 0%", (open.match(/About[^\n]*/) ?? [""])[0]);
  /* Eyebrows render uppercase, so innerText carries no case. */
  const up = open.toUpperCase();
  check(up.indexOf("CHATS IN THIS PROJECT") !== -1 && up.indexOf("CHATS IN THIS PROJECT") < up.indexOf("CODE IN THIS PROJECT"), "chats come before code");
  const rows = await p.getByLabel("Project instructions").getAttribute("rows");
  check(Number(rows) <= 4, "one line of instructions gets a box for a few lines, not a page", `rows=${rows}`);
}

console.log("\nNotebook and Artifacts: previews are prose");
{
  await go("Notebook");
  const t = await main();
  check(!/#{1,6} |^- |\s- Hypotonic/m.test(t), "no heading or bullet marks leak into a row", (t.match(/Water moves[^\n]*/) ?? [""])[0]);
  check(/The three words Hypotonic Isotonic Hypertonic/.test(t), "the words are all still there");
  await go("Artifacts");
  const a = await main();
  check(!/# Essay plan/.test(a) && /Essay plan/.test(a), "a document's row shows its text, not its heading mark", (a.match(/Essay plan[^\n]*\n[^\n]*/) ?? [""])[0].replace(/\n/g, " · "));
}

console.log("\nStudy: no NaN, and cards in the order they matter");
{
  await go("Study");
  const t = await main();
  check(!/NaN/.test(t), "a study day without a `right` count does not put NaN on the screen");
  check(/Known when asked, last 30 days: \d+%/.test(t), "the recall line still shows with the rest counted", (t.match(/Known when asked[^\n]*/) ?? [""])[0].slice(0, 60));
  await p.getByText("Cell biology").first().click();
  await p.waitForTimeout(900);
  const fronts = await p.locator("main").getByRole("button", { name: /^Edit “/ }).allInnerTexts();
  const order = fronts.map((f) => f.split("\n")[0]);
  check(order.length === 24, "every card is listed", `${order.length}`);
  const dues = await p.locator("main").locator("span.tnum").allInnerTexts();
  const firstLater = dues.findIndex((d) => /^in /.test(d));
  const lastNow = dues.lastIndexOf("now");
  check(firstLater === -1 || lastNow < firstLater, "everything due now is above everything due later", `${dues.slice(0, 12).join(", ")}`);
  check(!(order[1] === "Cell q1" && order[2] === "Cell q10"), "and not sorted as text", order.slice(0, 4).join(", "));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
