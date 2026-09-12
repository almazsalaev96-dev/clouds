/**
 * The app knows what kind of job a request is. Now the answer knows too.
 *
 * `lib/task.ts` has classified every request since it was written — learning,
 * coding, research, writing, data, design — and the answer went to exactly one
 * place: a second model, told what to look for when checking the first. The
 * classification was being spent on the audit and never on the work. So a
 * proof, a pull request and a claim about the world were all asked for in the
 * same voice, by an app that could tell them apart.
 *
 * This reads the wire. What matters is not that a block of text was added but
 * *which* block, and that it rides in its own system block behind the cache
 * breakpoint — because the composed prompt above it is the app's cacheable
 * prefix, and a per-turn line folded into it makes every turn pay full price
 * to re-read the project knowledge it sits above.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-shape.mjs
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const newChat = async () => {
  await page.getByRole("button", { name: /New chat/ }).click();
  await page.waitForTimeout(600);
};

/** What the app actually sent, as the provider received it. */
const sent = async (question) => {
  await fetch(`${MOCK}/__reset`);
  await page.getByRole("textbox", { name: "Message" }).fill(question);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2600);
  return fetch(`${MOCK}/__last`).then((r) => r.json());
};

console.log("\nEach kind of work is asked for in the way that kind needs");
const CASES = [
  ["explain why recursion terminates, I keep getting confused", /wrong version|mispredicts|retriev/i, "learning"],
  ["write a unit test for this function and fix the failing case", /empty case|boundary|invariant/i, "coding"],
  ["is it true that the Roman concrete recipe was lost — cite sources", /strongest version of the case against|infer/i, "research"],
  ["recompute the quarterly totals in this table and chart the trend", /arithmetic|denominator|correlation/i, "data"],
];
for (const [question, wants, kind] of CASES) {
  await newChat();
  const last = await sent(question);
  const system = last.systemText ?? "";
  check(wants.test(system), `${kind}: the answer is asked for the way ${kind} needs it`, (system.match(wants) ?? ["no match"])[0]);
  check(/## This request/.test(system), `  and it says which kind it read this as`);
}

console.log("\nAn ordinary question gets no lecture about how to answer it");
{
  await newChat();
  const last = await sent("what time is it in Tokyo");
  const system = last.systemText ?? "";
  check(!/## This request/.test(system), "nothing is added to a request that is not one of the kinds", system.slice(-60));
}

console.log("\nA stance that withholds something is not shown the thing it withholds");
{
  /* The leak every teaching prompt has and none of them name: a model that has
     already solved the problem writes a hint shaped like the solution — right
     variable, the useless step skipped, pointing straight at the answer. The
     instruction was obeyed; the shape gave it away. Not looking is the fix. */
  await newChat();
  await page.getByRole("button", { name: /Response style/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Socratic/i }).first().click();
  await page.waitForTimeout(600);
  const last = await sent("why does this loop run twice");
  const system = last.systemText ?? "";
  check(/Reason only about the work they have already shown you/.test(system),
    "the teaching stance is told not to work ahead");
  check(/leak — in the shape of the hint|points at it/i.test(system),
    "and told why, so it is a reason rather than a rule");

  await page.getByRole("button", { name: /Response style/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Normal/i }).first().click();
  await page.waitForTimeout(600);
  const plain = (await sent("why does this loop run twice")).systemText ?? "";
  check(!/Reason only about the work/.test(plain),
    "an ordinary answer is still allowed to work the whole thing out");
}

console.log("\nThe per-turn half rides behind the cache breakpoint");
{
  /* Both halves have to exist for the split to mean anything, so this gives
     the thread standing instructions long enough to be worth caching — which
     is the case the separation exists for. */
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("store.settings.v1"));
    s.state.systemPrompt = "You are helping Almaz. " + "Keep the house style throughout. ".repeat(90);
    localStorage.setItem("store.settings.v1", JSON.stringify(s));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await newChat();
  const last = await sent("explain why recursion terminates, I keep getting confused");
  check(last.systemBlocks >= 2, "the instructions went out in two blocks, not one", `${last.systemBlocks} blocks`);
  check(last.cachedSystemBlocks === 1, "exactly one of them is the cached prefix", `${last.cachedSystemBlocks} cached`);
  check(/house style/.test(last.systemText ?? ""), "the stable half is the one that carries the standing instructions");
  check(/## This request/.test(last.systemText ?? ""), "with the per-turn half in it");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-shape PASS");
process.exit(failed ? 1 : 0);
