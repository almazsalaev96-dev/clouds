import { describe, it, expect } from "vitest";
import {
  computeMastery,
  retrievability,
  retentionState,
  updateAbility,
  bandFor,
  type MasteryEvidence,
} from "./mastery";
import {
  review,
  newMemoryState,
  intervalForRetention,
  examAdjustedRetention,
  previewIntervals,
  selectDue,
  reviewLoadForecast,
} from "./scheduling";
import { rankPriorities, masteryForGrade, chooseAction, type PriorityInput } from "./priority";
import {
  difficultyForTargetSuccess,
  successProbability,
  decideNextMove,
  interleaveByTopic,
  selectNext,
  type SelectionContext,
} from "./adaptive";
import { computeReadiness, forecastGrade, normalCdf, gradeFromPercentage } from "./readiness";
import { generateSession, generatePlan, planPhases } from "./planner";
import { buildLossProfile, mistakeStatus, repairLadder, dueForRedo, type Mistake } from "./mistakes";
import { markObjectively, scoreLedger, overallDifficulty, EVEN_DIFFICULTY, type Question, type Attempt } from "./question";
import { aoMarkSplit, aoTotals, minutesPerMark, effectiveExamWeight, absoluteExamWeight, type Syllabus } from "./curriculum";
import { calibration, rollupByDay, studyStreak, type LearningEvent } from "./events";
import { buildPeriodReport, consistency } from "./review-report";
import { addDays, id } from "./types";

const NOW = "2026-03-01T09:00:00.000Z";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mkQuestion(over: Partial<Question> = {}): Question {
  return {
    id: id.question("q1"),
    syllabusId: id.syllabus("s1"),
    version: 1,
    type: "mcq",
    source: { kind: "original", licence: "owned" },
    topicIds: [id.topic("t1")],
    marks: 4,
    timeSeconds: 240,
    prompt: "Prompt",
    markScheme: { totalMarks: 4, style: "points" },
    difficulty: { ...EVEN_DIFFICULTY },
    ...over,
  };
}

function mkAttempt(fraction: number, at: string, over: Partial<Attempt> = {}): Attempt {
  return {
    id: id.attempt(`a-${at}-${fraction}`),
    questionId: id.question("q1"),
    questionVersion: 1,
    startedAt: at,
    submittedAt: at,
    timeSpent: 120,
    response: { kind: "text", text: "answer" },
    score: fraction * 4,
    maxScore: 4,
    markedBy: "self",
    mode: "practice",
    ...over,
  };
}

function evidence(fractions: number[], difficulty = 0.5): MasteryEvidence[] {
  return fractions.map((f, i) => ({
    attempt: mkAttempt(f, addDays(NOW, -fractions.length + i)),
    question: {
      id: id.question(`q${i}`),
      marks: 4,
      difficulty: { ...EVEN_DIFFICULTY, knowledge: difficulty, reasoning: difficulty },
      type: "short-answer",
      topicIds: [id.topic("t1")],
      objectiveIds: [`o${i}`],
    },
  }));
}

// ---------------------------------------------------------------------------

describe("curriculum derivations", () => {
  const syllabus = {
    id: id.syllabus("s"),
    code: "0000",
    title: "T",
    subject: "S",
    qualificationId: "q",
    examBoardId: "b",
    version: { label: "v", firstExamYear: 2026, lastExamYear: 2028 },
    papers: [
      { id: id.paper("p1"), syllabusId: id.syllabus("s"), code: "1", name: "P1", durationMinutes: 75, rawMarks: 40, weightOfQualification: 0.2, stage: "as" as const, sections: [] },
      { id: id.paper("p4"), syllabusId: id.syllabus("s"), code: "4", name: "P4", durationMinutes: 75, rawMarks: 40, weightOfQualification: 0.2, stage: "a2" as const, sections: [] },
    ],
    assessmentObjectives: [
      { id: "ao1", code: "AO1", name: "Knowledge", description: "", weightByPaper: { p1: 0.35, p4: 0.15 } },
      { id: "ao3", code: "AO3", name: "Analysis", description: "", weightByPaper: { p1: 0.2, p4: 0.4 } },
    ],
    commandWords: [],
    topics: [
      { id: id.topic("a"), syllabusId: id.syllabus("s"), code: "1", title: "A", examWeight: 0.4 },
      { id: id.topic("b"), syllabusId: id.syllabus("s"), code: "2", title: "B" },
      { id: id.topic("c"), syllabusId: id.syllabus("s"), code: "3", title: "C" },
    ],
    objectives: [],
    skills: [],
  } satisfies Syllabus;

  it("converts AO percentages into raw marks per paper", () => {
    const split = aoMarkSplit(syllabus, id.paper("p4"));
    expect(split.find((r) => r.aoCode === "AO3")!.marks).toBe(16); // 40% of 40
    expect(split.find((r) => r.aoCode === "AO1")!.marks).toBe(6);
  });

  it("totals AO marks across papers", () => {
    const totals = aoTotals(syllabus);
    expect(totals.find((t) => t.aoCode === "AO1")!.marks).toBe(14 + 6);
  });

  it("computes minutes per mark", () => {
    expect(minutesPerMark(syllabus.papers[0]!)).toBeCloseTo(1.875, 3);
  });

  it("splits unclaimed exam weight evenly across siblings", () => {
    // A claims 0.4; B and C share the remaining 0.6.
    expect(effectiveExamWeight(syllabus, syllabus.topics[1]!)).toBeCloseTo(0.3, 5);
  });
});

describe("objective marking", () => {
  it("marks a single-answer MCQ exactly", () => {
    const q = mkQuestion({
      type: "mcq",
      marks: 1,
      markScheme: { totalMarks: 1, style: "points" },
      response: { choices: [{ id: "a", text: "A", correct: true }, { id: "b", text: "B", misconception: "Confuses X with Y" }] },
    });
    expect(markObjectively(q, { kind: "choice", selected: ["a"] })!.score).toBe(1);
    const wrong = markObjectively(q, { kind: "choice", selected: ["b"] })!;
    expect(wrong.score).toBe(0);
    expect(wrong.detail[0]).toContain("Confuses");
  });

  it("penalises false positives on multi-select", () => {
    const q = mkQuestion({
      type: "multi-select",
      marks: 2,
      markScheme: { totalMarks: 2, style: "points" },
      response: {
        choices: [
          { id: "a", text: "A", correct: true },
          { id: "b", text: "B", correct: true },
          { id: "c", text: "C" },
        ],
      },
    });
    expect(markObjectively(q, { kind: "choice", selected: ["a", "b"] })!.score).toBe(2);
    // 2 hits, 1 false positive ⇒ net 1 ⇒ 1 mark
    expect(markObjectively(q, { kind: "choice", selected: ["a", "b", "c"] })!.score).toBe(1);
  });

  it("detects the missing ×100 on a percentage answer", () => {
    const q = mkQuestion({
      type: "numeric",
      marks: 2,
      markScheme: { totalMarks: 2, style: "points", acceptedValues: [{ value: 25, unit: "%" }] },
    });
    const r = markObjectively(q, { kind: "numeric", value: 0.25 })!;
    expect(r.score).toBe(0);
    expect(r.detail.join(" ")).toContain("multiply by 100");
  });

  it("detects an inverted formula", () => {
    const q = mkQuestion({
      type: "numeric",
      marks: 2,
      markScheme: { totalMarks: 2, style: "points", acceptedValues: [{ value: 4 }] },
    });
    const r = markObjectively(q, { kind: "numeric", value: 0.25 })!;
    expect(r.detail.join(" ")).toContain("reciprocal");
  });

  it("credits adjacency in ordering questions", () => {
    const q = mkQuestion({
      type: "order",
      marks: 3,
      markScheme: { totalMarks: 3, style: "points" },
      response: { sequence: [{ id: "1", text: "a" }, { id: "2", text: "b" }, { id: "3", text: "c" }, { id: "4", text: "d" }] },
    });
    // All adjacencies preserved but rotated ⇒ partial, not zero.
    const r = markObjectively(q, { kind: "order", sequence: ["2", "3", "4", "1"] })!;
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(3);
  });

  it("refuses to mark written types objectively", () => {
    expect(markObjectively(mkQuestion({ type: "essay" }), { kind: "text", text: "x" })).toBeNull();
  });

  it("scores a mark-scheme ledger with partial credit", () => {
    const ms = {
      totalMarks: 4,
      style: "points" as const,
      points: [
        { id: "p1", text: "one", marks: 2 },
        { id: "p2", text: "two", marks: 2 },
      ],
    };
    expect(scoreLedger(ms, [
      { pointId: "p1", outcome: "hit", awarded: 2 },
      { pointId: "p2", outcome: "partial", awarded: 1 },
    ])).toBe(3);
  });
});

describe("mastery", () => {
  it("returns untested with no evidence", () => {
    const m = computeMastery([], { now: NOW });
    expect(m.band).toBe("untested");
    expect(m.confidence).toBe(0);
  });

  it("rewards correct answers on hard questions more than on easy ones", () => {
    const easy = updateAbility(0.5, 0.2, 1);
    const hard = updateAbility(0.5, 0.8, 1);
    expect(hard).toBeGreaterThan(easy);
  });

  it("punishes wrong answers on easy questions more than on hard ones", () => {
    const easy = updateAbility(0.5, 0.2, 0);
    const hard = updateAbility(0.5, 0.8, 0);
    expect(easy).toBeLessThan(hard);
  });

  it("does not award mastery for five easy correct answers", () => {
    const m = computeMastery(evidence([1, 1, 1, 1, 1], 0.15), { now: NOW, totalObjectives: 20 });
    // High ability, but no transfer, no coverage ⇒ not exam-ready.
    expect(m.band).not.toBe("exam-ready");
    expect(m.signals.transfer).toBe(0);
  });

  it("names the limiting signal", () => {
    const m = computeMastery(evidence([1, 1, 1, 1]), { now: NOW, totalObjectives: 50 });
    expect(["transfer", "coverage", "retention"]).toContain(m.limitingFactor);
  });

  it("penalises inconsistency", () => {
    const steady = computeMastery(evidence([0.7, 0.7, 0.7, 0.7, 0.7, 0.7]), { now: NOW });
    const swingy = computeMastery(evidence([1, 0.2, 1, 0.2, 1, 0.2]), { now: NOW });
    expect(steady.signals.consistency).toBeGreaterThan(swingy.signals.consistency);
  });

  it("models forgetting", () => {
    expect(retrievability(10, 0)).toBeCloseTo(1, 5);
    expect(retrievability(10, 10)).toBeCloseTo(Math.exp(-1), 5);
    expect(retrievability(10, 100)).toBeLessThan(0.01);
    expect(retentionState(0.95)).toBe("secure");
    expect(retentionState(0.2)).toBe("forgotten");
  });

  it("bands untested separately from fragile", () => {
    expect(bandFor(0, 0)).toBe("untested");
    expect(bandFor(0.1, 3)).toBe("fragile");
    expect(bandFor(0.9, 30)).toBe("exam-ready");
  });
});

describe("scheduler", () => {
  it("grows the interval on repeated good reviews", () => {
    let s = newMemoryState(NOW);
    const intervals: number[] = [];
    let now = NOW;
    for (let i = 0; i < 5; i++) {
      const out = review(s, 3, now);
      s = out.state;
      intervals.push(out.intervalDays);
      now = s.dueAt;
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]!).toBeGreaterThanOrEqual(intervals[i - 1]!);
    }
    expect(intervals[intervals.length - 1]!).toBeGreaterThan(intervals[0]!);
  });

  it("collapses stability on a lapse but never to zero", () => {
    let s = newMemoryState(NOW);
    s = review(s, 4, NOW).state;
    s = review(s, 4, s.dueAt).state;
    const before = s.stability;
    const after = review(s, 1, s.dueAt).state;
    expect(after.stability).toBeLessThan(before);
    expect(after.stability).toBeGreaterThan(0);
    expect(after.lapses).toBe(1);
    expect(after.streak).toBe(0);
  });

  it("never schedules past the exam date", () => {
    let s = newMemoryState(NOW);
    const examDate = addDays(NOW, 10);
    for (let i = 0; i < 6; i++) s = review(s, 4, NOW, { targetRetention: 0.9, maximumInterval: 365, examDate }).state;
    const out = review(s, 4, NOW, { targetRetention: 0.9, maximumInterval: 365, examDate });
    expect(out.intervalDays).toBeLessThanOrEqual(10);
    expect(out.because.join(" ")).toContain("before the exam");
  });

  it("raises target retention as the exam approaches", () => {
    expect(examAdjustedRetention(0.85, 200)).toBe(0.85);
    expect(examAdjustedRetention(0.85, 5)).toBeGreaterThan(0.9);
    expect(examAdjustedRetention(0.85, 2)).toBeGreaterThan(examAdjustedRetention(0.85, 10));
  });

  it("over-reviews items born from real mistakes", () => {
    const authored = newMemoryState(NOW, "authored");
    const fromMistake = newMemoryState(NOW, "mistake");
    expect(fromMistake.stability).toBeLessThan(authored.stability);
    const out = review(fromMistake, 3, NOW);
    expect(out.because.join(" ")).toContain("mark you actually lost");
  });

  it("inverts the forgetting curve correctly", () => {
    // R = exp(-t/S) ⇒ t = -S ln R.  S=10, R=0.9 ⇒ ~1.05 days
    expect(intervalForRetention(10, 0.9)).toBe(1);
    expect(intervalForRetention(100, 0.9)).toBe(11);
  });

  it("orders due items by marks at risk, not by due date", () => {
    const stale = { item: "trivia", state: { ...newMemoryState(addDays(NOW, -30)), reps: 3, stability: 2, lastReviewedAt: addDays(NOW, -30), dueAt: addDays(NOW, -20) }, importance: 0.05 };
    const heavy = { item: "core", state: { ...newMemoryState(addDays(NOW, -8)), reps: 3, stability: 10, lastReviewedAt: addDays(NOW, -8), dueAt: addDays(NOW, -1) }, importance: 0.95 };
    const due = selectDue([stale, heavy], NOW, 2);
    expect(due[0]!.item).toBe("core");
  });

  it("previews all four grades", () => {
    const p = previewIntervals(newMemoryState(NOW), NOW);
    expect(p[1]).toBeLessThanOrEqual(p[3]!);
    expect(p[3]).toBeLessThanOrEqual(p[4]!);
  });

  it("forecasts review load per day", () => {
    const states = [newMemoryState(NOW), { ...newMemoryState(NOW), dueAt: addDays(NOW, 2) }];
    const f = reviewLoadForecast(states, NOW, 5);
    expect(f).toHaveLength(5);
    expect(f.reduce((s, d) => s + d.due, 0)).toBe(2);
  });
});

describe("priority", () => {
  const base: PriorityInput = {
    topicId: id.topic("t"),
    topicTitle: "T",
    examWeight: 0.1,
    qualificationMarks: 200,
    mastery: computeMastery(evidence([0.5, 0.5, 0.5]), { now: NOW }),
    retention: 0.8,
    targetMastery: 0.88,
    estimatedMinutes: 30,
    dependents: 0,
  };

  it("prefers a heavy topic over a light one, all else equal", () => {
    const ranked = rankPriorities([
      { ...base, topicId: id.topic("heavy"), examWeight: 0.25 },
      { ...base, topicId: id.topic("light"), examWeight: 0.02 },
    ]);
    expect(ranked[0]!.topicId).toBe("heavy");
  });

  it("prefers a cheap fix over an expensive one of equal value", () => {
    const ranked = rankPriorities([
      { ...base, topicId: id.topic("cheap"), estimatedMinutes: 20 },
      { ...base, topicId: id.topic("dear"), estimatedMinutes: 240 },
    ]);
    expect(ranked[0]!.topicId).toBe("cheap");
  });

  it("does not recommend polishing an already-mastered topic", () => {
    const mastered = computeMastery(evidence([1, 1, 1, 1, 1, 1, 1, 1]), { now: NOW, totalObjectives: 8 });
    const ranked = rankPriorities([
      { ...base, topicId: id.topic("mastered"), mastery: mastered, retention: 0.95 },
      { ...base, topicId: id.topic("weak") },
    ]);
    expect(ranked[0]!.topicId).toBe("weak");
  });

  it("weights prerequisites above their own mark value", () => {
    const withDeps = rankPriorities([{ ...base, topicId: id.topic("hub"), dependents: 6 }])[0]!;
    const without = rankPriorities([{ ...base, topicId: id.topic("leaf"), dependents: 0 }])[0]!;
    expect(withDeps.marksPerHour).toBeGreaterThan(without.marksPerHour);
  });

  it("raises urgency as the exam nears", () => {
    const far = rankPriorities([{ ...base, daysToExam: 200 }])[0]!;
    const near = rankPriorities([{ ...base, daysToExam: 5 }])[0]!;
    expect(near.marksPerHour).toBeGreaterThan(far.marksPerHour);
  });

  it("always explains itself", () => {
    const r = rankPriorities([base])[0]!;
    expect(r.because.length).toBeGreaterThan(2);
    expect(r.because.join(" ")).toContain("marks per hour");
  });

  it("maps target grades to required mastery", () => {
    const scale = ["A*", "A", "B", "C", "D", "E", "U"];
    expect(masteryForGrade("A*", scale)).toBeGreaterThan(masteryForGrade("C", scale));
    expect(masteryForGrade("A*", scale)).toBeCloseTo(0.9, 2);
  });

  it("chooses review, not relearning, for decayed-but-able topics", () => {
    const m = computeMastery(evidence([1, 1, 1, 1]), { now: NOW, stabilityDays: 1 });
    const action = chooseAction({ ...base, mastery: m, retention: 0.2 });
    expect(["review", "practise", "stretch"]).toContain(action);
  });
});

describe("adaptive selection", () => {
  const ctx: SelectionContext = {
    ability: 0.6,
    session: [],
    streakWrong: 0,
    streakRight: 0,
    minutesLeft: 20,
    interleave: true,
  };

  it("targets roughly 75% success", () => {
    const d = difficultyForTargetSuccess(0.6);
    expect(successProbability(0.6, d)).toBeCloseTo(0.75, 2);
  });

  it("goes to the prerequisite after two wrong, not just easier", () => {
    expect(decideNextMove({ ...ctx, streakWrong: 2 }).move).toBe("prerequisite");
  });

  it("raises difficulty after three right", () => {
    expect(decideNextMove({ ...ctx, streakRight: 3 }).move).toBe("harder");
  });

  it("switches topic after two consecutive same-topic questions", () => {
    const move = decideNextMove({
      ...ctx,
      session: [
        { questionId: "a", topicId: id.topic("t1"), fraction: 1, difficulty: 0.5 },
        { questionId: "b", topicId: id.topic("t1"), fraction: 1, difficulty: 0.5 },
      ],
    });
    expect(move.move).toBe("different-topic");
  });

  it("stops when time is up", () => {
    expect(decideNextMove({ ...ctx, minutesLeft: 0 }).move).toBe("stop");
  });

  it("picks the candidate closest to target difficulty", () => {
    const mk = (qid: string, d: number) => ({
      question: { id: id.question(qid), topicIds: [id.topic("t1")], difficulty: { ...EVEN_DIFFICULTY, knowledge: d, reasoning: d, calculation: d, language: d, steps: d, unfamiliarContext: d }, type: "mcq" as const, marks: 1 },
      seenCount: 0,
    });
    const decision = { move: "same" as const, targetDifficulty: 0.4, because: "" };
    const res = selectNext([mk("far", 0.95), mk("near", 0.4)], decision, ctx, () => 0.5);
    expect(res.chosen!.question.id).toBe("near");
    expect(res.because.join(" ")).toContain("chance you get this right");
  });

  it("never puts two same-topic items adjacent when interleaving", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, topic: "A" })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, topic: "B" })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, topic: "C" })),
    ];
    const order = interleaveByTopic(items, (x) => x.topic);
    expect(order).toHaveLength(10);
    let adjacentSame = 0;
    for (let i = 1; i < order.length; i++) if (order[i]!.topic === order[i - 1]!.topic) adjacentSame++;
    expect(adjacentSame).toBe(0);
  });
});

describe("readiness and forecasting", () => {
  const mastery = computeMastery(evidence([0.8, 0.8, 0.8, 0.9]), { now: NOW, totalObjectives: 4 });
  const input = {
    topicMastery: [{ topicId: "t1", examWeight: 1, mastery }],
    syllabusCoverage: 0.8,
    meanRetention: 0.8,
    applicationRate: { earned: 30, available: 50 },
    techniqueRate: { earned: 20, available: 50 },
    timingRatio: 1.1,
    mocks: [
      { at: addDays(NOW, -20), fraction: 0.6 },
      { at: addDays(NOW, -10), fraction: 0.68 },
    ],
    totalObjectives: 40,
  };

  it("names the limiting dimension rather than hiding it in an average", () => {
    const r = computeReadiness(input);
    expect(r.limitingDimension!.key).toBe("technique");
    expect(r.dimensions).toHaveLength(8);
  });

  it("refuses to claim readiness without a mock", () => {
    const r = computeReadiness({ ...input, mocks: [] });
    expect(r.caveats.join(" ")).toContain("No full mock");
    expect(r.score).toBeLessThan(computeReadiness(input).score);
  });

  it("never returns a bare grade without a range", () => {
    const syllabus = { gradeThresholds: [], papers: [], assessmentObjectives: [] } as unknown as Syllabus;
    const r = computeReadiness(input);
    const f = forecastGrade(r, input, syllabus, "A");
    expect(f.range).toHaveLength(2);
    expect(f.percentage.low).toBeLessThan(f.percentage.high);
    expect(f.caveats.join(" ")).toContain("not a prediction");
  });

  it("widens the interval when evidence is thin but sufficient", () => {
    const syllabus = { gradeThresholds: [], papers: [], assessmentObjectives: [] } as unknown as Syllabus;
    // Just past the forecast threshold, with poor coverage and no mocks.
    const thin = {
      ...input,
      mocks: [],
      syllabusCoverage: 0.1,
      topicMastery: [
        { topicId: "t", examWeight: 1, mastery: computeMastery(evidence(Array(9).fill(0.8)), { now: NOW }) },
      ],
    };
    const wide = forecastGrade(computeReadiness(thin), thin, syllabus, "A");
    const narrow = forecastGrade(computeReadiness(input), input, syllabus, "A");
    expect(wide.sufficient).toBe(true);
    expect(wide.percentage.high - wide.percentage.low).toBeGreaterThan(narrow.percentage.high - narrow.percentage.low);
  });

  it("maps percentages through real thresholds when supplied", () => {
    const syllabus = {
      gradeThresholds: [{ session: "2025", thresholds: { "A*": 160, A: 140, B: 120, C: 100, U: 0 }, maxMark: 200 }],
    } as unknown as Syllabus;
    expect(gradeFromPercentage(0.85, syllabus.gradeThresholds!, syllabus)).toBe("A*");
    expect(gradeFromPercentage(0.72, syllabus.gradeThresholds!, syllabus)).toBe("A");
    expect(gradeFromPercentage(0.05, syllabus.gradeThresholds!, syllabus)).toBe("U");
  });

  it("has a sane normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
});

describe("session generation", () => {
  const priorities = rankPriorities([
    { topicId: id.topic("t1"), topicTitle: "Electrolysis", examWeight: 0.2, qualificationMarks: 200, mastery: computeMastery(evidence([0.3, 0.4]), { now: NOW }), retention: 0.5, targetMastery: 0.88, estimatedMinutes: 30, dependents: 2 },
    { topicId: id.topic("t2"), topicTitle: "Moles", examWeight: 0.15, qualificationMarks: 200, mastery: computeMastery(evidence([0.6, 0.7]), { now: NOW }), retention: 0.7, targetMastery: 0.88, estimatedMinutes: 30, dependents: 4 },
  ]);
  const titles = { t1: "Electrolysis", t2: "Moles" };

  it("fills exactly the requested time", () => {
    for (const minutes of [5, 10, 25, 45, 90]) {
      const s = generateSession({ minutes, priorities, titles, dueReviewCount: 12, openMistakeCount: 4 });
      expect(s.blocks.reduce((t, b) => t + b.minutes, 0)).toBe(minutes);
    }
  });

  it("leads with retrieval when reviews are due", () => {
    const s = generateSession({ minutes: 30, priorities, titles, dueReviewCount: 20, openMistakeCount: 0 });
    expect(s.blocks[0]!.kind).toBe("recall");
  });

  it("includes mistake repair when mistakes are open", () => {
    const s = generateSession({ minutes: 40, priorities, titles, dueReviewCount: 0, openMistakeCount: 5 });
    expect(s.blocks.some((b) => b.kind === "mistake-fix")).toBe(true);
  });

  it("switches to exam framing close to the exam", () => {
    const s = generateSession({ minutes: 45, priorities, titles, dueReviewCount: 5, openMistakeCount: 2, daysToExam: 3 });
    expect(s.blocks.some((b) => b.kind === "exam-question")).toBe(true);
  });

  it("gives every block a reason", () => {
    const s = generateSession({ minutes: 60, priorities, titles, dueReviewCount: 8, openMistakeCount: 3 });
    for (const b of s.blocks) expect(b.because.length).toBeGreaterThan(10);
  });

  it("plans phases that sum to the whole remaining period", () => {
    const phases = planPhases(NOW, addDays(NOW, 100));
    expect(phases).toHaveLength(5);
    expect(phases[0]!.from).toBe(NOW.slice(0, 10));
    expect(phases[4]!.to).toBe(addDays(NOW, 100).slice(0, 10));
  });

  it("warns rather than pretends when there is no exam date", () => {
    const plan = generatePlan({ now: NOW, weeklyMinutes: [0, 60, 60, 60, 60, 60, 0], priorities, titles });
    expect(plan.warnings.join(" ")).toContain("No exam date");
  });

  it("schedules rest days as rest, not as failure", () => {
    const plan = generatePlan({ now: NOW, weeklyMinutes: [0, 60, 60, 60, 60, 60, 0], priorities, titles, horizonDays: 14 });
    expect(plan.days.filter((d) => d.isRestDay).length).toBeGreaterThan(0);
  });
});

describe("mistake lab", () => {
  const mk = (over: Partial<Mistake>): Mistake => ({
    id: id.mistake("m"),
    questionId: id.question("q"),
    topicIds: [id.topic("t1")],
    category: "no-chain",
    marksLost: 2,
    studentAnswer: "x",
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    occurrences: 1,
    cleanRunsSince: 0,
    status: "open",
    ...over,
  });

  it("requires three clean runs before declaring a mistake eliminated", () => {
    expect(mistakeStatus({ occurrences: 1, cleanRunsSince: 1 })).toBe("repairing");
    expect(mistakeStatus({ occurrences: 1, cleanRunsSince: 2 })).toBe("repairing");
    expect(mistakeStatus({ occurrences: 1, cleanRunsSince: 3 })).toBe("eliminated");
  });

  it("flags recurring mistakes", () => {
    expect(mistakeStatus({ occurrences: 3, cleanRunsSince: 0 })).toBe("recurring");
  });

  it("identifies technique-dominated mark loss and says to stop revising content", () => {
    const profile = buildLossProfile([
      mk({ category: "no-chain", marksLost: 6 }),
      mk({ category: "no-judgement", marksLost: 5 }),
      mk({ category: "no-application", marksLost: 4 }),
      mk({ category: "knowledge-gap", marksLost: 2 }),
    ]);
    expect(profile.techniqueShare).toBeGreaterThan(0.55);
    expect(profile.prescription).toContain("Stop revising content");
    expect(profile.headline).toContain("lost marks are technique");
  });

  it("routes knowledge gaps through explanation before questions", () => {
    expect(repairLadder("knowledge-gap")[0]!.kind).toBe("explain");
    expect(repairLadder("no-judgement")[0]!.kind).toBe("drill");
  });

  it("prioritises recurring, costly mistakes for redo", () => {
    const cheapOnce = mk({ id: id.mistake("cheap"), marksLost: 1, occurrences: 1 });
    const costlyRepeat = mk({ id: id.mistake("costly"), marksLost: 5, occurrences: 4 });
    expect(dueForRedo([cheapOnce, costlyRepeat], NOW)[0]!.id).toBe("costly");
  });

  it("excludes eliminated mistakes from redo", () => {
    const done = mk({ id: id.mistake("done"), status: "eliminated" });
    expect(dueForRedo([done], NOW)).toHaveLength(0);
  });
});

describe("analytics", () => {
  const events: LearningEvent[] = [
    { type: "question_answered", at: `${NOW.slice(0, 10)}T10:00:00Z`, questionId: "q1", topicIds: ["t"], score: 4, maxScore: 4, timeSpent: 100, confidence: 4, mode: "practice" },
    { type: "question_answered", at: `${NOW.slice(0, 10)}T10:05:00Z`, questionId: "q2", topicIds: ["t"], score: 0, maxScore: 4, timeSpent: 100, confidence: 4, mode: "practice" },
    { type: "question_answered", at: `${NOW.slice(0, 10)}T10:10:00Z`, questionId: "q3", topicIds: ["t"], score: 0, maxScore: 4, timeSpent: 100, confidence: 4, mode: "practice" },
    { type: "question_answered", at: `${NOW.slice(0, 10)}T10:15:00Z`, questionId: "q4", topicIds: ["t"], score: 4, maxScore: 4, timeSpent: 100, confidence: 1, mode: "practice" },
  ];

  it("rolls up by day", () => {
    const r = rollupByDay(events);
    expect(r).toHaveLength(1);
    expect(r[0]!.questionsAnswered).toBe(4);
    expect(r[0]!.marksEarned).toBe(8);
  });

  it("detects overconfidence", () => {
    const many = Array.from({ length: 16 }, (_, i) => events[i % 4]!);
    const c = calibration(many);
    expect(c.overconfidence).toBeGreaterThan(0);
  });

  it("counts a streak that survives an empty today", () => {
    const rollups = [
      { date: "2026-02-27", questionsAnswered: 3, marksEarned: 1, marksAvailable: 4, minutesStudied: 5, cardsReviewed: 0, mistakesFixed: 0 },
      { date: "2026-02-28", questionsAnswered: 3, marksEarned: 1, marksAvailable: 4, minutesStudied: 5, cardsReviewed: 0, mistakesFixed: 0 },
    ];
    expect(studyStreak(rollups, "2026-03-01")).toBe(2);
  });
});

describe("difficulty", () => {
  it("weights reasoning above knowledge", () => {
    const reasoningHard = overallDifficulty({ ...EVEN_DIFFICULTY, reasoning: 1, knowledge: 0 });
    const knowledgeHard = overallDifficulty({ ...EVEN_DIFFICULTY, reasoning: 0, knowledge: 1 });
    expect(reasoningHard).toBeGreaterThan(knowledgeHard);
  });

  it("respects an explicit overall override", () => {
    expect(overallDifficulty({ ...EVEN_DIFFICULTY, overall: 0.123 })).toBe(0.123);
  });
});

describe("absolute exam weight", () => {
  const syllabus = {
    id: "s", code: "0", title: "T", subject: "S", qualificationId: "q", examBoardId: "b",
    version: { label: "v", firstExamYear: 2026, lastExamYear: 2028 },
    papers: [], assessmentObjectives: [], commandWords: [], objectives: [], skills: [],
    topics: [
      { id: "sec1", syllabusId: "s", code: "1", title: "Section 1", examWeight: 0.5 },
      { id: "sec2", syllabusId: "s", code: "2", title: "Section 2", examWeight: 0.5 },
      { id: "a", syllabusId: "s", code: "1.1", title: "A", parentId: "sec1" },
      { id: "b", syllabusId: "s", code: "1.2", title: "B", parentId: "sec1" },
      { id: "c", syllabusId: "s", code: "2.1", title: "C", parentId: "sec2" },
    ],
  } as unknown as Syllabus;

  it("multiplies through the ancestor chain", () => {
    // A is half of Section 1, which is half of the qualification ⇒ 25%.
    expect(absoluteExamWeight(syllabus, syllabus.topics[2]!)).toBeCloseTo(0.25, 5);
    // C is the only child of Section 2 ⇒ the whole 50%.
    expect(absoluteExamWeight(syllabus, syllabus.topics[4]!)).toBeCloseTo(0.5, 5);
  });

  it("leaf weights across the syllabus sum to one", () => {
    const leaves = syllabus.topics.filter((t) => !syllabus.topics.some((c) => c.parentId === t.id));
    const total = leaves.reduce((s, t) => s + absoluteExamWeight(syllabus, t), 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("survives a malformed pack that describes a cycle", () => {
    const cyclic = {
      ...syllabus,
      topics: [
        { id: "x", syllabusId: "s", code: "x", title: "X", parentId: "y" },
        { id: "y", syllabusId: "s", code: "y", title: "Y", parentId: "x" },
      ],
    } as unknown as Syllabus;
    expect(() => absoluteExamWeight(cyclic, cyclic.topics[0]!)).not.toThrow();
  });
});

describe("forecast honesty", () => {
  const syllabus = { gradeThresholds: [], papers: [], assessmentObjectives: [] } as unknown as Syllabus;

  const inputWith = (attempts: number, mocks: { at: string; fraction: number }[] = []) => ({
    topicMastery: [
      { topicId: "t", examWeight: 1, mastery: computeMastery(evidence(Array(attempts).fill(0.7)), { now: NOW }) },
    ],
    syllabusCoverage: 0.5,
    meanRetention: 0.7,
    mocks,
    totalObjectives: 10,
  });

  it("refuses to project a grade from no evidence at all", () => {
    const input = inputWith(0);
    const f = forecastGrade(computeReadiness(input), input, syllabus, "A*");
    expect(f.sufficient).toBe(false);
    expect(f.central).toBe("—");
    expect(f.targetProbability.because.join(" ")).toContain("nothing to project from");
  });

  it("refuses to project from a handful of questions", () => {
    const input = inputWith(3);
    const f = forecastGrade(computeReadiness(input), input, syllabus, "A");
    expect(f.sufficient).toBe(false);
  });

  it("projects once there is enough evidence", () => {
    const input = inputWith(12);
    const f = forecastGrade(computeReadiness(input), input, syllabus, "A");
    expect(f.sufficient).toBe(true);
    expect(f.central).not.toBe("—");
    expect(f.percentage.low).toBeLessThan(f.percentage.high);
  });

  it("projects from a single mock even with few questions", () => {
    const input = inputWith(2, [{ at: NOW, fraction: 0.62 }]);
    const f = forecastGrade(computeReadiness(input), input, syllabus, "A");
    expect(f.sufficient).toBe(true);
  });
});

describe("period reports", () => {
  const day = (n: number) => addDays(NOW, -n);
  const answer = (at: string, score: number, max: number, topic = "t1"): LearningEvent => ({
    type: "question_answered", at, questionId: `q-${at}-${score}`, topicIds: [topic],
    score, maxScore: max, timeSpent: 120, mode: "practice",
  });
  const loss = (at: string, category: string, marks: number): LearningEvent => ({
    type: "mark_lost", at, questionId: "q", topicIds: ["t1"], category: category as never, marks,
  });

  it("refuses to draw conclusions from a quiet week", () => {
    const r = buildPeriodReport([answer(day(2), 3, 4)], NOW, 7, "This week");
    expect(r.quiet).toBe(true);
    expect(r.instruction).toContain("Too little to draw conclusions");
  });

  it("identifies an entrenched failure across two periods", () => {
    const events: LearningEvent[] = [];
    for (let i = 0; i < 8; i++) events.push(answer(day(i % 6), 2, 4));
    for (let i = 0; i < 8; i++) events.push(answer(day(8 + (i % 6)), 2, 4));
    for (let i = 0; i < 4; i++) events.push(loss(day(i), "no-chain", 2));
    for (let i = 0; i < 4; i++) events.push(loss(day(9 + i), "no-chain", 2));
    const r = buildPeriodReport(events, NOW, 7, "This week");
    expect(r.recurringLoss?.category).toBe("no-chain");
    expect(r.headline).toContain("did last period too");
    expect(r.instruction).toContain("entrenched");
  });

  it("does not report topic movement from thin evidence", () => {
    const events = [answer(day(1), 4, 4, "t1"), answer(day(9), 0, 4, "t1")];
    const r = buildPeriodReport(events, NOW, 7, "This week");
    expect(r.topicsImproved).toHaveLength(0);
    expect(r.topicsSlipped).toHaveLength(0);
  });

  it("reads a fall in accuracy as possible difficulty increase, not decline", () => {
    const events: LearningEvent[] = [];
    for (let i = 0; i < 6; i++) events.push(answer(day(i), 1, 4));
    for (let i = 0; i < 6; i++) events.push(answer(day(8 + i), 4, 4));
    const r = buildPeriodReport(events, NOW, 7, "This week");
    expect(r.accuracyChange).toBeLessThan(0);
    expect(r.instruction).toContain("difficulty rose");
  });
});
