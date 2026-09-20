/**
 * Research: the model may search the web, and the answer says what it read.
 *
 * The claims, in the order a person would notice them: the toggle offers the
 * tool and only then; while the search runs the wait says what is being
 * searched for; the pages come back numbered; the text carries a marker where
 * a claim rests on a page; the strip under the answer lists the same pages by
 * the same numbers and survives a reload; and a turn the provider pauses is
 * sent straight back and finishes — no "continue", no second question.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nOff by default, and then on");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What is a debounce");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(3500);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(!(sent.tools ?? []).length, "with research off, no tool rides in the request", JSON.stringify(sent.tools ?? []));
  check((await p.locator(".msg section[aria-label='Sources']").count()) === 0, "and no sources are claimed");

  const toggle = p.getByRole("button", { name: /Research: let it search the web/ });
  check(await toggle.isVisible(), "the toggle is in the bar");
  await toggle.click();
  await p.waitForTimeout(300);
  check(await p.getByRole("button", { name: /Stop searching the web/ }).isVisible(), "and pressing it says it is on");
}

console.log("\nWith it on, the model searches and the answer says what it read");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What is the difference between a debounce and a throttle");
  await p.keyboard.press("Meta+Enter");
  /* The searching line is up only while the search runs: catch it early. */
  const searching = await p.locator("text=/Searching for/").first().isVisible({ timeout: 2500 }).catch(() => false);
  check(searching, "while it searches, the wait says what is being searched for");
  await p.waitForTimeout(4000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check((sent.tools ?? []).some((t) => /^web_search_/.test(t)), "the request carried the search tool", JSON.stringify(sent.tools));
  check(!(sent.tools ?? []).some((t) => /^web_fetch_/.test(t)), "but not fetch, because nothing in the conversation is a URL to fetch");

  const msg = p.locator(".msg").last();
  const text = await msg.innerText();
  check(/\[1\]/.test(text), "the text carries a marker where a claim rests on a page", (text.match(/[^.]*\[1\][^.]*/) ?? [""])[0].trim().slice(0, 70));
  const strip = msg.locator("section[aria-label='Sources']");
  check(await strip.isVisible(), "and a strip of sources sits under the answer");
  const rows = await strip.locator("li").allInnerTexts();
  check(rows.length === 2, "two pages, numbered", rows.map((r) => r.replace(/\s+/g, " ")).join(" | "));
  check(/^1\s+Debounce and throttle, explained/.test(rows[0] ?? ""), "the first is the one the marker points at", (rows[0] ?? "").replace(/\s+/g, " "));
  const href = await strip.locator("a").first().getAttribute("href");
  check(href === "https://example.org/debounce", "and it links to the page itself", href ?? "none");
  const quote = await strip.locator("a").first().getAttribute("title");
  check(/A debounce waits for silence/.test(quote ?? ""), "with the cited passage on the link", quote ?? "none");
}

console.log("\nThe sources are kept, not only shown");
{
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const strip = p.locator(".msg section[aria-label='Sources']").last();
  check(await strip.isVisible(), "after a reload the strip is still there");
  check((await strip.locator("li").count()) === 2, "with both pages");
  const off = await p.getByRole("button", { name: /Stop searching the web/ }).isVisible().catch(() => false);
  check(off, "and the conversation remembers that research is on");
}

console.log("\nA URL in the question offers fetch as well");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("Summarise https://example.org/debounce for me");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check((sent.tools ?? []).some((t) => /^web_fetch_/.test(t)), "fetch rides along once there is something to fetch", JSON.stringify(sent.tools));
}

console.log("\nA paused turn is sent straight back and finishes");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("keep searching until you find what a throttle is");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(5000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  /* The mock ends the first round with pause_turn and answers only a request
     whose last message is the assistant's own tool blocks. If the app had
     added a "continue" message, or not resumed at all, either the count or
     the last role would say so. */
  check(sent.lastRole === "assistant", "the resumed request ends in the assistant's own turn, with no added question", `last role: ${sent.lastRole}`);
  const text = await p.locator(".msg").last().innerText();
  check(/throttle/i.test(text) && text.length > 60, "and the answer arrives on the resumed round", text.replace(/\s+/g, " ").slice(0, 60));
  check(!/continue/i.test(await p.locator("main").innerText()), "with nothing said to make it continue");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
