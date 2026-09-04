/**
 * The content has to be true, not just present.
 *
 * A worked example whose stated answer the marker would reject, or a likelihood
 * row that does not sum to 1, is a bug the student meets rather than the build
 * does — so both are checked here mechanically.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { grade } from "../../server/src/grading/grade.ts";
import { QUESTIONS, CONCEPTS, WORKSHEETS, questionById, conceptById } from "../src/app/bank.js";
import { DIAGNOSTICS } from "../src/app/diagnostics.js";
import * as eig from "../src/learning/eig.js";

describe("question bank", () => {
  test("every expected answer is marked correct by the real grader", () => {
    for (const q of QUESTIONS) {
      for (const e of q.expected) {
        const r = grade(e.text, q.expected);
        assert.equal(r.verdict, "correct", `${q.id} rejects its own answer ${e.text}: ${r.reason}`);
      }
    }
  });

  test("student notation for the same answers is accepted", () => {
    const typed = {
      "li-1": "x=5", "li-2": "x = -3", "qu-1": "x=2 or x=3", "qu-2": "3, -5",
      "qu-3": "2, -2", "qu-4": "0, 6", "tr-3": "1/sqrt 2", "fr-3": "1 1/4",
      "ex-1": "x^2-2x-15", "ex-3": "(x + 4)(x + 3)",
    };
    for (const [id, text] of Object.entries(typed)) {
      assert.equal(grade(text, questionById[id].expected).verdict, "correct", `${id} rejected ${text}`);
    }
  });

  test("every question has all five rungs of help", () => {
    for (const q of QUESTIONS) {
      for (const field of ["nudge", "hint", "explain"]) {
        assert.ok(q[field] && q[field].length > 20, `${q.id} has no useful ${field}`);
      }
      assert.ok(q.solution && q.solution.length > 0, `${q.id} has no solution`);
      assert.ok(Array.isArray(q.steps) && q.steps.length >= 2, `${q.id} has too few steps`);
    }
  });

  test("every question belongs to a declared concept and a worksheet", () => {
    const placed = new Set(WORKSHEETS.flatMap((w) => w.questionIds));
    for (const q of QUESTIONS) {
      assert.ok(conceptById[q.conceptId], `${q.id} names an unknown concept`);
      assert.ok(placed.has(q.id), `${q.id} appears on no worksheet`);
    }
  });

  test("concept prerequisites all exist", () => {
    for (const c of CONCEPTS) {
      for (const p of c.prerequisites) assert.ok(conceptById[p], `${c.id} needs unknown ${p}`);
    }
  });
});

describe("diagnostics", () => {
  test("priors and every likelihood row sum to 1", () => {
    for (const d of DIAGNOSTICS) {
      const priors = d.hypotheses.reduce((s, h) => s + h.prior, 0);
      assert.ok(Math.abs(priors - 1) < 1e-9, `${d.conceptId} priors sum to ${priors}`);
      for (const q of d.questions) {
        for (const h of d.hypotheses) {
          const row = q.likelihoods[h.id];
          assert.ok(row, `${q.id} has no row for ${h.id}`);
          const total = Object.values(row).reduce((a, b) => a + b, 0);
          assert.ok(Math.abs(total - 1) < 1e-9, `${q.id}/${h.id} sums to ${total}`);
          for (const key of Object.keys(row)) {
            assert.ok(q.options.some((o) => o.response === key), `${q.id} scores unofferable response ${key}`);
          }
        }
      }
    }
  });

  test("a question that separates nothing is ranked last", () => {
    const d = DIAGNOSTICS.find((x) => x.conceptId === "linear-equations");
    const ranked = eig.rank(eig.priorMap(d.hypotheses), d.questions);
    assert.equal(ranked[ranked.length - 1].question.id, "lq-e");
    assert.ok(ranked[0].score > ranked[ranked.length - 1].score * 5,
      "the control question is not clearly worse than the informative ones");
  });

  test("each diagnostic finds a seeded misconception within four questions", () => {
    for (const d of DIAGNOSTICS) {
      for (const truth of d.hypotheses.map((h) => h.id)) {
        if (truth === "fluent") continue;
        let run = eig.newRun(d.hypotheses);
        let asked = 0;
        while (asked < 4 && !eig.isConfident(run, 0.8)) {
          const q = eig.selectNext(run.prior, d.questions, run.asked);
          if (!q) break;
          // A student whose only problem is `truth` answers as that hypothesis predicts.
          const response = Object.entries(q.likelihoods[truth]).sort((a, b) => b[1] - a[1])[0][0];
          run = eig.observe(run, q, response);
          asked += 1;
        }
        assert.equal(eig.leading(run).id, truth,
          `${d.conceptId}: seeded ${truth}, concluded ${eig.leading(run).id} after ${asked}`);
        assert.ok(asked <= 4, `${d.conceptId}/${truth} took ${asked} questions`);
      }
    }
  });
});
