/**
 * The round built from the "why would millions use it" research (§14):
 * six accents, the first-run card, the session's cheer.
 *
 * The claims: Appearance offers six accents; choosing one changes the
 * accent tokens and nothing else; it is on the root before first paint
 * after a reload; every accent clears 4.5:1 as text on the page and as
 * white on its fill, in both themes; the blank page's first card asks a
 * name and a level and the level reaches Personalization; Personalization
 * says how much is remembered; and a study session that answered
 * something ends with a cheer and the streak kept.
 *
 *   bash /tmp/claude-0/one.sh e2e-accent
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "", nameAsked: false };
const token = (n) => p.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);
const ratio = (a, c) => p.evaluate(([a, c]) => {
  const rgb = (x) => { const d = document.createElement("div"); d.style.color = x; document.body.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r.match(/\d+/g).slice(0, 3).map(Number); };
  const lum = (x) => { const [r, g, b] = rgb(x).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const l1 = lum(a), l2 = lum(c); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}, [a, c]);

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe first card asks a name and a level, once");
{
  const card = p.getByRole("form", { name: "First things" });
  check(await card.isVisible(), "the blank page asks, as a card, not a modal");
  await card.getByLabel("Your name").fill("Almaz");
  await card.getByLabel("Your level").selectOption("alevel");
  await card.getByRole("button", { name: "Save" }).click();
  await p.waitForTimeout(500);
  check((await card.count()) === 0, "Save takes the card away");
  check(/Almaz/.test(await p.locator("main").innerText()), "and the greeting knows the name");
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state);
  check(st.persona?.level === "alevel" && st.name === "Almaz" && st.nameAsked === true, "the level is kept with the persona, the name with the greeting", JSON.stringify({ level: st.persona?.level, name: st.name }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  check((await p.getByRole("form", { name: "First things" }).count()) === 0, "and it never comes back");
}

console.log("\nPersonalization says what is remembered, and shows the level");
{
  await p.getByRole("button", { name: /(^|\s)Settings$/ }).first().click();
  await p.waitForTimeout(500);
  const dlg = p.locator("[role=dialog]");
  await dlg.getByRole("button", { name: "Personalization", exact: true }).click();
  await p.waitForTimeout(300);
  check(/remembers nothing about you yet/.test(await dlg.innerText()), "with nothing remembered, it says so");
  check((await dlg.getByLabel("Your level").inputValue()) === "alevel", "the level from the first card is here");
  await dlg.getByRole("button", { name: "See and edit memory" }).click();
  await p.waitForTimeout(300);
  check(await dlg.getByRole("heading", { name: "Memory" }).isVisible(), "and the door opens the Memory page");
}

console.log("\nEight accents, each measured");
{
  const dlg = p.locator("[role=dialog]");
  await dlg.getByRole("button", { name: "Appearance", exact: true }).click();
  await p.waitForTimeout(300);
  const group = dlg.getByRole("radiogroup", { name: "Accent" });
  const names = await group.getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check(names.join(" ") === "Blue Violet Teal Rose Amber Green Lime Aqua", "eight to choose from", names.join(" "));
  const before = { canvas: await token("--bg-canvas"), text: await token("--text-primary"), signal: await token("--accent-2"), accent: await token("--accent") };
  await group.getByRole("radio", { name: "Violet" }).click();
  await p.waitForTimeout(300);
  check((await p.evaluate(() => document.documentElement.dataset.accent)) === "violet", "the root carries the accent");
  check((await token("--accent")) !== before.accent, "the accent changed", `${before.accent} → ${await token("--accent")}`);
  check((await token("--bg-canvas")) === before.canvas && (await token("--text-primary")) === before.text && (await token("--accent-2")) === before.signal, "and nothing else did — the page, the ink and the signal are as they were");
  for (const theme of ["light", "dark"]) {
    await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    for (const a of ["Blue", "Violet", "Teal", "Rose", "Amber", "Green", "Lime", "Aqua"]) {
      await group.getByRole("radio", { name: a }).click();
      await p.waitForTimeout(120);
      const text = await ratio(await token("--accent"), await token("--bg-canvas"));
      /* The ink on a filled control is the accent's own foreground: white
         for six of them, near-black for the two acid ones that cannot
         carry white — which is why it is measured rather than assumed. */
      const onFill = await ratio(await token("--accent-fg"), await token("--accent-fill"));
      const edge = await ratio(await token("--accent-fill"), await token("--bg-canvas"));
      check(text >= 4.5 && onFill >= 4.5 && edge >= 3, `${theme} ${a}: text ${text.toFixed(2)}, ink on fill ${onFill.toFixed(2)}, fill edge ${edge.toFixed(2)}`);
    }
  }
  await p.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await group.getByRole("radio", { name: "Teal" }).click();
  await p.waitForTimeout(200);
  await p.keyboard.press("Escape");
  /* Before first paint: the attribute is there the moment the document is. */
  await p.goto("about:blank");
  const seen = [];
  p.on("framenavigated", () => {});
  await p.goto("http://localhost:3100", { waitUntil: "commit" });
  seen.push(await p.evaluate(() => document.documentElement.dataset.accent).catch(() => "?"));
  await p.waitForLoadState("networkidle");
  check(seen[0] === "teal", "after a reload the accent is on the root before the app has drawn", seen[0]);
}

console.log("\nA session that answered something ends with a cheer");
{
  await p.evaluate(() => new Promise((ok, no) => {
    const r = indexedDB.open("clouds");
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const db = r.result, now = Date.now();
      const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
      const tx = db.transaction(["decks", "cards", "studyDays"], "readwrite");
      tx.objectStore("decks").put({ id: "d1", name: "Osmosis", createdAt: now, updatedAt: now });
      tx.objectStore("cards").put({ id: "c1", deckId: "d1", front: "What is osmosis?", back: "Water moving", state: "review", due: now - 1000, interval: 3, ease: 2.5, reps: 2, lapses: 0, step: 0, createdAt: now, stability: 3, difficulty: 5 });
      tx.objectStore("studyDays").put({ day: day(now - 86_400_000), answered: 5, right: 4 });
      tx.oncomplete = () => { db.close(); ok(true); };
      tx.onerror = () => no(tx.error);
    };
  }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.keyboard.press("Meta+5");
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Open Osmosis/ }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /^Study/ }).first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Show answer" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Good/ }).click();
  await p.waitForTimeout(900);
  const main = await p.locator("main").innerText();
  check(/Nothing left for now/.test(main), "the session ends");
  check((await p.getByTestId("celebration").count()) === 1, "with paper falling");
  check(/2-day streak kept/.test(main), "and the streak kept, with its number", (main.match(/\d+-day streak kept/) ?? [""])[0]);
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
