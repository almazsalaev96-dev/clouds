"""Behavioural tests for the learning engine.

These assert what the model must *believe*, not what it currently computes. A golden
fixture catches drift; these catch the model being wrong in a way that would mislead a
student.
"""

import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from slatelearn import (  # noqa: E402
    eig, engine, intervention, mastery, misconception, nextaction, scheduling,
)
from slatelearn.engine import QuestionResult  # noqa: E402
from slatelearn.nextaction import (  # noqa: E402
    ActionKind, AssignmentSnapshot, Concept, SessionContext,
)
from slatelearn.types import (  # noqa: E402
    Assistance, Attempt, AttemptKind, ConceptState, ErrorType, MasteryState, Outcome,
)

T0 = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)


def seq(concept, spec, day_step=1.0, start=0.0):
    out = []
    for i, item in enumerate(spec):
        err = item[3] if len(item) > 3 else None
        out.append(Attempt(concept, T0 + timedelta(days=start + i * day_step),
                           item[0], item[1], item[2], error_type=err,
                           session_id=f"{concept}-{i}", question_id=f"{concept}-q{i}"))
    return out


def fold(attempts):
    return engine.fold(attempts)[attempts[0].concept_id]


C, I, P = Outcome.CORRECT, Outcome.INCORRECT, Outcome.PARTIAL
PRACTICE = AttemptKind.PRACTICE


class TestEvidenceWeighting(unittest.TestCase):
    def test_solutions_never_produce_ability(self):
        st = fold(seq("x", [(C, Assistance.SOLUTION, PRACTICE)] * 8))
        self.assertEqual(mastery.evidence_strength(st), 0.0)
        self.assertEqual(mastery.fresh_state(st), MasteryState.INTRODUCED)

    def test_help_is_discounted_not_ignored(self):
        unaided = fold(seq("a", [(C, Assistance.NONE, PRACTICE)] * 4))
        hinted = fold(seq("b", [(C, Assistance.HINT, PRACTICE)] * 4))
        self.assertGreater(mastery.predicted_p(unaided), mastery.predicted_p(hinted))
        self.assertGreater(mastery.predicted_p(hinted), 0.4)

    def test_hints_cannot_reach_reliable(self):
        st = fold(seq("b", [(C, Assistance.HINT, PRACTICE)] * 12))
        self.assertLess(mastery.fresh_state(st).rank, MasteryState.RELIABLE.rank)

    def test_unreadable_work_changes_nothing_but_the_count(self):
        base = seq("r", [(C, Assistance.NONE, PRACTICE)] * 2)
        with_noise = base + [Attempt("r", T0 + timedelta(days=2), I,
                                     error_type=ErrorType.UNREADABLE, session_id="r-x")]
        a, b = fold(base), fold(with_noise)
        self.assertAlmostEqual(mastery.predicted_p(a), mastery.predicted_p(b), places=12)
        self.assertAlmostEqual(a.stability, b.stability, places=12)
        self.assertEqual(b.attempts, a.attempts + 1)

    def test_careless_slip_costs_less_than_a_knowledge_gap(self):
        careless = fold(seq("c", [(C, Assistance.NONE, PRACTICE),
                                  (C, Assistance.NONE, PRACTICE),
                                  (I, Assistance.NONE, PRACTICE, ErrorType.CARELESS)]))
        gap = fold(seq("g", [(C, Assistance.NONE, PRACTICE),
                             (C, Assistance.NONE, PRACTICE),
                             (I, Assistance.NONE, PRACTICE, ErrorType.KNOWLEDGE_GAP)]))
        self.assertGreater(mastery.predicted_p(careless), mastery.predicted_p(gap))
        self.assertGreater(careless.stability, gap.stability)


class TestMasteryProgression(unittest.TestCase):
    def test_unaided_practice_reaches_reliable(self):
        st = fold(seq("x", [(C, Assistance.NONE, PRACTICE)] * 6))
        self.assertEqual(mastery.fresh_state(st), MasteryState.RELIABLE)

    def test_mastery_needs_transfer_and_retention_separately(self):
        base = seq("x", [(C, Assistance.NONE, PRACTICE)] * 6)
        transfer = base + [Attempt("x", T0 + timedelta(days=10), C, Assistance.NONE,
                                   AttemptKind.TRANSFER, session_id="t")]
        self.assertEqual(fold(transfer).transfer_correct, 1)
        self.assertEqual(fold(transfer).retention_correct, 0,
                         "one attempt must not satisfy both requirements")
        self.assertEqual(mastery.fresh_state(fold(transfer)), MasteryState.TRANSFERABLE)

        full = transfer + [Attempt("x", T0 + timedelta(days=20), C, Assistance.NONE,
                                   AttemptKind.RETRIEVAL, session_id="r")]
        self.assertEqual(mastery.fresh_state(fold(full)), MasteryState.MASTERED)

    def test_single_correct_answer_is_never_mastery(self):
        st = fold(seq("x", [(C, Assistance.NONE, PRACTICE)]))
        self.assertLess(mastery.fresh_state(st).rank, MasteryState.RELIABLE.rank)

    def test_one_session_cannot_be_reliable(self):
        atts = [Attempt("x", T0 + timedelta(minutes=5 * i), C, Assistance.NONE,
                        PRACTICE, session_id="one") for i in range(8)]
        self.assertLess(mastery.fresh_state(fold(atts)).rank, MasteryState.RELIABLE.rank)

    def test_failures_pull_ability_down(self):
        good = fold(seq("x", [(C, Assistance.NONE, PRACTICE)] * 4))
        mixed = fold(seq("y", [(C, Assistance.NONE, PRACTICE),
                               (I, Assistance.NONE, PRACTICE),
                               (C, Assistance.NONE, PRACTICE),
                               (I, Assistance.NONE, PRACTICE)]))
        self.assertGreater(mastery.predicted_p(good), mastery.predicted_p(mixed))

    def test_partial_credit_sits_between(self):
        p = [mastery.predicted_p(fold(seq(k, [(o, Assistance.NONE, PRACTICE)] * 3)))
             for k, o in (("a", I), ("b", P), ("c", C))]
        self.assertLess(p[0], p[1])
        self.assertLess(p[1], p[2])


class TestMemory(unittest.TestCase):
    def test_retrievability_decays_monotonically(self):
        vals = [mastery.retrievability(8.0, d) for d in range(0, 200, 7)]
        self.assertEqual(vals, sorted(vals, reverse=True))
        self.assertAlmostEqual(vals[0], 1.0, places=9)
        self.assertGreater(vals[-1], 0.0)

    def test_spacing_effect_beats_cramming(self):
        crammed = fold([Attempt("x", T0 + timedelta(minutes=10 * i), C,
                                Assistance.NONE, PRACTICE, session_id=f"s{i}")
                        for i in range(5)])
        spaced = fold([Attempt("x", T0 + timedelta(days=3 * i), C,
                               Assistance.NONE, PRACTICE, session_id=f"s{i}")
                       for i in range(5)])
        self.assertGreater(spaced.stability, crammed.stability,
                           "reviewing a nearly-forgotten memory must be worth more")

    def test_lapse_does_not_reset_stability(self):
        built = fold(seq("x", [(C, Assistance.NONE, PRACTICE)] * 5))
        after = mastery.apply(built, Attempt("x", T0 + timedelta(days=60), I,
                                             Assistance.NONE, AttemptKind.RETRIEVAL,
                                             session_id="z"))
        self.assertLess(after.stability, built.stability)
        self.assertGreater(after.stability, mastery.S_MIN)

    def test_mastery_expires_without_review(self):
        atts = seq("x", [(C, Assistance.NONE, PRACTICE)] * 6)
        atts += [Attempt("x", T0 + timedelta(days=10), C, Assistance.NONE,
                         AttemptKind.TRANSFER, session_id="t"),
                 Attempt("x", T0 + timedelta(days=20), C, Assistance.NONE,
                         AttemptKind.RETRIEVAL, session_id="r")]
        st = fold(atts)
        self.assertEqual(mastery.fresh_state(st), MasteryState.MASTERED)
        later = st.last_reviewed + timedelta(days=400)
        self.assertLess(mastery.effective_state(st, later).rank,
                        MasteryState.MASTERED.rank)

    def test_difficulty_is_mean_reverting(self):
        st = fold(seq("x", [(I, Assistance.NONE, PRACTICE)] * 3))
        hard = st.difficulty
        for i in range(20):
            st = mastery.apply(st, Attempt("x", T0 + timedelta(days=10 + i), C,
                                           Assistance.NONE, PRACTICE, session_id=f"k{i}"))
        self.assertLess(st.difficulty, hard)
        self.assertGreaterEqual(st.difficulty, mastery.D_MIN)


class TestScheduling(unittest.TestCase):
    def test_interval_grows_with_stability(self):
        vals = [scheduling.interval_days(s) for s in [1, 5, 20, 100]]
        self.assertEqual(vals, sorted(vals))

    def test_exam_proximity_shortens_intervals(self):
        far = scheduling.interval_days(20.0, scheduling.ReviewContext())
        near = scheduling.interval_days(20.0, scheduling.ReviewContext(days_until_exam=10))
        soon = scheduling.interval_days(20.0, scheduling.ReviewContext(days_until_exam=2))
        self.assertGreater(far, near)
        self.assertGreater(near, soon)

    def test_unlearned_concept_has_no_forgetting_risk(self):
        st = fold(seq("x", [(I, Assistance.HINT, PRACTICE)] * 3))
        self.assertEqual(scheduling.forgetting_risk(st, T0 + timedelta(days=90)), 0.0)

    def test_known_concept_accrues_risk_over_time(self):
        st = fold(seq("x", [(C, Assistance.NONE, PRACTICE)] * 5))
        r1 = scheduling.forgetting_risk(st, st.last_reviewed + timedelta(days=5))
        r2 = scheduling.forgetting_risk(st, st.last_reviewed + timedelta(days=90))
        self.assertGreater(r2, r1)


class TestMisconceptions(unittest.TestCase):
    def _repeats(self, n, etype=ErrorType.CALCULATION, concepts=3):
        now = T0 + timedelta(days=30)
        return now, [Attempt(f"t{i % concepts}", now - timedelta(days=i), I,
                             error_type=etype, question_id=f"q{i}") for i in range(n)]

    def test_two_mistakes_are_not_a_pattern(self):
        now, atts = self._repeats(2)
        self.assertEqual(misconception.detect(atts, now), [])

    def test_three_across_questions_is_a_pattern(self):
        now, atts = self._repeats(4)
        found = misconception.detect(atts, now)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].error_type, ErrorType.CALCULATION)
        self.assertEqual(found[0].distinct_concepts, 3)
        self.assertIn("across 3 topics", misconception.headline(found[0]))

    def test_recent_patterns_outrank_stale_ones(self):
        now = T0 + timedelta(days=100)
        stale = [Attempt("a", now - timedelta(days=80 + i), I,
                         error_type=ErrorType.READING, question_id=f"s{i}")
                 for i in range(5)]
        fresh = [Attempt("b", now - timedelta(days=i), I,
                         error_type=ErrorType.CALCULATION, question_id=f"f{i}")
                 for i in range(3)]
        found = misconception.detect(stale + fresh, now)
        self.assertEqual(found[0].error_type, ErrorType.CALCULATION)

    def test_correct_answers_are_never_patterns(self):
        now = T0
        atts = [Attempt("a", now, C, error_type=ErrorType.CALCULATION,
                        question_id=f"q{i}") for i in range(6)]
        self.assertEqual(misconception.detect(atts, now), [])


class TestInformationGain(unittest.TestCase):
    def setUp(self):
        self.h = [eig.Hypothesis(k, k, 1.0) for k in ("formula", "sign", "algebra", "none")]
        self.prior = eig.prior_map(self.h)

    def test_uninformative_question_scores_zero(self):
        q = eig.CandidateQuestion("flat", "", {h.id: {"correct": .5, "other": .5}
                                               for h in self.h})
        self.assertAlmostEqual(eig.expected_information_gain(self.prior, q), 0.0, places=12)

    def test_perfectly_splitting_question_scores_one_bit(self):
        q = eig.CandidateQuestion("split", "", {
            "formula": {"a": 1.0}, "sign": {"a": 1.0},
            "algebra": {"b": 1.0}, "none": {"b": 1.0}})
        self.assertAlmostEqual(eig.expected_information_gain(self.prior, q), 1.0, places=9)

    def test_fully_identifying_question_scores_full_entropy(self):
        q = eig.CandidateQuestion("id", "", {
            h.id: {h.id: 1.0} for h in self.h})
        self.assertAlmostEqual(eig.expected_information_gain(self.prior, q), 2.0, places=9)

    def test_impossible_observation_keeps_the_prior(self):
        q = eig.CandidateQuestion("q", "", {h.id: {"a": 1.0} for h in self.h})
        self.assertEqual(eig.posterior(self.prior, q, "never-seen"), self.prior)

    def test_adaptive_run_identifies_the_real_cause(self):
        cands = [
            eig.CandidateQuestion("signProbe", "", {
                "formula": {"correct": .85, "signError": .10, "other": .05},
                "sign": {"correct": .10, "signError": .85, "other": .05},
                "algebra": {"correct": .55, "signError": .20, "other": .25},
                "none": {"correct": .95, "signError": .03, "other": .02}}, 1.0),
            eig.CandidateQuestion("formulaProbe", "", {
                "formula": {"correct": .10, "wrongFormula": .85, "other": .05},
                "sign": {"correct": .80, "wrongFormula": .10, "other": .10},
                "algebra": {"correct": .50, "wrongFormula": .20, "other": .30},
                "none": {"correct": .95, "wrongFormula": .03, "other": .02}}, 1.0),
        ]
        run = eig.run_adaptive(
            self.h, cands,
            lambda q: "signError" if "signError" in q.responses() else "correct")
        self.assertEqual(run.leading[0], "sign")
        self.assertTrue(run.is_confident())
        self.assertLess(run.remaining_uncertainty(), 1.0)

    def test_it_stops_asking_once_confident(self):
        cands = [eig.CandidateQuestion(f"q{i}", "", {
            "formula": {"a": .05, "b": .95}, "sign": {"a": .95, "b": .05},
            "algebra": {"a": .5, "b": .5}, "none": {"a": .05, "b": .95}}, 1.0)
            for i in range(6)]
        run = eig.run_adaptive(self.h, cands, lambda q: "a", max_questions=6)
        self.assertLess(len(run.asked), 6)


class TestNextAction(unittest.TestCase):
    def setUp(self):
        self.now = T0 + timedelta(days=30)
        self.concepts = [
            Concept("cts", "Completing the square", "Maths", ("fact",), 1.3, 2),
            Concept("fact", "Factorising", "Maths", (), 1.0),
            Concept("graphs", "Quadratic graphs", "Maths", ("cts",), 1.1),
        ]
        self.states = engine.fold(
            seq("cts", [(I, Assistance.HINT, PRACTICE)] * 3, start=27) +
            seq("fact", [(C, Assistance.NONE, PRACTICE)] * 4, start=0) +
            seq("graphs", [(C, Assistance.NONE, PRACTICE)] * 5, start=25))

    def rec(self, **kw):
        due = kw.pop("due_hours", 20.0)
        asg = [AssignmentSnapshot("a1", "Worksheet", "Physics",
                                  self.now + timedelta(hours=due), 18, 12, ("graphs",))]
        ctx = SessionContext(now=self.now, **kw)
        return nextaction.recommend(self.states, self.concepts, asg, ctx)

    def test_imminent_deadline_wins(self):
        self.assertEqual(self.rec(due_hours=6)[0].kind, ActionKind.FINISH_ASSIGNMENT)

    def test_distant_deadline_yields_to_learning(self):
        self.assertNotEqual(self.rec(due_hours=200)[0].kind, ActionKind.FINISH_ASSIGNMENT)

    def test_forgotten_material_is_recall_not_reteaching(self):
        recs = self.rec(due_hours=200)
        fix = [r for r in recs if r.kind is ActionKind.FIX_WEAKNESS
               and "fact" in r.concept_ids]
        review = [r for r in recs if r.kind is ActionKind.RETRIEVAL_REVIEW
                  and "fact" in r.concept_ids]
        self.assertEqual(fix, [], "a known-but-faded concept is not a knowledge gap")
        self.assertTrue(review)

    def test_rest_can_win_when_genuinely_tired(self):
        fresh = self.rec(due_hours=200, minutes_worked_continuously=0.0)
        tired = self.rec(due_hours=200, minutes_worked_continuously=75.0)
        self.assertNotEqual(fresh[0].kind, ActionKind.REST)
        self.assertEqual(tired[0].kind, ActionKind.REST)

    def test_diagnostic_only_when_the_model_is_unsure(self):
        self.assertFalse(any(r.kind is ActionKind.DIAGNOSTIC
                             for r in self.rec(model_uncertainty=0.0)))
        self.assertTrue(any(r.kind is ActionKind.DIAGNOSTIC
                            for r in self.rec(model_uncertainty=0.9)))

    def test_a_plan_never_pads_to_fill_the_time(self):
        recs = self.rec(due_hours=200)
        plan = nextaction.plan_session(recs, 120.0)
        self.assertLess(sum(r.minutes for r in plan), 120.0)

    def test_a_plan_respects_a_short_window(self):
        plan = nextaction.plan_session(self.rec(due_hours=200), 10.0)
        self.assertLessEqual(sum(r.minutes for r in plan), 10.0)
        self.assertTrue(plan)

    def test_a_plan_does_not_repeat_a_concept(self):
        plan = nextaction.plan_session(self.rec(due_hours=200), 60.0)
        keys = [tuple(sorted(r.concept_ids)) for r in plan if r.concept_ids]
        self.assertEqual(len(keys), len(set(keys)))


class TestTestReport(unittest.TestCase):
    def test_report_answers_the_five_questions(self):
        results = [
            QuestionResult("q1", "fact", C, 3, 3, 40.0, None, 0.9),
            QuestionResult("q2", "cts", I, 4, 1, 210.0, ErrorType.MISCONCEPTION, 0.9),
            QuestionResult("q3", "cts", I, 4, 0, 180.0, ErrorType.CALCULATION, 0.85),
            QuestionResult("q4", "graphs", C, 3, 3, 55.0, None, 0.5),
        ]
        rep = engine.build_report(results)
        self.assertAlmostEqual(rep.percentage, 100 * 7 / 14, places=9)
        self.assertIn("cts", rep.weaknesses)
        self.assertIn("fact", rep.strengths)
        self.assertEqual(rep.calibration["confidentlyWrong"], ["q2", "q3"])
        self.assertEqual(rep.slowest[0], "q2")
        self.assertEqual(rep.error_counts["misconception"], 1)

    def test_overconfidence_is_named(self):
        results = [QuestionResult(f"q{i}", "c", I, 2, 0, 30.0,
                                  ErrorType.MISCONCEPTION, 0.95) for i in range(4)]
        self.assertEqual(engine.build_report(results).calibration["verdict"],
                         "overconfident")

    def test_no_confidence_data_means_no_calibration_claim(self):
        results = [QuestionResult("q1", "c", C, 2, 2, 10.0)]
        self.assertIsNone(engine.build_report(results).calibration)


class TestProjectionPurity(unittest.TestCase):
    def test_replay_is_order_independent_on_input(self):
        atts = seq("x", [(C, Assistance.NONE, PRACTICE),
                         (I, Assistance.HINT, PRACTICE),
                         (C, Assistance.NONE, PRACTICE)])
        a = engine.fold(atts)["x"]
        b = engine.fold(list(reversed(atts)))["x"]
        self.assertAlmostEqual(a.alpha, b.alpha, places=12)
        self.assertAlmostEqual(a.stability, b.stability, places=12)

    def test_deleting_evidence_removes_the_belief(self):
        atts = seq("x", [(C, Assistance.NONE, PRACTICE)] * 6)
        self.assertEqual(mastery.fresh_state(engine.fold(atts)["x"]), MasteryState.RELIABLE)
        self.assertEqual(engine.fold(atts[:1])["x"].independent_correct, 1)
        self.assertLess(mastery.fresh_state(engine.fold(atts[:1])["x"]).rank,
                        MasteryState.RELIABLE.rank)

    def test_apply_does_not_mutate_its_input(self):
        st = ConceptState("x")
        before = (st.alpha, st.beta, st.stability, st.attempts)
        mastery.apply(st, Attempt("x", T0, C, session_id="s"))
        self.assertEqual((st.alpha, st.beta, st.stability, st.attempts), before)


class TestIntervention(unittest.TestCase):
    NOW = T0 + timedelta(days=30)

    def state(self, spec, start=5):
        st = ConceptState("cts")
        for i, (outcome, assist, kind) in enumerate(spec):
            st = mastery.apply(st, Attempt(
                "cts", self.NOW - timedelta(days=start - i), outcome, assist, kind,
                session_id=f"s{i}"))
        return st

    def kinds(self, plan):
        return [s.kind.value for s in plan.steps]

    def test_a_faded_concept_is_recalled_not_retaught(self):
        st = self.state([(C, Assistance.NONE, PRACTICE)] * 5, start=90)
        plan = intervention.build(st, self.NOW)
        self.assertNotIn("teach", self.kinds(plan))
        self.assertIn("practise", self.kinds(plan))

    def test_new_ground_starts_from_the_idea(self):
        plan = intervention.build(ConceptState("cts"), self.NOW)
        self.assertEqual(self.kinds(plan)[0], "teach")

    def test_solid_work_gets_a_transfer_probe_not_a_lesson(self):
        st = self.state([(C, Assistance.NONE, PRACTICE)] * 5)
        self.assertEqual(self.kinds(intervention.build(st, self.NOW)), ["transfer"])

    def test_a_failed_approach_is_not_repeated(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW,
                                  strategies_used=[intervention.Strategy.EXPLANATION])
        used = [s.strategy for s in plan.steps if s.strategy]
        self.assertNotIn(intervention.Strategy.EXPLANATION, used)

    def test_teaching_by_worked_example_does_not_also_add_an_example(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW,
                                  strategies_used=[intervention.Strategy.EXPLANATION])
        self.assertEqual(self.kinds(plan).count("example"), 0)

    def test_verification_survives_every_budget(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        for minutes in (30, 12, 8, 6, 4, 1):
            plan = intervention.build(st, self.NOW, available_minutes=minutes)
            self.assertIn("verify", self.kinds(plan),
                          f"verification was dropped at {minutes} minutes")

    def test_a_short_budget_drops_the_cheapest_things_first(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW, available_minutes=6)
        self.assertLessEqual(plan.minutes, 6.0)
        self.assertIn("teach", self.kinds(plan))

    def test_a_weak_prerequisite_is_addressed_first(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW, has_weak_prerequisite=True)
        self.assertEqual(self.kinds(plan)[0], "prerequisite")

    def test_uncertainty_asks_before_it_teaches(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW, uncertain=True)
        self.assertEqual(self.kinds(plan)[0], "diagnose")

    def test_the_strategy_ladder_never_runs_out(self):
        used = []
        for _ in range(20):
            used.append(intervention.next_strategy(used))
        self.assertEqual(len(used), 20)

    def test_follow_up_is_scheduled_from_where_the_student_will_be(self):
        st = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        plan = intervention.build(st, self.NOW)
        self.assertGreater(plan.follow_up_days, 0)
        self.assertLess(plan.follow_up_days, 30)

    def test_success_is_measured_not_asserted(self):
        before = self.state([(I, Assistance.HINT, PRACTICE)] * 3)
        after = mastery.apply(before, Attempt("cts", self.NOW, C, Assistance.NONE,
                                              PRACTICE, session_id="new"))
        self.assertTrue(intervention.verify_passed(before, after))

        # Getting it right only after being shown the answer proves nothing.
        shown = mastery.apply(before, Attempt("cts", self.NOW, C, Assistance.SOLUTION,
                                              PRACTICE, session_id="new"))
        self.assertFalse(intervention.verify_passed(before, shown))


class TestGoldenFixture(unittest.TestCase):
    def test_fixture_matches_a_fresh_run(self):
        from slatelearn import golden
        path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "fixtures", "learning-golden.json"))
        if not os.path.exists(path):
            self.skipTest("fixture not generated yet")
        with open(path) as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk, golden.build(),
                         "fixtures/learning-golden.json is stale; "
                         "run python3 -m slatelearn.golden")


if __name__ == "__main__":
    unittest.main(verbosity=2)
