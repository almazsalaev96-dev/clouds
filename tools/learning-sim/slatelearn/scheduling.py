"""Spaced retrieval scheduling. Spec: docs/LEARNING-MODEL.md section 5."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from . import mastery
from .types import ConceptState

R_DEFAULT = 0.90
R_EXAM_NEAR = 0.93      # exam within 14 days
R_EXAM_IMMINENT = 0.95  # exam within 5 days
R_PREREQUISITE = 0.93   # something due depends on this
R_LOW_PRIORITY = 0.85

EXAM_NEAR_DAYS = 14.0
EXAM_IMMINENT_DAYS = 5.0

MIN_INTERVAL_DAYS = 0.02  # ~30 minutes; never schedule "now, again, now"
MAX_INTERVAL_DAYS = 365.0


@dataclass(frozen=True)
class ReviewContext:
    days_until_exam: Optional[float] = None
    is_prerequisite_of_due_work: bool = False
    low_priority: bool = False


def target_retention(ctx: ReviewContext) -> float:
    """Higher target => shorter interval => more frequent review near an exam.

    This falls out of one formula rather than being a pile of special cases.
    """
    if ctx.low_priority:
        return R_LOW_PRIORITY
    t = R_DEFAULT
    if ctx.days_until_exam is not None:
        if ctx.days_until_exam <= EXAM_IMMINENT_DAYS:
            t = max(t, R_EXAM_IMMINENT)
        elif ctx.days_until_exam <= EXAM_NEAR_DAYS:
            t = max(t, R_EXAM_NEAR)
    if ctx.is_prerequisite_of_due_work:
        t = max(t, R_PREREQUISITE)
    return t


def interval_days(stability: float, ctx: ReviewContext = ReviewContext()) -> float:
    """Days from the last review until retrievability decays to the target."""
    if stability <= 0.0:
        return MIN_INTERVAL_DAYS
    r = target_retention(ctx)
    raw = 9.0 * stability * (1.0 / r - 1.0)
    return mastery.clamp(raw, MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS)


def due_at(state: ConceptState, ctx: ReviewContext = ReviewContext()) -> Optional[datetime]:
    if state.last_reviewed is None:
        return None
    return state.last_reviewed + timedelta(days=interval_days(state.stability, ctx))


def is_due(state: ConceptState, now: datetime,
           ctx: ReviewContext = ReviewContext()) -> bool:
    d = due_at(state, ctx)
    return d is not None and now >= d


def overdue_days(state: ConceptState, now: datetime,
                 ctx: ReviewContext = ReviewContext()) -> float:
    d = due_at(state, ctx)
    if d is None:
        return 0.0
    return max(0.0, mastery.days_between(d, now))


def forgetting_risk(state: ConceptState, now: datetime) -> float:
    """1 - R, but only counted once the concept was actually known.

    A concept never learned is a gap, not a forgetting risk; conflating the two makes
    the recommender push review at things the student has never seen.
    """
    if state.last_reviewed is None:
        return 0.0
    p = mastery.predicted_p(state)
    if p < mastery.P_PRACTICING:
        return 0.0
    return (1.0 - mastery.current_retrievability(state, now)) * p
