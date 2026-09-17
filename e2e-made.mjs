/**
 * Asked for a thing in the chat, you get the thing.
 *
 * Not its source. The answer's markup never appears in the transcript — while
 * it streams there is a card that says what is being built and how far along
 * it is, and when it lands there is a card that names it, a column beside the
 * conversation where it runs, and the code behind one press for whoever wants
 * it. A second page in the same conversation replaces what is running rather
 * than making a second thing. And every made page gets the base stylesheet,
 * so a model that forgot to design gets a design anyway.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-made.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3100/studio", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

const box = p.locator(".composer-shell textarea").first();
const table = (name) => p.evaluate((n) => new Promise((ok) => {
  const r = indexedDB.open("clouds"); r.onsuccess = () => {
    const q = r.result.transaction(n).objectStore(n).getAll();
    q.onsuccess = () => { r.result.close(); ok(q.result); };
  };
}), name);
const column = p.getByRole("complementary", { name: /running$/ });

console.log("\nWhile it is being built");
{
  await box.fill("make me a timer for two minutes");
  await p.keyboard.press("Enter");
  /* The mock streams the page over a couple of seconds; sample the transcript
     mid-way and it must show a card, not markup. */
  let sawBuilding = false, sawMarkup = false;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(100);
    const main = await p.locator("main").innerText();
    if (/Building/.test(main)) sawBuilding = true;
    if (/<!doctype html|<script>/.test(main)) sawMarkup = true;
  }
  check(sawBuilding, "the transcript says what is being built while it streams");
  check(!sawMarkup, "and never shows the markup on its way in");
  await p.waitForTimeout(3000);
}

console.log("\nWhen it lands");
{
  const main = await p.locator("main").innerText();
  check(!/<!doctype html|<\/script>|<style>/.test(main), "the answer's markup is not in the transcript");
  check(await p.locator(".msg pre").count() === 0, "not as a code block either", `${await p.locator(".msg pre").count()} blocks`);
  const card = p.getByRole("group", { name: "Made: Two minutes" });
  check(await card.count() === 1, "a card names the thing that was made");
  check(await column.isVisible(), "and it is running in a column beside the conversation");
  const frame = column.frameLocator("iframe");
  await frame.locator("#t").waitFor({ timeout: 8000 });
  check((await frame.locator("#t").innerText()) === "02:00", "running for real", await frame.locator("#t").innerText());
  const base = await frame.locator("style[data-armi-base]").count();
  check(base === 1, "with the base stylesheet under it, so it has a design whether or not the model gave it one");
  const font = await frame.locator("body").evaluate((el) => getComputedStyle(el).fontFamily);
  check(!/Times|serif$/i.test(font) || /system-ui|sans/i.test(font), "a system face rather than the browser's default", font.slice(0, 40));
  const made = await table("canvases");
  check(made.length === 1 && made[0].kind === "code" && made[0].lang === "html", "kept as one runnable document in Code", `${made.length} canvases`);
  const msgs = await table("messages");
  check(msgs.filter((m) => m.role === "assistant")[0]?.canvasId === made[0].id, "and the answer remembers which one it built");
  await card.getByRole("button", { name: "Show code" }).click();
  await p.waitForTimeout(300);
  check(await card.locator("pre").count() === 1, "the code is one press away for whoever wants it");
  await card.getByRole("button", { name: "Hide code" }).click();
}

console.log("\nAsked again, it is the same thing, updated");
{
  await box.fill("make me a timer with bigger numbers");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  const made = await table("canvases");
  check(made.length === 1, "a second page in the same conversation replaces what is running rather than making a second thing", `${made.length} canvases`);
  const msgs = (await table("messages")).filter((m) => m.role === "assistant");
  check(msgs.length === 2 && msgs[0].canvasId === msgs[1].canvasId, "both answers point at the one canvas");
  check(await p.getByRole("group", { name: "Made: Two minutes" }).count() === 2, "and each has its card");
  check(await column.isVisible(), "the column is still open on it");
}

console.log("\nClosed, and opened again from the card");
{
  await p.getByRole("button", { name: "Close" }).click();
  await p.waitForTimeout(400);
  check(!(await column.isVisible().catch(() => false)), "the column closes");
  await p.getByRole("group", { name: "Made: Two minutes" }).first().getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(600);
  check(await column.isVisible(), "and the card opens it again");
}

console.log("\nAnd into Code, running, in one press");
{
  await p.getByRole("button", { name: "Open in Code" }).click();
  await p.waitForTimeout(900);
  check(await p.getByRole("button", { name: /Use it/ }).isVisible(), "Code opens it with Use it on it");
  const f = p.frameLocator("iframe").first();
  await f.locator("#t").waitFor({ timeout: 8000 });
  check((await f.locator("#t").innerText()) === "02:00", "running there too");
  await p.locator("aside nav").getByRole("button", { name: "Conversations" }).click();
  await p.waitForTimeout(600);
  check(await column.isVisible(), "and back in the conversation the column is open on it again");
}

console.log("\nA question is still a question");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(300);
  await box.fill("what is a debounce");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);
  check(!(await column.isVisible().catch(() => false)), "a new conversation that built nothing has no column");
  check(await p.getByRole("group", { name: /^Made:/ }).count() === 0, "and no card");
}

console.log("\nFrom the Creative room");
{
  await p.locator("aside nav").getByRole("button", { name: "Creative" }).first().click();
  await p.waitForTimeout(700);
  check(await p.getByRole("textbox", { name: "What to make" }).isVisible(), "the room asks what to make");
  check(await p.getByRole("group", { name: "Ideas" }).getByRole("button").count() >= 4, "and offers ideas, sent as they are");
  await p.getByRole("group", { name: "Ideas" }).getByRole("button").first().click();
  await p.waitForTimeout(5000);
  check(await p.getByRole("textbox", { name: "Message" }).isVisible(), "an idea starts a conversation");
  check(await column.isVisible(), "whose answer is running beside it");
  const convs = await table("conversations");
  check(convs.some((c) => c.mode === "creative"), "and the conversation is stamped creative, so every answer in it is a page");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
