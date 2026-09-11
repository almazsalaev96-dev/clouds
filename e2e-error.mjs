/**
 * What a person actually sees when it goes wrong.
 *
 * `classifyError` turns every provider's dialect into one sentence and one
 * button, and `test-error.ts` checks the translation. This checks the other
 * half — that the sentence reaches the screen, that the button is the right
 * button, that pressing it does the thing it names, and that a conversation
 * survives the failure rather than being left with half an answer and no
 * explanation.
 *
 * None of this had ever been rendered by a test, because nothing could make
 * the mock fail on purpose. Now `GET /__fail?status=&body=&times=` arms it.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-error.mjs
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

const arm = (status, body, times = 1) =>
  fetch(`${MOCK}/__fail?status=${status}&body=${encodeURIComponent(body)}&times=${times}`).then((r) => r.json());
const disarm = () => fetch(`${MOCK}/__fail`).then((r) => r.json());

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const ask = async (q) => {
  await page.getByRole("textbox", { name: "Message" }).fill(q);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2400);
};
const newChat = async () => {
  await page.getByRole("button", { name: /New chat/ }).click();
  await page.waitForTimeout(700);
};
/* What is on screen about the failure: the sentence, and the buttons beside it. */
const shown = () =>
  page.evaluate(() => {
    const bar = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).borderLeftWidth === "2px" && /rgb/.test(getComputedStyle(d).borderLeftColor) && (d.textContent ?? "").length > 5 && d.querySelector("button"),
    );
    if (!bar) return null;
    return {
      text: (bar.querySelector("span")?.textContent ?? "").trim(),
      buttons: [...bar.querySelectorAll("button")].map((x) => (x.getAttribute("aria-label") || x.textContent || "").trim()),
    };
  });

console.log("\nA rejected key says so, and offers the key");
{
  await arm(401, '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}');
  await ask("what is a debounce");
  const e = await shown();
  check(Boolean(e), "the failure is on screen rather than silent", e ? "" : "nothing rendered");
  check(/rejected your API key/i.test(e?.text ?? ""), "in words about the key", e?.text);
  check(!/x-api-key|authentication_error/i.test(e?.text ?? ""), "and not in the provider's own", e?.text);
  check((e?.buttons ?? []).some((x) => /add key/i.test(x)), "with the button that fixes it", (e?.buttons ?? []).join(", "));
}

console.log("\nAnd pressing that button opens the place where keys go");
{
  await page.getByRole("button", { name: /^Add key$/ }).click();
  await page.waitForTimeout(900);
  const open = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    return d ? (d.textContent ?? "").slice(0, 80) : null;
  });
  check(Boolean(open), "settings opened", open ?? "nothing opened");
  check(/key/i.test(open ?? ""), "on the keys", (open ?? "").slice(0, 40));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
}

console.log("\nA provider having a bad day is not your key's fault");
{
  await newChat();
  await arm(500, '{"error":{"type":"api_error","message":"Internal server error"}}');
  await ask("what is a debounce");
  const e = await shown();
  check(/trouble on their end/i.test(e?.text ?? ""), "it says whose problem it is", e?.text);
  check((e?.buttons ?? []).some((x) => /switch model/i.test(x)), "and offers the way round it", (e?.buttons ?? []).join(", "));
  check((e?.buttons ?? []).some((x) => /retry/i.test(x)), "as well as trying again", (e?.buttons ?? []).join(", "));
}

console.log("\nRetry actually retries, and the answer replaces the error");
{
  await disarm();
  await page.getByRole("button", { name: /^Retry$/ }).first().click();
  await page.waitForTimeout(3000);
  const e = await shown();
  check(e === null, "the error is gone", e?.text ?? "");
  const prose = await page.locator(".prose").count();
  check(prose > 0, "and an answer is in its place", `${prose} on screen`);
  const texts = await page.locator(".prose").allInnerTexts();
  check(texts.some((t) => /debounce/i.test(t)), "the answer to the question that failed", texts[0]?.slice(0, 40));
}

console.log("\nOne question, one error: a failure does not stack up");
{
  await newChat();
  await arm(503, "upstream connect error", 3);
  await ask("what is a debounce");
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll("div")].filter(
      (d) => getComputedStyle(d).borderLeftWidth === "2px" && (d.textContent ?? "").includes("trouble"),
    ).length,
  );
  check(bars === 1, "one error bar, not one per attempt", String(bars));
  await disarm();
}

console.log("\nA conversation that failed is still a conversation");
{
  /* The failure must not eat the question. Somebody who asks, fails, and comes
     back tomorrow should find what they asked rather than an empty thread. */
  const mine = await page.evaluate(() =>
    [...document.querySelectorAll("[id^=m-]")].map((n) => (n.textContent ?? "").trim().slice(0, 40)),
  );
  check(mine.some((t) => /debounce/i.test(t)), "the question is still there", mine.join(" | ").slice(0, 70));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() =>
    [...document.querySelectorAll("[id^=m-]")].map((n) => (n.textContent ?? "").trim().slice(0, 40)),
  );
  check(after.some((t) => /debounce/i.test(t)), "and it survives a reload", after.join(" | ").slice(0, 70));
}

console.log("\nA rate limit is waited out rather than shown");
{
  await newChat();
  await arm(429, '{"type":"error","error":{"type":"rate_limit_error","message":"retry-after 1"}}');
  await ask("what is a debounce");
  await page.waitForTimeout(4000);
  const e = await shown();
  check(e === null, "nothing to clear: the app waited and asked again", e?.text ?? "");
  const texts = await page.locator(".prose").allInnerTexts();
  check(texts.some((t) => /debounce/i.test(t)), "and the answer arrived", texts[0]?.slice(0, 40));
  await disarm();
}

console.log("\nA conversation too long to send says which problem it is");
{
  await newChat();
  await arm(400, '{"error":{"message":"prompt is too long: 250000 tokens > 200000 maximum context"}}');
  await ask("what is a debounce");
  const e = await shown();
  check(/too long for the model/i.test(e?.text ?? ""), "it names the length rather than blaming the key", e?.text);
  check((e?.buttons ?? []).some((x) => /switch model/i.test(x)), "and points at a model with more room", (e?.buttons ?? []).join(", "));
  await disarm();
}

console.log("\nAnd the error is announced, not only drawn");
{
  const live = await page.evaluate(() => {
    const regions = [...document.querySelectorAll("[aria-live]")];
    return regions.map((r) => ({ live: r.getAttribute("aria-live"), text: (r.textContent ?? "").trim().slice(0, 60) }));
  });
  check(live.length > 0, "there is a live region on the page", `${live.length}`);
  check(live.some((r) => /too long|went wrong|trouble|rejected/i.test(r.text)), "and the failure reached it", JSON.stringify(live).slice(0, 120));
}

console.log("\nAn answer cut short by a safety filter says it was cut short");
{
  /* All three providers report this stop reason and nothing ever showed it,
     so an answer a safety system trimmed arrived looking exactly like one
     that had finished. */
  await newChat();
  await ask("please refuse this one");
  await page.waitForTimeout(1200);
  const meta = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
  check(/cut short by a safety filter|declined by a safety filter/i.test(meta), "the answer is marked rather than left looking complete", (meta.match(/.{0,20}safety filter.{0,10}/) ?? ["not marked"])[0]);
  const offered = await page.getByRole("button", { name: /Try another model/ }).count();
  check(offered > 0, "and offers the only thing that helps", `${offered}`);
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await disarm();
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-error PASS");
process.exit(failed ? 1 : 0);
