/**
 * The Studio: study material from anything, written to a standard and
 * checked, opened from any room.
 *
 * The claims, on the screen and at the wire: the Studio room leads with the
 * study tools; a book is read first and the student is told what it is and
 * asked what to make, with the tools that suit it already ticked; each page
 * is written under the house rules and its standard, checked by a second
 * reading, and rewritten once when it falls short, and says so at its foot;
 * a paper is made to sit and to print; a quiz is marked without a model;
 * the answer checker writes a scheme when none is given and marks against
 * it; a book added to a Notebook page is met with the question of what to
 * make from it; a topic alone is enough; and a chat ask for a kind of study
 * material the Studio knows is crafted to the house standard.
 *
 *   bash /tmp/claude-0/one.sh e2e-studio
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, rules: ["worked"] };
const CHAPTER = [
  "Osmosis is the movement of water across a partially permeable membrane from a region of higher water potential to a region of lower water potential.",
  "Water potential is measured in kilopascals and pure water has a water potential of zero.",
  "A cell placed in a hypotonic solution gains water; an animal cell may burst while a plant cell becomes turgid.",
  "A cell placed in a hypertonic solution loses water; a plant cell becomes flaccid and then plasmolysed.",
].join("\n\n");
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);
const waitFor = async (loc, ms = 10000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };
/* Waited for, not slept through: a cold server on a busy machine is slower
   than a fixed pause, and a check that reads the calls too soon fails for
   the wrong reason. */
const until = async (pred, ms = 20000) => {
  for (let t = 0; t < ms; t += 250) {
    if (pred(await recent())) return;
    await new Promise((r) => setTimeout(r, 250));
  }
};
const dialog = () => p.getByRole("dialog", { name: /Studio|Answer checker/ });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
await fetch(`${MOCK}/__reset`);

console.log("\nThe Studio room leads with the study tools");
{
  await p.locator("aside nav").getByRole("button", { name: "Studio" }).first().click();
  const tools = p.getByRole("region", { name: "Study tools" });
  check(await waitFor(tools), "the study tools are the first thing in the Studio");
  check(await tools.getByRole("button", { name: "Check an answer" }).isVisible() && await tools.getByRole("button", { name: "Make exam paper" }).isVisible(), "the checker and the paper maker are among them");
  await tools.getByRole("button", { name: /All \d+ tools/ }).click();
  const all = await tools.getByRole("listitem").count();
  check(all >= 18, "every tool is one press away", `${all} tools`);
}

console.log("\nA book is read first, and the student is asked what to make");
{
  await p.getByRole("button", { name: /Make study materials from a book or notes/ }).click();
  check(await waitFor(dialog()), "the Studio opens over the room");
  await p.getByLabel("Choose a file to make study material from").setInputFiles({ name: "osmosis-chapter.txt", mimeType: "text/plain", buffer: Buffer.from(CHAPTER) });
  const what = p.getByRole("region", { name: "What it is" });
  check(await waitFor(what), "it reads the book and says what it is");
  check(/Osmosis/.test(await what.innerText()) && /Biology · GCSE/.test(await what.innerText()), "the title, the subject and the level", (await what.innerText()).replace(/\s+/g, " ").slice(0, 80));
  await until((c) => c.some((r) => r.kind === "reading"));
  const reading = (await recent()).find((r) => r.kind === "reading");
  check(/partially permeable membrane/.test(reading?.asked ?? ""), "from the book's own words", (await recent()).map((r) => r.kind).join(" → "));
  const list = p.getByRole("list", { name: "What to make" });
  const on = async (name) => (await list.getByRole("checkbox", { name, exact: true }).getAttribute("aria-checked")) === "true";
  check(await on("Revision notes") && await on("Flashcards") && await on("Exam paper"), "the tools that suit a textbook chapter are ticked");
  check(!(await on("Essay plan")), "and the ones that do not, are not");
  check((await p.getByLabel("Level").inputValue()) === "GCSE", "the level it read is filled in, and can be changed");
  await list.getByRole("checkbox", { name: "Quiz", exact: true }).click();
  await p.getByLabel("Exam board").fill("AQA");
  await p.getByRole("radiogroup", { name: "Paper length" }).getByRole("radio", { name: "15 min" }).click();
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: /^Make 4/ }).click();
  const made = p.getByRole("list", { name: "What is being made" });
  await p.getByText("Ready", { exact: true }).waitFor({ timeout: 30000 }).catch(() => {});
  const txt = await made.innerText();
  check(/Revision notes[\s\S]*rewritten where it fell short/.test(txt), "the notes were checked, found short, and rewritten", txt.replace(/\s+/g, " ").slice(0, 120));
  const seq = (await recent()).map((r) => r.kind);
  check(seq.includes("studio-check") && seq.indexOf("studio-fix") > seq.indexOf("studio-check"), "write, check, then fix", seq.join(" → "));
  const writer = (await recent()).find((r) => /THE TASK: Revision notes/.test(r.asked ?? ""));
  check(/Correct first/.test(writer?.asked ?? "") && /THE STANDARD it will be checked against/.test(writer?.asked ?? "") && /Exam board: AQA/.test(writer?.asked ?? ""), "written under the house rules, the standard, and the board");
  check(/fully worked example/.test(writer?.asked ?? ""), "and under the student's own rules");
  check(seq.includes("studio-paper") && seq.includes("studio-quiz"), "a paper and a quiz were written");
  const notes = await rows("notes");
  const page = notes.find((n) => n.title === "Osmosis — Revision notes");
  check(page && /\[fixed\]/.test(page.content) && /Checked against the standard for revision notes/.test(page.content), "the page kept is the rewritten one, and says how it was checked");
  check(notes.some((n) => n.title === "Osmosis — Exam paper" && /## Mark scheme/.test(n.content)), "the paper is also a page to print, with its mark scheme");
  const decks = await rows("decks");
  check(decks.some((d) => d.name === "Osmosis"), "and the cards are a deck");
  const mocks = await rows("mocks");
  check(mocks.length === 2 && mocks.every((m) => m.courseId === ""), "two papers, belonging to no course", `${mocks.length}`);
}

console.log("\nA quiz is marked here, without a model");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: "Take it: Quiz" }).click();
  const qs = p.getByRole("list", { name: "Questions" });
  check(await waitFor(qs), "the quiz opens in Study");
  await p.getByRole("radiogroup", { name: "Options for question 1" }).getByRole("radio").nth(0).click();
  await p.getByRole("radiogroup", { name: "Options for question 2" }).getByRole("radio").nth(0).click();
  await p.getByRole("button", { name: "Finish and mark" }).first().click();
  const result = p.getByRole("region", { name: "Paper result" });
  check(await waitFor(result), "it is marked at once");
  check(/1\/2/.test((await result.innerText()).replace(/\s+/g, "")), "one right, one wrong", (await result.innerText()).replace(/\s+/g, " ").slice(0, 40));
  check(/pure water is 0 kPa/.test(await qs.innerText()), "and the reason is shown under the right option");
  check(!(await recent()).some((r) => r.kind === "exam-mark"), "no model was asked to mark it");
}

console.log("\nThe paper is sat and marked from Study");
{
  await p.getByRole("button", { name: "Back" }).first().click();
  await p.waitForTimeout(500);
  const papers = p.getByRole("region", { name: "Your papers" });
  check(await papers.isVisible(), "Study lists the papers made in the Studio");
  await papers.getByRole("button", { name: "Open Osmosis — Exam paper" }).click();
  check(await waitFor(p.getByRole("timer", { name: "Time left" })), "the paper has a clock");
  await p.getByLabel("Answer to question 2").fill("More energy, so they move faster, so more cross per second.");
  await p.getByRole("button", { name: "Finish and mark" }).first().click();
  const result = p.getByRole("region", { name: "Paper result" });
  check(await waitFor(result, 15000), "it is marked");
  check(/3\/5/.test((await result.innerText()).replace(/\s+/g, "")), "3 of 5", (await result.innerText()).replace(/\s+/g, " ").slice(0, 40));
  await p.getByRole("button", { name: "Back" }).first().click();
  await p.waitForTimeout(400);
}

console.log("\nThe answer checker writes a scheme when there is none, then marks against it");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("button", { name: "Check an answer" }).click();
  const d = p.getByRole("dialog", { name: "Studio" });
  check(await waitFor(d.getByLabel("The question")), "the checker opens");
  await d.getByLabel("The question").fill("Explain why the rate of diffusion increases with temperature. [3]");
  await p.waitForTimeout(200);
  check((await d.getByLabel("Marks").inputValue()) === "3", "the marks are read from the question");
  await d.getByLabel("Your answer", { exact: true }).fill("The particles have more energy so they move faster.");
  await d.getByRole("button", { name: "Mark my answer" }).click();
  const got = d.getByLabel(/out of 3 marks/);
  check(await waitFor(got), "it is marked");
  check(await got.getAttribute("aria-label") === "2 out of 3 marks", "2 of 3", await got.getAttribute("aria-label"));
  check(/one was written in the board's style first/.test(await d.innerText()), "and it says the scheme was written first");
  const seq = (await recent()).map((r) => r.kind);
  check(seq.indexOf("scheme") >= 0 && seq.indexOf("exam-mark") > seq.indexOf("scheme"), "scheme, then marking", seq.join(" → "));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nA book added to a Notebook page is met with the question of what to make");
{
  await fetch(`${MOCK}/__reset`);
  await p.locator("aside nav").getByRole("button", { name: "Notebook" }).first().click();
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(700);
  await p.getByLabel("Choose something to read").setInputFiles({ name: "osmosis-chapter.txt", mimeType: "text/plain", buffer: Buffer.from(CHAPTER) });
  const ask = p.getByRole("group", { name: "What to make from it" });
  check(await waitFor(ask), "the page asks what to make from it");
  check(/osmosis-chapter\.txt is here\. What should I make from it\?/.test((await ask.innerText()).replace(/\s+/g, " ")), "naming the book");
  check(!(await recent()).length, "and has not spent a call to ask", (await recent()).map((r) => r.kind + ":" + (r.head ?? "").slice(0, 60)).join(" | "));
  await ask.getByRole("button", { name: "Mind map" }).click();
  const list = p.getByRole("list", { name: "What to make" });
  check(await waitFor(list), "a press opens the Studio on that book");
  check((await list.getByRole("checkbox", { name: "Mind map", exact: true }).getAttribute("aria-checked")) === "true" && (await list.getByRole("checkbox", { name: "Revision notes", exact: true }).getAttribute("aria-checked")) === "false", "with the tool pressed ticked, and only that");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nA topic alone is enough");
{
  await fetch(`${MOCK}/__reset`);
  await p.keyboard.press("Control+k");
  await p.getByRole("textbox", { name: "Command palette" }).fill("Studio: make");
  await p.waitForTimeout(300);
  await p.getByRole("option", { name: /Studio: make study materials/ }).first().click();
  await p.getByLabel("Topic").fill("Photosynthesis");
  await p.getByRole("button", { name: "Next" }).click();
  const list = p.getByRole("list", { name: "What to make" });
  check(await waitFor(list), "a topic goes straight to the choice");
  for (const name of ["Flashcards", "Exam paper"]) await list.getByRole("checkbox", { name, exact: true }).click();
  await p.getByRole("button", { name: /^Make 1/ }).click();
  await p.getByText("Ready", { exact: true }).waitFor({ timeout: 20000 }).catch(() => {});
  const notes = await rows("notes");
  const page = notes.find((n) => n.title === "Photosynthesis — Revision notes");
  check(page && /Written from general knowledge/.test(page.content), "the notes are written from the topic, and say so");
  check((await recent()).some((r) => r.kind === "studio-topic"), "without a source");
  await p.getByRole("button", { name: "Done" }).click();
}

console.log("\nIn chat, study material is crafted to the house standard");
{
  await fetch(`${MOCK}/__reset`);
  await p.locator("aside nav").getByRole("button", { name: /Conversations|Chat/ }).first().click().catch(() => {});
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: "Message" }).fill("mind map of the Krebs cycle");
  await p.keyboard.press("Enter");
  await until((c) => c.some((r) => r.kind === "answer"), 30000);
  const calls = await recent();
  const study = calls.find((r) => r.kind === "study");
  check(Boolean(study), "a five-word ask for a mind map is crafted", JSON.stringify(calls.map((r) => r.kind)) + " all:" + JSON.stringify(((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).map((r) => r.kind)));
  check(/already has a written house standard/.test(study?.asked ?? "") && /One central idea/.test(study?.asked ?? ""), "the study builds on the house standard for a mind map");
  const answer = calls.find((r) => r.kind === "answer");
  check(/This is study material, so:/.test(answer?.system ?? "") && /One central idea/.test(answer?.system ?? ""), "and the writer gets the education rules and the house standard");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
