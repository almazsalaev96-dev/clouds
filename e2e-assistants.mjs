/**
 * Assistants of your own.
 *
 * The claims: one is made in Settings with a name, an icon, how it works,
 * a model and an opening line; it stands on the front door as a chip;
 * pressing the chip opens the box with its opening line and the header
 * names it; the answer carries "## You are <name>" with the instructions
 * after your rules, and goes to the model it was given; "/its-name" in a
 * new chat does the same; the palette offers "Chat with <name>"; deleting
 * it leaves its conversations in place.
 *
 *   bash /tmp/claude-0/one.sh e2e-assistants
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "light", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", rules: ["british"], name: "Almaz", nameAsked: true };
const answerSystem = async () => {
  const recent = (await fetch(`${MOCK}/__recent`).then((r) => r.json())).recent ?? [];
  return [...recent].reverse().find((r) => r.kind === "answer") ?? {};
};

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);

console.log("\nMade in Settings");
{
  check((await p.getByRole("list", { name: "Your assistants" }).count()) === 0, "with none made, the front door shows no row of them");
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Assistants", exact: true }).click();
  await p.waitForTimeout(300);
  const dlg = p.locator("[role=dialog]");
  check(/None yet/.test(await dlg.innerText()), "the panel says none yet");
  await dlg.getByRole("button", { name: "New assistant" }).click();
  await dlg.getByLabel("Icon").fill("⚗️");
  await dlg.getByLabel("Name").fill("Chem coach");
  check(/\/chem-coach/.test(await dlg.innerText()), "the name becomes a command, shown as you type", (await dlg.innerText()).match(/\/[a-z-]+/)?.[0]);
  await dlg.getByLabel("How it works").fill("Start every answer with a one-line safety note. Ask which exam board before going deep.");
  await dlg.getByLabel("Opening line").fill("Explain the reaction I name");
  await dlg.getByLabel("Answers with").selectOption("one");
  await dlg.getByRole("button", { name: "Make it" }).click();
  await p.waitForTimeout(500);
  const row = dlg.getByRole("list", { name: "Assistants" });
  check(/Chem coach/.test(await row.innerText()) && /\/chem-coach/.test(await row.innerText()), "it is listed with its command");
  check(/Mira 4\.1/.test(await row.innerText()), "and the model it answers with", (await row.innerText()).match(/Mira[^\n]*/)?.[0]);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\nOn the front door, and a press from a chat");
{
  const chips = p.getByRole("list", { name: "Your assistants" });
  check(await chips.isVisible(), "the front door now shows the row");
  await chips.getByRole("button", { name: "Chem coach" }).click();
  await p.waitForTimeout(400);
  const box = p.getByRole("textbox", { name: "Message" });
  check((await box.inputValue()) === "Explain the reaction I name", "pressing it opens the box with the opening line", await box.inputValue());
  check(await p.getByRole("button", { name: "Answering as Chem coach" }).isVisible(), "and the header says who will answer");
  await fetch(`${MOCK}/__reset`);
  await box.fill("Explain the reaction between sodium and water");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const call = await answerSystem();
  const sys = call.system ?? "";
  check(/## Working as Chem coach/.test(sys), "the system prompt names the assistant", sys.match(/## You are[^\n]*/)?.[0]);
  check(/Start every answer with a one-line safety note/.test(sys), "with its instructions");
  const rules = sys.indexOf("## Your rules");
  const who = sys.indexOf("## Working as Chem coach");
  check(rules > -1 && rules < who, "after your rules, which still hold inside it", `rules at ${rules}, assistant at ${who}`);
  check(/claude/i.test(call.model ?? "") || /gpt|o\d/i.test(call.model ?? ""), "and the call went to the model it was given, not Auto", call.model);
  check(await p.getByRole("button", { name: "Answering as Chem coach" }).isVisible(), "the header still names it once the chat exists");
}

console.log("\nBy its name after a slash");
{
  await p.getByRole("button", { name: "New chat" }).first().click();
  await p.waitForTimeout(400);
  const box = p.getByRole("textbox", { name: "Message" });
  await box.fill("/chem");
  await p.waitForTimeout(200);
  const menu = await p.getByRole("listbox").innerText().catch(() => "");
  check(/\/chem-coach/.test(menu), "the slash menu offers it by its command", menu.split("\n")[0]);
  await fetch(`${MOCK}/__reset`);
  await box.fill("/chem-coach what is a mole");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  const call = await answerSystem();
  check(/## Working as Chem coach/.test(call.system ?? ""), "the answer comes as the assistant");
  const main = await p.locator("main").innerText();
  check(/what is a mole/.test(main) && !/\/chem-coach/.test(main), "and the command is not part of the message kept");
}

console.log("\nIn the palette, and gone without taking its chats");
{
  await p.keyboard.press("Meta+K");
  await p.waitForTimeout(400);
  await p.getByRole("textbox", { name: "Command palette" }).fill("chem");
  await p.waitForTimeout(300);
  const pal = await p.getByRole("dialog").innerText();
  check(/Chat with Chem coach/.test(pal), "the palette offers a chat with it", pal.split("\n").find((l) => /Chem/.test(l)));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /Settings/ }).last().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Assistants", exact: true }).click();
  await p.waitForTimeout(300);
  const dlg = p.locator("[role=dialog]");
  check(/2 conversations/.test(await dlg.innerText()), "its row counts the conversations it answered in", (await dlg.innerText()).match(/\d+ conversations?/)?.[0]);
  await dlg.getByRole("button", { name: "Delete Chem coach" }).click();
  await dlg.getByRole("button", { name: /^Delete$|Yes|Confirm/ }).first().click().catch(() => {});
  await p.waitForTimeout(500);
  check(/None yet/.test(await dlg.innerText()), "deleted, the panel is empty again");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  const kept = await p.evaluate(async () => {
    const d = await new Promise((r) => { const q = indexedDB.open("clouds"); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => { const q = d.transaction("conversations").objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
    return { n: rows.length, linked: rows.filter((c) => c.assistantId).length };
  });
  check(kept.n === 2 && kept.linked === 0, "both conversations stay, on their own", JSON.stringify(kept));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
