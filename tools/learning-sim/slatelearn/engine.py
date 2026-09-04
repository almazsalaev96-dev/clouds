"""The projection: evidence log in, understanding out.

`project()` is a pure function of the attempt log and the clock. Nothing in the
product stores a conclusion; every conclusion is recomputed here. That is what makes
"why am I being shown this?" answerable and what makes deleting your data actually
delete the beliefs derived from it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence

from . import eig, mastery, misconception, nextaction, scheduling
from .nextaction import AssignmentSnapshot, Concept, Recommendation, SessionContext
from .types import Attempt, ConceptState, ErrorType, MasteryState, Outcome


@dataclass
class ConceptView:
    concept_id: str
    name: str
    state: MasteryState
    fresh_state: MasteryState
    p_unaided: float
    retrievability: float
    stability_days: float
    difficulty: float
    attempts: int
    independent_correct: int
    evidence: float
    independence: Optional[float]
    due_at: Optional[datetime]
    overdue_days: float

    def to_dict(self) -> dict:
        return {
            "conceptId": self.concept_id,
            "name": self.name,
            "state": self.state.value,
            "freshState": self.fresh_state.value,
            "pUnaided": round(self.p_unaided, 9),
            "retrievability": round(self.retrievability, 9),
            "stabilityDays": round(self.stability_days, 9),
            "difficulty": round(self.difficulty, 9),
            "attempts": self.attempts,
            "independentCorrect": self.independent_correct,
            "evidence": round(self.evidence, 9),
            "independence": None if self.independence is None else round(self.independence, 9),
            "dueAt": self.due_at.isoformat() if self.due_at else None,
            "overdueDays": round(self.overdue_days, 9),
        }


@dataclass
class Projection:
    at: datetime
    concepts: List[ConceptView] = field(default_factory=list)
    patterns: List[misconception.Pattern] = field(default_factory=list)
    recommendations: List[Recommendation] = field(default_factory=list)
    plan: List[Recommendation] = field(default_factory=list)
    states: Dict[str, ConceptState] = field(default_factory=dict)

    def concept(self, cid: str) -> Optional[ConceptView]:
        return next((c for c in self.concepts if c.concept_id == cid), None)

    @property
    def weakest(self) -> List[ConceptView]:
        seen = [c for c in self.concepts if c.attempts > 0]
        return sorted(seen, key=lambda c: (c.p_unaided, c.concept_id))

    @property
    def due_now(self) -> List[ConceptView]:
        return [c for c in self.concepts if c.overdue_days > 0.0]

    def to_dict(self) -> dict:
        return {
            "at": self.at.isoformat(),
            "concepts": [c.to_dict() for c in self.concepts],
            "patterns": [p.to_dict() for p in self.patterns],
            "recommendations": [r.to_dict() for r in self.recommendations],
            "plan": [r.to_dict() for r in self.plan],
        }


def fold(attempts: Sequence[Attempt]) -> Dict[str, ConceptState]:
    """Replay the log. Order matters, so it is enforced here rather than assumed."""
    states: Dict[str, ConceptState] = {}
    for a in sorted(attempts, key=lambda x: (x.at, x.concept_id, x.question_id)):
        st = states.get(a.concept_id) or ConceptState(a.concept_id)
        states[a.concept_id] = mastery.apply(st, a)
    return states


def project(attempts: Sequence[Attempt],
            concepts: Sequence[Concept],
            assignments: Sequence[AssignmentSnapshot] = (),
            ctx: Optional[SessionContext] = None) -> Projection:
    now = ctx.now if ctx else datetime.now(tz=(attempts[0].at.tzinfo if attempts else None))
    ctx = ctx or SessionContext(now=now)
    states = fold(attempts)
    by_id = {c.id: c for c in concepts}
    review_ctx = scheduling.ReviewContext(days_until_exam=ctx.days_until_exam)

    views: List[ConceptView] = []
    for cid, st in sorted(states.items()):
        views.append(ConceptView(
            concept_id=cid,
            name=by_id[cid].name if cid in by_id else cid,
            state=mastery.effective_state(st, now),
            fresh_state=mastery.fresh_state(st),
            p_unaided=mastery.predicted_p(st),
            retrievability=mastery.current_retrievability(st, now),
            stability_days=st.stability,
            difficulty=st.difficulty,
            attempts=st.attempts,
            independent_correct=st.independent_correct,
            evidence=mastery.evidence_strength(st),
            independence=mastery.independence(st),
            due_at=scheduling.due_at(st, review_ctx),
            overdue_days=scheduling.overdue_days(st, now, review_ctx),
        ))

    patterns = misconception.detect(attempts, now)
    recs = nextaction.recommend(states, concepts, assignments, ctx)
    plan = nextaction.plan_session(recs, ctx.available_minutes)
    return Projection(at=now, concepts=views, patterns=patterns,
                      recommendations=recs, plan=plan, states=states)


# --- test intelligence -----------------------------------------------------

@dataclass
class QuestionResult:
    question_id: str
    concept_id: str
    outcome: Outcome
    marks_available: int = 1
    marks_awarded: int = 0
    seconds: float = 0.0
    error_type: Optional[ErrorType] = None
    confidence: Optional[float] = None


@dataclass
class TestReport:
    """A score alone changes nothing. This answers the five questions that matter:
    how did I do, what did I get wrong, why, what should I study, what do I do next.
    """

    marks_awarded: int
    marks_available: int
    seconds: float
    by_concept: Dict[str, dict]
    error_counts: Dict[str, int]
    calibration: Optional[dict]
    slowest: List[str]
    strengths: List[str]
    weaknesses: List[str]
    next_step: Optional[Recommendation]

    @property
    def percentage(self) -> float:
        return 0.0 if self.marks_available == 0 else 100.0 * self.marks_awarded / self.marks_available

    def to_dict(self) -> dict:
        return {
            "marksAwarded": self.marks_awarded,
            "marksAvailable": self.marks_available,
            "percentage": round(self.percentage, 9),
            "seconds": round(self.seconds, 9),
            "byConcept": self.by_concept,
            "errorCounts": self.error_counts,
            "calibration": self.calibration,
            "slowest": self.slowest,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "nextStep": self.next_step.to_dict() if self.next_step else None,
        }


CALIBRATION_GAP = 0.25


def build_report(results: Sequence[QuestionResult],
                 projection: Optional[Projection] = None,
                 concept_names: Optional[Dict[str, str]] = None) -> TestReport:
    names = concept_names or {}
    awarded = sum(r.marks_awarded for r in results)
    available = sum(r.marks_available for r in results)
    seconds = sum(r.seconds for r in results)

    by_concept: Dict[str, dict] = {}
    for r in results:
        b = by_concept.setdefault(r.concept_id, {
            "name": names.get(r.concept_id, r.concept_id),
            "marksAwarded": 0, "marksAvailable": 0, "questions": 0, "seconds": 0.0,
        })
        b["marksAwarded"] += r.marks_awarded
        b["marksAvailable"] += r.marks_available
        b["questions"] += 1
        b["seconds"] += r.seconds
    for b in by_concept.values():
        b["percentage"] = round(
            0.0 if b["marksAvailable"] == 0
            else 100.0 * b["marksAwarded"] / b["marksAvailable"], 9)
        b["seconds"] = round(b["seconds"], 9)

    error_counts: Dict[str, int] = {}
    for r in results:
        if r.error_type is not None and r.outcome is not Outcome.CORRECT:
            error_counts[r.error_type.value] = error_counts.get(r.error_type.value, 0) + 1

    # Confidence against performance: where a student is sure and wrong, the problem
    # is a misconception rather than a gap, and that changes the intervention.
    scored = [r for r in results if r.confidence is not None]
    calibration = None
    if scored:
        mean_conf = sum(r.confidence for r in scored) / len(scored)
        mean_score = sum(r.marks_awarded / max(1, r.marks_available) for r in scored) / len(scored)
        calibration = {
            "meanConfidence": round(mean_conf, 9),
            "meanScore": round(mean_score, 9),
            "gap": round(mean_conf - mean_score, 9),
            "verdict": ("overconfident" if mean_conf - mean_score > CALIBRATION_GAP
                        else "underconfident" if mean_score - mean_conf > CALIBRATION_GAP
                        else "wellCalibrated"),
            "confidentlyWrong": sorted(
                r.question_id for r in scored
                if r.confidence >= 0.7 and r.marks_awarded < r.marks_available),
        }

    ranked = sorted(by_concept.items(), key=lambda kv: (kv[1]["percentage"], kv[0]))
    weaknesses = [cid for cid, b in ranked if b["percentage"] < 60.0]
    strengths = [cid for cid, b in reversed(ranked) if b["percentage"] >= 80.0]
    slowest = [r.question_id for r in sorted(results, key=lambda r: -r.seconds)[:3] if r.seconds > 0]

    next_step = projection.recommendations[0] if projection and projection.recommendations else None
    return TestReport(
        marks_awarded=awarded, marks_available=available, seconds=seconds,
        by_concept=by_concept, error_counts=error_counts, calibration=calibration,
        slowest=slowest, strengths=strengths, weaknesses=weaknesses, next_step=next_step,
    )
