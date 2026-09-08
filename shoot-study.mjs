import { chromium } from "playwright";

const URL = "http://localhost:3100";
const OUT = process.argv[2];

const NOTE = `# Debouncing user input

Search boxes that fire on every keystroke waste requests and produce results the
user has already moved past. The fix is to wait until typing settles.

## Why state is the wrong place for the timer

Holding the timer id in \`useState\` re-renders the component on every keystroke,
which is exactly the cost you were trying to avoid. A \`useRef\` survives renders
without causing them.

## What to cancel

- The pending timer, on every new keystroke.
- The in-flight request, via \`AbortController\` — otherwise a slow early response
  can overwrite a fast later one.
- Both, on unmount.

## Choosing a delay

| Context | Delay |
| --- | --- |
| Type-ahead suggestions | 150–250ms |
| Full search results | 300–400ms |
| Expensive server work | 500ms+ |

Below about 100ms the debounce stops earning its keep; above 500ms the box starts
to feel broken.`;

const PAPER = `## Summary

Input debouncing trades a small, deliberate delay for a large reduction in wasted
work. Applied to a search field, it cuts request volume by roughly the ratio of
keystrokes to settled queries while leaving the interface feeling immediate.

## The failure it prevents

Firing a request per keystroke produces three distinct problems. The obvious one
is volume. The second is ordering: responses return out of sequence, so a slow
early query can overwrite a fast later one and show results for a prefix the user
has already replaced. The third is perceptual — results that flicker through
intermediate states read as instability rather than speed.

## Implementation notes

The timer belongs in a ref rather than in state, since a state change would
re-render on every keystroke and reintroduce the cost the debounce exists to
remove. Cancellation must cover both the pending timer and the in-flight request;
an \`AbortController\` handles the latter and additionally frees the connection.

## Choosing the interval

Between 150ms and 400ms the delay is imperceptible to most users while removing
the large majority of intermediate requests. Below roughly 100ms the mechanism
stops earning its cost. Above 500ms the field begins to feel unresponsive, and
the saving no longer justifies the impression.

## Conclusion

Debouncing is cheap to implement and easy to get subtly wrong. The two mistakes
that matter are keeping the timer in render-triggering state, and cancelling the
timer while leaving the request running.`;

const CARDS = [
  ["Why does holding a debounce timer in state defeat the purpose?", "It re-renders on every keystroke — the exact cost the debounce was meant to remove."],
  ["What goes wrong if you cancel the timer but not the request?", "A slow earlier response can arrive after a faster later one and overwrite it."],
  ["Below what delay does a debounce stop earning its cost?", "Around 100ms — too few intermediate requests are removed to justify it."],
  ["Above what delay does an input start to feel broken?", "Roughly 500ms."],
  ["Which API cancels the in-flight request rather than just the timer?", "AbortController, passed as the fetch signal."],
  ["Why a ref rather than a variable in the component body?", "A plain variable is recreated each render; a ref persists across them without causing one."],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate((t) => {
    localStorage.setItem("clouds.settings", JSON.stringify({ state: { theme: t, density: "comfortable", modelId: "claude-sonnet-4-5", section: "notes", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: { anthropic: "sk-ant-demo" }, params: {}, favorites: [], recentModels: [], systemPrompt: "" }, version: 1 }));
  }, theme);

  await page.evaluate(async ({ note, paper, cards }) => {
    for (let i = 0; i < 80; i++) {
      const list = await indexedDB.databases();
      if (list.some((d) => d.name === "clouds")) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("clouds");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const now = Date.now();
    await new Promise((res, rej) => {
      const tx = db.transaction(["notes", "decks", "cards", "papers"], "readwrite");
      tx.objectStore("notes").put({ id: "n1", title: "Debouncing user input", content: note, createdAt: now - 90000, updatedAt: now, pinned: false, tags: [] });
      tx.objectStore("notes").put({ id: "n2", title: "Postgres index selectivity", content: "# Postgres index selectivity\n\nThe planner ignores an index when it expects to touch too much of the table.", createdAt: now - 400000, updatedAt: now - 400000, pinned: false, tags: [] });
      tx.objectStore("decks").put({ id: "d1", title: "Debouncing user input", createdAt: now, sourceNoteId: "n1" });
      cards.forEach(([front, back], i) => {
        tx.objectStore("cards").put({
          id: `c${i}`, deckId: "d1", front, back,
          ease: 2.5, interval: i < 4 ? 0 : 3, reps: i < 4 ? 0 : 2, lapses: 0,
          due: i < 4 ? now - 1000 : now + 3 * 86400000, createdAt: now,
        });
      });
      tx.objectStore("papers").put({ id: "p1", title: "Debouncing user input", subtitle: "Why the obvious implementation is wrong", author: "A. Salaev", content: paper, createdAt: now, updatedAt: now, format: "report" });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { note: NOTE, paper: PAPER, cards: CARDS });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // Notes
  await page.getByRole("button", { name: /Debouncing user input/ }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/notes-${theme}.png` });

  if (theme === "light") {
    await page.getByRole("button", { name: "Preview" }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/notes-preview.png` });
  }

  // Cards
  await page.keyboard.press("Control+3");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Debouncing user input/ }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Space");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/cards-${theme}.png` });

  // Papers
  await page.keyboard.press("Control+4");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Debouncing user input/ }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/paper-${theme}.png` });

  if (theme === "light") {
    // What the exported PDF actually looks like.
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/paper-print.png`, fullPage: true });
    await page.emulateMedia({ media: "screen" });
  }

  await ctx.close();
}
await browser.close();
console.log("study shots done");
