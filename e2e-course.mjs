/**
 * Courses: the exam a student is sitting, cut the way the board cuts it.
 *
 * The claims, on the screen and at the wire: a course is built from a
 * subject, a level and a board into a specification checklist; a topic
 * gives an exam question on demand, and what the student writes is marked
 * point by point against the scheme, with their answer rewritten to full
 * marks; what they missed becomes cards; notes are written for the topic;
 * a timed mock is aimed at the weakest topics and marked; and every mark
 * lifts the course's result on the Study index.
 *
 *   bash /tmp/claude-0/one.sh e2e-course
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);
const waitFor = async (loc, ms = 8000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
await fetch(`${MOCK}/__reset`);
await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
await p.waitForTimeout(700);

console.log("\nA course is built from a subject, a level and a board");
{
  const strip = p.getByRole("region", { name: "Your courses" });
  check(await strip.isVisible(), "Study offers courses before there are any", (await strip.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 90));
  await strip.getByRole("button", { name: /Add a course/ }).click();
  const form = p.getByRole("region", { name: "Add a course" });
  check(await form.isVisible(), "pressing it opens a short form, not a wizard");
  await form.getByLabel("Subject").fill("Biology");
  await form.getByRole("radiogroup", { name: "Level" }).getByRole("radio", { name: "GCSE", exact: true }).click();
  const boards = await form.getByRole("radiogroup", { name: "Exam board" }).getByRole("radio").allInnerTexts();
  check(boards.includes("AQA") && boards.includes("Edexcel") && boards.includes("OCR"), "the boards for the level are offered", boards.join(", "));
  await form.getByRole("radiogroup", { name: "Exam board" }).getByRole("radio", { name: "AQA" }).click();
  await form.getByRole("button", { name: "Build the course" }).click();
  const spec = p.getByRole("region", { name: "Specification" });
  check(await waitFor(spec), "the course opens on its specification");
  const seq = (await recent()).map((r) => r.kind);
  check(seq.includes("course"), "the specification was asked for", seq.join(" → "));
  const specText = await spec.innerText();
  check(/Cell biology/i.test(specText) && /4\.1\.3/.test(specText) && /Transport in cells/.test(specText) && /The heart/.test(specText), "units and topics with the board's codes", specText.replace(/\s+/g, " ").slice(0, 110));
  const result = p.getByRole("region", { name: "Course result" });
  check(/0%/.test(await result.innerText()) && /likely marks/.test(await result.innerText()), "the result starts honest: nothing tried is worth nothing");
  check(/Start Cell structure/.test(await result.innerText()), "and says where the first marks are");
  const saved = await rows("courses");
  check(saved.length === 1 && saved[0].name === "Biology · GCSE · AQA", "the course is kept", saved[0]?.name);
}

console.log("\nHow sure you are colours a topic until marks do");
{
  const group = p.getByRole("group", { name: "How sure are you about Cell division" });
  await group.getByRole("button", { name: "Not yet" }).click();
  await p.waitForTimeout(400);
  check(await group.getByRole("button", { name: "Not yet" }).getAttribute("aria-pressed") === "true", "a topic can be marked red");
  check(/Revise Cell division/.test(await p.getByRole("region", { name: "Course result" }).innerText()), "and a red topic becomes one of the next moves");
}

console.log("\nA topic gives an exam question and marks the answer point by point");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: "Open Transport in cells" }).click();
  await p.waitForTimeout(500);
  check(await p.getByRole("tab", { name: /^Questions/ }).getAttribute("aria-selected") === "true", "the topic opens on its exam questions");
  check(await p.getByRole("radiogroup", { name: "Difficulty" }).getByRole("radio").count() === 4, "four difficulties, easy to exam-style");
  await p.getByRole("radiogroup", { name: "Difficulty" }).getByRole("radio", { name: "Hard" }).click();
  await p.getByRole("button", { name: "Give me a question" }).click();
  const q = p.getByRole("region", { name: "Exam question" });
  check(await waitFor(q), "a question arrives");
  check(/\[3\]/.test(await q.innerText()) && /3 marks/.test(await q.innerText()), "with its marks", (await q.innerText()).replace(/\s+/g, " ").slice(0, 90));
  const asked = (await recent()).find((r) => r.kind === "question");
  check(/AQA/.test(asked?.head ?? "") && /Transport in cells/.test(asked?.head ?? "") && /5 to 6 marks/.test(asked?.head ?? ""), "written for the board, the topic and the difficulty");
  await q.getByRole("button", { name: "Show the mark scheme" }).click();
  check(/Mark scheme/.test(await q.innerText()) && /Examiner tip/.test(await q.innerText()), "the scheme, model answer and examiner tip are there if wanted");
  await q.getByRole("button", { name: "Hide the mark scheme" }).click();
  await q.getByLabel("Your answer").fill("The particles have more energy so they move faster.");
  await q.getByRole("button", { name: "Mark my answer" }).click();
  const marked = q.getByLabel(/out of 3 marks/);
  check(await waitFor(marked), "it is marked");
  check(await marked.getAttribute("aria-label") === "2 out of 3 marks", "2 of 3: the marks the answer earned and no more", await marked.getAttribute("aria-label"));
  const pts = q.getByRole("list", { name: "Mark points" });
  check(await pts.getByRole("listitem").count() === 3, "one line per mark point");
  check(await pts.getByLabel("Missed").count() === 1, "with the missed point shown as missed");
  check(/to full marks/.test(await q.innerText()) && /\[full marks\]/.test(await q.innerText()), "and their answer rewritten to full marks");
  const markCall = (await recent()).find((r) => r.kind === "exam-mark");
  check(/more energy so they move faster/.test(markCall?.asked ?? ""), "the marker was sent what the student wrote");
  const stored = await rows("marks");
  check(stored.length === 1 && stored[0].got === 2 && stored[0].marks === 3 && stored[0].topic === "Transport in cells", "the mark is kept against the topic", JSON.stringify(stored.map((r) => `${r.got}/${r.marks}`)));

  await q.getByRole("button", { name: "Turn what I missed into cards" }).click();
  await p.waitForTimeout(700);
  const cards = await rows("cards");
  check(cards.length === 1 && cards[0].topic === "Transport in cells", "what was missed becomes a card on the topic", `${cards.length} cards`);
  const decks = await rows("decks");
  check(decks.length === 1 && decks[0].name === "Biology · GCSE · AQA", "in the course's own deck", decks[0]?.name);

  await q.getByRole("button", { name: "Similar question" }).click();
  await p.waitForTimeout(1500);
  check(/Question 2/.test(await q.innerText()) && (await q.getByLabel("Your answer").inputValue()) === "", "a similar question is a new one, with an empty box");
  const avoid = (await recent()).filter((r) => r.kind === "question").at(-1);
  check(/Do not repeat/.test(avoid?.asked ?? "") && /Question 1/.test(avoid?.asked ?? ""), "and the question already had is named so it is not repeated");
  check(/2\/3/.test(await p.getByRole("region", { name: "Your answers on this topic" }).innerText()), "the answer given is listed under the topic");
}

console.log("\nRevision notes for exactly this topic");
{
  await p.getByRole("tab", { name: /^Notes/ }).click();
  await p.getByRole("button", { name: "Write the revision notes" }).click();
  const notes = p.getByRole("article", { name: "Revision notes" });
  check(await waitFor(notes), "the notes are written into the topic");
  await p.waitForTimeout(600);
  check(/Key points/.test(await notes.innerText()) && /Examiner tips/.test(await notes.innerText()), "key points to examiner tips", (await notes.innerText()).replace(/\s+/g, " ").slice(0, 60));
  const course = (await rows("courses"))[0];
  check(Object.keys(course.notes ?? {}).length === 1, "and kept as a Notebook page linked to the topic");
}

console.log("\nThe course's result rises with the marks");
{
  await p.getByRole("button", { name: "Back to Biology" }).click();
  await p.waitForTimeout(500);
  const txt = await p.getByRole("region", { name: "Course result" }).innerText();
  const likely = Number((txt.match(/(\d+)%/) ?? [])[1]);
  check(likely > 0, "likely marks are no longer nothing", `${likely}%`);
  check(/2 of 3 marks/.test(txt), "and the marks answered are counted", txt.replace(/\s+/g, " ").slice(0, 120));
}

console.log("\nA mock paper is aimed at the gaps, timed and marked");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("region", { name: "Mock exams" }).getByRole("button", { name: /Quick test · 15 min/ }).click();
  const questions = p.getByRole("list", { name: "Questions" });
  check(await waitFor(questions), "the paper opens");
  check(await p.getByRole("timer", { name: "Time left" }).isVisible(), "with a clock");
  const paperCall = (await recent()).find((r) => r.kind === "paper");
  const firstId = ((paperCall?.head ?? "").match(/- (u\dt\d): /) ?? [])[1];
  check(firstId === "u1t2", "the weakest topic is put first: the red one", firstId);
  check(await questions.getByRole("listitem").count() === 3, "three questions");
  await p.getByLabel("Answer to question 2").fill("More energy, so they move faster, so more cross per second.");
  await p.getByLabel("Answer to question 1").fill("Particles spread out.");
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: "Finish and mark" }).first().click();
  const result = p.getByRole("region", { name: "Paper result" });
  check(await waitFor(result, 15000), "it is marked when finished");
  const txt = await result.innerText();
  check(/3\/8/.test(txt.replace(/\s+/g, "")), "the paper's total", txt.replace(/\s+/g, " ").slice(0, 60));
  check(await result.getByRole("list", { name: "By topic" }).getByRole("listitem").count() >= 2, "broken down by topic, weakest first");
  const marks = (await recent()).filter((r) => r.kind === "exam-mark").length;
  check(marks === 2, "an unanswered question is not sent to be marked", `${marks} marking calls`);
  const mocks = await rows("mocks");
  check(mocks.length === 1 && mocks[0].finishedAt && mocks[0].got === 3 && mocks[0].out === 8, "the paper is kept with its score");
}

console.log("\nThe course is on the Study index with its result");
{
  await p.getByRole("button", { name: "Back to Biology" }).click();
  await p.waitForTimeout(400);
  check(/3 \/ 8/.test(await p.getByRole("list", { name: "Papers sat" }).innerText()), "the paper is listed on the course");
  await p.getByRole("button", { name: "Back to Study" }).click();
  await p.waitForTimeout(500);
  const tile = p.getByRole("button", { name: "Open course Biology · GCSE · AQA" });
  check(await tile.isVisible(), "the course has a tile");
  check(/\d+%/.test(await tile.innerText()) && /topics tried/.test(await tile.innerText()), "with its likely marks and how much is covered", (await tile.innerText()).replace(/\s+/g, " "));
  await p.reload({ waitUntil: "networkidle" });
  await p.locator("aside nav").getByRole("button", { name: "Study" }).first().click();
  await p.waitForTimeout(700);
  check(await p.getByRole("button", { name: "Open course Biology · GCSE · AQA" }).isVisible(), "and it survives a reload");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
