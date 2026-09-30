/**
 * Free AI on this computer.
 *
 * The claims, on the screen and at the wire: Settings has a Free AI page
 * that says how to install, how to let this site in (with this site's own
 * address in the setting), and which models to download; Connect to a
 * server that is not there says why and what to do; Connect to one that is
 * lists what is installed with what each can do; "Use" makes it the model;
 * a question then goes from the browser straight to that server — by the
 * model's own name, and never to Armi's server; the picker lists it under
 * "On this computer"; it is still there after a reload; and a server that
 * has gone away is said plainly.
 *
 *   bash /tmp/claude-0/one.sh e2e-local
 */
import { chromium } from "playwright";
import http from "node:http";

const PORT = 11435;
const MOCK = "http://127.0.0.1:8787";
let asked = [];
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (o) => { res.writeHead(200, { ...cors, "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/v1/models") return send({ object: "list", data: [{ id: "qwen3.5:4b" }, { id: "gpt-oss:20b" }, { id: "nomic-embed-text" }] });
    if (req.url === "/api/version") return send({ version: "0.35.0" });
    if (req.url === "/api/show") {
      const name = JSON.parse(body || "{}").model;
      return send(name === "qwen3.5:4b" ? { capabilities: ["completion", "vision", "thinking"], model_info: { "qwen35.context_length": 262144 } } : { capabilities: ["completion", "tools", "thinking"] });
    }
    if (req.url === "/v1/chat/completions") {
      const j = JSON.parse(body);
      asked.push(j);
      res.writeHead(200, { ...cors, "content-type": "text/event-stream" });
      const chunks = [
        { choices: [{ delta: { reasoning: "Light in, sugar out." } }] },
        { choices: [{ delta: { content: "Plants turn light, water and carbon dioxide " } }] },
        { choices: [{ delta: { content: "into glucose and oxygen." }, finish_reason: "stop" }] },
      ];
      for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    res.writeHead(404, cors);
    res.end();
  });
});
await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("PAGE: " + e.message));
let failed = 0;
const check = (c, l, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const settings = () => p.evaluate(() => JSON.parse(localStorage.getItem("store.settings.v1")).state);
const S = { theme: "light", density: "comfortable", modelId: "auto", styleId: "auto", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true, section: "chat" };

await p.goto("http://localhost:3100", { waitUntil: "networkidle" });
await p.evaluate((s) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: s, version: 1 })), S);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(500);

console.log("\nSettings has a Free AI page");
{
  await p.locator("aside").getByRole("button", { name: /(^|\s)Settings$/ }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Free AI", exact: true }).click();
  const d = p.getByRole("dialog");
  check(await d.getByRole("heading", { name: "Free AI on your computer" }).isVisible(), "the page is there");
  check(await d.getByRole("link", { name: /Get Ollama/ }).getAttribute("href") === "https://ollama.com/download", "with where to get Ollama");
  check(await d.getByText("OLLAMA_ORIGINS=http://localhost:3100", { exact: true }).isVisible(), "the setting that lets this site in, with this site's own address");
  const list = d.getByRole("list", { name: "Free models to download" });
  check(await list.getByRole("listitem").count() >= 5 && await list.getByText("ollama pull qwen3.5:4b").isVisible(), "and a short list of free models, each with its command", String(await list.getByRole("listitem").count()));
}

console.log("\nConnect");
{
  const d = p.getByRole("dialog");
  await d.getByLabel("Server address").fill("http://127.0.0.1:11499");
  await d.getByRole("button", { name: "Connect" }).click();
  const st = d.getByRole("status");
  await st.waitFor({ timeout: 8000 }).catch(() => {});
  check(/Couldn't reach/.test(await st.innerText()) && /OLLAMA_ORIGINS=http:\/\/localhost:3100/.test(await st.innerText()), "nothing there: says so, and how to fix it", (await st.innerText()).slice(0, 90));
  await d.getByLabel("Server address").fill(`http://127.0.0.1:${PORT}`);
  await d.getByRole("button", { name: "Connect" }).click();
  await p.waitForFunction(() => /Connected/.test(document.querySelector('[role="dialog"] [role="status"]')?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
  check(/Connected — 2 models/.test(await st.innerText()), "connected: the chat models counted, the embedding one left out", await st.innerText());
  const mine = d.getByRole("list", { name: "Models on this computer" });
  check(await mine.getByText("Qwen3.5 4b").isVisible() && /sees pictures/.test(await mine.innerText()) && /uses tools/.test(await mine.innerText()), "each with what it can do", (await mine.innerText()).replace(/\s+/g, " ").slice(0, 120));
  await mine.getByRole("button", { name: "Use Qwen3.5 4b" }).click();
  check((await settings()).modelId === "local/qwen3.5:4b", "\"Use\" makes it the model");
  await p.keyboard.press("Escape");
}

console.log("\nA question, answered on this computer");
{
  await fetch(`${MOCK}/__reset`).catch(() => {});
  asked = [];
  await p.getByRole("textbox", { name: "Message" }).fill("what is photosynthesis");
  await p.keyboard.press("Enter");
  await p.getByText("into glucose and oxygen.").first().waitFor({ timeout: 15000 }).catch(() => {});
  check(await p.getByText(/Plants turn light, water and carbon dioxide into glucose and oxygen\./).first().isVisible(), "the answer arrives");
  check(asked.length >= 1 && asked[0].model === "qwen3.5:4b" && asked[0].stream === true, "asked of this computer, by the model's own name, streamed", asked[0]?.model);
  check(JSON.stringify(asked[0]?.messages ?? []).includes("what is photosynthesis"), "with the question in it");
  const cloud = ((await fetch(`${MOCK}/__recent`).then((r) => r.json()).catch(() => ({}))).recent ?? []).filter((r) => r.kind !== "title");
  check(cloud.length === 0, "and nothing went to a company", String(cloud.length));
}

console.log("\nIn the picker, and after a reload");
{
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  check((await settings()).modelId === "local/qwen3.5:4b", "still the model after a reload");
  const trigger = p.getByRole("button", { name: /Model: Qwen3\.5 4b, on this computer/ }).first();
  check(await trigger.isVisible(), "the picker names it");
  await trigger.click();
  check(await p.getByRole("heading", { name: "On this computer" }).isVisible(), "and lists it under \"On this computer\"");
  await p.keyboard.press("Escape");
  asked = [];
  await p.getByRole("textbox", { name: "Message" }).fill("and respiration?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2500);
  check(asked.length >= 1, "a question after the reload goes there too, with no reconnecting");
}

console.log("\nWhen the server has gone");
{
  await new Promise((ok) => server.close(ok));
  server.closeAllConnections?.();
  await p.getByRole("textbox", { name: "Message" }).fill("one more");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);
  check(await p.getByText(/Couldn't reach the model on your computer|Couldn.t reach/).first().isVisible().catch(() => false), "it says the model on this computer could not be reached");
}

console.log(errs.length ? "\n  ✗ " + errs.join("\n  ") : "\n  ✓ no runtime errors");
if (errs.length) failed++;
console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
await b.close();
process.exit(failed ? 1 : 0);
