/**
 * The same doing on the other wire format: an OpenAI-shaped model asks for
 * a tool as `tool_calls`, the app runs it and answers with `tool` messages,
 * and the answer that follows is written from the result.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "gpt-5.6-terra", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true };
const box = () => p.getByRole("textbox", { name: "Message" });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nAn OpenAI-shaped model saves cards through tool_calls");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("make me flashcards about debounce");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(5500);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(/^gpt/.test(last.model ?? ""), "the request went to the other company", last.model);
  check((last.tools ?? []).includes("save_cards"), "carrying the app's tools as functions", (last.tools ?? []).slice(0, 4).join(","));
  check(last.lastRole === "tool", "and the results went back as tool messages", last.lastRole);
  const row = await p.locator(".msg").last().innerText();
  check(/Done — Saved 3 cards to “Debounce”/.test(row), "the answer is written from the result", row.split("\n").find((l) => /Done/.test(l))?.slice(0, 60));
  check(await p.locator(".msg").last().getByRole("list", { name: "Done in this app" }).isVisible(), "and the chip is under it");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
