/**
 * A notebook made of sources, the way Google's notebook works and past it.
 *
 * The claims, on the screen and at the wire: "New notebook" opens sources,
 * chat and studio; sources come in four ways — a file, pasted text, one of
 * your own pages, and a web page, with a private address refused; the
 * sources are described in a guide with questions to start on, and the
 * notebook names itself from it; answers come only from the ticked sources,
 * with numbered citations that open the passage in the source, and one that
 * is not in the source said to be so; a source switched off is not sent; the
 * chat can answer as a learning guide; an answer is saved as a note in the
 * notebook; the audio overview is written to the format, length and focus
 * chosen, read by two voices line by line, and a listener can join in and
 * be answered; the Studio's tools make from the notebook and what they make
 * is listed in it; a note leads back to its notebook; on a phone the three
 * panels are tabs.
 *
 *   bash /tmp/claude-0/one.sh e2e-sourcebook
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
/* Voices stood in for: two of them, and every utterance recorded and ended
   after a moment, so playing can be watched line by line. */
await ctx.addInitScript(() => {
  window.__spoken = [];
  const fake = {
    getVoices: () => [{ name: "Basic English", lang: "en-US" }, { name: "Google UK English Female", lang: "en-GB" }],
    speak(u) { window.__spoken.push({ text: u.text, voice: u.voice?.name ?? null, rate: u.rate }); setTimeout(() => u.onend?.(), 120); },
    cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
});
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const rows = (store) => p.evaluate((store) => new Promise((ok) => {
  const r = indexedDB.open("clouds");
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);
const recent = async () => ((await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? []).filter((r) => r.kind !== "title");
const until = async (pred, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (pred(await recent())) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
const waitFor = async (loc, ms = 10000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };
const book = async () => (await rows("notes")).find((n) => n.view === "notebook");
const CHAPTER = [
  "Osmosis is the movement of water across a partially permeable membrane from a region of higher water potential to a region of lower water potential.",
  "Water potential is measured in kilopascals and pure water has a water potential of zero.",
  "A cell placed in a hypotonic solution gains water; an animal cell may burst while a plant cell becomes turgid.",
].join("\n\n");
const dialog = () => p.getByRole("dialog", { name: "Add sources" });
const sourcesList = () => p.getByRole("list", { name: "Your sources", exact: true });
const main = () => p.locator("main");
/* The notebook's two doors: the sources and the Studio open beside the page. */
const openSheet = async (which) => {
  const region = p.getByRole("region", { name: which === "sources" ? "Sources" : "Studio", exact: true });
  if (await region.isVisible().catch(() => false)) return;
  await main().getByRole("button", { name: which === "sources" ? /^Sources, \d+$/ : "Notebook studio" }).first().click();
  await region.waitFor({ timeout: 3000 }).catch(() => {});
};
const home = async () => {
  const back = p.getByRole("button", { name: "Back to the notebook" });
  if (await back.isVisible().catch(() => false)) { await back.click(); await p.waitForTimeout(300); }
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
await fetch(`${MOCK}/__reset`);

console.log("\nA new notebook, laid out as Gemini lays one out");
{
  await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).first().click();
  await p.waitForTimeout(500);
  /* A page of one's own first, to bring in as a source later. */
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: "Page content" }).fill("# My lab notes\n\nIn the potato experiment the chips in pure water gained mass, because water entered by osmosis.");
  await p.waitForTimeout(1000);
  await p.getByRole("button", { name: "All pages" }).first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "New notebook" }).first().click();
  check(await waitFor(p.getByRole("textbox", { name: "Notebook name" })), "one column: its name at the top");
  check(await main().getByRole("button", { name: "Sources, 0" }).isVisible() && await main().getByRole("button", { name: "Notebook studio" }).isVisible(), "the sources and the Studio a press away, not three panels at once");
  check(!(await p.getByRole("region", { name: "Sources", exact: true }).count()), "the sources panel closed until asked for");
  check(await p.getByText("Add a source to get started").isVisible(), "and an empty notebook says where to start");
  check(await p.getByRole("button", { name: "Change the notebook's icon" }).isVisible(), "with a mark that can be changed");
  check(await p.locator("aside").getByRole("region", { name: "Notebooks" }).getByRole("button", { name: "Untitled notebook" }).isVisible(), "and the sidebar lists it under Notebooks");
}

console.log("\nSources, four ways in");
{
  await p.getByRole("button", { name: "Add sources" }).first().click();
  check(await waitFor(dialog()), "Add sources opens");
  await dialog().getByRole("tab", { name: /Paste/ }).click();
  await p.getByLabel("Source name").fill("Osmosis chapter");
  await p.getByLabel("Pasted text").fill(CHAPTER);
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  await p.waitForTimeout(400);
  await openSheet("sources");
  check(await waitFor(sourcesList().getByRole("button", { name: "Osmosis chapter", exact: true })), "pasted text becomes a source");

  await p.getByRole("region", { name: "Sources" }).getByRole("button", { name: "Add" }).click();
  await dialog().getByRole("tab", { name: /Website/ }).click();
  await p.getByLabel("Web address").fill("http://127.0.0.1/");
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  const alert = dialog().getByRole("alert");
  check(await waitFor(alert) && /not on the public web/.test(await alert.innerText()), "a private address is refused, with the reason", await alert.innerText().catch(() => ""));

  await dialog().getByRole("tab", { name: /My pages/ }).click();
  await dialog().getByRole("list", { name: "Your pages" }).getByRole("button", { name: /My lab notes/ }).click();
  check(await waitFor(sourcesList().getByRole("button", { name: "My lab notes", exact: true })), "one of your own pages becomes a source");

  await p.getByRole("region", { name: "Sources" }).getByRole("button", { name: "Add" }).click();
  await dialog().getByLabel("Choose files to add as sources").setInputFiles({ name: "lecture.txt", mimeType: "text/plain", buffer: Buffer.from("The lecture covered active transport, which moves substances against a concentration gradient using energy from respiration.") });
  check(await waitFor(sourcesList().getByRole("button", { name: "lecture.txt", exact: true })), "and a file");
  check((await rows("sources")).length === 3, "three sources kept", String((await rows("sources")).length));
}

console.log("\nThe guide: what the sources are, and where to start");
{
  const guide = p.getByRole("region", { name: "Notebook guide" });
  check(await waitFor(guide.getByRole("heading", { name: "About your sources" }), 15000), "a summary, written from the sources");
  check(/\bosmosis\b/.test(await guide.locator("strong").first().innerText().catch(() => "")), "with the key terms in bold");
  await p.waitForTimeout(500);
  check((await book())?.title === "Osmosis and water potential" && (await p.getByRole("textbox", { name: "Notebook name" }).inputValue()) === "Osmosis and water potential", "and the untitled notebook takes its name", (await book())?.title);
  const sugg = p.getByRole("group", { name: "Suggested questions" });
  check(await sugg.getByRole("button").count() === 3, "three questions to start on");
}

console.log("\nAnswers from the sources only, cited");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("group", { name: "Suggested questions" }).getByRole("button", { name: "What is osmosis?" }).click();
  await until((c) => c.some((r) => r.kind === "answer"));
  await p.waitForTimeout(800);
  const asked = (await recent()).find((r) => r.kind === "answer")?.asked ?? "";
  check(/sources only: What is osmosis\?/.test(asked) && /partially permeable/.test(asked) && /potato experiment/.test(asked), "the question went with the ticked sources", asked.slice(0, 80));
  const conv = p.getByRole("list", { name: "Conversation" });
  const chips = conv.locator("a[href^='#armi-cite-']");
  check(await chips.count() >= 3, "each claim carries a numbered citation", String(await chips.count()));
  check(!(await p.getByRole("group", { name: "Suggested questions" }).getByRole("button", { name: "What is osmosis?" }).count()), "and the question asked leaves the suggestions");
  await chips.first().click();
  const src = p.getByRole("region", { name: /^Source: / });
  check(await waitFor(src), "a citation opens its source");
  check((await src.locator("mark").innerText().catch(() => "")).length > 20, "with the quoted passage marked", (await src.locator("mark").innerText().catch(() => "")).slice(0, 60));
  check(await waitFor(src.getByRole("region", { name: "Source guide" }).getByText(/textbook section/)), "and the source's own guide, written on opening");
  await src.getByRole("button", { name: "Back to the sources" }).click();
  await chips.nth(2).click();
  check(/is not in/.test(await p.getByRole("region", { name: "Chat" }).innerText()), "a quotation that is not in the source is said to be so");
}

console.log("\nA source switched off is not sent");
{
  await sourcesList().getByRole("checkbox", { name: "Use lecture.txt" }).uncheck();
  await p.waitForTimeout(400);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Ask about your sources" }).fill("What is water potential measured in?");
  await p.keyboard.press("Enter");
  await until((c) => c.some((r) => r.kind === "answer"));
  const asked = (await recent()).find((r) => r.kind === "answer")?.asked ?? "";
  check(!/active transport/.test(asked) && /kilopascals/.test(asked), "the lecture stayed out, the chapter went");
  check(/Q: What is osmosis\?/.test(asked), "and the conversation so far went with it, for follow-ups");
  check(/2 sources/.test(await p.getByRole("region", { name: "Chat" }).innerText()), "the box says how many sources it is asking");
}

console.log("\nThe chat answers the way it is asked to");
{
  await p.getByRole("button", { name: "Configure the chat" }).click();
  await p.getByRole("radio", { name: "Learning guide" }).click();
  await p.getByRole("radio", { name: "Shorter" }).click();
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Ask about your sources" }).fill("Why does a plant cell become turgid?");
  await p.keyboard.press("Enter");
  await until((c) => c.some((r) => r.kind === "answer"));
  const asked = (await recent()).find((r) => r.kind === "answer")?.asked ?? "";
  check(/as a tutor/.test(asked) && /three or four sentences/.test(asked), "as a learning guide, and shorter");
}

console.log("\nAn answer kept as a note in the notebook");
{
  const conv = p.getByRole("list", { name: "Conversation" });
  await conv.getByRole("button", { name: "Save to note" }).first().click();
  await p.waitForTimeout(600);
  await openSheet("studio");
  const notes = p.getByRole("region", { name: "Notes" });
  check(/What is osmosis\?/.test(await notes.innerText()), "it is listed under Notes");
  const kept = (await rows("notes")).find((n) => n.title === "What is osmosis?");
  const nb = await book();
  check(kept?.nbOf === nb?.id && (kept?.citations?.length ?? 0) >= 3, "belongs to the notebook, citations and all");
  check(await conv.getByRole("button", { name: "Open the saved note" }).count() === 1, "and the answer says it is saved");
}

console.log("\nThe audio overview, to the brief");
{
  await fetch(`${MOCK}/__reset`);
  const audio = p.getByRole("region", { name: "Audio Overview" });
  await audio.getByRole("button", { name: "Customise" }).click();
  await audio.getByRole("radio", { name: /Debate/ }).click();
  await audio.getByRole("radio", { name: "Shorter" }).click();
  await audio.getByRole("textbox").fill("Only what is on the exam");
  await audio.getByRole("button", { name: "Generate" }).click();
  const script = audio.getByRole("list", { name: "Transcript" });
  check(await waitFor(script, 15000), "the conversation is written");
  const asked = (await recent()).find((r) => r.kind === "nb-audio")?.asked ?? "";
  check(/argues one side/.test(asked) && /about 450 words/.test(asked) && /Only what is on the exam/.test(asked), "to the format, length and focus chosen");
  const lines = await script.getByRole("listitem").allInnerTexts();
  check(lines.length >= 6 && /^Maya/.test(lines[0]) && /^Theo/.test(lines[1]), "two hosts, turn by turn", lines.slice(0, 2).map((l) => l.slice(0, 20)).join(" | "));
  await audio.getByRole("button", { name: "Play" }).click();
  await p.waitForFunction(() => (window.__spoken ?? []).length >= 3, null, { timeout: 8000 }).catch(() => {});
  const spoken = await p.evaluate(() => window.__spoken);
  check(spoken.length >= 3 && /textbook section on osmosis/.test(spoken[0].text), "played line by line from the top", String(spoken.length));
  check(new Set(spoken.slice(0, 2).map((s) => s.voice)).size === 2, "in two different voices", spoken.slice(0, 2).map((s) => s.voice).join(" / "));
  check(await audio.locator("[aria-current='true']").count() === 1, "the line being read is marked in the transcript");
  await audio.getByRole("button", { name: "Pause" }).click();
  await audio.getByRole("button", { name: /Join/ }).click();
  await audio.getByLabel("Your question for the hosts").fill("What happens to a plant cell in pure water?");
  await audio.getByRole("button", { name: "Ask", exact: true }).click();
  await p.waitForTimeout(1500);
  const after = await script.innerText();
  check(/You\s*What happens to a plant cell in pure water\?/.test(after) && /becomes turgid/.test(after), "a listener joins in, and the hosts answer", after.match(/You[^\n]*\n?[^\n]*/)?.[0]?.slice(0, 80));
  check(((await book())?.nb?.audio?.lines ?? []).some((l) => l.who === 2), "and the exchange is kept with the overview");
  await audio.getByRole("button", { name: "Pause" }).click().catch(() => {});
}

console.log("\nThe Studio makes from the notebook, and lists what it made");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("list", { name: "Make from these sources" }).getByRole("button", { name: /FAQ/ }).click();
  const sheet = p.getByRole("dialog", { name: /Studio/ });
  check(await waitFor(sheet), "a tool opens the Studio on the ticked sources");
  const faq = sheet.getByRole("checkbox", { name: "FAQ", exact: true });
  check(await waitFor(faq, 15000) && (await faq.getAttribute("aria-checked")) === "true", "with FAQ chosen");
  await sheet.getByRole("button", { name: /^Make \d/ }).click();
  await sheet.getByText("Ready", { exact: true }).waitFor({ timeout: 40000 }).catch(() => {});
  await sheet.getByRole("button", { name: "Done" }).click().catch(() => {});
  await p.waitForTimeout(700);
  const made = (await rows("notes")).find((n) => / — FAQ$/.test(n.title));
  const nb = await book();
  check(made?.nbOf === nb?.id && (made?.madeFrom?.length ?? 0) === 2, "the FAQ belongs to the notebook and remembers its two sources", made?.title);
  check(/— FAQ/.test(await p.getByRole("region", { name: "Notes" }).innerText()), "and is listed under Notes");
}

console.log("\nA notebook holds several chats, listed under its name");
{
  await home();
  const list = p.getByRole("list", { name: "Chats in this notebook" });
  check(await waitFor(list) && await list.getByRole("listitem").count() === 1 && /What is osmosis\?/.test(await list.innerText()) && /Today/.test(await list.innerText()), "the chat so far, named by its first question, with when", (await list.innerText().catch(() => "")).replace(/\n/g, " | ").slice(0, 80));
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Ask about your sources" }).fill("What does hypotonic mean?");
  await p.keyboard.press("Enter");
  await until((c) => c.some((r) => r.kind === "answer"));
  const asked = (await recent()).find((r) => r.kind === "answer")?.asked ?? "";
  check(!/Q: What is osmosis\?/.test(asked), "a question from the notebook's page starts a new chat, without the old one's history");
  await p.waitForTimeout(500);
  await home();
  check(await list.getByRole("listitem").count() === 2 && /What does hypotonic mean\?/.test(await list.getByRole("listitem").first().innerText()), "two chats, newest first");
  await list.getByRole("listitem").first().hover();
  await list.getByRole("button", { name: /^Delete What does hypotonic mean/ }).click();
  await p.waitForTimeout(400);
  check(await list.getByRole("listitem").count() === 1, "and one can be deleted");
  await list.getByRole("button", { name: /^What is osmosis\?/ }).click();
  check(await waitFor(p.getByRole("list", { name: "Conversation" })) && (await p.getByRole("list", { name: "Conversation" }).getByRole("listitem").count()) >= 3, "an old chat opens where it was left");
}

console.log("\nA note leads back; a notebook is still a page underneath");
{
  await openSheet("studio");
  await p.getByRole("region", { name: "Notes" }).getByRole("button", { name: /What is osmosis\?/ }).click();
  await p.waitForTimeout(700);
  const back = p.getByRole("button", { name: /^In the notebook / });
  check(await waitFor(back), "the note says which notebook it is in");
  await back.click();
  check(await waitFor(p.getByRole("textbox", { name: "Notebook name" })), "and goes back to it");
  await p.getByRole("button", { name: "Open as a page" }).click();
  check(await waitFor(p.getByRole("button", { name: "Open as a notebook" })), "“As a page” shows the page, and the way back");
  await p.getByRole("button", { name: "Open as a notebook" }).click();
  check(await waitFor(p.getByRole("textbox", { name: "Notebook name" })), "which returns to the notebook");
}

console.log("\nOn a phone, the sources come up over the page");
{
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(500);
  /* The sidebar was open at desktop width, and on a phone it is a drawer. */
  const scrim = p.locator("div.fixed.inset-0.z-30[aria-hidden='true']");
  if (await scrim.isVisible().catch(() => false)) await scrim.click({ position: { x: 380, y: 400 } });
  await p.waitForTimeout(400);
  check(await p.getByRole("textbox", { name: "Ask about your sources" }).isVisible(), "the box to ask is at the foot");
  await openSheet("sources");
  const box = await p.getByRole("region", { name: "Sources", exact: true }).boundingBox();
  check(await sourcesList().isVisible() && box && box.width > 340, "the sources open over the page, the width of the phone", box ? `${Math.round(box.width)}px` : "");
  await p.getByRole("region", { name: "Sources", exact: true }).getByRole("button", { name: "Close" }).click();
  await p.waitForTimeout(300);
  check(!(await p.getByRole("region", { name: "Sources", exact: true }).count()), "and close again");
}
check(!errs.length, "no page errors", errs.join(" | ").slice(0, 200));
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
