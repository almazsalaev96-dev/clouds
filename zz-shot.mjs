import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const S = (theme) => ({ theme, density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true });
for (const theme of ["light", "dark"]) {
  const p = await (await b.newContext({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2 })).newPage();
  await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S(theme));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/tmp/claude-0/shell-${theme}.png` });
  const box = await p.locator("aside").first().boundingBox();
  const row = await p.getByRole("button", { name: "Study" }).first().boundingBox();
  const names = await p.locator("aside nav button").allInnerTexts();
  console.log(theme, "| panel", JSON.stringify(box), "| Study row h", row?.height, "| order:", names.filter(Boolean).join(" → "));
}
await b.close();
