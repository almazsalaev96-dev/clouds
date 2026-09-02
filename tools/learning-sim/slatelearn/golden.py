"""Generate the cross-language oracle: fixtures/learning-golden.json.

The Swift implementation in `SlateLearning` loads this exact file and asserts it
reproduces every number to 9 decimal places. Regenerate with:

    python3 -m slatelearn.golden

CI regenerates it and fails if the working tree differs, so the two implementations
cannot drift silently.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from . import eig, engine, intervention, mastery, misconception, nextaction, scheduling
from .engine import QuestionResult
from .nextaction import AssignmentSnapshot, Concept, SessionContext
from .types import Assistance, Attempt, AttemptKind, ConceptState, ErrorType, Outcome

T0 = datetime(2026, 1, 1, 9, 0, 0, tzinfo=timezone.utc)
PLACES = 9


def r(x: float) -> float:
    return round(float(x), PLACES)


def iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def attempt_json(a: Attempt) -> Dict[str, Any]:
    return {
        "conceptId": a.concept_id,
        "at": iso(a.at),
        "outcome": a.outcome.value,
        "assistance": a.assistance.value,
        "kind": a.kind.value,
        "errorType": a.error_type.value if a.error_type else None,
        "sessionId": a.session_id,
        "questionId": a.question_id,
        "confidence": a.confidence,
        "secondsSpent": a.seconds_spent,
    }


def state_json(s: ConceptState) -> Dict[str, Any]:
    return {
        "alpha": r(s.alpha),
        "beta": r(s.beta),
        "difficulty": r(s.difficulty),
        "stability": r(s.stability),
        "lastReviewed": iso(s.last_reviewed) if s.last_reviewed else None,
        "attempts": s.attempts,
        "independentCorrect": s.independent_correct,
        "transferCorrect": s.transfer_correct,
        "retentionCorrect": s.retention_correct,
        "carelessSlips": s.careless_slips,
        "sessions": len(s.sessions),
        "pUnaided": r(mastery.predicted_p(s)),
        "evidence": r(mastery.evidence_strength(s)),
        "freshState": mastery.fresh_state(s).value,
    }


def _walk(attempts: List[Attempt]) -> List[Dict[str, Any]]:
    """State after every attempt: the Swift port must match at each step, not just
    at the end, so a divergence is located rather than merely detected."""
    st = ConceptState(attempts[0].concept_id)
    steps = []
    for a in attempts:
        st = mastery.apply(st, a)
        steps.append({"attempt": attempt_json(a), "state": state_json(st)})
    return steps


def _seq(concept: str, spec, day_step: float = 1.0, start: float = 0.0):
    out = []
    for i, item in enumerate(spec):
        outcome, assist, kind = item[0], item[1], item[2]
        err = item[3] if len(item) > 3 else None
        out.append(Attempt(
            concept_id=concept,
            at=T0 + timedelta(days=start + i * day_step),
            outcome=outcome, assistance=assist, kind=kind, error_type=err,
            session_id=f"{concept}-s{i}", question_id=f"{concept}-q{i}",
        ))
    return out


# --- scenarios -------------------------------------------------------------

def sc_mastery_ladder() -> Dict[str, Any]:
    a = _seq("cts", [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 6)
    a.append(Attempt("cts", T0 + timedelta(days=10), Outcome.CORRECT,
                     Assistance.NONE, AttemptKind.TRANSFER,
                     session_id="cts-t", question_id="cts-qt"))
    a.append(Attempt("cts", T0 + timedelta(days=20), Outcome.CORRECT,
                     Assistance.NONE, AttemptKind.RETRIEVAL,
                     session_id="cts-r", question_id="cts-qr"))
    return {"name": "masteryLadder",
            "note": "unaided practice -> reliable -> transferable -> mastered",
            "steps": _walk(a)}


def sc_solution_dependency() -> Dict[str, Any]:
    a = _seq("solv", [(Outcome.CORRECT, Assistance.SOLUTION, AttemptKind.PRACTICE)] * 6)
    return {"name": "solutionDependency",
            "note": "being shown the answer six times is not evidence of ability",
            "steps": _walk(a)}


def sc_assistance_ladder() -> Dict[str, Any]:
    a = _seq("hints", [
        (Outcome.INCORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.HINT, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.NUDGE, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
    ])
    return {"name": "assistanceLadder",
            "note": "help consumed is discounted, independence recovers",
            "steps": _walk(a),
            "independence": r(mastery.independence(engine.fold(a)["hints"]))}


def sc_careless() -> Dict[str, Any]:
    a = _seq("care", [
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.INCORRECT, Assistance.NONE, AttemptKind.PRACTICE, ErrorType.CARELESS),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
    ])
    b = _seq("gap", [
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.INCORRECT, Assistance.NONE, AttemptKind.PRACTICE, ErrorType.KNOWLEDGE_GAP),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
    ])
    return {"name": "carelessVsGap",
            "note": "a slip must not cost mastery the way a knowledge gap does",
            "careless": _walk(a), "knowledgeGap": _walk(b)}


def sc_unreadable() -> Dict[str, Any]:
    a = _seq("read", [
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
        (Outcome.INCORRECT, Assistance.NONE, AttemptKind.PRACTICE, ErrorType.UNREADABLE),
        (Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE),
    ])
    return {"name": "unreadableIsNotEvidence",
            "note": "handwriting we could not read changes nothing but the count",
            "steps": _walk(a)}


def sc_forgetting() -> Dict[str, Any]:
    a = _seq("forget", [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 4)
    a.append(Attempt("forget", T0 + timedelta(days=6), Outcome.CORRECT,
                     Assistance.NONE, AttemptKind.TRANSFER, session_id="f-t"))
    a.append(Attempt("forget", T0 + timedelta(days=12), Outcome.CORRECT,
                     Assistance.NONE, AttemptKind.RETRIEVAL, session_id="f-r"))
    st = engine.fold(a)["forget"]
    curve = []
    for d in [0, 1, 3, 7, 14, 30, 60, 120, 365]:
        when = st.last_reviewed + timedelta(days=d)
        curve.append({
            "days": d,
            "retrievability": r(mastery.current_retrievability(st, when)),
            "effectiveState": mastery.effective_state(st, when).value,
        })
    return {"name": "forgetting",
            "note": "mastered is not a trophy; it expires without review",
            "finalState": state_json(st), "curve": curve}


def sc_lapse() -> Dict[str, Any]:
    a = _seq("lapse", [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 4)
    a.append(Attempt("lapse", T0 + timedelta(days=40), Outcome.INCORRECT,
                     Assistance.NONE, AttemptKind.RETRIEVAL,
                     error_type=ErrorType.KNOWLEDGE_GAP, session_id="l-x"))
    a.append(Attempt("lapse", T0 + timedelta(days=41), Outcome.CORRECT,
                     Assistance.HINT, AttemptKind.PRACTICE, session_id="l-y"))
    a.append(Attempt("lapse", T0 + timedelta(days=44), Outcome.CORRECT,
                     Assistance.NONE, AttemptKind.RETRIEVAL, session_id="l-z"))
    return {"name": "lapseAndRecovery",
            "note": "a lapse costs stability but does not reset it to zero",
            "steps": _walk(a)}


def sc_scheduling() -> Dict[str, Any]:
    rows = []
    for s in [0.4, 1.0, 3.0, 8.75, 30.0, 120.0]:
        for label, ctx in [
            ("default", scheduling.ReviewContext()),
            ("examIn10", scheduling.ReviewContext(days_until_exam=10.0)),
            ("examIn3", scheduling.ReviewContext(days_until_exam=3.0)),
            ("prerequisite", scheduling.ReviewContext(is_prerequisite_of_due_work=True)),
            ("lowPriority", scheduling.ReviewContext(low_priority=True)),
        ]:
            rows.append({
                "stability": s, "context": label,
                "targetRetention": r(scheduling.target_retention(ctx)),
                "intervalDays": r(scheduling.interval_days(s, ctx)),
            })
    curve = [{"stability": s, "days": d,
              "retrievability": r(mastery.retrievability(s, d))}
             for s in [1.0, 8.75, 60.0] for d in [0, 1, 7, 30, 90]]
    return {"name": "scheduling", "intervals": rows, "retrievability": curve}


def sc_patterns() -> Dict[str, Any]:
    now = T0 + timedelta(days=30)
    ats: List[Attempt] = []
    for i in range(4):
        ats.append(Attempt(f"topic{i % 3}", now - timedelta(days=i * 2),
                           Outcome.INCORRECT, error_type=ErrorType.CALCULATION,
                           question_id=f"q{i}", session_id=f"s{i}"))
    for i in range(3):
        ats.append(Attempt("topic0", now - timedelta(days=1 + i),
                           Outcome.INCORRECT, error_type=ErrorType.MISCONCEPTION,
                           question_id=f"m{i}", session_id=f"s{i}"))
    ats.append(Attempt("topic1", now - timedelta(days=1), Outcome.INCORRECT,
                       error_type=ErrorType.READING, question_id="r0"))
    found = misconception.detect(ats, now)
    return {"name": "misconceptionPatterns",
            "now": iso(now),
            "attempts": [attempt_json(a) for a in ats],
            "patterns": [p.to_dict() for p in found],
            "headlines": [misconception.headline(p) for p in found]}


def sc_eig() -> Dict[str, Any]:
    hyps = [
        eig.Hypothesis("formula", "Chooses the wrong formula", 1.0),
        eig.Hypothesis("sign", "Drops negative signs", 1.0),
        eig.Hypothesis("rearrange", "Cannot rearrange the equation", 1.0),
        eig.Hypothesis("none", "No specific weakness", 1.0),
    ]
    cands = [
        eig.CandidateQuestion("splitFormula", "Which formula applies here?", {
            "formula": {"correct": 0.10, "wrongFormula": 0.80, "signError": 0.05, "other": 0.05},
            "sign": {"correct": 0.30, "wrongFormula": 0.05, "signError": 0.60, "other": 0.05},
            "rearrange": {"correct": 0.15, "wrongFormula": 0.10, "signError": 0.15, "other": 0.60},
            "none": {"correct": 0.90, "wrongFormula": 0.03, "signError": 0.04, "other": 0.03},
        }, 1.5, "cts"),
        eig.CandidateQuestion("uninformative", "Restate the question", {
            h: {"correct": 0.5, "other": 0.5} for h in ["formula", "sign", "rearrange", "none"]
        }, 1.5, "cts"),
        eig.CandidateQuestion("slowButSharp", "Full worked solution, 6 minutes", {
            "formula": {"correct": 0.05, "other": 0.95},
            "sign": {"correct": 0.95, "other": 0.05},
            "rearrange": {"correct": 0.50, "other": 0.50},
            "none": {"correct": 0.98, "other": 0.02},
        }, 6.0, "cts"),
        eig.CandidateQuestion("signProbe", "Expand -(x - 3)^2", {
            "formula": {"correct": 0.85, "signError": 0.10, "other": 0.05},
            "sign": {"correct": 0.15, "signError": 0.80, "other": 0.05},
            "rearrange": {"correct": 0.60, "signError": 0.20, "other": 0.20},
            "none": {"correct": 0.95, "signError": 0.03, "other": 0.02},
        }, 1.0, "signs"),
    ]
    prior = eig.prior_map(hyps)
    ranked = [{"questionId": q.id,
               "eig": r(eig.expected_information_gain(prior, q)),
               "eigPerMinute": r(score)} for q, score in eig.rank(prior, cands)]

    # A simulated student who really does drop signs.
    def responder(q: eig.CandidateQuestion) -> str:
        if "signError" in q.responses():
            return "signError"
        return "other" if "other" in q.responses() else "correct"

    run = eig.run_adaptive(hyps, cands, responder, max_questions=6, confidence=0.80)
    return {"name": "expectedInformationGain",
            "priorEntropyBits": r(eig.entropy(list(prior.values()))),
            "ranked": ranked,
            "adaptiveRun": {
                "asked": run.asked,
                "transcript": [{"questionId": q, "response": resp} for q, resp in run.transcript],
                "posterior": {k: r(v) for k, v in sorted(run.prior.items())},
                "leading": run.leading[0],
                "leadingProbability": r(run.leading[1]),
                "remainingBits": r(run.remaining_uncertainty()),
            }}


def _demo_world():
    now = T0 + timedelta(days=30)
    attempts: List[Attempt] = []
    attempts += _seq("cts", [(Outcome.INCORRECT, Assistance.HINT, AttemptKind.PRACTICE),
                             (Outcome.INCORRECT, Assistance.HINT, AttemptKind.PRACTICE,
                              ErrorType.MISCONCEPTION),
                             (Outcome.PARTIAL, Assistance.GUIDED, AttemptKind.PRACTICE)],
                     start=27.0)
    attempts += _seq("fact", [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 4,
                     start=0.0)
    attempts += _seq("graphs", [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 5,
                     start=25.0)
    concepts = [
        Concept("cts", "Completing the square", "Mathematics", ("fact",), 1.3, 2),
        Concept("fact", "Factorising", "Mathematics", (), 1.0, 0),
        Concept("graphs", "Quadratic graphs", "Mathematics", ("cts",), 1.1, 1),
    ]
    return now, attempts, concepts


def sc_next_action() -> Dict[str, Any]:
    now, attempts, concepts = _demo_world()
    cases = []
    for label, due_hours, worked, avail, uncertainty in [
        ("dueTomorrow", 20.0, 0.0, 30.0, 0.0),
        ("dueInFiveDays", 120.0, 0.0, 30.0, 0.0),
        ("tired", 20.0, 70.0, 30.0, 0.0),
        ("uncertainModel", 120.0, 0.0, 30.0, 0.9),
        ("tenMinutesOnly", 120.0, 0.0, 10.0, 0.0),
    ]:
        asg = [AssignmentSnapshot("a1", "Physics worksheet", "Physics",
                                  now + timedelta(hours=due_hours), 18, 12, ("graphs",))]
        ctx = SessionContext(now=now, available_minutes=avail,
                             minutes_worked_continuously=worked,
                             model_uncertainty=uncertainty)
        proj = engine.project(attempts, concepts, asg, ctx)
        cases.append({
            "case": label,
            "recommendations": [x.to_dict() for x in proj.recommendations],
            "plan": [x.to_dict() for x in proj.plan],
            "planMinutes": r(sum(x.minutes for x in proj.plan)),
        })
    return {"name": "nextBestAction", "now": iso(now),
            "attempts": [attempt_json(a) for a in attempts],
            "cases": cases}


def sc_projection() -> Dict[str, Any]:
    now, attempts, concepts = _demo_world()
    asg = [AssignmentSnapshot("a1", "Physics worksheet", "Physics",
                              now + timedelta(hours=20), 18, 12, ("graphs",))]
    proj = engine.project(attempts, concepts, asg,
                          SessionContext(now=now, available_minutes=30.0))
    return {"name": "projection",
            "concepts": [c.to_dict() for c in proj.concepts],
            "weakestFirst": [c.concept_id for c in proj.weakest],
            "patterns": [p.to_dict() for p in proj.patterns]}


def sc_test_report() -> Dict[str, Any]:
    now, attempts, concepts = _demo_world()
    proj = engine.project(attempts, concepts, [],
                          SessionContext(now=now, available_minutes=30.0))
    results = [
        QuestionResult("q1", "fact", Outcome.CORRECT, 3, 3, 45.0, None, 0.9),
        QuestionResult("q2", "cts", Outcome.INCORRECT, 4, 1, 210.0, ErrorType.MISCONCEPTION, 0.85),
        QuestionResult("q3", "cts", Outcome.INCORRECT, 4, 0, 180.0, ErrorType.CALCULATION, 0.80),
        QuestionResult("q4", "graphs", Outcome.CORRECT, 3, 3, 60.0, None, 0.50),
        QuestionResult("q5", "graphs", Outcome.PARTIAL, 2, 1, 95.0, ErrorType.REASONING_GAP, 0.60),
    ]
    names = {c.id: c.name for c in concepts}
    return {"name": "testReport",
            "report": engine.build_report(results, proj, names).to_dict()}


def sc_intervention() -> Dict[str, Any]:
    now = T0 + timedelta(days=30)

    def built(spec, start):
        st = ConceptState("cts")
        for i, (outcome, assist, kind) in enumerate(spec):
            st = mastery.apply(st, Attempt(
                "cts", now - timedelta(days=start - i), outcome, assist, kind,
                session_id=f"s{i}"))
        return st

    unaided = [(Outcome.CORRECT, Assistance.NONE, AttemptKind.PRACTICE)] * 5
    hinted = [(Outcome.INCORRECT, Assistance.HINT, AttemptKind.PRACTICE)] * 3

    cases = [
        ("neverSeen", ConceptState("cts"), 12.0, [], None, False, False),
        ("struggling", built(hinted, 5), 12.0, [], None, False, False),
        ("struggingAfterExplanation", built(hinted, 5), 12.0,
         [intervention.Strategy.EXPLANATION], "a sign error", False, False),
        ("weakPrerequisite", built(hinted, 5), 12.0, [], None, True, False),
        ("uncertain", built(hinted, 5), 12.0, [], None, False, True),
        ("faded", built(unaided, 90), 12.0, [], None, False, False),
        ("solidNoTransfer", built(unaided, 5), 12.0, [], None, False, False),
        ("sixMinutesOnly", built(hinted, 5), 6.0, [], None, False, False),
        ("threeMinutesOnly", built(hinted, 5), 3.0, [], None, False, False),
    ]

    out = []
    for label, state, minutes, used, error, prerequisite, uncertain in cases:
        plan = intervention.build(
            state, now, available_minutes=minutes, strategies_used=used,
            known_error=error, has_weak_prerequisite=prerequisite, uncertain=uncertain)
        out.append({
            "case": label,
            "availableMinutes": minutes,
            "state": state_json(state),
            "plan": plan.to_dict(),
        })

    ladder = []
    used: List[intervention.Strategy] = []
    for _ in range(len(intervention.STRATEGY_ORDER) + 1):
        nxt = intervention.next_strategy(used)
        ladder.append(nxt.value)
        used.append(nxt)

    return {"name": "intervention", "now": iso(now), "cases": out, "strategyLadder": ladder}


SCENARIOS = [
    sc_mastery_ladder, sc_solution_dependency, sc_assistance_ladder, sc_careless,
    sc_unreadable, sc_forgetting, sc_lapse, sc_scheduling, sc_patterns, sc_eig,
    sc_next_action, sc_projection, sc_test_report, sc_intervention,
]


def constants() -> Dict[str, Any]:
    """Exported so the Swift port asserts on the same numbers, not copies of them."""
    return {
        "alpha0": mastery.ALPHA_0, "beta0": mastery.BETA_0,
        "evidenceHalfLifeDays": mastery.EVIDENCE_HALF_LIFE,
        "sMin": mastery.S_MIN, "sMax": mastery.S_MAX,
        "stabA": mastery.STAB_A, "stabB": mastery.STAB_B, "stabC": mastery.STAB_C,
        "lapseK": mastery.LAPSE_K, "lapseD": mastery.LAPSE_D,
        "lapseS": mastery.LAPSE_S, "lapseR": mastery.LAPSE_R,
        "dStep": mastery.D_STEP, "dRevert": mastery.D_REVERT,
        "pPracticing": mastery.P_PRACTICING, "pDeveloping": mastery.P_DEVELOPING,
        "pReliable": mastery.P_RELIABLE, "pMastered": mastery.P_MASTERED,
        "retentionMinDays": mastery.RETENTION_MIN_DAYS,
        "rCapReliable": mastery.R_CAP_RELIABLE,
        "rCapDeveloping": mastery.R_CAP_DEVELOPING,
        "rCapPracticing": mastery.R_CAP_PRACTICING,
        "rDefault": scheduling.R_DEFAULT, "rExamNear": scheduling.R_EXAM_NEAR,
        "rExamImminent": scheduling.R_EXAM_IMMINENT,
        "wFix": nextaction.W_FIX, "wReview": nextaction.W_REVIEW,
        "wTransfer": nextaction.W_TRANSFER, "wAssignment": nextaction.W_ASSIGNMENT,
        "wDiagnostic": nextaction.W_DIAGNOSTIC, "wRest": nextaction.W_REST,
        "deadlineHorizonHours": nextaction.DEADLINE_HORIZON_HOURS,
        "fatigueOnsetMinutes": nextaction.FATIGUE_ONSET_MIN,
        "fatigueSpanMinutes": nextaction.FATIGUE_SPAN_MIN,
        "interventionMinMinutes": intervention.MIN_MINUTES,
        "stepMinutes": {k.value: v for k, v in intervention.STEP_MINUTES.items()},
    }


def build() -> Dict[str, Any]:
    return {
        "$schema": "slate/learning-golden/1",
        "version": 1,
        "epoch": iso(T0),
        "decimalPlaces": PLACES,
        "constants": constants(),
        "scenarios": [fn() for fn in SCENARIOS],
    }


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", "..", ".."))
    path = os.path.join(root, "fixtures", "learning-golden.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(build(), f, indent=2, sort_keys=False)
        f.write("\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
