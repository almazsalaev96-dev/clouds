import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { loadConfig, redactConfig } from "../src/config.ts";
import { assemble, clipToBytes, ContextTooLarge } from "../src/context/budget.ts";
import { redact } from "../src/context/redact.ts";
import { toJSONSchema, validate, S } from "../src/domain/schema.ts";
import { CheckReply, TutorReply } from "../src/domain/contracts.ts";
import {
  entropy, expectedInformationGain, priorMap, validateDiagnostic,
  type DiagnosticQuestion, type Hypothesis,
} from "../src/generation/diagnostic.ts";
import { validateQuestion, validateSet } from "../src/generation/validate.ts";
import { grade } from "../src/grading/grade.ts";
import { enrich, reconcile, type ModelJudgement } from "../src/grading/reconcile.ts";
import { createApp } from "../src/http/app.ts";
import { MockProvider } from "../src/providers/ai/mock.ts";
import { MockVoice } from "../src/providers/voice/mock.ts";
import { authenticate } from "../src/security/auth.ts";
import { RateLimiter } from "../src/security/rateLimit.ts";

const ENV = {
  ANTHROPIC_API_KEY: "test-key",
  ELEVENLABS_API_KEY: "test-voice-key",
  SLATE_RPM: "5",
  NODE_ENV: "development",
} as NodeJS.ProcessEnv;

function makeApp(handler?: (r: never) => unknown) {
  const ai = new MockProvider(handler as never);
  const voice = new MockVoice();
  const app = createApp({ config: loadConfig(ENV), ai, voice });
  return { app, ai, voice };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("schema", () => {
  it("accepts a valid object and drops unknown keys", () => {
    const s = S.object({ a: S.string(), b: S.int({ min: 0 }) }, ["a", "b"]);
    const r = validate<{ a: string; b: number }>(s, { a: "x", b: 2, sneaky: true });
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.value, { a: "x", b: 2 });
  });

  it("names the field that is wrong", () => {
    const s = S.object({ a: S.string(), b: S.int() }, ["a", "b"]);
    const r = validate(s, { a: "x", b: 1.5 });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.issues[0]!.path.includes("b"));
  });

  it("reports a missing required field", () => {
    const r = validate(S.object({ a: S.string() }, ["a"]), {});
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.issues.some((i) => i.message === "is required"));
  });

  it("enforces enums", () => {
    assert.equal(validate(S.enum(["a", "b"]), "c").ok, false);
    assert.equal(validate(S.enum(["a", "b"]), "b").ok, true);
  });

  it("produces a JSON Schema the model can be held to", () => {
    const js = toJSONSchema(TutorReply) as Record<string, unknown>;
    assert.equal(js["type"], "object");
    assert.equal(js["additionalProperties"], false);
    assert.ok((js["required"] as string[]).includes("confidence"));
  });

  it("keeps the validator and the JSON Schema in step", () => {
    // Same declaration, both directions: what the model is told and what we check.
    const js = toJSONSchema(CheckReply) as { properties: Record<string, unknown> };
    const declared = Object.keys(js.properties).sort();
    const valid = {
      verdict: "correct", whatIsRight: "a", whatToFix: "", errorType: "unknown",
      errorConfidence: 0, conceptIds: [], suggestedAssistance: "none",
      nextAction: { kind: "moveOn", label: "Next" },
    };
    const r = validate<Record<string, unknown>>(CheckReply, valid);
    assert.equal(r.ok, true);
    assert.ok(r.ok && Object.keys(r.value).every((k) => declared.includes(k)));
  });
});

describe("redaction", () => {
  it("removes contact details", () => {
    const r = redact("Email a.student@school.org or call 07700 900123 today");
    assert.ok(!r.text.includes("a.student@school.org"));
    assert.ok(!r.text.includes("900123"));
    assert.equal(r.removed["email"], 1);
  });

  it("removes names it was told about", () => {
    const r = redact("Almaz Salaev, Year 12, Physics", ["Almaz Salaev"]);
    assert.ok(!r.text.includes("Almaz"));
    assert.equal(r.removed["name"], 1);
  });

  it("removes long identifiers, and says that is what they were", () => {
    const r = redact("Candidate 1234567890123");
    assert.ok(!r.text.includes("1234567890123"));
    // The label matters: a candidate number reported as a phone number makes the
    // removal report misleading to anyone auditing what left the device.
    assert.equal(r.removed["longNumber"], 1);
    assert.equal(r.removed["phone"], undefined);
  });

  it("removes a phone number written with spaces", () => {
    assert.ok(!redact("Call 07700 900123 today").text.includes("900123"));
    assert.ok(!redact("Ring +44 20 7946 0958").text.includes("7946"));
  });

  it("leaves a short number that is not an identifier", () => {
    // The nine-digit floor exists so the redactor does not eat the mathematics.
    assert.equal(redact("Answer: 1234567").text, "Answer: 1234567");
  });

  it("leaves the mathematics alone", () => {
    const maths = "Solve 3x + 2 = 14 and find x^2 - 6x + 5 at x = 2.5";
    assert.equal(redact(maths).text, maths);
  });

  it("leaves ordinary four-digit numbers alone", () => {
    assert.equal(redact("In 1945 the value was 2024").text, "In 1945 the value was 2024");
  });
});

describe("context budget", () => {
  const part = (kind: string, text: string) =>
    ({ kind, label: kind, text } as never);

  it("keeps the highest priority parts and drops the lowest", () => {
    const r = assemble([
      part("neighbouringPages", "n".repeat(5000)),
      part("focus", "the selected equation"),
      part("questionText", "Solve for x"),
    ], 400);
    assert.ok(r.included.includes("focus"));
    assert.ok(r.included.includes("questionText"));
    assert.ok(r.dropped.includes("neighbouringPages"));
  });

  it("orders parts by priority regardless of input order", () => {
    const r = assemble([
      part("pageText", "page"), part("focus", "focus"), part("studentWork", "work"),
    ], 10_000);
    assert.deepEqual(r.included, ["focus", "studentWork", "pageText"]);
  });

  it("trims a long low-priority part rather than dropping it", () => {
    const r = assemble([part("focus", "f"), part("pageText", "p".repeat(4000))], 1200);
    assert.ok(r.truncated.includes("pageText"));
    assert.ok(r.text.includes("[trimmed to fit]"));
  });

  it("refuses rather than answering about the wrong thing", () => {
    assert.throws(
      () => assemble([part("focus", "x".repeat(9000))], 300),
      ContextTooLarge,
    );
  });

  it("never splits a multi-byte character", () => {
    const clipped = clipToBytes("héllo wörld ✓✓✓", 9);
    assert.ok(Buffer.byteLength(clipped) <= 9);
    assert.equal(clipped, clipped.normalize());
    assert.ok(!clipped.includes("�"));
  });

  it("keeps a small high-value part rather than padding a large one", () => {
    // The mastery hints are a few hundred bytes and tell the tutor whether this
    // student has met the idea before. Letting page text crowd them out because it
    // sits higher in the priority list is exactly backwards.
    const r = assemble([
      part("focus", "f"), part("studentWork", "w"), part("questionText", "q"),
      part("pageText", "p".repeat(20_000)),
      part("masteryHints", "Completing the square: getting there"),
    ], 3000);
    assert.ok(r.included.includes("masteryHints"));
    assert.ok(r.truncated.includes("pageText"));
    assert.ok(r.bytes <= 3000);
  });

  it("still emits parts in priority order after reallocating", () => {
    const r = assemble([
      part("masteryHints", "short"), part("pageText", "p".repeat(2000)),
      part("focus", "f"),
    ], 10_000);
    assert.deepEqual(r.included, ["focus", "pageText", "masteryHints"]);
    assert.ok(r.text.indexOf("focus") < r.text.indexOf("pageText"));
  });

  it("does not let a pile of small parts eat the whole budget", () => {
    const parts = Array.from({ length: 40 }, (_, i) =>
      ({ kind: "figures", label: `fig${i}`, text: "x".repeat(200) } as never));
    const r = assemble([part("focus", "f"), ...parts], 4000);
    assert.ok(r.bytes <= 4000);
    assert.ok(r.included.includes("focus"));
  });

  it("stays inside the budget", () => {
    const r = assemble([
      part("focus", "a".repeat(300)), part("pageText", "b".repeat(3000)),
      part("figures", "c".repeat(3000)),
    ], 1500);
    assert.ok(r.bytes <= 1500, `used ${r.bytes}`);
  });
});

describe("verdict reconciliation", () => {
  const model = (over: Partial<ModelJudgement> = {}): ModelJudgement => ({
    verdict: "incorrect",
    whatIsRight: "The method is right.",
    whatToFix: "The final value is wrong.",
    errorType: "calculation",
    errorConfidence: 0.6,
    conceptIds: ["c"],
    suggestedAssistance: "hint",
    nextAction: { kind: "tryAgain", label: "Try again" },
    ...over,
  });

  it("lets arithmetic overrule the model when the model is wrong", () => {
    const g = grade("3/2", [{ text: "1.5" }]);
    assert.equal(g.verdict, "correct");
    const r = reconcile(g, model({ verdict: "incorrect" }));
    assert.equal(r.verdict, "correct");
    assert.equal(r.decidedBy, "grader");
    assert.equal(r.modelOverruled, true);
  });

  it("clears the fault text when it overrules a wrong 'incorrect'", () => {
    const r = reconcile(grade("3/2", [{ text: "1.5" }]), model());
    assert.equal(r.whatToFix, "");
    assert.equal(r.errorType, "unknown");
    assert.equal(r.nextAction.kind, "moveOn");
  });

  it("defers to the model when arithmetic cannot decide", () => {
    const g = grade("Because the forces balance", [{ text: "The forces balance", shape: "text" }]);
    assert.equal(g.verdict, "abstain");
    const r = reconcile(g, model({ verdict: "partiallyCorrect" }));
    assert.equal(r.verdict, "partiallyCorrect");
    assert.equal(r.decidedBy, "model");
    assert.ok(r.confidence <= 0.85, "a model-only verdict must not claim certainty");
  });

  it("reports agreement as certain", () => {
    const g = grade("7", [{ text: "4" }]);
    const r = reconcile(g, model({ verdict: "incorrect" }));
    assert.equal(r.decidedBy, "agreement");
    assert.equal(r.confidence, 1);
  });

  it("prefers the grader's diagnosis of how the answer missed", () => {
    const g = grade("-4", [{ text: "4" }]);
    const r = enrich(reconcile(g, model({ errorType: "misconception" })), g);
    assert.equal(r.errorType, "careless");
    assert.ok(r.whatToFix.includes("sign"));
  });
});

describe("generated question validation", () => {
  const base = {
    prompt: "Solve x^2 - 7x + 12 = 0",
    answerShape: "set",
    acceptableAnswers: ["3, 4"],
    workedSolution: ["Factorise", "x = 3 or x = 4"],
    conceptIds: ["quadratics"], difficulty: "medium", marks: 3,
  };

  it("accepts a sound question", () => {
    assert.equal(validateQuestion(base).ok, true);
  });

  it("rejects answers that contradict each other", () => {
    const r = validateQuestion({ ...base, acceptableAnswers: ["3, 4", "3, 5"] });
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.code === "answersDisagree"));
  });

  it("accepts genuinely equivalent alternative forms", () => {
    const r = validateQuestion({ ...base, acceptableAnswers: ["3, 4", "x = 4, x = 3", "{4, 3}"] });
    assert.equal(r.ok, true);
  });

  it("rejects an answer the marker cannot read", () => {
    const r = validateQuestion({ ...base, acceptableAnswers: ["3 or maybe 4???"] });
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.code === "unparseableAnswer"));
  });

  it("rejects a prompt that gives its own answer away", () => {
    const r = validateQuestion({ ...base, prompt: "Show that the roots are 3, 4" });
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.code === "answerInPrompt"));
  });

  it("rejects an unfilled placeholder", () => {
    const r = validateQuestion({ ...base, prompt: "Solve x^2 - [insert] x + 12 = 0" });
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.code === "ambiguousPlaceholder"));
  });

  it("rejects a duplicate within a set", () => {
    const { accepted, rejected } = validateSet([base, { ...base }]);
    assert.equal(accepted.length, 1);
    assert.equal(rejected[0]!.problems[0]!.code, "duplicate");
  });

  it("rejects a quantity question with no unit anywhere", () => {
    const r = validateQuestion({
      ...base, prompt: "Find the acceleration", answerShape: "quantity",
      acceptableAnswers: ["9.81"], unit: "m/s^2",
    });
    assert.ok(r.problems.some((p) => p.code === "unitMissing"));
  });
});

describe("diagnostic validation", () => {
  const hypotheses: Hypothesis[] = [
    { id: "sign", label: "Drops signs", prior: 1, conceptIds: [] },
    { id: "formula", label: "Wrong formula", prior: 1, conceptIds: [] },
    { id: "arithmetic", label: "Arithmetic slips", prior: 1, conceptIds: [] },
    { id: "none", label: "No specific weakness", prior: 1, conceptIds: [] },
  ];

  const question = (
    prompt: string,
    table: Record<string, Record<string, number>>,
  ): DiagnosticQuestion => ({
    prompt, answerShape: "expression", acceptableAnswers: ["1"],
    workedSolution: ["step"], conceptIds: ["c"], difficulty: "medium", marks: 2,
    discriminates: Object.entries(table).map(([hypothesisId, responses]) => ({
      hypothesisId,
      responses: Object.entries(responses).map(([category, probability]) => ({
        category, probability,
      })),
    })),
  });

  const flat = Object.fromEntries(
    hypotheses.map((h) => [h.id, { correct: 0.5, other: 0.5 }]),
  );

  const sharp = {
    sign: { correct: 0.05, signError: 0.9, other: 0.05 },
    formula: { correct: 0.85, signError: 0.05, other: 0.1 },
    arithmetic: { correct: 0.6, signError: 0.1, other: 0.3 },
    none: { correct: 0.95, signError: 0.03, other: 0.02 },
  };

  it("measures entropy in bits", () => {
    assert.equal(entropy([0.5, 0.5]), 1);
    assert.equal(entropy([0.25, 0.25, 0.25, 0.25]), 2);
    assert.equal(entropy([1]), 0);
  });

  it("scores a question every hypothesis answers alike at zero", () => {
    const prior = priorMap(hypotheses);
    assert.ok(expectedInformationGain(prior, question("flat", flat)) < 1e-9);
  });

  it("scores a discriminating question well above zero", () => {
    const prior = priorMap(hypotheses);
    assert.ok(expectedInformationGain(prior, question("sharp", sharp)) > 0.5);
  });

  it("accepts a set that can tell the hypotheses apart", () => {
    const r = validateDiagnostic(hypotheses, [question("sharp", sharp)]);
    assert.equal(r.ok, true);
    assert.equal(r.questions.length, 1);
    assert.ok(r.priorEntropyBits > 1.9);
    assert.ok(r.bestQuestionBits > 0.5);
  });

  it("rejects a question that discriminates nothing", () => {
    const r = validateDiagnostic(hypotheses, [question("flat", flat)]);
    assert.equal(r.ok, false);
    assert.equal(r.rejected[0]!.problems[0]!.code, "uninformative");
  });

  it("rejects a question that ignores one of the hypotheses", () => {
    const partial = { sign: sharp.sign, formula: sharp.formula, arithmetic: sharp.arithmetic };
    const r = validateDiagnostic(hypotheses, [question("partial", partial)]);
    assert.equal(r.ok, false);
    assert.ok(r.rejected[0]!.problems.some((p) => p.code === "missingHypothesis"));
  });

  it("rejects probabilities that do not sum to one", () => {
    const broken = {
      ...sharp,
      sign: { correct: 0.5, signError: 0.9, other: 0.4 },
    };
    const r = validateDiagnostic(hypotheses, [question("broken", broken)]);
    assert.ok(r.rejected[0]!.problems.some((p) => p.code === "probabilitiesDoNotSum"));
  });

  it("rejects a question with no discrimination table at all", () => {
    const bare = { ...question("bare", sharp) };
    delete bare.discriminates;
    const r = validateDiagnostic(hypotheses, [bare]);
    assert.equal(r.rejected[0]!.problems[0]!.code, "noDiscrimination");
  });

  it("keeps the good questions and reports the bad ones", () => {
    const r = validateDiagnostic(hypotheses, [
      question("flat", flat), question("sharp", sharp),
    ]);
    assert.equal(r.ok, true);
    assert.equal(r.questions.length, 1);
    assert.equal(r.rejected.length, 1);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then refuses", () => {
    const l = new RateLimiter(3);
    const now = 1_000_000;
    assert.equal(l.check("a", now).allowed, true);
    assert.equal(l.check("a", now).allowed, true);
    assert.equal(l.check("a", now).allowed, true);
    const denied = l.check("a", now);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSeconds > 0);
  });

  it("keeps callers separate", () => {
    const l = new RateLimiter(1);
    assert.equal(l.check("a").allowed, true);
    assert.equal(l.check("b").allowed, true);
  });

  it("recovers once the window passes", () => {
    const l = new RateLimiter(1);
    const now = 1_000_000;
    assert.equal(l.check("a", now).allowed, true);
    assert.equal(l.check("a", now + 61_000).allowed, true);
  });

  it("forgets idle callers", () => {
    const l = new RateLimiter(5);
    l.check("a", 1_000_000);
    l.sweep(1_000_000 + 120_000);
    assert.equal(l.size, 0);
  });
});

describe("authentication", () => {
  it("runs open in development", () => {
    assert.equal(authenticate({}, null, "1.2.3.4").ok, true);
  });

  it("requires a token when one is configured", () => {
    assert.equal(authenticate({}, "secret", "1.2.3.4").ok, false);
    assert.equal(authenticate({ authorization: "Bearer secret" }, "secret", "1.2.3.4").ok, true);
  });

  it("rejects a wrong token of the same length", () => {
    assert.equal(authenticate({ "x-slate-token": "secreT" }, "secret", "1.2.3.4").ok, false);
  });

  it("rate-limits per device when the app supplies one", () => {
    const a = authenticate({ authorization: "Bearer s", "x-slate-device": "ipad-1" }, "s", "1.2.3.4");
    assert.equal(a.callerKey, "device:ipad-1");
  });
});

describe("routes", () => {
  let harness: ReturnType<typeof makeApp>;
  beforeEach(() => { harness = makeApp(); });

  it("reports health without a token", async () => {
    const res = await harness.app.handle(new Request("http://localhost/health"));
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { status: string }).status, "ok");
  });

  it("grades deterministically with no model call", async () => {
    const res = await harness.app.handle(post("/v1/grade", {
      submitted: "3/2", expected: [{ text: "1.5" }],
    }));
    assert.equal(res.status, 200);
    const body = await res.json() as { grade: { verdict: string } };
    assert.equal(body.grade.verdict, "correct");
    assert.equal(harness.ai.calls.length, 0, "the fast path must not spend a model call");
  });

  it("checks an answer and returns a reconciled verdict", async () => {
    const res = await harness.app.handle(post("/v1/check", {
      submitted: "x^2 + 3x + 2", expected: [{ text: "(x+1)(x+2)" }],
      questionText: "Expand (x+1)(x+2)", workingText: "x^2 + 3x + 2",
    }));
    assert.equal(res.status, 200);
    const body = await res.json() as { check: { verdict: string; modelOverruled: boolean } };
    assert.equal(body.check.verdict, "correct");
    assert.equal(body.check.modelOverruled, true, "the mock says incorrect; arithmetic says otherwise");
  });

  it("passes the grader's finding into the model's context", async () => {
    await harness.app.handle(post("/v1/check", {
      submitted: "-4", expected: [{ text: "4" }], questionText: "Evaluate",
    }));
    const prompt = harness.ai.calls[0]!.prompt;
    assert.ok(prompt.includes("Verdict: incorrect"));
    assert.ok(prompt.includes("sign"), "the near-miss diagnosis must reach the model");
  });

  it("answers a bare 'why' using the page as the antecedent", async () => {
    const res = await harness.app.handle(post("/v1/tutor", {
      ask: "why?", questionText: "Solve 3x + 2 = 14", workingText: "3x = 16",
    }));
    assert.equal(res.status, 200);
    const prompt = harness.ai.calls[0]!.prompt;
    assert.ok(prompt.includes("Solve 3x + 2 = 14"));
    assert.ok(prompt.includes("3x = 16"));
  });

  it("redacts before anything reaches the provider", async () => {
    await harness.app.handle(post("/v1/tutor", {
      ask: "check this", questionText: "Name: Almaz Salaev (almaz@school.org)",
      redactTerms: ["Almaz Salaev"],
    }));
    const prompt = harness.ai.calls[0]!.prompt;
    assert.ok(!prompt.includes("almaz@school.org"));
    assert.ok(!prompt.includes("Almaz"));
  });

  it("rejects a generated question that does not check out", async () => {
    const { app } = makeApp((() => ({
      questions: [{
        prompt: "Solve x^2 - 7x + 12 = 0", answerShape: "set",
        acceptableAnswers: ["3, 4", "3, 9"],
        workedSolution: ["Factorise"], conceptIds: ["q"], difficulty: "medium", marks: 3,
      }],
    })) as never);
    const res = await app.handle(post("/v1/generate", { conceptIds: ["q"], count: 1 }));
    assert.equal(res.status, 502, "nothing unverified reaches a student");
  });

  it("returns questions that do check out", async () => {
    const res = await harness.app.handle(post("/v1/generate", { conceptIds: ["q"], count: 1 }));
    assert.equal(res.status, 200);
    const body = await res.json() as { questions: unknown[] };
    assert.equal(body.questions.length, 1);
  });

  it("streams speech", async () => {
    const res = await harness.app.handle(post("/v1/voice", { text: "Try the third line again." }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "audio/mpeg");
    assert.equal(harness.voice.spoken[0], "Try the third line again.");
  });

  it("refuses an unknown endpoint", async () => {
    const res = await harness.app.handle(post("/v1/nonsense", {}));
    assert.equal(res.status, 404);
  });

  it("rejects a malformed body without leaking anything technical", async () => {
    const res = await harness.app.handle(new Request("http://localhost/v1/grade", {
      method: "POST", body: "{not json",
    }));
    assert.equal(res.status, 400);
    const body = await res.json() as { error: { message: string } };
    assert.ok(body.error.message.includes("work is saved"));
    assert.ok(!/SyntaxError|undefined|stack/i.test(body.error.message));
  });

  it("rate limits and says when to come back", async () => {
    const { app } = makeApp();
    let last: Response | null = null;
    for (let i = 0; i < 7; i++) {
      last = await app.handle(post("/v1/grade", { submitted: "1", expected: [{ text: "1" }] }));
    }
    assert.equal(last!.status, 429);
    assert.ok(Number(last!.headers.get("retry-after")) > 0);
  });

  it("turns a provider failure into a sentence a student can read", async () => {
    const { app } = makeApp((() => { throw new Error("socket hang up"); }) as never);
    const res = await app.handle(post("/v1/tutor", { ask: "why?" }));
    assert.equal(res.status, 500);
    const body = await res.json() as { error: { message: string; requestId: string } };
    assert.ok(!body.error.message.includes("socket"));
    assert.ok(body.error.requestId.length > 0, "the operator still gets a handle on it");
  });

  it("carries a request id on every response", async () => {
    const res = await harness.app.handle(post("/v1/grade", { submitted: "1", expected: [{ text: "1" }] }));
    assert.ok(res.headers.get("x-request-id"));
  });
});

describe("configuration", () => {
  it("refuses to start without provider credentials", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv),
      /ANTHROPIC_API_KEY/);
  });

  it("refuses to run open in production", () => {
    assert.throws(
      () => loadConfig({ ...ENV, NODE_ENV: "production" } as NodeJS.ProcessEnv),
      /SLATE_APP_TOKEN/,
    );
  });

  it("defaults every task to the strongest model", () => {
    const c = loadConfig(ENV);
    assert.ok(Object.values(c.models).every((m) => m === "claude-opus-5"));
  });

  it("allows per-task routing when an operator opts in", () => {
    const c = loadConfig({ ...ENV, SLATE_MODEL_HANDWRITING: "claude-haiku-4-5" } as NodeJS.ProcessEnv);
    assert.equal(c.models.handwriting, "claude-haiku-4-5");
    assert.equal(c.models.tutor, "claude-opus-5");
  });

  it("never exposes a key when the config is logged", () => {
    const printed = JSON.stringify(redactConfig(loadConfig(ENV)));
    assert.ok(!printed.includes("test-key"));
    assert.ok(!printed.includes("test-voice-key"));
    assert.ok(printed.includes("set"));
  });
});
