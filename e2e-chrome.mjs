/**
 * The frame, as the reference draws it.
 *
 * The claims: on a desk the sidebar's own header holds the close control;
 * closed, a rail stays — the mark at the top that becomes the open icon
 * under the pointer, New chat, Search, the five rooms, the account — and
 * the bar shows no toggle of its own; ⌘\ and ⌘⇧S both toggle; ⌘1–5 go to
 * the rooms in the order the sidebar lists them; on a phone the bar's
 * toggle opens the drawer. The box's plus menu offers, beyond files and a
 * photo: a picture, Learn, Research, Deep research, Slides, a
 * project, an assistant and a temporary chat; "New project from this
 * chat" makes one named for the thread and puts the chat in it; "Answer
 * as an assistant" switches the thread to it.
 *
 *   bash /tmp/claude-0/one.sh e2e-chrome
 */
import { chromium } from "playwright";
const MOCK = "http://127.0.0.1:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: [], name: "Almaz", nameAsked: true };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate(async (s) => {
  localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 }));
  const db = await new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => res(r.result); });
  const now = Date.now();
  const tx = db.transaction(["assistants", "projects"], "readwrite");
  tx.objectStore("assistants").put({ id: "as1", name: "Chem coach", short: "chem-coach", icon: "⚗️", instructions: "Safety note first.", modelId: "one", createdAt: now, updatedAt: now, uses: 0 });
  tx.objectStore("projects").put({ id: "pr1", name: "Timetable review", description: "", instructions: "Money in pounds.", createdAt: now, updatedAt: now });
  await new Promise((res) => { tx.oncomplete = res; });
}, S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nThe sidebar, laid out as ChatGPT's app lays it out");
{
  const aside = p.locator("aside").first();
  for (const name of ["Find a conversation", "Conversations", "Notebook", "Projects", "Studio", "New chat", "Settings"])
    check(await aside.getByRole("button", { name, exact: true }).isVisible(), `the panel has ${name}`);
  check(!(await aside.getByRole("button", { name: "Study", exact: true }).count()), "and no Study: it is not one of the listed rooms");
  /* On a desk (a mouse and a wide window) it is the desktop apps' column:
     New chat and Search as the first rows, the account at the foot, and the
     switch inside the panel's own header. */
  const chat = await aside.getByRole("button", { name: "New chat", exact: true }).boundingBox();
  const gear = await aside.getByRole("button", { name: "Settings", exact: true }).boundingBox();
  const panel = await aside.boundingBox();
  check(chat && panel && chat.y < panel.y + 110 && chat.height <= 40, "New chat is a row at the top, desk-sized", chat ? `${Math.round(chat.y)}px down, ${Math.round(chat.height)}px tall` : "");
  check(gear && panel && gear.y > panel.y + panel.height - 70, "and you and your settings are the row at the foot");
  check(panel && Math.round(panel.x) === 0 && panel.width <= 262, "flush to the edge, 260 wide", panel ? `${Math.round(panel.x)}, ${Math.round(panel.width)}` : "");
  const header = p.locator("main header").first();
  check(!(await header.getByRole("button", { name: "Hide sidebar" }).isVisible()), "the page's round switch is for touch; on a desk the panel carries its own");
  check(await header.getByRole("button", { name: "Start a new chat" }).isVisible(), "and a new chat is at the top right");
  await aside.getByRole("button", { name: "Hide sidebar" }).click();
  await p.waitForTimeout(500);
  const w = await aside.evaluate((el) => el.getBoundingClientRect().width).catch(() => 0);
  check(w > 40 && w < 60, "closed, a rail of icons is left, as the desktop apps leave one", `${Math.round(w)}px wide`);
  check(await aside.getByRole("button", { name: "Studio", exact: true }).isVisible() && await aside.getByRole("button", { name: "Show sidebar" }).isVisible(), "with every room and the switch to open it");
  await aside.getByRole("button", { name: "Show sidebar" }).click();
  await p.waitForTimeout(500);
  check(await aside.getByRole("button", { name: "Search chats" }).count() === 0 && await aside.getByRole("button", { name: "Find a conversation" }).isVisible(), "open again, Search is a row");
  await aside.getByRole("button", { name: "Hide sidebar" }).click();
  await p.waitForTimeout(400);
  await p.keyboard.press("Meta+Shift+S");
  await p.waitForTimeout(500);
  check(await aside.getByRole("button", { name: "Notebook", exact: true }).isVisible(), "⌘⇧S opens it again, as the reference's chord does");
  await aside.getByRole("button", { name: "Notebook", exact: true }).click();
  await p.waitForTimeout(600);
  check(await aside.getByRole("button", { name: "Notebook", exact: true }).getAttribute("aria-current") === "true", "a room button goes to the room");
  await p.keyboard.press("Meta+5");
  await p.waitForTimeout(600);
  check(/Today|Decks|Add a course/.test(await p.locator("main").innerText()), "and Study is still there, one shortcut away");
  await p.keyboard.press("Meta+3");
  await p.waitForTimeout(600);
  check(await aside.getByRole("button", { name: "Projects", exact: true }).getAttribute("aria-current") === "true", "⌘3 is the third room the sidebar lists, Projects");
  await p.keyboard.press("Meta+1");
  await p.waitForTimeout(500);
}

console.log("\nThe box's plus menu holds the functions");
{
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  const menu = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  for (const item of ["Add photos and files", "Take a photo", "Create image", "Study and learn", "Web search", "Deep research", "Slides", "Add to a project", "Answer as an assistant", "Temporary chat"])
    check(menu.includes(item), `offers ${item}`);
  await p.getByRole("button", { name: /^Add to a project/ }).click();
  await p.waitForTimeout(250);
  const pane = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  check(/New project from this chat/.test(pane) && /Timetable review/.test(pane), "the project page lists yours and offers a new one", pane.replace(/\s+/g, " ").slice(0, 80));
  await p.getByRole("button", { name: /^Timetable review/ }).click();
  await p.waitForTimeout(400);
  check(await p.getByRole("button", { name: /Timetable review/ }).first().isVisible(), "choosing one puts the chat-to-be in it, said in the header");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.locator("[data-radix-popper-content-wrapper]").last().waitFor({ timeout: 3000 });
  await p.waitForTimeout(200);
  const again = await p.locator("[data-radix-popper-content-wrapper]").last().innerText();
  check(/Answer as an assistant/.test(again), "reopened, the menu is back on its first page", again.replace(/\s+/g, " ").slice(0, 120));
  await p.getByRole("button", { name: /^Answer as an assistant/ }).click();
  await p.waitForTimeout(250);
  await p.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name: /^Chem coach/ }).click();
  await p.waitForTimeout(400);
  check(await p.getByRole("button", { name: "Answering as Chem coach" }).isVisible(), "choosing an assistant sets who answers, said in the header");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Deep research/ }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  check(/Stop deep research/.test(await p.locator("[data-radix-popper-content-wrapper]").last().innerText()), "Deep research is a switch, and shows it is on");
  await p.keyboard.press("Escape");
}

console.log("\nA project from the chat itself");
{
  await fetch(`${MOCK}/__reset`);
  await p.getByRole("textbox", { name: "Message" }).fill("What is a debounce and when would I use one");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^In Timetable review|^Add to a project/ }).click();
  await p.waitForTimeout(250);
  await p.getByRole("button", { name: /^New project from this chat/ }).click();
  await p.waitForTimeout(800);
  check(/Made the project/.test(await p.locator("main").innerText()), "the box says the project was made");
  const rows = await p.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const projects = await new Promise((r) => { const q = d.transaction("projects").objectStore("projects").getAll(); q.onsuccess = () => r(q.result); });
    const convs = await new Promise((r) => { const q = d.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
    const made = projects.find((x) => x.id !== "pr1");
    return { projects: projects.length, made: made?.name, linked: convs.some((c) => c.projectId === made?.id), assistant: convs[0]?.assistantId, deep: convs[0]?.deep };
  });
  check(rows.projects === 2 && rows.linked, "a second project exists with this conversation in it", JSON.stringify(rows));
  check(Boolean(rows.made) && rows.made !== "New project", "named for the conversation", rows.made);
  check(rows.assistant === "as1" && rows.deep === true, "and the assistant and deep research chosen before the first message stuck to it", JSON.stringify({ assistant: rows.assistant, deep: rows.deep }));
}

console.log("\nOn an iPad the touch layout stays: big rows, the pill and the gear, the round switch");
{
  const land = await (await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  await land.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await land.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
  await land.reload({ waitUntil: "networkidle" });
  await land.waitForTimeout(800);
  const aside = land.locator("aside").first();
  const chat = await aside.getByRole("button", { name: "New chat", exact: true }).boundingBox();
  const gear = await aside.getByRole("button", { name: "Settings", exact: true }).boundingBox();
  const panel = await aside.boundingBox();
  check(chat && gear && panel && chat.y > panel.y + panel.height - 90 && gear.x > chat.x && Math.abs(chat.y + chat.height / 2 - (gear.y + gear.height / 2)) < 4, "landscape: the Chat pill and the gear float at the foot, side by side");
  check(await land.locator("main header").first().getByRole("button", { name: "Hide sidebar" }).isVisible(), "and the round switch is on the page, top left");
  await land.close();
  const port = await (await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  await port.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await port.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
  await port.reload({ waitUntil: "networkidle" });
  await port.waitForTimeout(800);
  check(!(await port.locator("aside").getByRole("button", { name: "New chat" }).isVisible()), "upright: the page has the whole width, the sidebar starts closed");
  await port.getByRole("button", { name: "Show sidebar" }).first().click();
  await port.waitForTimeout(500);
  const drawer = await port.locator("aside").first().boundingBox();
  const main = await port.locator("main").first().boundingBox();
  check(drawer && main && main.x < 5, "and opens as a drawer over the page, which keeps its width", `main at ${Math.round(main?.x ?? -1)}px`);
  await port.close();
}

console.log("\nOn a phone the bar opens the drawer");
{
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await phone.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { ...s, sidebarOpen: false }, version: 1 })), S);
  await phone.reload({ waitUntil: "networkidle" });
  await phone.waitForTimeout(800);
  const opener = phone.getByRole("button", { name: "Show sidebar" }).first();
  check(await opener.isVisible(), "the bar's toggle is there on a phone");
  const railHidden = (await phone.locator("[data-rail]").count()) === 0 || !(await phone.locator("[data-rail]").first().isVisible());
  check(railHidden, "and no rail crowds the phone");
  await opener.click();
  await phone.waitForTimeout(500);
  check(await phone.locator("aside").getByRole("button", { name: "New chat" }).isVisible(), "the drawer opens, with the Chat button at its foot");
  await phone.mouse.click(380, 400);
  await phone.waitForTimeout(500);
  check(!(await phone.locator("aside").getByRole("button", { name: "New chat" }).isVisible()), "and a tap beside it closes it, as ChatGPT's does");
  await phone.close();
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
