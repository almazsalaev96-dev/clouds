/**
 * A second opinion, from somewhere else.
 *
 * The one thing an app holding several providers' keys can do that a
 * single-provider app cannot do honestly. A model asked to check its own
 * answer reproduces the same reasoning from the same weights and reports that
 * it holds up — which is not verification, it is an echo with extra steps, and
 * it is worse than no check because a reader takes it as evidence.
 *
 * So the checker always comes from a *different provider*, and where there is
 * no second provider the app says so rather than quietly asking a sibling
 * model and calling it independent. Both halves are asserted here, and the
 * refusal is the one that is easy to get wrong.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock \
 *   OPENAI_BASE_URL=http://127.0.0.1:8787 OPENAI_API_KEY=sk-mock npx next start -p 3100
 *   node e2e-verify.mjs
 *
 * Both providers point at the same mock, which now speaks both wire formats.
 * Until it did, nothing this app does across two providers was testable at all:
 * a request correctly routed elsewhere left the harness and died against a real
 * endpoint, which looks exactly like the feature being broken.
 */
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-clouds/fa496cc1-6c1b-5786-a4f7-ad158109470c/scratchpad/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const wire = async () => (await (await fetch("http://127.0.0.1:8787/__last")).json());

const S = (over = {}) => ({ theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, ...over });

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1100);

await page.getByRole("textbox", { name: "Message" }).fill("Explain debouncing to me");
await page.keyboard.press("Enter");
await page.waitForTimeout(2800);

console.log("\nAn answer can be checked");
{
  const answered = (await wire()).model;
  check(/claude/i.test(answered ?? ""), "the answer came from Anthropic", answered);
  check((await page.getByRole("button", { name: /Check with another model/ }).count()) === 1,
    "and there is a way to ask somebody else");
}

console.log("\nAnd the check goes somewhere else");
{
  await page.getByRole("button", { name: /Check with another model/ }).click();
  await page.waitForTimeout(3200);

  const checker = (await wire()).model;
  check(/gpt/i.test(checker ?? ""),
    "a model from a different provider does the checking — one marking its own homework agrees with itself",
    checker);

  const asked = JSON.stringify(await wire());
  check(/Someone asked a question and got the answer below/.test(asked),
    "it is asked to check rather than to answer");
  check(/from a different assistant/.test(asked),
    "and is not told which model wrote it — a checker with a name has a thumb on the scale");
  check(/You are not rewriting it/.test(asked), "with no licence to improve it");
  check(/Do not flatter it and do not look for fault/.test(asked),
    "and told that both flattering and fault-finding are ways of not answering");
}

console.log("\nAnd it checks the things that matter for this kind of work");
{
  /* The generic rules ask "is it right". For code that misses the input that
     breaks it; for a dataset it misses the arithmetic nobody recomputed. So the
     kind of work is read from the question and the answer together, and the
     checks that belong to it are added. Read at the wire, because a rule that
     does not reach the request is a rule that does not exist. */
  await page.getByRole("button", { name: /New chat/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("textbox", { name: "Message" }).fill(
    "refactor this and fix the type error:\n```ts\nfunction go(xs) { return xs.map(x => x.id) }\n```",
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2800);
  await page.getByRole("button", { name: /Check with another model/ }).click();
  await page.waitForTimeout(3200);

  const asked = JSON.stringify(await wire());
  check(/This is code/.test(asked), "the checker is told what kind of work it is looking at",
    (asked.match(/This is [^.\\]{0,60}/) ?? ["not said"])[0]);
  check(/empty list|null|boundary/i.test(asked),
    "and told to find the input that breaks it, which “is it right” does not ask");
  check(/quietly changes behaviour/i.test(asked),
    "and to say if it changed something the instruction did not ask to change");
  check(!/recompute the numbers/i.test(asked),
    "without the checks that belong to some other kind of work");
}

console.log("\nA disagreement is shown as one");
{
  const shown = await page.locator("main").innerText();
  check(/SECOND OPINION/i.test(shown), "the verdict lands under the answer it is about");
  check(/mostly agrees/i.test(shown), "and says where the two ended up", "mostly agrees");
  check(/GPT/i.test(shown), "naming who did the checking");
  check(/trailing edge/i.test(shown), "with the specific disagreement, not “some details may be inaccurate”");
  await page.screenshot({ path: `${OUT}/verify-verdict.png` });

  check((await page.getByRole("button", { name: /Check with another model/ }).count()) === 0,
    "and asking again is not offered — the verdict is about this text, and it has one");
}

console.log("\nIt survives a reload, because it is evidence about this answer");
{
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  const shown = await page.locator("main").innerText();
  check(/SECOND OPINION/i.test(shown), "the verdict is stored with the message, not held in memory");
}

console.log("\nWith one provider there is no second opinion, and it says so");
{
  const solo = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p2 = await solo.newPage();
  await p2.goto("http://localhost:3100", { waitUntil: "networkidle" });
  /* Anthropic only — and a client key for it, so the app has exactly one
     provider to work with however the server is configured. */
  await p2.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })),
    S({ keys: { anthropic: "sk-ant-mock" } }));
  await p2.addInitScript(() => {
    // Hide the server's own OpenAI key from this page, so only Anthropic is usable.
    const f = window.fetch;
    window.fetch = async (u, o) => {
      const res = await f(u, o);
      if (String(u).includes("/api/models")) {
        const j = await res.clone().json().catch(() => null);
        if (j && j.configured) {
          return new Response(JSON.stringify({ ...j, configured: { anthropic: true } }), {
            headers: { "content-type": "application/json" },
          });
        }
      }
      return res;
    };
  });
  await p2.reload({ waitUntil: "networkidle" });
  await p2.waitForTimeout(1500);

  /* A fresh thread. The two contexts share an origin and therefore a database,
     so the conversation already carrying a verdict is the one that opens —
     and "no verdict is produced" would pass on the previous one's. */
  await p2.getByRole("button", { name: /New chat/ }).first().click();
  await p2.waitForTimeout(600);
  await p2.getByRole("textbox", { name: "Message" }).fill("Explain debouncing to me");
  await p2.keyboard.press("Enter");
  await p2.waitForTimeout(2800);
  await p2.getByRole("button", { name: /Check with another model/ }).click();
  await p2.waitForTimeout(1200);

  const shown = await p2.locator("main").innerText();
  check(/different provider/i.test(shown),
    "it refuses rather than checking with a sibling model and calling it independent",
    (shown.split("\n").find((l) => /different provider/i.test(l)) ?? "").slice(0, 80));
  /* Asked of the database rather than the screen. A browser context in
     Playwright has its own storage, so this one's database holds only what
     this one did — which makes "how many verdicts were written" an exact
     question with an exact answer, where "is the phrase on screen" is a
     question about everything ever rendered. */
  const verdicts = await p2.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction(["messages"]).objectStore("messages").getAll(); q.onsuccess = () => r(q.result); });
    d.close();
    return rows.filter((m) => m.verdict).length;
  });
  check(verdicts === 0, "and no verdict is written at all", `${verdicts} in the database`);
  await p2.screenshot({ path: `${OUT}/verify-alone.png` });
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
