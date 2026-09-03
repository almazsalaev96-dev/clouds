/**
 * Cross-language parity, third implementation.
 *
 * `fixtures/learning-golden.json` is produced by the Python reference. Swift asserts
 * against it on device; this asserts against it in the browser engine. Three
 * implementations, one oracle — so the web version is not a simplified demo of the
 * model, it is the model.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as M from "../src/learning/mastery.js";
import * as S from "../src/learning/scheduling.js";
import * as MC from "../src/learning/misconceptions.js";
import * as EIG from "../src/learning/eig.js";
import * as NA from "../src/learning/nextaction.js";
import { fold, project } from "../src/learning/index.js";

const fixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../fixtures/learning-golden.json", import.meta.url)), "utf8",
));

const TOLERANCE = 5e-9;
const scenario = (name) => {
  const found = fixture.scenarios.find((s) => s.name === name);
  assert.ok(found, `the fixture has no scenario named ${name}`);
  return found;
};

const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) <= TOLERANCE,
    `${label}: got ${actual}, the reference says ${expected}`);

const attemptOf = (j) => ({
  conceptId: j.conceptId,
  at: Date.parse(j.at),
  outcome: j.outcome,
  assistance: j.assistance,
  kind: j.kind,
  errorType: j.errorType,
  sessionId: j.sessionId,
  questionId: j.questionId,
});

function assertState(state, want, label) {
  close(state.alpha, want.alpha, `${label}.alpha`);
  close(state.beta, want.beta, `${label}.beta`);
  close(state.difficulty, want.difficulty, `${label}.difficulty`);
  close(state.stability, want.stability, `${label}.stability`);
  close(M.predictedP(state), want.pUnaided, `${label}.pUnaided`);
  close(M.evidenceStrength(state), want.evidence, `${label}.evidence`);
  assert.equal(state.attempts, want.attempts, `${label}.attempts`);
  assert.equal(state.independentCorrect, want.independentCorrect, `${label}.independentCorrect`);
  assert.equal(state.transferCorrect, want.transferCorrect, `${label}.transferCorrect`);
  assert.equal(state.retentionCorrect, want.retentionCorrect, `${label}.retentionCorrect`);
  assert.equal(state.carelessSlips, want.carelessSlips, `${label}.carelessSlips`);
  assert.equal(state.sessions.length, want.sessions, `${label}.sessions`);
  assert.equal(M.freshState(state), want.freshState, `${label}.freshState`);
}

/** Every step, not just the end, so a divergence is located rather than detected. */
function walk(steps, label) {
  let state = null;
  steps.forEach((step, index) => {
    const attempt = attemptOf(step.attempt);
    state = M.apply(state ?? M.newState(attempt.conceptId), attempt);
    assertState(state, step.state, `${label}[${index}]`);
  });
  return state;
}

describe("constants match the reference", () => {
  const c = fixture.constants;
  it("ability", () => {
    close(M.ALPHA_0, c.alpha0, "alpha0");
    close(M.BETA_0, c.beta0, "beta0");
    close(M.EVIDENCE_HALF_LIFE, c.evidenceHalfLifeDays, "evidenceHalfLife");
  });
  it("memory", () => {
    for (const [ours, theirs] of [
      [M.STAB_A, "stabA"], [M.STAB_B, "stabB"], [M.STAB_C, "stabC"],
      [M.LAPSE_K, "lapseK"], [M.LAPSE_D, "lapseD"],
      [M.LAPSE_S, "lapseS"], [M.LAPSE_R, "lapseR"],
      [M.S_MIN, "sMin"], [M.S_MAX, "sMax"],
    ]) close(ours, c[theirs], theirs);
  });
  it("thresholds and weights", () => {
    for (const [ours, theirs] of [
      [M.P_RELIABLE, "pReliable"], [M.P_MASTERED, "pMastered"],
      [M.R_CAP_RELIABLE, "rCapReliable"], [S.R_DEFAULT, "rDefault"],
      [S.R_EXAM_IMMINENT, "rExamImminent"], [NA.W_ASSIGNMENT, "wAssignment"],
      [NA.W_REST, "wRest"], [NA.DEADLINE_HORIZON_HOURS, "deadlineHorizonHours"],
    ]) close(ours, c[theirs], theirs);
  });
});

describe("mastery", () => {
  it("reproduces the ladder step by step", () => {
    walk(scenario("masteryLadder").steps, "masteryLadder");
  });

  it("gives no ability for answers produced after the solution was shown", () => {
    walk(scenario("solutionDependency").steps, "solutionDependency");
  });

  it("discounts help and recovers independence", () => {
    const s = scenario("assistanceLadder");
    const state = walk(s.steps, "assistanceLadder");
    close(M.independence(state), s.independence, "independence");
  });

  it("costs less for a slip than for a knowledge gap", () => {
    const s = scenario("carelessVsGap");
    walk(s.careless, "careless");
    walk(s.knowledgeGap, "knowledgeGap");
  });

  it("treats unreadable work as no evidence at all", () => {
    walk(scenario("unreadableIsNotEvidence").steps, "unreadable");
  });

  it("loses stability to a lapse without resetting it", () => {
    walk(scenario("lapseAndRecovery").steps, "lapseAndRecovery");
  });
});

describe("memory", () => {
  it("reproduces the forgetting curve and the expiry of mastery", () => {
    const s = scenario("forgetting");
    const f = s.finalState;
    const state = {
      ...M.newState("forget"),
      alpha: f.alpha, beta: f.beta, difficulty: f.difficulty, stability: f.stability,
      lastReviewed: Date.parse(f.lastReviewed), attempts: f.attempts,
      independentCorrect: f.independentCorrect, transferCorrect: f.transferCorrect,
      retentionCorrect: f.retentionCorrect,
      sessions: Array.from({ length: f.sessions }, (_, i) => String(i)),
    };
    assert.equal(M.freshState(state), f.freshState);

    for (const point of s.curve) {
      const when = state.lastReviewed + point.days * 86_400_000;
      close(M.currentRetrievability(state, when), point.retrievability, `R@${point.days}d`);
      assert.equal(M.effectiveState(state, when), point.effectiveState,
        `effective state after ${point.days} days`);
    }
  });
});

describe("scheduling", () => {
  it("reproduces every interval and target", () => {
    const contexts = {
      default: {}, examIn10: { daysUntilExam: 10 }, examIn3: { daysUntilExam: 3 },
      prerequisite: { isPrerequisiteOfDueWork: true }, lowPriority: { lowPriority: true },
    };
    for (const row of scenario("scheduling").intervals) {
      const ctx = contexts[row.context];
      close(S.targetRetention(ctx), row.targetRetention, `target(${row.context})`);
      close(S.intervalDays(row.stability, ctx), row.intervalDays,
        `interval(${row.stability}, ${row.context})`);
    }
    for (const row of scenario("scheduling").retrievability) {
      close(M.retrievability(row.stability, row.days), row.retrievability,
        `R(${row.stability}, ${row.days})`);
    }
  });
});

describe("misconceptions", () => {
  it("finds the same patterns, in the same order, with the same strengths", () => {
    const s = scenario("misconceptionPatterns");
    const found = MC.detect(s.attempts.map(attemptOf), Date.parse(s.now));
    assert.equal(found.length, s.patterns.length);
    found.forEach((pattern, i) => {
      const want = s.patterns[i];
      assert.equal(pattern.errorType, want.errorType);
      assert.equal(pattern.occurrences, want.occurrences);
      assert.equal(pattern.distinctConcepts, want.distinctConcepts);
      close(pattern.strength, want.strength, `pattern[${i}].strength`);
    });
    assert.deepEqual(found.map(MC.headline), s.headlines);
  });
});

describe("information gain", () => {
  const hypotheses = ["formula", "sign", "rearrange", "none"]
    .map((id) => ({ id, label: id, prior: 1 }));

  const candidates = [
    { id: "splitFormula", estimatedMinutes: 1.5, likelihoods: {
      formula: { correct: 0.10, wrongFormula: 0.80, signError: 0.05, other: 0.05 },
      sign: { correct: 0.30, wrongFormula: 0.05, signError: 0.60, other: 0.05 },
      rearrange: { correct: 0.15, wrongFormula: 0.10, signError: 0.15, other: 0.60 },
      none: { correct: 0.90, wrongFormula: 0.03, signError: 0.04, other: 0.03 } } },
    { id: "uninformative", estimatedMinutes: 1.5, likelihoods: Object.fromEntries(
      ["formula", "sign", "rearrange", "none"].map((h) => [h, { correct: 0.5, other: 0.5 }])) },
    { id: "slowButSharp", estimatedMinutes: 6.0, likelihoods: {
      formula: { correct: 0.05, other: 0.95 }, sign: { correct: 0.95, other: 0.05 },
      rearrange: { correct: 0.50, other: 0.50 }, none: { correct: 0.98, other: 0.02 } } },
    { id: "signProbe", estimatedMinutes: 1.0, likelihoods: {
      formula: { correct: 0.85, signError: 0.10, other: 0.05 },
      sign: { correct: 0.15, signError: 0.80, other: 0.05 },
      rearrange: { correct: 0.60, signError: 0.20, other: 0.20 },
      none: { correct: 0.95, signError: 0.03, other: 0.02 } } },
  ];

  it("ranks the questions identically, in bits", () => {
    const s = scenario("expectedInformationGain");
    const prior = EIG.priorMap(hypotheses);
    close(EIG.entropy(Object.values(prior)), s.priorEntropyBits, "priorEntropy");

    const ranked = EIG.rank(prior, candidates);
    assert.deepEqual(ranked.map((r) => r.question.id), s.ranked.map((r) => r.questionId));
    ranked.forEach((entry, i) => {
      close(EIG.expectedInformationGain(prior, entry.question), s.ranked[i].eig, `eig[${i}]`);
      close(entry.score, s.ranked[i].eigPerMinute, `eigPerMinute[${i}]`);
    });
  });

  it("runs the same adaptive sequence to the same conclusion", () => {
    const s = scenario("expectedInformationGain").adaptiveRun;
    let run = EIG.newRun(hypotheses);
    for (let i = 0; i < 6; i++) {
      if (EIG.isConfident(run, 0.8)) break;
      const q = EIG.selectNext(run.prior, candidates, run.asked);
      if (!q) break;
      const responses = [...new Set(Object.values(q.likelihoods).flatMap(Object.keys))];
      const response = responses.includes("signError") ? "signError"
        : responses.includes("other") ? "other" : "correct";
      run = EIG.observe(run, q, response);
    }
    assert.deepEqual(run.asked, s.asked);
    assert.equal(EIG.leading(run).id, s.leading);
    close(EIG.leading(run).probability, s.leadingProbability, "leadingProbability");
    close(EIG.remainingUncertainty(run), s.remainingBits, "remainingBits");
    for (const [id, value] of Object.entries(s.posterior)) {
      close(run.prior[id] ?? 0, value, `posterior[${id}]`);
    }
  });
});

describe("recommendation", () => {
  const concepts = [
    { id: "cts", name: "Completing the square", prerequisites: ["fact"], examWeight: 1.3, upcomingUses: 2 },
    { id: "fact", name: "Factorising" },
    { id: "graphs", name: "Quadratic graphs", prerequisites: ["cts"], examWeight: 1.1, upcomingUses: 1 },
  ];

  it("produces the same actions, order, minutes and scores in every case", () => {
    const s = scenario("nextBestAction");
    const now = Date.parse(s.now);
    const states = fold(s.attempts.map(attemptOf));

    const cases = {
      dueTomorrow: [20, 0, 30, 0], dueInFiveDays: [120, 0, 30, 0],
      tired: [20, 70, 30, 0], uncertainModel: [120, 0, 30, 0.9],
      tenMinutesOnly: [120, 0, 10, 0],
    };

    for (const testCase of s.cases) {
      const [dueHours, worked, available, uncertainty] = cases[testCase.case];
      const assignment = {
        id: "a1", title: "Physics worksheet", subject: "Physics",
        dueAt: now + dueHours * 3_600_000,
        questionsTotal: 18, questionsDone: 12, conceptIds: ["graphs"],
      };
      const got = NA.recommend(states, concepts, [assignment], {
        now, availableMinutes: available,
        minutesWorkedContinuously: worked, modelUncertainty: uncertainty,
      });

      assert.equal(got.length, testCase.recommendations.length, `${testCase.case}: count`);
      got.forEach((r, i) => {
        const want = testCase.recommendations[i];
        assert.equal(r.kind, want.kind, `${testCase.case}[${i}].kind`);
        assert.equal(r.title, want.title, `${testCase.case}[${i}].title`);
        close(r.minutes, want.minutes, `${testCase.case}[${i}].minutes`);
        close(r.score, want.score, `${testCase.case}[${i}].score`);
      });

      const plan = NA.planSession(got, available);
      assert.deepEqual(plan.map((r) => r.title), testCase.plan.map((r) => r.title),
        `${testCase.case}: plan`);
      close(plan.reduce((sum, r) => sum + r.minutes, 0), testCase.planMinutes,
        `${testCase.case}.planMinutes`);
    }
  });

  it("projects the same concept views", () => {
    const source = scenario("nextBestAction");
    const now = Date.parse(source.now);
    const projection = project(
      source.attempts.map(attemptOf), concepts,
      [{ id: "a1", title: "Physics worksheet", dueAt: now + 20 * 3_600_000,
        questionsTotal: 18, questionsDone: 12, conceptIds: ["graphs"] }],
      { now, availableMinutes: 30 },
    );

    const expected = scenario("projection");
    assert.deepEqual(projection.weakest.map((c) => c.conceptId), expected.weakestFirst);
    for (const want of expected.concepts) {
      const view = projection.concepts.find((c) => c.conceptId === want.conceptId);
      assert.ok(view, `no view for ${want.conceptId}`);
      assert.equal(view.state, want.state, `${want.conceptId}.state`);
      assert.equal(view.freshState, want.freshState, `${want.conceptId}.freshState`);
      close(view.pUnaided, want.pUnaided, `${want.conceptId}.pUnaided`);
      close(view.retrievability, want.retrievability, `${want.conceptId}.retrievability`);
      close(view.stabilityDays, want.stabilityDays, `${want.conceptId}.stabilityDays`);
      close(view.overdueDays, want.overdueDays, `${want.conceptId}.overdueDays`);
    }
  });
});
