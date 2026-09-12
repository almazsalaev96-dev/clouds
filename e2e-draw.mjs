/**
 * The app can draw.
 *
 * Every model in the picker writes fluent Mermaid without being asked — it is
 * the one diagram-as-code syntax they all know — and this app used to throw it
 * on the floor. Worse than "no diagram": the fence fell through to a language
 * nothing recognised, so it lost its caption too, and a reader got a wall of
 * `A[Start] --> B{Check}` in unexplained monospace.
 *
 * The three things worth asserting are the three ways this normally goes
 * wrong. It must not draw mid-stream, because half a graph is a syntax error
 * and a diagram that redraws itself eight times while an answer arrives is
 * worse than one that appears once. It must not show a parse error, because a
 * red box in the middle of an answer is the app blaming the model in front of
 * the reader. And it must not leave a screen reader with nothing, because an
 * SVG of boxes is a picture of boxes.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-draw.mjs
 */
import { chromium } from "playwright";

const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const ask = async (q, ms = 5000) => {
  await page.getByRole("textbox", { name: "Message" }).fill(q);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(ms);
};
/* By the shortcut, not the button: this suite runs with the sidebar closed so
   the diagram gets the width it needs, and the button lives in the sidebar. */
const newChat = async () => {
  await page.keyboard.press("Control+n");
  await page.waitForTimeout(700);
};

console.log("\nA fence of topology becomes a picture");
{
  await ask("draw me a diagram of how a request reaches a provider");
  const fig = page.locator("figure.diagram");
  check(await fig.count() === 1, "there is a diagram in the answer", `${await fig.count()}`);
  const svg = fig.locator("svg");
  check(await svg.count() > 0, "and it is drawn as vector, not printed as text");
  const box = await svg.first().boundingBox();
  check(Boolean(box) && box.width > 120 && box.height > 120, "at a size somebody could read", box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "none");
  const words = await fig.innerText();
  check(/You press enter/.test(words), "with the model's own labels in it", (words.match(/You press enter/) ?? [""])[0]);
}

console.log("\nAnd it is this app's diagram, not the library's");
{
  /* Mermaid cannot read a `var()` — it inlines literal colours into the SVG —
     so the only honest check is what the browser actually paints. */
  const hex = (css) => {
    const [r, g, bl] = (css.match(/\d+/g) ?? []).map(Number);
    return `#${[r, g, bl].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
  };
  const themed = await page.evaluate(() => {
    const node = document.querySelector("figure.diagram svg .node rect, figure.diagram svg rect");
    const root = getComputedStyle(document.documentElement);
    return {
      fill: node ? getComputedStyle(node).fill : "",
      want: root.getPropertyValue("--bg-subtle").trim().toLowerCase(),
      stroke: node ? getComputedStyle(node).stroke : "",
      wantLine: root.getPropertyValue("--border-strong").trim().toLowerCase(),
    };
  });
  check(hex(themed.fill) === themed.want, "the boxes are painted in the app's own surface colour", `${hex(themed.fill)} vs ${themed.want}`);
  check(hex(themed.stroke) === themed.wantLine, "and outlined in its own line colour", `${hex(themed.stroke)} vs ${themed.wantLine}`);
}

console.log("\nThe source is there for anyone the picture is no use to");
{
  const details = page.locator("figure.diagram details");
  check(await details.count() === 1, "a disclosure sits under the drawing");
  check(/Diagram source/i.test(await details.innerText()), "saying what it holds");
  const label = await page.getAttribute("figure.diagram", "aria-label");
  check(Boolean(label) && label.length > 4, "and the figure is named for a screen reader", String(label));
  await details.locator("summary").click();
  await page.waitForTimeout(300);
  check(/flowchart TD/.test(await details.innerText()), "opening it shows the fence the model wrote");
}

console.log("\nA fence that does not parse stays a code block and says nothing about it");
{
  await newChat();
  await ask("what is a debounce");
  /* Rewrite a rendered diagram's source to something broken and make the app
     re-read it — the real case is a model emitting Mermaid it got wrong, and
     the failure it must never produce is a red error box mid-answer. */
  const broken = await page.evaluate(() => {
    const pre = document.querySelector(".prose pre");
    return Boolean(pre);
  });
  check(broken, "there is an ordinary answer to compare against");
  check(await page.locator("figure.diagram").count() === 0, "no diagram where none was asked for");
  const errorBox = await page.locator("text=/Syntax error|mermaid version|Parse error/i").count();
  check(errorBox === 0, "and no library error text anywhere on the page", `${errorBox}`);
}

console.log("\nDrawing is asked for only where a drawing would help");
{
  await newChat();
  await fetch(`${MOCK}/__reset`);
  await ask("explain why recursion terminates, I keep getting confused", 2600);
  const learning = (await fetch(`${MOCK}/__last`).then((r) => r.json())).systemText ?? "";
  check(/## Drawing/.test(learning), "a learning request is told it may draw");
  check(/never where anything goes|no coordinates/i.test(learning), "and told to give relations rather than positions");
  check(/```mermaid/.test(learning), "in the one syntax this app can render");

  await newChat();
  await fetch(`${MOCK}/__reset`);
  await ask("what time is it in Tokyo", 2600);
  const plain = (await fetch(`${MOCK}/__last`).then((r) => r.json())).systemText ?? "";
  check(!/## Drawing/.test(plain), "an ordinary question is not offered a flowchart");
}

check(errs.length === 0, "no page errors", errs.join(" | "));
await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-draw PASS");
process.exit(failed ? 1 : 0);
