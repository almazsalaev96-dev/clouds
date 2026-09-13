/**
 * What an answer offers next, and whether it means it.
 *
 * Six follow-ups sit under the last answer — simpler, an example, the steps,
 * why, quiz me, harder — and each is a real turn sent as the person, so the
 * transcript shows what was asked. That last part is the thing worth holding:
 * a chip that changed the model's instructions behind the scenes would be the
 * app acting in the person's name without saying so. Beside them, Tighten is
 * offered only when the linter found something to cut; the mock's answer is
 * clean, so its absence here is the assertion.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-follow.mjs
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const S = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);

console.log("\nFollow-ups under the last answer");
await p.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
await p.keyboard.press("Enter");
await p.waitForTimeout(3000);
const group = p.getByRole("group", { name: "Follow up" });
check(await group.count() === 1, "one row of follow-ups, on the last answer", `${await group.count()} found`);
const labels = await group.getByRole("button").allInnerTexts();
check(labels.join(" · ") === "Simpler · Example · Steps · Why? · Quiz me · Harder", "with the six moves in order", labels.join(" · "));
const before = await p.locator(".msg").count();
await group.getByRole("button", { name: "Example" }).click();
await p.waitForTimeout(3200);
const after = await p.locator(".msg").count();
check(after === before + 2, "pressing one sends a real turn and gets an answer", `${before} → ${after} messages`);
const sent = await p.locator(".msg .whitespace-pre-wrap.bg-subtle").last().innerText();
check(sent === "Give me one concrete example of that.", "and the transcript shows what was asked, in the person's own turn", sent);
check(await p.getByRole("group", { name: "Follow up" }).count() === 1, "the row moves to the new last answer, not one per answer");

console.log("\nTighten only when there is something to cut");
const tighten = await p.getByRole("button", { name: /^Tighten/ }).count();
check(tighten === 0, "the mock's answer is clean, so no Tighten is offered", `${tighten} found`);

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors"); if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close(); process.exit(failed ? 1 : 0);
