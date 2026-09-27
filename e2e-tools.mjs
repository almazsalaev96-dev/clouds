/**
 * The model reaches the app's own machinery.
 *
 * The claims: asked in the chat for a daily quiz, the model sets a routine,
 * and Open lands on it under Settings → Routines; asked for a project, it
 * makes one, puts this conversation in it, and Open goes to the project;
 * asked for an assistant, it makes one that is then a slash command in the
 * next chat, and Undo takes it away again. A temporary chat offers none of
 * the three.
 *
 *   bash /tmp/claude-0/one.sh e2e-tools
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, actionsOn: true, memoryOn: true };
const box = () => p.getByRole("textbox", { name: "Message" });
const say = async (text) => { await box().fill(text); await p.keyboard.press("Meta+Enter"); };
const lastRow = () => p.locator(".msg").last();
const table = (name) => p.evaluate((n) => new Promise((res) => { const r = indexedDB.open("clouds"); r.onsuccess = () => { const t = r.result.transaction(n).objectStore(n).getAll(); t.onsuccess = () => res(t.result); }; }), name);
const newChat = async () => { await p.getByRole("button", { name: "New chat" }).first().click(); await p.waitForTimeout(400); };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nA routine, from a sentence");
{
  await fetch(`${MOCK}/__reset`);
  await say("quiz me every weekday at 7:30");
  const doing = p.getByText("Setting up the routine", { exact: true });
  await doing.waitFor({ timeout: 6000 }).catch(() => {});
  check(await doing.isVisible().catch(() => false), "the wait says what is being done");
  await p.waitForTimeout(4500);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  for (const t of ["schedule_routine", "create_project", "create_assistant"]) check((last.tools ?? []).includes(t), `the request offered ${t}`);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Set a routine for 07:30 on weekdays/.test(await chip.innerText().catch(() => "")), "the chip says when it runs", (await chip.innerText().catch(() => "")).replace(/\s+/g, " "));
  const routines = await table("routines");
  check(routines.length === 1 && routines[0].prompt === "Quiz me on what is due today" && routines[0].hour === 7 && routines[0].minute === 30 && String(routines[0].days) === "1,2,3,4,5", "and the routine is real, with the prompt, the time and the days", JSON.stringify(routines[0] ?? {}).slice(0, 120));
  check(/next time the app is open/.test(await lastRow().innerText()), "the answer tells the honest limit: it runs when the app is open");
  await lastRow().getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(700);
  const dialog = p.getByRole("dialog");
  check(await dialog.isVisible(), "Open goes to Settings");
  check(/Weekdays at 07:30/.test(await dialog.innerText()), "on the Routines tab, where it is listed in words", (await dialog.innerText()).match(/Weekdays[^\n]*/)?.[0]);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nA project, and this conversation is in it");
{
  await newChat();
  await fetch(`${MOCK}/__reset`);
  await say("make me a project called Timetable review with the rule Money in pounds");
  await p.waitForTimeout(5000);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Made the project “Timetable review”/.test(await chip.innerText().catch(() => "")), "the chip names the project");
  const projects = await table("projects");
  const convs = await table("conversations");
  const made = projects.find((x) => x.name === "Timetable review");
  check(Boolean(made) && made.instructions === "Money in pounds", "it exists, with the rule as its instructions", made?.instructions);
  check(convs.some((c) => c.projectId === made?.id), "and this conversation is in it");
  await lastRow().getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(900);
  check(/Timetable review/.test(await p.locator("main").innerText()) && /Money in pounds/.test(await p.locator("main").innerText()), "Open goes to the project");
  await p.getByRole("button", { name: "Conversations" }).click();
  await p.waitForTimeout(500);
  await fetch(`${MOCK}/__reset`);
  await say("make me a project called Second");
  await p.waitForTimeout(4000);
  const again = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(!(again.tools ?? []).includes("create_project") && (again.tools ?? []).includes("save_to_project"), "inside a project the offer is to add to it, not to make another", (again.tools ?? []).filter((t) => /project/.test(t)).join(","));
}

console.log("\nAn assistant, then a slash command, then undone");
{
  await newChat();
  await fetch(`${MOCK}/__reset`);
  await say("make me an assistant called Chem coach that always gives a safety note first");
  await p.waitForTimeout(5000);
  const chip = lastRow().getByRole("list", { name: "Done in this app" });
  check(/Made the assistant “Chem coach”/.test(await chip.innerText().catch(() => "")), "the chip names the assistant");
  const rows = await table("assistants");
  check(rows.length === 1 && rows[0].short === "chem-coach" && /safety note first/.test(rows[0].instructions), "it exists with a slash name and the instructions", JSON.stringify(rows[0] ?? {}).slice(0, 100));
  check(/\/chem-coach/.test(await lastRow().innerText()), "and the answer says how to call it");
  await box().fill("/chem");
  await p.waitForTimeout(400);
  const menu = await p.getByRole("listbox").innerText().catch(() => "");
  check(/\/chem-coach/.test(menu), "and the slash menu offers it straight away", menu.split("\n")[0]);
  await p.keyboard.press("Escape");
  await box().fill("");
  await chip.getByRole("button", { name: "Undo" }).click();
  await p.waitForTimeout(700);
  check((await table("assistants")).length === 0, "Undo takes the assistant away again");
  check((await chip.getByRole("button", { name: "Undo" }).count()) === 0, "and the chip no longer offers to");
}

console.log("\nA temporary chat leaves nothing behind");
{
  await newChat();
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  await p.locator("[data-radix-popper-content-wrapper]").last().getByRole("button", { name: /^Temporary chat/ }).click();
  await p.waitForTimeout(300);
  await fetch(`${MOCK}/__reset`);
  await say("quiz me every day at 8");
  await p.waitForTimeout(3500);
  const last = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(!["schedule_routine", "create_project", "create_assistant", "remember"].some((t) => (last.tools ?? []).includes(t)), "none of the making tools is offered there", (last.tools ?? []).join(","));
  check((await table("routines")).length === 1, "and no routine was added");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
