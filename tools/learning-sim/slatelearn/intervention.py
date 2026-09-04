"""Turning a weakness into the shortest sequence that actually fixes it.

Spec: docs/LEARNING-MODEL.md sections 13-15 and 49-51.

"Fix this" is the product's most-used promise, so the sequence behind it has to be
principled rather than a fixed lesson template. Three rules shape it:

1. Teach only what is not known. Re-explaining something a student has merely
   forgotten wastes the minutes they were willing to give.
2. Never repeat a teaching approach that already failed. A second explanation in
   different words is not a second attempt.
3. Always verify with a question they have not seen, and schedule the return visit.
   An intervention that ends at "does that make sense?" has measured nothing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Sequence

from . import mastery, scheduling
from .types import Assistance, ConceptState, MasteryState


class StepKind(str, Enum):
    DIAGNOSE = "diagnose"
    TEACH = "teach"
    EXAMPLE = "example"
    GUIDED = "guided"
    PRACTISE = "practise"
    VERIFY = "verify"
    TRANSFER = "transfer"
    PREREQUISITE = "prerequisite"


class Strategy(str, Enum):
    EXPLANATION = "explanation"
    WORKED_EXAMPLE = "workedExample"
    ANALOGY = "analogy"
    VISUAL = "visual"
    GUIDED_QUESTION = "guidedQuestion"
    PREREQUISITE = "prerequisite"
    COUNTEREXAMPLE = "counterexample"
    RETRIEVAL_PROMPT = "retrievalPrompt"


# Order in which alternatives are tried once one has failed. Deliberately moves from
# telling towards asking: a student who did not follow an explanation is more likely to
# be reached by a worked example than by the same explanation lengthened.
STRATEGY_ORDER = [
    Strategy.EXPLANATION,
    Strategy.WORKED_EXAMPLE,
    Strategy.GUIDED_QUESTION,
    Strategy.ANALOGY,
    Strategy.VISUAL,
    Strategy.PREREQUISITE,
    Strategy.COUNTEREXAMPLE,
    Strategy.RETRIEVAL_PROMPT,
]

STEP_MINUTES = {
    StepKind.DIAGNOSE: 2.0,
    StepKind.PREREQUISITE: 3.0,
    StepKind.TEACH: 1.5,
    StepKind.EXAMPLE: 1.5,
    StepKind.GUIDED: 2.0,
    StepKind.PRACTISE: 2.5,
    StepKind.VERIFY: 2.0,
    StepKind.TRANSFER: 2.5,
}

# Steps whose removal costs the least, dropped first when time is short. Verification
# is absent from this list on purpose: an intervention that skips it has not been
# shortened, it has been abandoned.
DROP_ORDER = [
    StepKind.TRANSFER,
    StepKind.EXAMPLE,
    StepKind.DIAGNOSE,
    StepKind.GUIDED,
    StepKind.PREREQUISITE,
    StepKind.PRACTISE,
]

MIN_MINUTES = 3.0


@dataclass(frozen=True)
class Step:
    kind: StepKind
    strategy: Optional[Strategy] = None
    difficulty: str = "medium"
    assistance: Assistance = Assistance.NONE
    minutes: float = 0.0
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "kind": self.kind.value,
            "strategy": self.strategy.value if self.strategy else None,
            "difficulty": self.difficulty,
            "assistance": self.assistance.value,
            "minutes": round(self.minutes, 9),
            "detail": self.detail,
        }


@dataclass
class Intervention:
    concept_id: str
    steps: List[Step] = field(default_factory=list)
    rationale: str = ""
    follow_up_days: float = 0.0
    dropped: List[StepKind] = field(default_factory=list)

    @property
    def minutes(self) -> float:
        return sum(s.minutes for s in self.steps)

    def to_dict(self) -> dict:
        return {
            "conceptId": self.concept_id,
            "steps": [s.to_dict() for s in self.steps],
            "minutes": round(self.minutes, 9),
            "rationale": self.rationale,
            "followUpDays": round(self.follow_up_days, 9),
            "dropped": [k.value for k in self.dropped],
        }


def next_strategy(used: Sequence[Strategy]) -> Strategy:
    """The next approach that has not already failed."""
    for strategy in STRATEGY_ORDER:
        if strategy not in used:
            return strategy
    # Everything has been tried. Go back to the prerequisite rather than round again:
    # if six approaches have failed, the problem is probably upstream of this concept.
    return Strategy.PREREQUISITE


def build(state: ConceptState,
          now: datetime,
          available_minutes: float = 12.0,
          strategies_used: Sequence[Strategy] = (),
          known_error: Optional[str] = None,
          has_weak_prerequisite: bool = False,
          uncertain: bool = False) -> Intervention:
    """The shortest sequence that stands a chance of fixing this concept."""
    fresh = mastery.fresh_state(state)
    p = mastery.predicted_p(state)
    r = mastery.current_retrievability(state, now)
    steps: List[Step] = []

    def add(kind: StepKind, **kwargs) -> None:
        steps.append(Step(kind=kind, minutes=STEP_MINUTES[kind], **kwargs))

    # Case 1: known, but faded. This is a recall problem, not a teaching problem, and
    # re-explaining it would be both slower and mildly insulting.
    if fresh.rank >= MasteryState.RELIABLE.rank and r < 0.7:
        add(StepKind.PRACTISE, difficulty="medium", assistance=Assistance.NONE)
        add(StepKind.VERIFY, difficulty="medium", assistance=Assistance.NONE)
        rationale = (
            f"You could do this before; recall has dropped to {round(r * 100)}%. "
            "No re-teaching, just bringing it back."
        )
        return _fit(Intervention(state.concept_id, steps, rationale), available_minutes, state)

    # Case 2: solid and current, but never tested on unfamiliar ground.
    if fresh.rank >= MasteryState.RELIABLE.rank and state.transfer_correct == 0:
        add(StepKind.TRANSFER, difficulty="hard", assistance=Assistance.NONE)
        rationale = "You can do the standard version. This checks that you understand it."
        return _fit(Intervention(state.concept_id, steps, rationale), available_minutes, state)

    # Case 3: we do not know what is wrong. Ask before teaching, because teaching the
    # wrong thing costs more than the two minutes spent finding out.
    if uncertain or (state.attempts >= 3 and 0.25 < p < 0.55 and known_error is None):
        add(StepKind.DIAGNOSE)

    # Case 4: the weakness is upstream. Fixing the symptom leaves the cause.
    if has_weak_prerequisite:
        add(StepKind.PREREQUISITE)

    strategy = next_strategy(strategies_used)
    add(StepKind.TEACH, strategy=strategy)

    # A worked example earns its place when the student has little to go on, or when
    # explanation alone has already been tried — but not when the teaching step is
    # already a worked example, which would be the same thing twice.
    wants_example = (fresh.rank <= MasteryState.PRACTICING.rank
                     or Strategy.EXPLANATION in strategies_used)
    if wants_example and strategy is not Strategy.WORKED_EXAMPLE:
        add(StepKind.EXAMPLE, strategy=Strategy.WORKED_EXAMPLE)

    add(StepKind.GUIDED, assistance=Assistance.GUIDED, difficulty="easy")
    add(StepKind.PRACTISE, assistance=Assistance.NONE,
        difficulty="easy" if p < 0.4 else "medium")
    add(StepKind.VERIFY, assistance=Assistance.NONE, difficulty="medium")

    if known_error:
        rationale = f"Your last attempts point at {known_error}. This goes straight at it."
    elif fresh is MasteryState.UNSEEN or state.attempts == 0:
        rationale = "New ground, so this starts from the idea itself."
    elif strategies_used:
        rationale = (
            f"The {strategies_used[-1].value} approach did not land, so this one is "
            f"{strategy.value} instead."
        )
    else:
        rationale = f"You are at {round(p * 100)}% unaided on this."

    return _fit(Intervention(state.concept_id, steps, rationale), available_minutes, state)


def _fit(plan: Intervention, available_minutes: float, state: ConceptState) -> Intervention:
    """Trim to the time available, in a defined order, never dropping verification."""
    budget = max(MIN_MINUTES, available_minutes)
    for kind in DROP_ORDER:
        if plan.minutes <= budget:
            break
        remaining = [s for s in plan.steps if s.kind is not kind]
        if len(remaining) == len(plan.steps):
            continue
        if not any(s.kind is StepKind.VERIFY for s in remaining):
            continue
        plan.dropped.append(kind)
        plan.steps = remaining

    plan.follow_up_days = projected_follow_up(state)
    return plan


def projected_follow_up(state: ConceptState) -> float:
    """When to come back, assuming the intervention works.

    Uses the stability the concept would have after one successful unaided review, so
    the first return visit is scheduled from where the student will be rather than from
    where they are now.
    """
    projected = max(state.stability, mastery.S_MIN)
    if projected <= mastery.S_MIN:
        # Nothing to project from yet: come back tomorrow, which is when a newly
        # learned idea is most at risk and most cheaply saved.
        return 1.0
    grown = mastery.clamp(projected * 1.9, mastery.S_MIN, mastery.S_MAX)
    return scheduling.interval_days(grown)


def verify_passed(before: ConceptState, after: ConceptState) -> bool:
    """Did the intervention actually work?

    Not "did they say yes when asked if it made sense". The claim requires the unaided
    probability to have moved and at least one independent success to have been added.
    """
    moved = mastery.predicted_p(after) > mastery.predicted_p(before)
    earned = after.independent_correct > before.independent_correct
    return moved and earned
