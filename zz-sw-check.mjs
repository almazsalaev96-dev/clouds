/* Does the offline shell work? Loads the built app once online, goes offline, reloads. */
import { chromium } from "playwright";
const PORT = process.argv[2] ?? "3101";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const context = await browser.newContext({ serviceWorkers: "allow" });
// Registration is skipped under automation on purpose; pretend to be a person for this check.
await context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
const page = await context.newPage();
const fails = [];
const ok = (c, l, d = "") => { console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready.catch(() => null);
  return r ? { scope: r.scope, active: Boolean(r.active) } : null;
});
ok(Boolean(reg?.active), "the worker registers and activates on a real visit", JSON.stringify(reg));
// The first visit is not under the worker; the second is, and that is the one that fills the cache.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
ok(controlled, "the next load is under the worker");
const cached = await page.evaluate(async () => {
  const c = await caches.open("armi-shell-v1");
  const keys = await c.keys();
  return { n: keys.length, page: keys.some((k) => new URL(k.url).pathname === "/"), chunks: keys.filter((k) => k.url.includes("/_next/static/")).length, api: keys.some((k) => k.url.includes("/api/")) };
});
ok(cached.page && cached.chunks > 3, "the page and its scripts are in the cache", JSON.stringify(cached));
ok(!cached.api, "and nothing from the API is");

await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2500);
const title = await page.title().catch(() => "");
const body = await page.evaluate(() => document.body?.innerText?.slice(0, 400) ?? "").catch(() => "");
const onLine = await page.evaluate(() => navigator.onLine).catch(() => null);
console.log(`    navigator.onLine = ${onLine}`);
ok(/Armi/.test(title) && body.length > 40, "offline, the app still opens", `${title} · ${body.replace(/\s+/g, " ").slice(0, 80)}`);
ok(/Offline\./.test(body), "and says it is offline", body.replace(/\s+/g, " ").slice(0, 120));
const rooms = await page.evaluate(() => [...document.querySelectorAll("button, a")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()).filter((t) => /Study|Notebook|Code|Creative/.test(t)).length).catch(() => 0);
ok(rooms > 0, "with the rooms reachable", `${rooms} room controls`);
await context.setOffline(false);

// Under automation the worker is not registered at all.
const plain = await browser.newContext();
const p2 = await plain.newPage();
await p2.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
await p2.waitForTimeout(800);
const regs = await p2.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
ok(regs === 0, "and a test driver never gets one", `${regs} registrations`);

await browser.close();
console.log(fails.length ? `\n  ${fails.length} failed` : "\n  all passed");
process.exit(fails.length ? 1 : 0);
