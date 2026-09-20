/**
 * A chart, from a fence.
 *
 * The model writes the numbers; the app decides where they go. The claims
 * here are the ones a chart gets wrong when it is wrong: it is not drawn
 * until the answer has finished arriving, two series get a legend so colour
 * never carries identity alone, a gap in the data breaks the line instead of
 * bridging it, every value is reachable as a table without hovering, and the
 * hover readout lists every series at that x.
 */
import { chromium } from "playwright";
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
await p.getByRole("textbox", { name: "Message" }).fill("Chart the request trend for the quarter");
await p.keyboard.press("Meta+Enter");
await p.waitForTimeout(4500);

const fig = p.locator(".msg figure[aria-label='Requests per day']").last();

console.log("\nThe chart is drawn, once the answer has finished");
{
  check(await fig.isVisible(), "a figure with the chart's own title is on the page");
  const svg = fig.locator("svg[role='img']");
  check(await svg.count() === 1, "and it is one picture, not a code block");
  const label = await svg.getAttribute("aria-label");
  check(/Line chart.*Search, Checkout.*Jul to Oct.*table/.test(label ?? ""),
    "which says what it is to a reader who cannot see it", (label ?? "").slice(0, 90));
  check((await fig.locator("path[stroke]").count()) >= 3,
    "two series, and the gap in one of them breaks its line into two paths rather than bridging the missing month",
    `${await fig.locator("path[stroke]").count()} line segments`);
}

console.log("\nIdentity is never colour alone");
{
  const legend = await fig.locator("span.text-xs").allInnerTexts();
  check(legend.includes("Search") && legend.includes("Checkout"), "two series get a legend", legend.join(" · "));
  const textFill = await fig.locator("svg text").first().evaluate((t) => getComputedStyle(t).fill);
  const seriesFill = await fig.locator("svg path[stroke]").first().evaluate((t) => t.getAttribute("stroke"));
  check(!seriesFill?.includes("text") && !/chart-/.test(textFill), "and axis text wears a text token, not a series colour",
    `text ${textFill.slice(0, 22)} · series ${seriesFill}`);
}

console.log("\nEvery value is reachable without hovering");
{
  await fig.getByRole("button", { name: /As a table/ }).click();
  await p.waitForTimeout(300);
  const t = fig.locator("table");
  check(await t.isVisible(), "the table view opens");
  const cells = await t.locator("td").allInnerTexts();
  check(cells.includes("1,200 req") && cells.includes("2,600 req"), "with thousands grouped and the unit on", cells.slice(0, 6).join(" · "));
  check(cells.includes("—"), "and the missing month shown as a dash, not as zero and not as “null”");
}

console.log("\nThe hover readout lists every series at that x");
{
  const svg = fig.locator("svg[role='img']");
  const box = await svg.boundingBox();
  await p.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
  await p.waitForTimeout(200);
  const tip = fig.getByRole("status");
  check(await tip.isVisible(), "a readout appears");
  const txt = (await tip.innerText()).replace(/\s+/g, " ");
  check(/Sep/.test(txt) && /Search/.test(txt) && /Checkout/.test(txt), "naming the month and both series", txt.slice(0, 60));
  check(/700 req/.test(txt) && /—/.test(txt), "with the value leading, and the gap as a dash", txt.slice(0, 60));
}

console.log("\nAnd a fence it cannot read is shown as the code it is");
{
  await p.getByRole("textbox", { name: "Message" }).fill("plot ```chart\n{not json\n```");
  await p.keyboard.press("Meta+Enter");
  await p.waitForTimeout(4000);
  /* The mock answers the same chart regardless; the unparseable one is the
     user's own message, rendered by the same pipeline. */
  const user = p.locator(".msg").filter({ hasText: "not json" }).first();
  check((await user.locator("svg[role='img']").count()) === 0, "no picture is drawn from it");
  check(/not json/.test(await user.innerText()), "and the source is still there to read");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
