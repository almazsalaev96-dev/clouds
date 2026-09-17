/* Whether the casts actually work — against the real APIs, not the mock.
 *
 * `gate.sh` proves the cast machinery end to end, but every byte of it is
 * answered by `mock-provider.mjs`, and a mock is agreeable in exactly the
 * places a provider is not. It echoes `model` straight back, so a model name
 * that no longer exists upstream streams happily here and 404s in production.
 * It accepts whichever parameter spelling arrives, so a field sent under a
 * name one provider has never heard of looks identical to one that landed.
 * Those two are structural: no amount of care in the mock can catch a name
 * only the provider knows is wrong.
 *
 * So this is the other half, and it is deliberately not in `gate.sh`: it needs
 * real keys and it spends real money — a few tenths of a cent, and the tally
 * at the end says how much.
 *
 *   npx jiti verify-live.ts              every provider with a key
 *   npx jiti verify-live.ts openai       just one
 *
 * Keys come from the environment or `.env.local`, are never printed, and are
 * never written anywhere. A provider with no key is skipped, not failed.
 */
import { readFileSync, existsSync } from "node:fs";
import { MODELS, PROVIDERS, estimateCost, getModel } from "./lib/models";
import { PRESETS, resolveCast, briefPrompt, briefNote, playerFor } from "./lib/presets";
import { baseUrlFor } from "./lib/providers/shared";
import { adapterFor } from "./lib/providers";
import type { ChatRequest, Message, ProviderId, StreamEvent } from "./lib/types";

let failed = 0;
let spentUsd = 0;
const check = (p: boolean, l: string, d = "") => {
  if (!p) failed++;
  console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`);
};
const note = (l: string) => console.log(`  · ${l}`);

/* `.env.local` is where the README tells people to put a key, so reading it
   here means the documented setup is the one that works. Parsed rather than
   sourced: this never runs a line of that file. */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const only = process.argv[2] as ProviderId | undefined;
const ALL = Object.keys(PROVIDERS) as ProviderId[];
const wanted = only ? ALL.filter((p) => p === only) : ALL;
if (only && !wanted.length) {
  console.log(`\nNo such provider: ${only}. One of: ${ALL.join(", ")}`);
  process.exit(2);
}

const keyOf = (p: ProviderId) => process.env[PROVIDERS[p].keyName]?.trim() || "";

/**
 * Where each provider actually lives, and what its catalogue is called.
 *
 * Copied from the adapters rather than guessed, because the two halves split
 * differently and getting it wrong verifies an endpoint that is not the one
 * that ships: `ANTHROPIC_BASE_URL` stops before `/v1` and the adapter adds
 * `/v1/messages`, while the OpenAI-shaped bases include `/v1` already and add
 * only `/chat/completions`. The default hosts are not guessable either —
 * Moonshot is `.ai`, not `.com`.
 */
const ENDPOINT: Record<ProviderId, { base: () => string; models: string }> = {
  anthropic: { base: () => baseUrlFor("anthropic", "https://api.anthropic.com"), models: "/v1/models?limit=1000" },
  openai: { base: () => baseUrlFor("openai", "https://api.openai.com/v1"), models: "/models" },
  moonshot: { base: () => baseUrlFor("moonshot", "https://api.moonshot.ai/v1"), models: "/models" },
  deepseek: { base: () => baseUrlFor("deepseek", "https://api.deepseek.com/v1"), models: "/models" },
};
const live = wanted.filter((p) => keyOf(p));

console.log("\nKeys");
for (const p of wanted) {
  const base = ENDPOINT[p].base();
  const host = (() => { try { return new URL(base).host; } catch { return base; } })();
  if (keyOf(p)) note(`${PROVIDERS[p].name} — key present, talking to ${host}`);
  else note(`${PROVIDERS[p].name} — no ${PROVIDERS[p].keyName}, skipping`);
}

if (!live.length) {
  console.log(`
Nothing to verify: no keys are set.

  cp .env.example .env.local     then put a real key in it

A key pasted into a chat, a terminal history or a commit is a key to rotate,
not a key to use.
`);
  process.exit(0);
}

/* ------------------------------------------------------------ catalogue -- */
/* The check the mock cannot do at all. Every `apiName` in lib/models.ts is a
   claim about somebody else's product, and the only thing that can settle it
   is that provider's own list. One request per provider, no tokens. */

async function catalogueOf(p: ProviderId, key: string): Promise<Set<string> | string> {
  const headers: Record<string, string> =
    p === "anthropic"
      ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : { authorization: `Bearer ${key}` };
  const url = ENDPOINT[p].base() + ENDPOINT[p].models;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return `${res.status} ${(await res.text()).slice(0, 120)}`;
    const body = (await res.json()) as { data?: { id?: string }[] };
    return new Set((body.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x)));
  } catch (e) {
    return `could not reach it — ${(e as Error).message}`;
  }
}

const catalogues = new Map<ProviderId, Set<string>>();

/**
 * Whether a catalogue serves a name we offer.
 *
 * Providers publish dated snapshots and apps hold the moving alias, so
 * `claude-haiku-4-5` and `claude-haiku-4-5-20251001` are one model and have to
 * match. Every looser rule than "the extra part is a date" reads a *different*
 * model as this one, and each time it hides the one failure this check exists
 * for. Either name being a prefix of the other made `gpt-5.5` answer for a
 * withdrawn `gpt-5`. Allowing any digits and hyphens after it then made
 * `claude-opus-5-1-20260301` answer for a withdrawn `claude-opus-5`, because a
 * version bump is digits too. So the remainder has to be a date and nothing
 * else: `20251001`, or `2024-08-06` the way OpenAI writes it.
 */
const DATED = /^(?:\d{8}|\d{4}-\d{2}-\d{2})$/;

function serves(catalogue: Set<string>, apiName: string): boolean {
  if (catalogue.has(apiName)) return true;
  const snapshotOf = (long: string, short: string) =>
    long.startsWith(short + "-") && DATED.test(long.slice(short.length + 1));
  return [...catalogue].some((id) => snapshotOf(id, apiName) || snapshotOf(apiName, id));
}

console.log("\nEvery model this app offers is a model that provider still serves");
for (const p of live) {
  const got = await catalogueOf(p, keyOf(p));
  if (typeof got === "string") {
    /* A gateway, Azure or a local model is under no obligation to publish a
       catalogue, and failing the run because one did not would punish exactly
       the deployments `*_BASE_URL` exists for. Against the provider's own host
       there is no such excuse: a list that cannot be read is a finding. */
    if (process.env[`${p.toUpperCase()}_BASE_URL`]?.trim())
      note(`${PROVIDERS[p].name}: no catalogue behind that base URL, so the names went unchecked — ${got}`);
    else check(false, `${PROVIDERS[p].name}: could not read the catalogue`, got);
    continue;
  }
  catalogues.set(p, got);
  const mine = MODELS.filter((m) => m.provider === p);
  const missing = mine.filter((m) => !serves(got, m.apiName));
  check(
    missing.length === 0,
    `${PROVIDERS[p].name}: ${mine.length - missing.length}/${mine.length} of our names exist upstream`,
    missing.length ? `not served: ${missing.map((m) => m.apiName).join(", ")}` : `${got.size} models listed`,
  );
}

/* ----------------------------------------------------------------- wire -- */
/* One real streaming turn per parameter shape, through the adapter the app
   actually uses. Reasoning and non-reasoning models take different fields —
   `max_completion_tokens` and `reasoning_effort` against `max_tokens`,
   `temperature` and `top_p` — and the mock waves both through. Only the
   provider can say whether the body we build is the body it accepts. */

const msg = (text: string): Message =>
  ({ id: "m1", conversationId: "c", parentId: null, role: "user", content: [{ type: "text", text }], createdAt: 0 }) as Message;

interface Ran { text: string; reasoning: string; error: string | null; usage: { inputTokens: number; outputTokens: number; costUsd: number } | null; done: boolean }

async function run(modelId: string, prompt: string, turnPrompt?: string, maxTokens = 512): Promise<Ran> {
  const req = {
    modelId,
    messages: [msg(prompt)],
    turnPrompt,
    params: { maxTokens, temperature: 0.2, topP: 1, reasoningEffort: "low" },
  } as ChatRequest;
  const out: Ran = { text: "", reasoning: "", error: null, usage: null, done: false };
  const key = keyOf(getModel(modelId).provider);
  for await (const ev of adapterFor(modelId)(req, key, new AbortController().signal) as AsyncGenerator<StreamEvent>) {
    if (ev.type === "text") out.text += ev.text;
    else if (ev.type === "reasoning") out.reasoning += ev.text;
    else if (ev.type === "usage") { out.usage = ev.usage; spentUsd += ev.usage.costUsd; }
    else if (ev.type === "done") out.done = true;
    else if (ev.type === "error") out.error = ev.error.message + (ev.error.detail ? ` :: ${ev.error.detail.slice(0, 160)}` : "");
  }
  return out;
}

/** The cheapest model of a given shape, so a verification costs what it must and no more. */
function cheapest(p: ProviderId, reasoning: boolean) {
  const served = catalogues.get(p);
  return MODELS
    .filter((m) => m.provider === p && Boolean(m.reasoning) === reasoning)
    /* Never probe a name the catalogue just said is not there: that fails
       twice for one reason and buries the finding above it. */
    .filter((m) => !served || serves(served, m.apiName))
    .sort((a, b) => a.priceIn + a.priceOut - (b.priceIn + b.priceOut))[0];
}

console.log("\nThe body each adapter builds is a body that provider accepts");
for (const p of live) {
  for (const reasoning of [false, true]) {
    const shape = reasoning ? "reasoning params" : "sampling params";
    const m = cheapest(p, reasoning);
    /* Said rather than skipped in silence. Every Anthropic and OpenAI model in
       the catalogue is a reasoning model, so the other branch of the adapter —
       `max_tokens` with `temperature` and `top_p` — has nothing here that can
       reach it, and a run that quietly checked one shape would read as having
       checked both. It is not dead code, it is code the day a non-reasoning
       model is added, and until then nothing live is proving it. */
    if (!m) { note(`${PROVIDERS[p].name}: no model takes ${shape} — that branch is unexercised`); continue; }
    const r = await run(m.id, "Reply with exactly: OK");
    if (r.error) { check(false, `${m.name} (${shape})`, r.error); continue; }
    check(r.done && !!r.usage, `${m.name} (${shape}) streamed and reported usage`,
      r.usage ? `${r.usage.inputTokens} in / ${r.usage.outputTokens} out` : "no usage frame");
    /* A reasoning model can legitimately spend a small ceiling entirely on
       thinking and return no prose. That is the provider behaving, not the
       adapter failing, so it is said rather than counted against. */
    if (!r.text.trim()) note(`${m.name} returned no text — ceiling likely spent on reasoning`);
  }
}

/* ----------------------------------------------------------------- cast -- */
/* And the claim the product is built on: an Armi model is two companies. */

const configured = Object.fromEntries(live.map((p) => [p, true]));
const companiesOf = (ids: string[]) => new Set(ids.map((id) => getModel(id).provider));

console.log("\nOn the keys actually present, each tactic spans more than one company");
{
  const spans: string[] = [];
  for (const preset of PRESETS) {
    const cast = resolveCast(preset.id, { configured });
    if (!cast) { check(false, `${preset.name} did not resolve`); continue; }
    const n = companiesOf([cast.answer.modelId, ...cast.parts.map((x) => x.modelId)]).size;
    if (n < 2) spans.push(`${preset.short} (${cast.short ?? "one company"})`);
  }
  check(spans.length === 0, `${PRESETS.length - spans.length}/${PRESETS.length} tactics run across two companies`,
    spans.length ? `single-company: ${spans.join(", ")}` : "");
  if (live.length < 2) note("only one provider has a key — a single-company cast is correct here, not a fault");
}

if (live.length >= 2) {
  console.log("\nOne turn, two companies, for real: the brief is written by one and reaches the other");
  const preset = PRESETS.find((x) => {
    const c = resolveCast(x.id, { configured });
    const b = playerFor(c, "brief");
    return b && c && getModel(b.modelId).provider !== getModel(c.answer.modelId).provider;
  });
  if (!preset) check(false, "no tactic resolved to a cross-company brief");
  else {
    const cast = resolveCast(preset.id, { configured })!;
    const briefer = playerFor(cast, "brief")!;
    const ASK = "why would you choose an event-sourced architecture over a CRUD one";

    const b = await run(briefer.modelId, briefPrompt(ASK, briefer.as), undefined, 300);
    check(!b.error && !!b.text.trim(), `${getModel(briefer.modelId).name} wrote the brief`, b.error ?? `${b.text.trim().split("\n").length} lines`);

    if (b.text.trim()) {
      /* The writer is handed the brief exactly the way the app hands it over —
         `briefNote` into `turnPrompt` — so what is proved here is the path
         that ships, not a reconstruction of it. */
      const a = await run(cast.answer.modelId, ASK, briefNote(b.text), 512);
      check(!a.error && !!a.text.trim(), `${getModel(cast.answer.modelId).name} answered with it in hand`, a.error ?? `${a.text.trim().length} chars`);
      check(
        getModel(briefer.modelId).provider !== getModel(cast.answer.modelId).provider,
        `${preset.name}: ${PROVIDERS[getModel(briefer.modelId).provider].name} briefed, ${PROVIDERS[getModel(cast.answer.modelId).provider].name} wrote`,
      );
    }
  }
}

console.log(`\nSpent ${spentUsd < 0.01 ? "under a cent" : "$" + spentUsd.toFixed(4)} verifying this.`);
console.log(failed ? `FAIL (${failed})` : "all passed");
process.exit(failed ? 1 : 0);
