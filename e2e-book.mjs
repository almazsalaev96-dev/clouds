/**
 * A long book is read to its last page before anything is written from it.
 *
 * It used to be cut to its first ninety thousand characters — for a 988-page
 * textbook, the first forty pages — and the pack was about chapter one.
 * This attaches a book of about three hundred thousand characters whose last
 * chapter says something the first ones do not, asks for lessons, and reads
 * what the mock was sent: several reader calls, one per part, and a writer
 * call whose material reaches the final part.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-book.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1194, height: 834 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

const early = "Chapter one. The tides.\n\n" + "The moon pulls the near water toward it and the far water away.\n\n".repeat(4_400);
const BOOK = early + "Chapter nine. Estuaries.\n\nAn estuary is where a river meets the sea, and its water is brackish.\n\n";
console.log(`\nA book of ${BOOK.length.toLocaleString()} characters`);

await p.locator("aside nav").getByRole("button", { name: "Notebook", exact: true }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /New page/ }).first().click();
await p.waitForTimeout(800);
await p.setInputFiles('input[aria-label="Choose something to read"]', { name: "oceans.txt", mimeType: "text/plain", buffer: Buffer.from(BOOK) });
await p.waitForTimeout(900);
await fetch(`${MOCK}/__reset`);

await p.getByRole("button", { name: "More ways to use this" }).click();
await p.waitForTimeout(250);
await p.getByRole("button", { name: /Make lessons/ }).click();

const said = [];
for (let i = 0; i < 60; i++) {
  const n = await p.locator("main").innerText().then((t) => (t.match(/Reading the whole of it — part \d+ of \d+|Read it all\. Writing/) ?? [""])[0]).catch(() => "");
  if (n && !said.includes(n)) said.push(n);
  if ((await p.getByRole("button", { name: /^Keep/ }).count()) > 0) break;
  await p.waitForTimeout(250);
}

const { recent } = await (await fetch(`${MOCK}/__recent`)).json();
const reads = recent.filter((r) => /You are reading part \d+ of \d+/.test(r.head ?? ""));
const last = await (await fetch(`${MOCK}/__last`)).json();
const writer = JSON.stringify(last ?? {});

console.log("\nIt is read in parts");
check(reads.length >= 5, "one reader call per part, not one call with the first forty pages", `${reads.length} reader calls`);
check(said.some((t) => /part \d+ of \d+/.test(t)), "and the page says how far along it is", said.join(" → ").slice(0, 120));

console.log("\nAnd the writer gets all of it");
check(/Part 6 of 6|Part 5 of 5|Part 7 of 7/.test(writer), "the material reaches the last part of the book");
check(/Cover the whole of it, not just the first parts/.test(writer), "and the writer is told to cover the whole");
check(/Only the lines under \\"Quotable\\"|Only the lines under "Quotable"/.test(writer), "and which lines are the book's own words, so citations stay exact");
check((await p.getByRole("button", { name: /^Keep/ }).count()) === 1, "the lessons arrive as the page, with a diff, as before");

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
