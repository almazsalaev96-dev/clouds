/**
 * A chapter in, a revision pack out.
 *
 * The claims: attach a source to a page and press "Revision pack", and
 * three pages appear beside it — the knowledge organiser, the Cornell
 * notes, the exam questions — named for the source, with a deck of cards
 * in Study; any of the three offers the whole pack as one file to
 * download, with how to use it on the front; and the Study room has its
 * own way in, which lands in the Notebook waiting for the file and makes
 * the pack the moment it arrives.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1366, height: 1024 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, section: "notebook" };
const CHAPTER = [
  "Osmosis is the movement of water across a partially permeable membrane from a region of higher water potential to a region of lower water potential.",
  "Water potential is measured in kilopascals and pure water has a water potential of zero.",
  "A cell placed in a hypotonic solution gains water; an animal cell may burst while a plant cell becomes turgid.",
  "A cell placed in a hypertonic solution loses water; a plant cell becomes flaccid and then plasmolysed.",
].join("\n\n");
const go = async (label) => { await p.getByRole("button", { name: label }).first().click(); await p.waitForTimeout(800); };
const attach = async (name) => {
  await p.getByLabel("Choose something to read").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(CHAPTER) });
  await p.waitForTimeout(800);
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nA source, and the pack made from it");
{
  await p.getByRole("button", { name: "New page" }).first().click();
  await p.waitForTimeout(800);
  await attach("osmosis-chapter.txt");
  const chip = p.getByRole("button", { name: "Revision pack" });
  check(await chip.isVisible(), "with a source attached the page offers the pack first");
  await chip.click();
  /* Polled on the room's text: an element matcher answered before the
     notice was up and the check read the room a beat too soon. */
  await p.waitForFunction(() => /3 pages( and \d+ cards)? made|Nothing usable|request failed/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 60_000 }).catch(() => {});
  const notice = await p.locator("main").innerText();
  check(/3 pages and \d+ cards made/.test(notice), "three pages and a deck come back", (notice.match(/3 pages[^\n]*/) ?? [""])[0].slice(0, 90));
}

console.log("\nThe pages are named for the source, in the Notebook");
{
  await p.getByRole("button", { name: /Back|All pages|Notebook/ }).first().click().catch(() => {});
  await go("Notebook");
  const list = await p.locator("main").innerText();
  for (const t of ["osmosis chapter — Knowledge organiser", "osmosis chapter — Cornell notes", "osmosis chapter — Exam questions"]) {
    check(list.includes(t), `“${t}” is a page`);
  }
}

console.log("\nAny page of the pack hands over the whole pack as one file");
{
  await p.locator("main").getByText("osmosis chapter — Cornell notes").first().click();
  await p.waitForTimeout(900);
  const dl = p.getByRole("button", { name: "Download the pack" });
  check(await dl.isVisible(), "a pack page offers the download");
  const [download] = await Promise.all([p.waitForEvent("download", { timeout: 10_000 }), dl.click()]);
  const path = await download.path();
  const text = path ? (await import("node:fs")).readFileSync(path, "utf8") : "";
  check(download.suggestedFilename() === "osmosis-chapter-revision-pack.md", "named for the source", download.suggestedFilename());
  check(/^# osmosis chapter — revision pack/.test(text), "titled as the pack");
  check(/How to use this/.test(text) && /Being asked is what works/.test(text), "with how to use it on the front — because a pack read as a summary is a summary");
  /* By heading, not by first mention: the front page names all three
     before any of them begins. */
  const at = ["Knowledge organiser", "Cornell notes", "Exam questions"].map((t) => text.indexOf(`# osmosis chapter — ${t}`));
  check(at.every((i) => i >= 0) && at[0] < at[1] && at[1] < at[2], "and all three pages inside, in order", at.join(" < "));
}

console.log("\nThe cards are in Study");
{
  await go("Study");
  const study = await p.locator("main").innerText();
  check(/osmosis chapter/.test(study) && /\d+ cards/.test(study), "a deck named for the source, with cards in it", (study.match(/osmosis chapter[^\n]*\n[^\n]*/) ?? [""])[0].replace(/\n/g, " · "));
}

console.log("\nAnd the Study room has its own way in");
{
  const way = p.getByRole("button", { name: "Make a revision pack" });
  check(await way.isVisible(), "beside “Work through a document”");
  await way.click();
  await p.waitForTimeout(1200);
  const here = await p.locator("main").innerText();
  check(/Attach the chapter/.test(here), "it lands in the Notebook on a new page, waiting for the file", (here.match(/Attach the chapter[^\n]*/) ?? [""])[0].slice(0, 70));
  await attach("krebs-cycle.txt");
  /* Polled on the room's text, not on an element: the notice is one line
     among others, and a second pack takes as long as the first. */
  await p.waitForFunction(() => /3 pages( and \d+ cards)? made/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 40_000 }).catch(() => {});
  const made = await p.locator("main").innerText();
  check(/3 pages and \d+ cards made/.test(made), "and the pack is made the moment the file lands, with no second press", (made.match(/3 pages[^\n]*/) ?? [""])[0].slice(0, 60));
  await go("Notebook");
  const list = await p.locator("main").innerText();
  check(list.includes("krebs cycle — Knowledge organiser"), "named for the second source", (list.match(/krebs cycle[^\n]*/) ?? [""])[0]);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
