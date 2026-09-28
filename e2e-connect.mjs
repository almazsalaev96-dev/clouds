/**
 * One workspace: the Notebook joined to the chat and to projects.
 *
 * The claims, on the screen and at the wire: a page can be put in a project,
 * where it is listed and becomes part of what that project's chats know; "/"
 * in a page offers blocks and actions and a checklist ticks where it is read;
 * "[[" offers the pages to link; "@" in the chat box attaches a page; "Chat
 * about this page" opens a chat with the page in it and the page lists the
 * chats about it; an answer can be added to the end of any page, marked with
 * where it came from; a question the notebook bears on is answered from the
 * student's own pages and the answer says so, and the setting turns it off;
 * the palette makes a page; and a lecture can be recorded into a page and
 * made into notes.
 *
 *   bash /tmp/claude-0/one.sh e2e-connect
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
/* A lecture needs a microphone and a recogniser; the recogniser is stood in
   for, and says two sentences when it is started. */
await ctx.addInitScript(() => {
  class FakeRecognition {
    constructor() { this.continuous = false; this.interimResults = false; this.lang = "en-GB"; }
    start() {
      setTimeout(() => {
        const res = (t) => { const alt = [{ transcript: t }]; alt.isFinal = true; return alt; };
        const results = [res("Osmosis is the diffusion of water across a partially permeable membrane."), res("A plant cell in pure water becomes turgid.")];
        this.onresult?.({ resultIndex: 0, results });
      }, 200);
    }
    stop() { setTimeout(() => this.onend?.(), 10); this.stopped = true; }
    abort() { this.stop(); }
  }
  window.webkitSpeechRecognition = FakeRecognition;
  window.SpeechRecognition = FakeRecognition;
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
const last = () => fetch(`${MOCK}/__last`, { method: "POST" }).then((r) => r.json());
const waitFor = async (loc, ms = 8000) => { await loc.first().waitFor({ timeout: ms }).catch(() => {}); return loc.first().isVisible().catch(() => false); };
const go = async (name) => { await p.locator("aside nav").getByRole("button", { name, exact: true }).first().click(); await p.waitForTimeout(600); };
const content = () => p.getByRole("textbox", { name: "Page content" });
const editing = async () => {
  const e = p.getByRole("button", { name: /^Edit$/ });
  if (await e.isVisible().catch(() => false)) { await e.click(); await p.waitForTimeout(300); }
};
const reading = async () => {
  const e = p.getByRole("button", { name: /^Preview$/ });
  if (await e.isVisible().catch(() => false)) { await e.click(); await p.waitForTimeout(300); }
};
const pageText = async (title) => ((await rows("notes")).find((n) => n.title === title)?.content ?? "");
const box = () => p.getByRole("textbox", { name: "Message" });
const send = async (text) => {
  await fetch(`${MOCK}/__reset`);
  await box().fill(text);
  await p.keyboard.press("Enter");
  await p.locator(".msg").last().waitFor({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(3500);
};
const palette = async (label) => {
  await p.keyboard.press("Escape");
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(300);
  await p.getByRole("textbox", { name: "Command palette" }).fill(label);
  await p.waitForTimeout(250);
  await p.getByRole("option", { name: new RegExp("^" + label) }).first().click();
  await p.waitForTimeout(600);
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

const OSMOSIS = "# Osmosis notes\n\nOsmosis is the movement of water across a partially permeable membrane. Pure water has a water potential of zero kilopascals.";

console.log("\nThe palette makes a page, and “/” writes in it");
{
  await go("Notebook");
  await palette("New page");
  check(await waitFor(content()), "“New page” from anywhere opens an empty page");
  await content().fill(OSMOSIS);
  await content().press("End");
  await p.keyboard.press("Control+End");
  await p.keyboard.type("\n\n/check");
  const menu = p.getByRole("listbox", { name: "Insert" });
  check(await waitFor(menu, 3000), "a slash at the start of a line offers what can go there");
  check(/Checklist/.test(await menu.getByRole("option").first().innerText()), "and “check” puts the checklist first", (await menu.getByRole("option").first().innerText()).split("\n")[0]);
  await p.keyboard.press("Enter");
  await p.keyboard.type("learn the definition");
  await p.waitForTimeout(1000);
  const v = await content().inputValue();
  check(/\n- \[ \] learn the definition$/.test(v) && !/\/check/.test(v), "Enter writes the checklist in place of the command", JSON.stringify(v.slice(-40)));
  /* Enter on a checklist line continues the list, so the next command
     starts on a line of its own. */
  await content().fill(v + "\n\n");
  await content().press("Control+End");
  await p.keyboard.type("/");
  await p.waitForTimeout(200);
  check(await menu.getByRole("option", { name: /Record a lecture/ }).count() > 0 && await menu.getByRole("option", { name: /Quiz me on this page/ }).count() > 0, "the menu offers actions as well as blocks — a recording, a quiz");
  await p.keyboard.press("Escape");
  await content().fill(v);
  await p.waitForTimeout(1000);
}

console.log("\nA checklist ticks where it is read");
{
  await reading();
  const box1 = p.locator(".prose input[type=checkbox], [class*=markdown] input[type=checkbox]").first();
  const any = p.locator("input[type=checkbox]").first();
  const target = (await box1.count()) ? box1 : any;
  check(await target.isEnabled().catch(() => false), "the box in the reading view can be pressed");
  await target.click();
  await p.waitForTimeout(900);
  check(/- \[x\] learn the definition/.test(await pageText("Osmosis notes")), "and pressing it ticks it in the page itself");
  check(/1 of 1 tasks? done/.test((await p.locator("main").innerText()).replace(/\s+/g, " ")) || await p.getByLabel("1 of 1 tasks done").count() > 0, "the head counts what is done");
}

console.log("\nA page goes in a project, and the project knows it");
{
  await go("Projects");
  await p.getByRole("button", { name: /New project/i }).first().click();
  await p.waitForTimeout(600);
  await p.getByLabel("Project name").fill("Biology");
  await p.waitForTimeout(1000);
  await go("Notebook");
  await p.getByRole("button", { name: /Osmosis notes/ }).first().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Add to a project" }).click();
  await p.getByRole("dialog", { name: "Projects" }).or(p.locator("[aria-label=Projects]").last()).getByRole("button", { name: /Biology/ }).first().click();
  await p.waitForTimeout(700);
  const n = (await rows("notes")).find((x) => x.title === "Osmosis notes");
  const proj = (await rows("projects")).find((x) => x.name === "Biology");
  check(Boolean(n?.projectId) && n.projectId === proj?.id, "the page is in the project");
  check(await p.getByRole("button", { name: "In the project Biology" }).isVisible(), "and its head says which");
  await go("Projects");
  await p.getByRole("button", { name: /Biology/ }).first().click().catch(() => {});
  await p.waitForTimeout(600);
  const listed = p.getByRole("region", { name: "Pages in this project" }).or(p.locator("section[aria-label='Pages in this project']"));
  check(await waitFor(listed) && /Osmosis notes/.test(await listed.first().innerText()), "the project lists its pages");
  await p.getByRole("button", { name: /New chat here/ }).click();
  await p.waitForTimeout(600);
  await send("what does my page say");
  const sys = (await last()).systemText ?? "";
  check(/Osmosis notes \(page\)/.test(sys) && /partially permeable membrane/.test(sys), "a chat in the project is sent the page as part of its knowledge", sys.match(/<document name="[^"]*">/g)?.join(" ") ?? "no documents");
}

console.log("\n“@” in the chat box attaches a page");
{
  await palette("New chat");
  await box().fill("explain @Osm");
  const menu = p.getByRole("listbox", { name: "Attach a page" });
  check(await waitFor(menu, 3000), "“@” offers the pages by name");
  await menu.getByRole("option", { name: /Osmosis notes/ }).first().click();
  await p.waitForTimeout(300);
  check((await box().inputValue()).trim() === "explain", "the @name leaves the text", JSON.stringify(await box().inputValue()));
  check(await p.getByText("Osmosis notes.md").first().isVisible().catch(() => false), "and the page is attached");
  await box().fill("explain this simply");
  await fetch(`${MOCK}/__reset`);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  check(/partially permeable membrane/.test((await last()).userText ?? ""), "the page went with the question");
}

console.log("\nAn answer is added to the end of a page");
{
  const msg = p.locator(".msg").last();
  await msg.hover();
  await msg.getByRole("button", { name: "More actions" }).click();
  await p.getByRole("menuitem", { name: /Add to a page/ }).click();
  const dlg = p.getByRole("dialog", { name: /Add to a page|Add this answer/ });
  check(await waitFor(dlg), "the page picker opens");
  await dlg.getByLabel("Find a page").fill("osm");
  await dlg.getByRole("list", { name: "Pages" }).getByRole("button", { name: /Osmosis notes/ }).click();
  await p.waitForTimeout(800);
  const text = await pageText("Osmosis notes");
  check(/From the chat “/.test(text) && text.startsWith("# Osmosis notes"), "the answer is at the end, marked with the chat it came from", JSON.stringify(text.slice(-120)));
  check(await p.getByText(/Added to/).first().isVisible().catch(() => false), "and a notice says where, with an undo");
}

console.log("\nThe notebook is read when it bears on the question");
{
  await palette("New chat");
  await send("what is the water potential of pure water in kilopascals");
  const sys = (await last()).systemText ?? "";
  check(/## From their notebook/.test(sys) && /<page title="Osmosis notes">/.test(sys), "the passage from their page was sent, fenced", sys.includes("From their notebook") ? "" : "no notebook section");
  const row = await p.locator(".msg").last().innerText();
  check(/built on your notes: “Osmosis notes”/.test(row), "and the answer says it built on their notes", (row.split("\n").find((l) => /notes/.test(l)) ?? "").slice(0, 80));
  await palette("New chat");
  await send("how do I bake sourdough bread at home");
  check(!/From their notebook/.test((await last()).systemText ?? ""), "a question it does not bear on is sent nothing from it");
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("store.settings.v1"));
    raw.state.notesInChat = false;
    localStorage.setItem("store.settings.v1", JSON.stringify(raw));
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  await palette("New chat");
  await send("what is the water potential of pure water in kilopascals");
  check(!/From their notebook/.test((await last()).systemText ?? ""), "and with the setting off, nothing is");
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("store.settings.v1"));
    raw.state.notesInChat = true;
    localStorage.setItem("store.settings.v1", JSON.stringify(raw));
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
}

console.log("\n“Chat about this page” opens a chat with the page in it");
{
  await go("Notebook");
  await p.getByRole("button", { name: /Osmosis notes/ }).first().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Chat about this page" }).first().click();
  await p.waitForTimeout(800);
  check(await waitFor(box()) && await p.getByText("Osmosis notes.md").first().isVisible().catch(() => false), "the chat opens with the page attached");
  await send("quiz me on it");
  const page = (await rows("notes")).find((n) => n.title === "Osmosis notes");
  const conv = (await rows("conversations")).find((c) => c.pageId === page?.id);
  check(Boolean(conv), "the chat remembers which page it is about");
  check(conv?.projectId === page?.projectId, "and sits in the page's project");
  await go("Notebook");
  await p.getByRole("button", { name: /Osmosis notes/ }).first().click().catch(() => {});
  await p.waitForTimeout(600);
  const chats = p.locator("[aria-label='Chats about this page']");
  check(await waitFor(chats) && (await chats.getByRole("button").count()) >= 1, "the page lists the chats about it");
}

console.log("\n“[[” offers the pages to link");
{
  await palette("New page");
  await content().fill("# Cell transport\n\nWater moves by ");
  await p.waitForTimeout(300);
  await content().click();
  await p.keyboard.press("Control+End");
  await p.keyboard.type("[[Osm");
  const menu = p.getByRole("listbox", { name: "Link to a page" });
  check(await waitFor(menu, 3000), "“[[” opens the list of pages");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(900);
  check(/\[\[Osmosis notes\]\]/.test(await content().inputValue()), "and Enter writes the link", JSON.stringify((await content().inputValue()).slice(-30)));
}

console.log("\nA lecture is recorded into the page");
{
  await content().fill((await content().inputValue()) + "\n\n");
  await content().press("Control+End");
  await p.keyboard.type("/record");
  await p.waitForTimeout(200);
  await p.keyboard.press("Enter");
  const rec = p.getByRole("region", { name: "Lecture recording" });
  check(await waitFor(rec, 3000), "“/record” starts a recording");
  await p.waitForTimeout(900);
  const v = await content().inputValue();
  check(/## Lecture transcript —/.test(v) && /diffusion of water across a partially permeable membrane/.test(v), "the transcript is written into the page as it is heard", JSON.stringify(v.slice(-80)));
  await rec.getByRole("button", { name: /Stop/ }).click();
  await p.waitForTimeout(300);
  await rec.getByRole("button", { name: /Make notes from it/ }).click();
  const studio = p.getByRole("dialog", { name: /Studio/ });
  check(await waitFor(studio), "and “Make notes from it” opens the Studio on the transcript");
  await p.keyboard.press("Escape");
}

check(!errs.length, "no page errors", errs.join(" | ").slice(0, 200));
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
