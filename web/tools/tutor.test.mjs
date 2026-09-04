/**
 * The tutor, served over HTTP with a gateway beside it.
 *
 * The smoke suite opens the built file directly, which is the offline case. This
 * one serves it from a real origin next to a stub gateway, because that is the
 * shape of the Vercel deployment and because two of the claims this product makes
 * can only be checked here:
 *
 *   · with a gateway on the same origin there is nothing to configure;
 *   · an API key pasted into the app is refused and never stored.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, "../dist/index.html"));
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); failures.push(name); }
};

// A stand-in for the deployed gateway. `requiresToken` and the token it expects are
// switched per scenario; the reply shape is the gateway's own contract.
const gateway = { requiresToken: false, token: "s3cret-access-code", seen: [] };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/health") {
    return send(200, {
      status: "ok", ai: "anthropic", voice: "unavailable",
      environment: "production", requiresToken: gateway.requiresToken,
    });
  }

  if (url.pathname === "/v1/tutor" && req.method === "POST") {
    const presented = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (gateway.requiresToken && presented !== gateway.token) {
      return send(401, { error: { code: "unauthorised", message: "no" } });
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    gateway.seen.push(body);
    return send(200, {
      reply: {
        mode: "hint",
        message: "Undo the addition before the multiplication.",
        steps: [{ text: "Subtract 7 from both sides.", isHidden: false }],
        confidence: 0.91, conceptIds: ["linear-equations"],
        nextAction: { kind: "retry", label: "Try again" },
      },
    });
  }

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;

const executablePath = process.env.SLATE_CHROMIUM || undefined;
const browser = await chromium.launch(executablePath
  ? { executablePath, args: ["--headless=new", "--no-sandbox"], ignoreDefaultArgs: ["--headless=old"] }
  : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

console.log("a gateway on the same origin");
await page.goto(origin);
await page.waitForSelector(".rail");
await page.locator(".rail-item[data-screen=settings]").click();
await page.waitForTimeout(250);
check("the tutor is found with nothing configured",
  await page.getByText("Tutor connected").first().isVisible());
check("and it says where the key lives",
  (await page.locator("#main").textContent()).includes("never been in this page"));

await page.locator(".rail-item[data-screen=home]").click();
await page.getByRole("button", { name: /Linear equations/ }).first().click();
await page.waitForSelector(".sheet");
await page.locator(".chip.ai").first().click();
await page.waitForSelector(".turn.ai .answer");
check("the tutor's own answer is rendered",
  (await page.locator(".turn.ai").last().textContent()).includes("Undo the addition"));
check("and is labelled as the tutor, with its confidence",
  (await page.locator(".answer-source").last().textContent()).includes("Tutor · confidence 0.91"));
check("the question and the student's record went with the ask", gateway.seen.length === 1
  && gateway.seen[0].questionText.includes("3x + 7")
  && typeof gateway.seen[0].masteryHints === "string");
check("no credential was sent by the page",
  !JSON.stringify(gateway.seen).match(/sk-ant|api[_-]?key/i));

console.log("a gateway that wants an access code");
gateway.requiresToken = true;
await page.reload();
await page.waitForSelector(".rail");
await page.locator(".rail-item[data-screen=settings]").click();
await page.waitForTimeout(250);
check("the app says a code is needed, not that something failed",
  await page.getByText("Tutor needs an access code").first().isVisible());
check("and distinguishes the code from an API key",
  (await page.locator("#main").textContent()).includes("not your API key"));

console.log("refusing a provider credential");
await page.locator('input[type=password]').fill("sk-ant-api03-EXAMPLE-not-a-real-key-000000");
await page.getByRole("button", { name: "Save and connect" }).click();
await page.waitForSelector(".modal");
check("pasting an API key is refused outright",
  (await page.locator(".modal").textContent()).includes("will not store it"));
check("it names where the key actually goes",
  (await page.locator(".modal").textContent()).includes("ANTHROPIC_API_KEY"));
check("and it is not written to storage", await page.evaluate(() => {
  const raw = JSON.stringify(localStorage);
  return !/sk-ant/.test(raw);
}));
await page.getByRole("button", { name: "Understood" }).click();
check("the field was cleared", (await page.locator('input[type=password]').inputValue()) === "");

console.log("connecting with the real code");
await page.locator('input[type=password]').fill("s3cret-access-code");
await page.getByRole("button", { name: "Save and connect" }).click();
await page.waitForTimeout(300);
check("the tutor connects", await page.getByText("Tutor connected").first().isVisible());

console.log("when the gateway rejects the call");
gateway.token = "rotated-since";
await page.locator(".rail-item[data-screen=home]").click();
await page.getByRole("button", { name: /Linear equations/ }).first().click();
await page.waitForSelector(".sheet");
await page.locator(".chip.ai").first().click();
await page.waitForTimeout(400);
const thread = await page.locator(".panel-body").textContent();
check("the failure is explained in the student's terms", /access code/i.test(thread), thread.slice(-160));
check("and the written help still arrives", thread.includes("Written help"));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failing: ${failures.join(", ")}` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
