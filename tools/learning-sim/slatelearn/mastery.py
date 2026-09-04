"""Mastery: ability, memory and derived state.

Normative spec: docs/LEARNING-MODEL.md sections 1-4.
Every constant is named and exported so the Swift port can assert on the same values.

Ability is held as recency-weighted Beta pseudo-counts rather than a Kalman-filtered
logit. Two reasons: a Kalman posterior's variance collapses after a handful of
observations and the learning rate stalls (six unaided successes stayed below the
"reliable" threshold, which is plainly wrong), and pseudo-counts are directly
explainable to a student: "six unaided successes, one slip".
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

from .types import (
    Assistance,
    Attempt,
    AttemptKind,
    ConceptState,
    ErrorType,
    MasteryState,
    Outcome,
)

# --- ability ---------------------------------------------------------------
ALPHA_0 = 0.8               # prior successes  -> p0 = 0.40, an unseen concept is
BETA_0 = 1.2                # prior failures      assumed not yet known
EVIDENCE_HALF_LIFE = 120.0  # days; how fast old evidence stops counting

# --- memory ----------------------------------------------------------------
S_MIN = 0.4
S_MAX = 3650.0
STAB_A = 0.90
STAB_B = 0.22
STAB_C = 0.90
LAPSE_K = 2.6
LAPSE_D = -0.28
LAPSE_S = 0.44
LAPSE_R = 0.36

# --- difficulty ------------------------------------------------------------
D_MIN, D_MAX = 1.0, 10.0
D_STEP = 0.9
D_REVERT = 0.05

# --- state thresholds ------------------------------------------------------
P_PRACTICING = 0.40
P_DEVELOPING = 0.55
P_RELIABLE = 0.75
P_MASTERED = 0.85
N_DEVELOPING = 3
INDEPENDENT_FOR_RELIABLE = 2
SESSIONS_FOR_RELIABLE = 2
RETENTION_MIN_DAYS = 3.0

# --- decay caps ------------------------------------------------------------
R_CAP_RELIABLE = 0.80
R_CAP_DEVELOPING = 0.60
R_CAP_PRACTICING = 0.35

INDEPENDENCE_WINDOW = 20


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def days_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 86400.0


# --- memory ----------------------------------------------------------------

def retrievability(stability: float, elapsed_days: float) -> float:
    """FSRS power forgetting curve: P(successful unaided retrieval right now)."""
    if stability <= 0.0:
        return 0.0
    t = max(0.0, elapsed_days)
    return (1.0 + t / (9.0 * stability)) ** -1.0


def current_retrievability(state: ConceptState, now: datetime) -> float:
    if state.last_reviewed is None:
        return 0.0
    return retrievability(state.stability, days_between(state.last_reviewed, now))


def _seed_stability(outcome: Outcome, difficulty: float) -> float:
    base = {"correct": 3.2, "partial": 1.6, "incorrect": 0.8}[outcome.value]
    return clamp(base * (11.0 - difficulty) / 10.0, S_MIN, S_MAX)


def _grow_stability(s: float, d: float, r: float, h: float) -> float:
    factor = (
        math.exp(STAB_A)
        * (11.0 - d)
        * (s ** -STAB_B)
        * (math.exp(STAB_C * (1.0 - r)) - 1.0)
        * h
    )
    return clamp(s * (1.0 + factor), S_MIN, S_MAX)


def _lapse_stability(s: float, d: float, r: float) -> float:
    v = LAPSE_K * (d ** LAPSE_D) * (s ** LAPSE_S) * math.exp(LAPSE_R * (1.0 - r))
    return clamp(v, S_MIN, min(s, S_MAX))


# --- ability ---------------------------------------------------------------

def predicted_p(state: ConceptState) -> float:
    """P(unaided correct) when the memory is fresh: 'can you do it when reminded'."""
    total = state.alpha + state.beta
    return state.alpha / total if total > 0 else ALPHA_0 / (ALPHA_0 + BETA_0)


def evidence_strength(state: ConceptState) -> float:
    """Effective observations behind `predicted_p`, excluding the prior."""
    return max(0.0, state.alpha + state.beta - (ALPHA_0 + BETA_0))


def ability_variance(state: ConceptState) -> float:
    a, b = state.alpha, state.beta
    n = a + b
    return (a * b) / (n * n * (n + 1.0))


def _age_evidence(state: ConceptState, elapsed_days: Optional[float]) -> None:
    if elapsed_days is None or elapsed_days <= 0.0:
        return
    d = 0.5 ** (elapsed_days / EVIDENCE_HALF_LIFE)
    state.alpha = ALPHA_0 + (state.alpha - ALPHA_0) * d
    state.beta = BETA_0 + (state.beta - BETA_0) * d


# --- the fold --------------------------------------------------------------

def apply(state: ConceptState, attempt: Attempt) -> ConceptState:
    """Fold one attempt into a concept state. Pure: returns a new state."""
    s = state.copy()
    score = attempt.outcome.score
    w = attempt.assistance.credit_weight
    g = attempt.kind.gain

    elapsed = (
        days_between(s.last_reviewed, attempt.at) if s.last_reviewed is not None else None
    )
    r_before = retrievability(s.stability, elapsed) if elapsed is not None else 0.0

    counts = attempt.error_type is None or attempt.error_type.counts_against_ability
    unreadable = attempt.error_type is ErrorType.UNREADABLE

    # --- ability -----------------------------------------------------------
    # A solved-for answer carries no information about unaided ability, a careless
    # slip is not a knowledge claim, and unreadable work is not evidence of anything.
    if w > 0.0 and counts and not unreadable:
        _age_evidence(s, elapsed)
        credit = score * w
        s.alpha += g * credit
        s.beta += g * (1.0 - credit)

    # --- difficulty --------------------------------------------------------
    if not unreadable:
        s.difficulty = clamp(
            s.difficulty + D_STEP * (0.5 - score) - D_REVERT * (s.difficulty - 5.0),
            D_MIN,
            D_MAX,
        )

    # --- memory ------------------------------------------------------------
    if not unreadable:
        # A careless slip means retrieval of the method succeeded, so it consolidates
        # memory rather than counting as a lapse.
        careless = attempt.error_type is ErrorType.CARELESS
        succeeded = score >= 0.5 or careless
        h = attempt.assistance.consolidation
        if careless and score < 0.5:
            h = min(h, 0.60)
        if s.last_reviewed is None or s.stability <= 0.0:
            s.stability = _seed_stability(attempt.outcome, s.difficulty)
        elif succeeded:
            s.stability = _grow_stability(s.stability, s.difficulty, r_before, h)
        else:
            s.stability = _lapse_stability(s.stability, s.difficulty, r_before)
        s.last_reviewed = attempt.at

    # --- counters ----------------------------------------------------------
    s.attempts += 1
    if attempt.session_id:
        s.sessions = s.sessions | {attempt.session_id}
    if attempt.outcome is Outcome.CORRECT and attempt.assistance.is_independent:
        s.independent_correct += 1
        # One attempt supplies at most one of the two strong signals. A transfer
        # success days later is impressive, but it is still a single observation
        # and must not satisfy both requirements for mastery on its own.
        if attempt.kind is AttemptKind.TRANSFER:
            s.transfer_correct += 1
        elif elapsed is not None and elapsed >= RETENTION_MIN_DAYS:
            s.retention_correct += 1
    if attempt.error_type is ErrorType.CARELESS:
        s.careless_slips += 1

    window = list(s.recent_credit) + [(w, score)]
    s.recent_credit = tuple(window[-INDEPENDENCE_WINDOW:])
    return s


# --- derived state ---------------------------------------------------------

def fresh_state(state: ConceptState) -> MasteryState:
    """State ignoring forgetting: what the student could do today if reminded."""
    if state.attempts == 0:
        return MasteryState.UNSEEN
    # No ability evidence means no ability claim. A student who has only ever been
    # shown solutions sits at the prior, and the prior is not an achievement.
    if evidence_strength(state) <= 0.0:
        return MasteryState.INTRODUCED
    p = predicted_p(state)
    reliable = (
        p >= P_RELIABLE
        and state.independent_correct >= INDEPENDENT_FOR_RELIABLE
        and len(state.sessions) >= SESSIONS_FOR_RELIABLE
    )
    if reliable and state.transfer_correct >= 1:
        if p >= P_MASTERED and state.retention_correct >= 1:
            return MasteryState.MASTERED
        return MasteryState.TRANSFERABLE
    if reliable:
        return MasteryState.RELIABLE
    if p >= P_DEVELOPING and state.attempts >= N_DEVELOPING:
        return MasteryState.DEVELOPING
    if p >= P_PRACTICING:
        return MasteryState.PRACTICING
    return MasteryState.INTRODUCED


def effective_state(state: ConceptState, now: datetime) -> MasteryState:
    """What the student can actually do *now*, after forgetting."""
    base = fresh_state(state)
    if base is MasteryState.UNSEEN:
        return base
    r = current_retrievability(state, now)
    cap = MasteryState.MASTERED
    if r < R_CAP_RELIABLE:
        cap = MasteryState.RELIABLE
    if r < R_CAP_DEVELOPING:
        cap = MasteryState.DEVELOPING
    if r < R_CAP_PRACTICING:
        cap = MasteryState.PRACTICING
    return MasteryState.at_rank(min(base.rank, cap.rank))


def independence(state: ConceptState) -> Optional[float]:
    """Share of recent success that was earned unaided. None when there is no success."""
    total = sum(sc for _, sc in state.recent_credit)
    if total <= 0.0:
        return None
    return sum(w * sc for w, sc in state.recent_credit) / total
