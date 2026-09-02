"""What is the single most useful thing this student could do right now?

Spec: docs/LEARNING-MODEL.md section 8.

Everything is scored in expected mastery gain per minute, so a five-minute targeted
intervention can legitimately beat thirty minutes of rereading. Rest is a real
candidate: a study product that can never recommend stopping is optimising for the
wrong thing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Sequence

from . import mastery, scheduling
from .types import ConceptState, MasteryState


class ActionKind(str, Enum):
    FIX_WEAKNESS = "fixWeakness"
    RETRIEVAL_REVIEW = "retrievalReview"
    TRANSFER_PROBE = "transferProbe"
    FINISH_ASSIGNMENT = "finishAssignment"
    DIAGNOSTIC = "diagnostic"
    REST = "rest"


@dataclass(frozen=True)
class Concept:
    id: str
    name: str
    subject: str = ""
    prerequisites: tuple = ()
    exam_weight: float = 1.0
    upcoming_uses: int = 0


@dataclass(frozen=True)
class AssignmentSnapshot:
    id: str
    title: str
    subject: str
    due_at: Optional[datetime]
    questions_total: int
    questions_done: int
    concept_ids: tuple = ()

    @property
    def remaining(self) -> int:
        return max(0, self.questions_total - self.questions_done)


@dataclass(frozen=True)
class SessionContext:
    now: datetime
    available_minutes: float = 30.0
    minutes_worked_continuously: float = 0.0
    days_until_exam: Optional[float] = None
    model_uncertainty: float = 0.0   # normalised entropy over open hypotheses, 0..1


@dataclass
class Recommendation:
    kind: ActionKind
    title: str
    reason: str
    minutes: float
    value: float
    score: float
    concept_ids: List[str] = field(default_factory=list)
    assignment_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "kind": self.kind.value,
            "title": self.title,
            "reason": self.reason,
            "minutes": round(self.minutes, 9),
            "value": round(self.value, 9),
            "score": round(self.score, 9),
            "conceptIds": self.concept_ids,
            "assignmentId": self.assignment_id,
        }


# --- weights ---------------------------------------------------------------
W_FIX = 0.55
W_REVIEW = 0.40
W_TRANSFER = 0.25
W_ASSIGNMENT = 2.20
W_DIAGNOSTIC = 0.50
W_REST = 0.60

FATIGUE_ONSET_MIN = 25.0
FATIGUE_SPAN_MIN = 45.0
REST_MINUTES = 5.0
DEADLINE_HORIZON_HOURS = 72.0
MINUTES_PER_QUESTION = 3.0
WORK_BLOCK_MINUTES = 10.0
MIN_ASSIGNMENT_URGENCY = 0.15


def importance(c: Concept, fanout: int, max_fanout: int) -> float:
    """Exam weight, how much else depends on it, and how often it is about to appear."""
    fan = (fanout / max_fanout) if max_fanout > 0 else 0.0
    upcoming = min(c.upcoming_uses, 4) / 4.0
    return c.exam_weight * (1.0 + 0.25 * fan + 0.25 * upcoming)


def _fanout(concepts: Sequence[Concept]) -> Dict[str, int]:
    counts = {c.id: 0 for c in concepts}
    for c in concepts:
        for p in c.prerequisites:
            if p in counts:
                counts[p] += 1
    return counts


def deadline_urgency(due_at: Optional[datetime], now: datetime) -> float:
    """Starts mattering two days out, not on the morning it is due."""
    if due_at is None:
        return MIN_ASSIGNMENT_URGENCY
    hours = (due_at - now).total_seconds() / 3600.0
    if hours <= 0:
        return 1.0
    ramp = mastery.clamp(1.0 - hours / DEADLINE_HORIZON_HOURS, 0.0, 1.0) ** 1.5
    return max(MIN_ASSIGNMENT_URGENCY, ramp)


def fatigue(minutes_worked: float) -> float:
    return mastery.clamp((minutes_worked - FATIGUE_ONSET_MIN) / FATIGUE_SPAN_MIN, 0.0, 1.0)


def recommend(states: Dict[str, ConceptState],
              concepts: Sequence[Concept],
              assignments: Sequence[AssignmentSnapshot],
              ctx: SessionContext) -> List[Recommendation]:
    """All candidate actions, best first. The caller shows the head and hides the rest."""
    now = ctx.now
    by_id = {c.id: c for c in concepts}
    fan = _fanout(concepts)
    max_fan = max(fan.values()) if fan else 0
    review_ctx = scheduling.ReviewContext(days_until_exam=ctx.days_until_exam)

    out: List[Recommendation] = []

    for cid, st in states.items():
        c = by_id.get(cid)
        if c is None:
            continue
        imp = importance(c, fan.get(cid, 0), max_fan)
        p = mastery.predicted_p(st)
        # Deliberately the *fresh* state, not the effective one. Something the student
        # knows but has let decay is a recall problem, and candidate 2 handles it.
        # Scoring it as a knowledge gap too would double-count and send them back to
        # re-learn material they already understand.
        state = mastery.fresh_state(st)

        # 1. Learning something you cannot yet do.
        if state.rank < MasteryState.RELIABLE.rank and st.attempts > 0:
            minutes = 8.0
            value = (1.0 - p) * W_FIX * imp
            out.append(Recommendation(
                kind=ActionKind.FIX_WEAKNESS,
                title=f"Fix: {c.name}",
                reason=f"You are at {int(round(p * 100))}% unaided on this.",
                minutes=minutes, value=value, score=value / minutes,
                concept_ids=[cid],
            ))

        # 2. Protecting something you already know but are losing.
        risk = scheduling.forgetting_risk(st, now)
        if risk > 0.05:
            minutes = 2.5
            value = risk * W_REVIEW * imp
            days_over = scheduling.overdue_days(st, now, review_ctx)
            when = "due now" if days_over <= 0 else f"{int(days_over)} days overdue"
            out.append(Recommendation(
                kind=ActionKind.RETRIEVAL_REVIEW,
                title=f"Recall: {c.name}",
                reason=f"Review {when}; recall is at "
                       f"{int(round(mastery.current_retrievability(st, now) * 100))}%.",
                minutes=minutes, value=value, score=value / minutes,
                concept_ids=[cid],
            ))

        # 3. Checking that "reliable" survives an unfamiliar surface.
        if state.rank >= MasteryState.RELIABLE.rank and st.transfer_correct == 0:
            minutes = 4.0
            value = W_TRANSFER * imp
            out.append(Recommendation(
                kind=ActionKind.TRANSFER_PROBE,
                title=f"Try a different angle: {c.name}",
                reason="You can do the standard version. This checks you understand it.",
                minutes=minutes, value=value, score=value / minutes,
                concept_ids=[cid],
            ))

    # 4. Work that is actually due.
    for a in assignments:
        if a.remaining <= 0:
            continue
        urgency = deadline_urgency(a.due_at, now)
        # Score the *next block* of work, not the whole assignment. Dividing a whole
        # worksheet's value by a whole worksheet's minutes buries urgent work under
        # optional five-minute reviews.
        minutes = min(a.remaining * MINUTES_PER_QUESTION, WORK_BLOCK_MINUTES,
                      max(1.0, ctx.available_minutes))
        value = urgency * W_ASSIGNMENT
        out.append(Recommendation(
            kind=ActionKind.FINISH_ASSIGNMENT,
            title=f"Continue: {a.title}",
            reason=f"{a.remaining} of {a.questions_total} questions left.",
            minutes=minutes, value=value, score=value / minutes,
            concept_ids=list(a.concept_ids), assignment_id=a.id,
        ))

    # 5. Asking, when we genuinely do not know what is wrong.
    if ctx.model_uncertainty > 0.35:
        minutes = 6.0
        value = ctx.model_uncertainty * W_DIAGNOSTIC
        out.append(Recommendation(
            kind=ActionKind.DIAGNOSTIC,
            title="Six quick questions",
            reason="Your recent work does not say clearly where the problem is.",
            minutes=minutes, value=value, score=value / minutes,
        ))

    # 6. Stopping.
    f = fatigue(ctx.minutes_worked_continuously)
    if f > 0.0:
        value = f * f * W_REST
        out.append(Recommendation(
            kind=ActionKind.REST,
            title="Take five minutes",
            reason=f"You have been working for "
                   f"{int(ctx.minutes_worked_continuously)} minutes.",
            minutes=REST_MINUTES, value=value, score=value / REST_MINUTES,
        ))

    out.sort(key=lambda r: (-r.score, r.minutes, r.kind.value, r.title))
    return out


def plan_session(recommendations: Sequence[Recommendation],
                 available_minutes: float,
                 max_items: int = 6) -> List[Recommendation]:
    """Greedy pack by value density. Never pads to fill the time.

    If the highest-value work takes eleven minutes of a stated thirty, the plan is
    eleven minutes long. Filling time is how revision apps waste afternoons.
    """
    chosen: List[Recommendation] = []
    used = 0.0
    seen_concepts: set = set()
    for r in recommendations:
        if len(chosen) >= max_items or used + r.minutes > available_minutes:
            continue
        if r.kind is ActionKind.REST and not chosen:
            chosen.append(r)
            used += r.minutes
            continue
        key = tuple(sorted(r.concept_ids))
        if key and key in seen_concepts:
            continue
        chosen.append(r)
        seen_concepts.add(key)
        used += r.minutes
    return chosen
