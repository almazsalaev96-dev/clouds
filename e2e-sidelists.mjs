/**
 * The sidebar lists the room you are in.
 *
 * It listed conversations in every room, so in Study the column beside the
 * decks was a history of chats. Now each room's own things are there —
 * decks with what is due, pages with the pinned ones first, projects, what
 * you made — each one tap from opening, and the search box searches them.
 *
 * Needs the app on 3100 (see gate.sh).
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
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
const side = p.locator("aside");
const go = async (room) => { await side.locator("nav").getByRole("button", { name: room, exact: true }).click(); await p.waitForTimeout(700); };
const rows = (label) => side.getByRole("region", { name: label }).getByRole("button");

console.log("\nStudy: the decks, with what is due");
await go("Study");
const decks = await rows("Decks").allInnerTexts();
check(decks.length === 2, "both decks are in the sidebar", decks.map((t) => t.replace(/\s+/g, " ")).join(" | "));
check(decks.some((t) => /Osmosis/.test(t) && /\b8\b/.test(t) && !/8\s+8/.test(t)), "with what is due on each", decks.find((t) => /Osmosis/.test(t))?.replace(/\s+/g, " "));
await rows("Decks").filter({ hasText: "Cell biology" }).click();
await p.waitForTimeout(800);
check(/Cell biology/.test(await p.locator("main").innerText()), "and tapping one opens it");
check((await rows("Decks").filter({ hasText: "Cell biology" }).getAttribute("aria-current")) === "true", "and its row says it is the open one");

console.log("\nNotebook: the pages, pinned first");
await go("Notebook");
const pages = await rows("Pages").allInnerTexts();
check(/Osmosis, properly/.test(pages[0] ?? ""), "the pinned page leads", pages[0]);
await rows("Pages").filter({ hasText: "Krebs cycle" }).click();
await p.waitForTimeout(900);
const body = await p.locator("main").innerText();
check(/Krebs cycle turns acetyl-CoA/.test(body), "and tapping one opens it", body.split("\n").find((l) => /Krebs/.test(l))?.slice(0, 40));

console.log("\nProjects and Creations");
await go("Projects");
check((await rows("Projects").count()) === 2, "projects are listed", (await rows("Projects").allInnerTexts()).join(" | "));
await go("Creations");
const made = await rows("Made here").allInnerTexts();
check(made.length === 3 && made.some((t) => /Essay plan/.test(t)), "what you made is listed, with its kind", made.map((t) => t.replace(/\s+/g, " ")).join(" | "));

console.log("\nThe search box searches the room");
await go("Study");
await side.getByRole("button", { name: "Find a deck" }).click();
await side.getByRole("textbox", { name: "Search decks" }).fill("cell");
await p.waitForTimeout(400);
const found = await rows("Decks").allInnerTexts();
check(found.length === 1 && /Cell biology/.test(found[0]), "typing narrows the decks", found.join(" | "));
await go("Conversations");
check((await side.getByRole("button", { name: "Find a conversation" }).count()) + (await side.getByRole("textbox", { name: "Search conversations" }).count()) >= 1, "and in Conversations it is conversations again");

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
