"""Core value types for the Slate learning engine reference implementation.

This module is intentionally dependency-free (stdlib only) so it can act as the
normative oracle for the Swift implementation in `SlateLearning`.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class Outcome(str, Enum):
    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"

    @property
    def score(self) -> float:
        return {"correct": 1.0, "partial": 0.5, "incorrect": 0.0}[self.value]


class Assistance(str, Enum):
    """How much help was actually consumed *before* the answer was given."""

    NONE = "none"
    NUDGE = "nudge"
    HINT = "hint"
    GUIDED = "guided"
    WORKED = "worked"
    SOLUTION = "solution"

    @property
    def credit_weight(self) -> float:
        return {
            "none": 1.00,
            "nudge": 0.85,
            "hint": 0.70,
            "guided": 0.50,
            "worked": 0.25,
            "solution": 0.00,
        }[self.value]

    @property
    def consolidation(self) -> float:
        """`h` in the stability update: how much a review consolidates memory."""
        return {
            "none": 1.00,
            "nudge": 1.00,
            "hint": 0.60,
            "guided": 0.60,
            "worked": 0.30,
            "solution": 0.15,
        }[self.value]

    @property
    def is_independent(self) -> bool:
        return self in (Assistance.NONE, Assistance.NUDGE)


class AttemptKind(str, Enum):
    PRACTICE = "practice"
    RETRIEVAL = "retrieval"
    TRANSFER = "transfer"
    EXAM = "exam"
    DIAGNOSTIC = "diagnostic"

    @property
    def gain(self) -> float:
        return {
            "practice": 1.00,
            "retrieval": 1.15,
            "transfer": 1.30,
            "exam": 1.20,
            "diagnostic": 1.10,
        }[self.value]


class ErrorType(str, Enum):
    KNOWLEDGE_GAP = "knowledgeGap"
    MISCONCEPTION = "misconception"
    PROCEDURAL = "procedural"
    CALCULATION = "calculation"
    READING = "reading"
    INTERPRETATION = "interpretation"
    APPLICATION = "application"
    REASONING_GAP = "reasoningGap"
    EXAM_TECHNIQUE = "examTechnique"
    CARELESS = "careless"
    TIME_MANAGEMENT = "timeManagement"
    UNREADABLE = "unreadable"
    UNKNOWN = "unknown"

    @property
    def counts_against_ability(self) -> bool:
        """A slip is not a knowledge claim, and unreadable work is not evidence."""
        return self not in (ErrorType.CARELESS, ErrorType.UNREADABLE)


class MasteryState(str, Enum):
    UNSEEN = "unseen"
    INTRODUCED = "introduced"
    PRACTICING = "practicing"
    DEVELOPING = "developing"
    RELIABLE = "reliable"
    TRANSFERABLE = "transferable"
    MASTERED = "mastered"

    @property
    def rank(self) -> int:
        return _STATE_ORDER.index(self)

    @classmethod
    def at_rank(cls, r: int) -> "MasteryState":
        return _STATE_ORDER[max(0, min(r, len(_STATE_ORDER) - 1))]


_STATE_ORDER = [
    MasteryState.UNSEEN,
    MasteryState.INTRODUCED,
    MasteryState.PRACTICING,
    MasteryState.DEVELOPING,
    MasteryState.RELIABLE,
    MasteryState.TRANSFERABLE,
    MasteryState.MASTERED,
]


@dataclass(frozen=True)
class Attempt:
    """One recorded try at a question, already attributed to a single concept.

    A question tagged with several concepts produces one Attempt per concept; the
    engine never blurs evidence across concepts.
    """

    concept_id: str
    at: datetime
    outcome: Outcome
    assistance: Assistance = Assistance.NONE
    kind: AttemptKind = AttemptKind.PRACTICE
    error_type: Optional[ErrorType] = None
    session_id: str = ""
    question_id: str = ""
    confidence: Optional[float] = None
    seconds_spent: Optional[float] = None

    def __post_init__(self) -> None:
        if self.at.tzinfo is None:
            object.__setattr__(self, "at", self.at.replace(tzinfo=timezone.utc))


@dataclass
class ConceptState:
    """Derived state for one (student, concept). Never authored directly."""

    concept_id: str
    alpha: float = 0.8
    beta: float = 1.2
    difficulty: float = 5.0
    stability: float = 0.0
    last_reviewed: Optional[datetime] = None
    attempts: int = 0
    independent_correct: int = 0
    transfer_correct: int = 0
    retention_correct: int = 0
    careless_slips: int = 0
    sessions: frozenset = field(default_factory=frozenset)
    recent_credit: tuple = ()  # rolling window of (weight, score) for independence

    def copy(self) -> "ConceptState":
        return replace(self)
