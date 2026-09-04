"""Slate learning engine — reference implementation.

This package is the normative source for the numbers in `SlateLearning` (Swift).
`python3 -m slatelearn.golden` regenerates `fixtures/learning-golden.json`, which the
Swift test suite loads and asserts against. CI fails if the two drift.
"""

from .types import (  # noqa: F401
    Assistance, Attempt, AttemptKind, ConceptState, ErrorType, MasteryState, Outcome,
)
from . import eig, engine, mastery, misconception, nextaction, scheduling  # noqa: F401

__all__ = [
    "Assistance", "Attempt", "AttemptKind", "ConceptState", "ErrorType",
    "MasteryState", "Outcome",
    "eig", "engine", "mastery", "misconception", "nextaction", "scheduling",
]
__version__ = "1.0.0"
