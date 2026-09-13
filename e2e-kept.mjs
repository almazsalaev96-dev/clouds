/**
 * What is kept, and what is deliberately not.
 *
 * Two features that are each other's opposite, and both of them are promises
 * about storage rather than features you can see working — which is exactly
 * the kind that rots silently. A memory that stops reaching the model is an
 * app that has quietly forgotten you. A temporary chat that outlives its tab
 * is a promise broken with no symptom at all.
 *
 * So everything here is read off the wire or off the database, never off the
 * interface's own claims: what the provider was actually sent, and what is
 * actually in IndexedDB afterwards.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-kept.mjs
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "light", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, memoryOn: true, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* The bar, and only the bar. `role="status"` is also on the transcript's own
   live region — the sr-only one that tells a screen reader an answer has
   landed — and that one carries the whole answer, so a match against it is
   both the wrong element and unreadable when it fails. */
const bar = async () =>
  (await page.locator("[role='status']:not(.sr-only)").allInnerTexts()).join(" \u00b7 ").replace(/\s+/g, " ").trim();

const rows = (table) => page.evaluate(async (t) => {
  const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
  if (![...d.objectStoreNames].includes(t)) { d.close(); return []; }
  const all = await new Promise((r) => { const q = d.transaction([t]).objectStore(t).getAll(); q.onsuccess = () => r(q.result); });
  d.close();
  return all;
}, table);

/** Say something in a brand-new ordinary thread, and hand back what the provider got. */
const ask = async (text, ms = 2600) => {
  await fetch(`${MOCK}/__reset`);
  await page.locator("aside nav").getByRole("button", { name: "Conversations" }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(ms);
  return fetch(`${MOCK}/__last`).then((r) => r.json());
};

console.log("\nAsking for something to be remembered");
{
  await ask("Remember that I write in British English.");
  const said = await bar();
  check(/Remembered/.test(said), "the app says it kept it, where the eye already is", said || "nothing");
  check(/British English/.test(said), "and shows the sentence it kept, not a reassurance");

  const kept = await rows("memories");
  check(kept.length === 1, "one row in the table", `${kept.length} rows`);
  check(kept[0]?.text === "I write in British English",
    "with the opening cleaned off and the words left alone", kept[0]?.text ?? "");
  check(kept[0]?.kind === "preference", "filed as a preference, which is what makes it standing");
}

console.log("\nAnd it reaches the model, in the half that is not cached");
{
  /* The question shares no word with the memory, which is the case a lexical
     retriever gets wrong: "answer in British English" is exactly as relevant
     to the moon as to everything else. */
  const seen = await ask("how far away is the moon");
  const sys = seen.systemText ?? "";
  check(/British English/.test(sys), "it is on the wire", `${sys.length} chars of system prompt`);
  check(/What you remember about this person/.test(sys), "under a heading that says what it is");
  check(/recite it back/.test(sys), "and told not to announce it every turn");
  /* The point of putting it in the turn block rather than the prefix: it
     changes every question, and folded into the cached half it would move the
     breakpoint and make every later turn re-read the project knowledge. */
  check((seen.systemBlocks ?? 0) >= 2,
    "in its own system block, behind the cache breakpoint",
    `${seen.systemBlocks} blocks, ${seen.cachedSystemBlocks} cached`);
}

console.log("\nWhat only sounds like a request to remember");
{
  await ask("do you remember what I told you about tides?");
  const kept = await rows("memories");
  check(kept.length === 1, "keeps nothing new", `${kept.length} rows`);
}

console.log("\nA credential is refused, and the refusal says so");
{
  await ask("Remember that my key is sk-ant-api03-AAAABBBBCCCCDDDDEEEE");
  const said = await bar();
  check(/Not kept/.test(said), "it says it did not keep it", said || "nothing");
  check(/API key|access token/i.test(said), "and what it recognised");
  check(!/AAAABBBBCCCC/.test(said), "without repeating it back");

  const kept = await rows("memories");
  check(kept.length === 1 && !JSON.stringify(kept).includes("AAAABBBBCCCC"),
    "and it is nowhere in the table", `${kept.length} rows`);
}

console.log("\nA temporary chat says what it is before you type in it");
{
  await page.keyboard.press("Control+Shift+n");
  await page.waitForTimeout(700);
  const main = await page.locator("main").innerText();
  check(/Temporary chat/.test(main), "it is labelled");
  check(/deleted when you close this tab/.test(main),
    "with the retention rule in words, not a reassurance",
    main.split("\n").find((l) => /deleted when/.test(l))?.slice(0, 80) ?? "");
}

console.log("\nAnd then it stays out of the history");
{
  await fetch(`${MOCK}/__reset`);
  await page.getByRole("textbox", { name: "Message" }).fill("what is a neap tide");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2600);

  const convs = await rows("conversations");
  const temp = convs.filter((c) => c.temporary);
  check(temp.length === 1, "the chat exists — there is nowhere else to put it", `${temp.length} temporary`);
  check(Boolean(temp[0]?.tempSession), "and it is stamped with the tab that owns it");

  const list = await page.locator("aside").innerText();
  check(!/neap tide/i.test(list), "but it is not in the sidebar");

  await page.getByRole("textbox", { name: "Search conversations" }).fill("neap").catch(async () => {
    await page.getByPlaceholder(/Search/i).first().fill("neap");
  });
  await page.waitForTimeout(900);
  const after = await page.locator("aside").innerText();
  check(!/neap tide/i.test(after), "and search does not find it either", after.split("\n").slice(0, 3).join(" / "));
  await page.getByRole("textbox", { name: "Search conversations" }).fill("").catch(() => {});
  await page.waitForTimeout(400);
}

console.log("\nMemory does not cross into it, in either direction");
{
  const seen = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(!/British English/.test(seen.systemText ?? ""),
    "nothing remembered goes out with a temporary chat");

  await page.getByRole("textbox", { name: "Message" }).fill("Remember that I am allergic to peanuts.");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2400);
  const kept = await rows("memories");
  check(!JSON.stringify(kept).includes("peanuts"),
    "and nothing said in one is remembered out of it",
    `${kept.length} rows`);
}

console.log("\nClosing the tab ends it");
{
  const before = (await rows("conversations")).filter((c) => c.temporary).length;
  /* What closing a tab actually does: sessionStorage goes, and the key this
     tab was writing to say it was still here goes with it. Everything else —
     the database, the settings — is exactly as the next launch would find it. */
  await page.evaluate(() => {
    sessionStorage.clear();
    for (const k of Object.keys(localStorage)) if (k.startsWith("temp.alive.")) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  const convs = await rows("conversations");
  const msgs = await rows("messages");
  check(before === 1 && convs.filter((c) => c.temporary).length === 0,
    "the chat is gone from the database", `${before} before, ${convs.filter((c) => c.temporary).length} after`);
  check(!JSON.stringify(msgs).includes("neap tide"),
    "and so are the messages in it — a swept row with its words left behind is not swept");
  check(convs.some((c) => !c.temporary), "while the ordinary conversations are untouched",
    `${convs.length} left`);
}

console.log("\nAnd the list of what it remembers is yours to empty");
{
  await page.keyboard.press("Control+,");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.waitForTimeout(500);
  const panel = await page.locator("[role='dialog']").innerText();
  check(/British English/.test(panel), "the sentence is listed in the words it was saved in");
  check(/Preference/.test(panel), "with what kind of thing it is");
  check(/used|never used/.test(panel), "and whether it is actually doing anything");

  await page.getByRole("button", { name: /^Forget: / }).first().click();
  await page.waitForTimeout(800);
  const kept = await rows("memories");
  check(kept.length === 0, "and forgetting it empties the table", `${kept.length} rows`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  const seen = await ask("how far away is the moon");
  check(!/British English/.test(seen.systemText ?? ""),
    "after which it stops reaching the model", "which is the only proof that forgetting worked");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-kept PASS");
process.exit(failed ? 1 : 0);
