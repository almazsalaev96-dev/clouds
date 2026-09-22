/* Every way a provider can fail, and what the person is told about it.
 *
 * `classifyError` is the one place a raw provider string is turned into a
 * sentence and a button, which makes it the one place a person's whole
 * experience of something going wrong is decided — and it had no test. The
 * cases below are the ones the function's own comments say are hard: Google
 * answering an invalid key with 400, a 403 that is a corporate proxy rather
 * than a rejected key, a Retry-After that should be believed over a guess.
 *
 *   npx jiti test-error.ts */
import { classifyError } from "./lib/providers/shared";
import type { ErrorKind, ProviderId } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const at = (status: number, body: string, provider: ProviderId = "anthropic") =>
  classifyError(provider, status, body);

console.log("\nThe plain statuses land where they should");
{
  const cases: [number, string, ErrorKind][] = [
    [401, '{"error":{"message":"invalid x-api-key"}}', "bad_key"],
    [429, '{"error":{"message":"rate_limit_error"}}', "rate_limit"],
    [429, '{"error":{"message":"You exceeded your current quota"}}', "quota"],
    [500, '{"error":{"message":"Internal server error"}}', "provider_down"],
    [503, "upstream connect error", "provider_down"],
    [504, "gateway timeout", "timeout"],
    [408, "request timeout", "timeout"],
    [418, "i am a teapot", "unknown"],
  ];
  for (const [status, body, want] of cases) {
    const e = at(status, body);
    check(e.kind === want, `${status} is ${want}`, e.kind === want ? "" : `got ${e.kind}`);
  }
}

console.log("\nNo provider's own words reach the person");
{
  const bodies: [number, string][] = [
    [401, "invalid x-api-key"],
    [500, "panic: nil pointer dereference at 0x4a1f"],
    [400, "context_length_exceeded: 200000 > 199000"],
  ];
  for (const [status, body] of bodies) {
    const e = at(status, body);
    check(!e.message.includes(body.slice(0, 12)), `${status}: the raw body stays out of the sentence`, e.message);
    check(e.detail?.startsWith(body.slice(0, 12)) === true, "  but is kept for the console", (e.detail ?? "").slice(0, 30));
    check(/^[A-Z]/.test(e.message) && /[.?]$/.test(e.message), "  and the sentence is a sentence", e.message);
  }
}

console.log("\nEvery kind offers something to do about it");
{
  const seen = new Map<ErrorKind, string>();
  const probe: [number, string][] = [
    [401, "invalid api key"], [429, "rate limited"], [429, "quota exceeded"],
    [400, "context length exceeded"], [400, "blocked by safety filter"],
    [400, "image modality not supported"], [500, "server error"], [504, "timeout"],
    [403, "blocked by proxy"], [418, "?"],
  ];
  for (const [s, b] of probe) {
    const e = at(s, b);
    seen.set(e.kind, e.action ?? "(none)");
    check(Boolean(e.action), `${e.kind} names an action`, e.action ?? "none");
  }
  check(seen.size >= 9, "and the probe reached nearly every kind", [...seen.keys()].join(", "));
}

console.log("\nA provider that says 400 when it means your key is wrong");
{
  /* Not every provider answers an invalid key with 401 — some send a 400
     whose body says so in words, which is why the body is read at all. */
  const e = at(400, '{"error":{"code":400,"message":"Invalid API key. Please pass a valid api key.","type":"invalid_authentication_error"}}', "moonshot");
  check(e.kind === "bad_key", "a 400 that says the key is not valid is a key problem", e.kind);
  check(e.action === "add_key", "and it sends you to the key rather than to Retry", e.action ?? "none");
  check(e.message.includes("Moonshot"), "named by the provider it came from", e.message);
}

console.log("\nA 403 is not automatically the key's fault");
{
  const proxy = at(403, "tunneling socket could not be established: 403 Forbidden, not in allowlist");
  check(proxy.kind === "network", "a refusal that reads like a proxy is a network problem", proxy.kind);
  check(proxy.action === "retry", "and it does not send you to re-issue a key that was always fine", proxy.action ?? "none");

  const real = at(403, '{"error":{"type":"permission_error","message":"Your API key does not have permission"}}');
  check(real.kind === "bad_key", "a 403 that reads like a rejected key still is one", real.kind);

  /* The trap the comment warns about: a body with both words in it. Permission
     denied wins, because a proxy does not know what an API key is. */
  const both = at(403, "permission denied by the egress proxy");
  check(both.kind === "bad_key", "and a body with both words in it reads as the key", both.kind);
}

console.log("\nWhen the provider says how long to wait, that is what is used");
{
  check(at(429, "rate limited, retry-after: 30").retryAfterMs === 30_000, "retry-after: 30 becomes 30s");
  check(at(429, '{"retry_after":2.5}').retryAfterMs === 2500, "retry_after 2.5 becomes 2.5s");
  check(at(429, "Retry-After 7").retryAfterMs === 7000, "header spelling, no colon");
  check(at(429, '{"error":{"retry-after-ms":2500}}').retryAfterMs === 2500, "and a name that says milliseconds means milliseconds");
  check(at(429, '{"retry_after_ms":900}').retryAfterMs === 900, "however it is punctuated");
  check(at(429, "slow down").retryAfterMs === 8000, "and without one, a sane default rather than none");
  check(at(500, "server error").retryAfterMs === undefined, "a 500 is not a rate limit and carries no wait");
}

console.log("\nThe same failure reads the same from every provider");
{
  for (const p of ["anthropic", "openai", "moonshot", "deepseek"] as ProviderId[]) {
    const e = at(401, "invalid api key", p);
    check(e.kind === "bad_key" && e.action === "add_key", `${p}: 401 is a key problem with a key action`, `${e.kind}/${e.action}`);
    check(e.message.length < 90, `${p}: and says so in one short sentence`, e.message);
  }
}

console.log("\nNothing throws on the bodies that are not JSON at all");
{
  for (const body of ["", "<html><title>502 Bad Gateway</title>", " ", "x".repeat(20_000)]) {
    let ok = true;
    let e;
    try { e = at(502, body); } catch { ok = false; }
    check(ok, `a ${body.length}-byte body of ${JSON.stringify(body.slice(0, 12))} is survivable`);
    check((e?.detail?.length ?? 0) <= 600, "  and the detail is bounded", String(e?.detail?.length));
  }
}

console.log("\nOut of credit is out of credit, whatever status it arrives under");
{
  /* Reported from the live app, and the whole of why it was a dead end.
     Anthropic says a spent balance with a 400 and an `invalid_request_error`,
     not a 429 — so none of the 400 branches matched, the kind fell through to
     `unknown`, and `unknown` is deliberately three things at once: not
     remembered as a provider ailment, not a reason to ask anywhere else, and
     shown by quoting the provider's own sentence. The person got a wall of
     API prose and a Retry that could only fail again, on a key that will not
     refill itself while they wait.

     Each of the four says it differently and only one of them uses 429. What
     they have in common is the words, so that is what is read. */
  const cases: [number, string, ProviderId][] = [
    [400, '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}', "anthropic"],
    [429, '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota"}}', "openai"],
    [402, '{"error":{"message":"Insufficient Balance"}}', "deepseek"],
    [401, '{"error":{"message":"Your account org-xxx<xxx@x.com> is not active, please check your account balance."}}', "moonshot"],
  ];
  for (const [status, body, provider] of cases) {
    const got = at(status, body, provider);
    check(got.kind === "quota", `${provider} at ${status} is out of credit, not a mystery`, got.kind);
    check(!/refused the request/.test(got.message), "and is told in the app's own words", got.message);
  }
  /* And the line it must not cross. A key that is wrong is not a key that is
     empty: one is fixed by pasting a new one and the other by paying, and
     sending somebody to the wrong one of those wastes their afternoon. */
  check(at(401, '{"error":{"message":"invalid x-api-key"}}').kind === "bad_key", "a rejected key is still a rejected key");
  check(at(429, '{"error":{"message":"rate_limit_error"}}').kind === "rate_limit", "and a rate limit is still a rate limit");
  /* "Billing" on its own is not a diagnosis — a provider mentioning a billing
     page in passing while refusing something else would otherwise send the
     turn to another company for no reason. */
  check(at(400, '{"error":{"message":"The model gpt-9 does not exist or you do not have access to it. See your billing page for the plans that include it."}}', "openai").kind !== "quota",
    "while a message that merely mentions billing is not a spent balance");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
