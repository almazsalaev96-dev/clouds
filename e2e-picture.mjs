/**
 * A picture, asked for in words.
 *
 * The claims: "draw me a picture of …" comes back as a picture in the thread,
 * with a way to save it; "/image" is a command and the + menu offers it;
 * the words that went out are the description, not the asking.
 */
import { chromium } from "playwright";
const MOCK = "http://localhost:8787";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const S = { theme: "dark", density: "comfortable", modelId: "one", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true };
const box = () => p.getByRole("textbox", { name: "Message" });

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(800);

console.log("\nAsked in words, answered with a picture");
{
  await fetch(`${MOCK}/__reset`);
  await box().fill("Draw me a picture of a plant cell, labelled");
  await p.keyboard.press("Enter");
  const img = p.locator(".msg img[alt]").last();
  const came = await img.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check(came, "a picture arrives in the thread");
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(sent.kind === "image" && /plant cell, labelled/.test(sent.prompt ?? "") && !/^draw/i.test(sent.prompt ?? ""), "the description went out, not the asking", JSON.stringify(sent.prompt));
  check(await p.getByRole("link", { name: "Save picture" }).count() === 1, "and it can be saved");
  const msgs = await p.locator(".msg").allInnerTexts();
  check(/Here it is/.test(msgs.at(-1) ?? ""), "under a line that says so", (msgs.at(-1) ?? "").slice(0, 40));
  check(/plant cell/i.test(await img.getAttribute("alt")), "and the picture is named for what it is", await img.getAttribute("alt"));
}

console.log("\nA command, and a menu entry");
{
  await box().fill("/");
  await p.waitForTimeout(250);
  const all = await p.getByRole("listbox", { name: "Commands" }).getByRole("option").allInnerTexts();
  check(all.some((t) => /^\/image/.test(t)), "“/image” is in the list", all.map((t) => t.split("\n")[0]).join(" · "));
  await box().fill("");
  await p.getByRole("button", { name: "Add files and tools" }).click();
  await p.waitForTimeout(300);
  const entry = p.getByRole("button", { name: /Make a picture/ });
  check(await entry.isVisible(), "the + menu offers to make one");
  check(await p.getByRole("button", { name: "Take a photo", exact: true }).isVisible(), "and to take a photo");
  await entry.click();
  await p.waitForTimeout(300);
  check((await box().inputValue()) === "/image ", "which puts the command in the box, ready for the description", JSON.stringify(await box().inputValue()));
  await fetch(`${MOCK}/__reset`);
  await box().fill("/image the water cycle as a diagram");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2500);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(sent.prompt === "the water cycle as a diagram", "and the command is not part of what is drawn", JSON.stringify(sent.prompt));
  check(await p.locator(".msg img[alt]").count() === 2, "a second picture, in the same thread");
}

console.log("\nA picture attached with the command is a picture to change");
{
  await fetch(`${MOCK}/__reset`);
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  await p.getByLabel("Choose photos and files to attach").setInputFiles({ name: "cell.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await p.waitForTimeout(500);
  await box().fill("/image label the nucleus");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);
  const sent = await fetch(`${MOCK}/__last`).then((r) => r.json());
  check(sent.kind === "image-edit" && sent.hadImage === true, "it goes out as an edit, with the picture", JSON.stringify(sent));
  check(sent.prompt === "label the nucleus", "and the words are the change asked for", JSON.stringify(sent.prompt));
  const msgs = await p.locator(".msg").allInnerTexts();
  check(/Here it is, changed/.test(msgs.at(-1) ?? ""), "the thread says it was changed, not drawn from nothing", (msgs.at(-1) ?? "").slice(0, 40));
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
