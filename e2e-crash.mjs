/**
 * One bad row used to end the app permanently.
 *
 * This is a local-first app: every conversation the person has ever had lives
 * in their own browser and nowhere else. There was no error boundary anywhere
 * in it, so a throw during render unmounted the whole tree and left the
 * browser's blank page — and the path there was not hypothetical.
 * `restoreBackup` admitted any row with a string id, so a message whose
 * `content` came back as a string rather than an array of blocks (a truncated
 * download, a half-synced file, a backup somebody opened in a text editor)
 * went into the database and reached `blockText`, which does `content.map`.
 *
 * And it did not fail once. `lastConversationId` reopens the same thread on the
 * next load, so the app was unopenable from then on, with everything inside the
 * database the person could no longer reach.
 *
 * So this suite writes that exact row straight into IndexedDB, and asserts the
 * two things that matter: something is on the screen, and there is a way out of
 * it that does not destroy anything.
 *
 *   node mock-provider.mjs &
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-mock npx next start -p 3100
 *   node e2e-crash.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
let failed = 0;
const check = (p, l, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const SETTINGS = { theme: "dark", density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };

await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), SETTINGS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

console.log("\nFirst, a real conversation, so there is something to lose");
await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
await page.keyboard.press("Enter");
await page.waitForTimeout(3200);
const convId = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows = await new Promise((res) => { const q = db.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => res(q.result); });
  return rows[0]?.id ?? null;
});
check(typeof convId === "string", "there is a conversation in the database", String(convId));

console.log("\nNow the row a truncated backup plants");
{
  /* `content` as a string rather than an array of blocks — the shape
     `restoreBackup` used to admit and the one `blockText` cannot survive.

     Hung off the end of the real chain and made the conversation's leaf, which
     is the part that matters: an orphan row is never walked and never renders,
     so planting one proves nothing. This is where a restored row actually
     lands, and it is on the path the app reads on every open. */
  const bad = await page.evaluate(async (convId) => {
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    const msgs = await new Promise((res) => { const q = db.transaction("messages").objectStore("messages").getAll(); q.onsuccess = () => res(q.result); });
    const last = msgs.filter((m) => m.conversationId === convId).sort((a, b) => a.createdAt - b.createdAt).pop();
    const id = "bad-row-1";
    const tx = db.transaction(["messages", "conversations"], "readwrite");
    tx.objectStore("messages").put({
      id,
      conversationId: convId,
      parentId: last?.id ?? null,
      role: "assistant",
      content: "this should have been an array of blocks",
      createdAt: Date.now(),
    });
    const conv = await new Promise((res) => { const q = tx.objectStore("conversations").get(convId); q.onsuccess = () => res(q.result); });
    if (conv) tx.objectStore("conversations").put({ ...conv, leafId: id });
    await new Promise((res) => { tx.oncomplete = res; });
    return { id, after: last?.id ?? null };
  }, convId);
  check(bad.after !== null, "the bad row is on the conversation's own chain, where a restore would put it", JSON.stringify(bad));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const body = (await page.locator("body").innerText().catch(() => "")).trim();
  check(body.length > 0, "the page is not blank", `${body.length} chars`);

  /* Next ships its own `role=alert` route announcer on every page, so the
     assertion has to name this one rather than counting alerts. */
  const net = page.getByRole("alert").filter({ hasText: /stopped the app drawing/i });
  const caught = await net.count() > 0;
  check(caught, "the throw was caught and said so");
  if (caught) {
    check(/stopped the app drawing/i.test(await net.innerText()), "in words rather than a stack trace");
    check(/[Nn]othing has been deleted/.test(await net.innerText()), "and it says the work is still there, because it is");
  }
}

console.log("\nAnd the way out is a way out, not a reload into the same crash");
{
  const leave = page.getByRole("button", { name: /Leave this conversation/i });
  const rescue = page.getByRole("button", { name: /Save a copy of everything/i });
  check(await leave.count() === 1, "there is a button that leaves the thread that is throwing");
  check(await rescue.count() === 1, "and one that takes a copy first");
  check(await page.getByRole("button", { name: /delete|erase|clear|wipe/i }).count() === 0,
    "and nothing offers to delete the database to make the error go away");

  /* The copy has to come off the tables directly. Whatever is wrong is
     upstream of the code that would normally export, so a lifeboat sharing a
     hull with the ship is not a lifeboat. */
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await rescue.click();
  const file = await dl.catch(() => null);
  check(file !== null, "and pressing it really produces a file", file ? await file.suggestedFilename() : "no download");

  await leave.click();
  await page.waitForTimeout(2500);
  check(await page.getByRole("alert").filter({ hasText: /stopped the app drawing/i }).count() === 0,
    "leaving it gets the app back");
  check(await page.getByRole("textbox", { name: "Message" }).count() === 1, "with a composer to type in");

  const still = await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
    const rows = await new Promise((res) => { const q = db.transaction("messages").objectStore("messages").getAll(); q.onsuccess = () => res(q.result); });
    return rows.length;
  });
  check(still >= 3, "and nothing was thrown away to get there", `${still} messages still in the database`);
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\ne2e-crash PASS");
process.exit(failed ? 1 : 0);
