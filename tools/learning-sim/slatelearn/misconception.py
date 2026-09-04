"""Turning repeated wrong answers into one named pattern.

Spec: docs/LEARNING-MODEL.md section 6.

The point of this module is the difference between a marking app and a teacher.
Four unrelated "incorrect" marks are noise; "you have dropped a negative sign four
times across three topics" is a lesson.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from .types import Attempt, ErrorType, Outcome

MIN_OCCURRENCES = 3
MIN_DISTINCT_QUESTIONS = 2
RECENCY_HALF_LIFE_DAYS = 14.0


@dataclass
class Pattern:
    error_type: ErrorType
    occurrences: int
    distinct_concepts: int
    distinct_questions: int
    concept_ids: List[str] = field(default_factory=list)
    last_seen: Optional[datetime] = None
    strength: float = 0.0

    def to_dict(self) -> dict:
        return {
            "errorType": self.error_type.value,
            "occurrences": self.occurrences,
            "distinctConcepts": self.distinct_concepts,
            "distinctQuestions": self.distinct_questions,
            "conceptIds": sorted(self.concept_ids),
            "lastSeen": self.last_seen.isoformat() if self.last_seen else None,
            "strength": round(self.strength, 9),
        }


def recency_weight(at: datetime, now: datetime) -> float:
    days = max(0.0, (now - at).total_seconds() / 86400.0)
    return 0.5 ** (days / RECENCY_HALF_LIFE_DAYS)


def detect(attempts: Iterable[Attempt], now: datetime) -> List[Pattern]:
    """Find error patterns worth telling the student about, strongest first."""
    buckets: Dict[ErrorType, List[Attempt]] = {}
    for a in attempts:
        if a.outcome is Outcome.CORRECT or a.error_type is None:
            continue
        if a.error_type in (ErrorType.UNKNOWN, ErrorType.UNREADABLE):
            continue
        buckets.setdefault(a.error_type, []).append(a)

    out: List[Pattern] = []
    for etype, group in buckets.items():
        concepts = {a.concept_id for a in group}
        questions = {a.question_id for a in group if a.question_id}
        if len(group) < MIN_OCCURRENCES:
            continue
        if max(len(questions), 1) < MIN_DISTINCT_QUESTIONS:
            continue
        recency = sum(recency_weight(a.at, now) for a in group)
        strength = len(group) * math.sqrt(len(concepts)) * recency
        out.append(
            Pattern(
                error_type=etype,
                occurrences=len(group),
                distinct_concepts=len(concepts),
                distinct_questions=len(questions),
                concept_ids=sorted(concepts),
                last_seen=max(a.at for a in group),
                strength=strength,
            )
        )
    out.sort(key=lambda p: (-p.strength, p.error_type.value))
    return out


def headline(p: Pattern) -> str:
    """Plain wording. No exclamation marks, no blame."""
    what = {
        ErrorType.CALCULATION: "arithmetic slips",
        ErrorType.MISCONCEPTION: "the same misunderstanding",
        ErrorType.PROCEDURAL: "steps applied in the wrong order",
        ErrorType.READING: "misread questions",
        ErrorType.INTERPRETATION: "misreadings of what the question asked for",
        ErrorType.APPLICATION: "trouble applying a method you know",
        ErrorType.REASONING_GAP: "missing steps in your reasoning",
        ErrorType.EXAM_TECHNIQUE: "marks lost to how the answer was written",
        ErrorType.KNOWLEDGE_GAP: "a gap in the underlying idea",
        ErrorType.CARELESS: "avoidable slips",
        ErrorType.TIME_MANAGEMENT: "running out of time",
    }.get(p.error_type, "the same kind of mistake")
    scope = (
        f"across {p.distinct_concepts} topics"
        if p.distinct_concepts > 1
        else "in this topic"
    )
    return f"{p.occurrences} {what} {scope}."
