"""Choosing the question that tells us the most.

Spec: docs/LEARNING-MODEL.md section 7.

A diagnostic is not a small exam. Its job is to *split hypotheses*: given several
possible reasons a student is going wrong, ask the question whose answer most reduces
uncertainty about which reason it is. Six such questions beat thirty random ones.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

EPS = 1e-12


@dataclass(frozen=True)
class Hypothesis:
    """A candidate explanation for the student's performance."""

    id: str
    label: str
    prior: float


@dataclass(frozen=True)
class CandidateQuestion:
    """A question we could ask, with how each hypothesis would answer it.

    `likelihoods[hypothesis_id][response] = P(response | hypothesis)`; each inner map
    must sum to 1. Response categories are diagnostic *signatures*, not just
    correct/incorrect: "answered with the sign flipped" is its own category, and that
    is where the discriminating power comes from.
    """

    id: str
    prompt: str
    likelihoods: Dict[str, Dict[str, float]]
    estimated_minutes: float = 1.5
    concept_id: str = ""

    def responses(self) -> List[str]:
        seen: List[str] = []
        for table in self.likelihoods.values():
            for r in table:
                if r not in seen:
                    seen.append(r)
        return sorted(seen)


def entropy(dist: Sequence[float]) -> float:
    """Shannon entropy in bits."""
    h = 0.0
    for p in dist:
        if p > EPS:
            h -= p * math.log2(p)
    return h


def normalise(weights: Dict[str, float]) -> Dict[str, float]:
    total = sum(weights.values())
    if total <= EPS:
        n = len(weights)
        return {k: 1.0 / n for k in weights} if n else {}
    return {k: v / total for k, v in weights.items()}


def prior_map(hypotheses: Sequence[Hypothesis]) -> Dict[str, float]:
    return normalise({h.id: max(0.0, h.prior) for h in hypotheses})


def response_marginal(prior: Dict[str, float],
                      q: CandidateQuestion) -> Dict[str, float]:
    """P(response) = sum_h P(h) P(response | h)."""
    out: Dict[str, float] = {}
    for r in q.responses():
        out[r] = sum(prior.get(h, 0.0) * table.get(r, 0.0)
                     for h, table in q.likelihoods.items())
    return out


def posterior(prior: Dict[str, float], q: CandidateQuestion,
              response: str) -> Dict[str, float]:
    """Bayes update after actually observing a response."""
    weights = {
        h: prior.get(h, 0.0) * q.likelihoods.get(h, {}).get(response, 0.0)
        for h in prior
    }
    if sum(weights.values()) <= EPS:
        # The observation is impossible under every hypothesis we hold. Refuse to
        # invent certainty: keep the prior and let the caller widen the hypothesis set.
        return dict(prior)
    return normalise(weights)


def expected_information_gain(prior: Dict[str, float],
                              q: CandidateQuestion) -> float:
    """Bits of uncertainty about the cause that this question is expected to remove."""
    h_prior = entropy(list(prior.values()))
    marg = response_marginal(prior, q)
    h_post = 0.0
    for r, pr in marg.items():
        if pr <= EPS:
            continue
        h_post += pr * entropy(list(posterior(prior, q, r).values()))
    return max(0.0, h_prior - h_post)


def rank(prior: Dict[str, float],
         candidates: Sequence[CandidateQuestion]) -> List[Tuple[CandidateQuestion, float]]:
    """Questions by information gain per minute, best first.

    A question every hypothesis answers identically scores zero and is never chosen.
    That is the 'do not ask what you already know' rule, and it is arithmetic rather
    than a heuristic.
    """
    scored = [
        (q, expected_information_gain(prior, q) / max(0.25, q.estimated_minutes))
        for q in candidates
    ]
    scored.sort(key=lambda t: (-t[1], t[0].estimated_minutes, t[0].id))
    return scored


def select_next(prior: Dict[str, float], candidates: Sequence[CandidateQuestion],
                asked: Sequence[str] = ()) -> Optional[CandidateQuestion]:
    remaining = [q for q in candidates if q.id not in set(asked)]
    if not remaining:
        return None
    best, gain = rank(prior, remaining)[0]
    return best if gain > EPS else None


@dataclass
class DiagnosticRun:
    prior: Dict[str, float]
    asked: List[str] = field(default_factory=list)
    transcript: List[Tuple[str, str]] = field(default_factory=list)

    def observe(self, q: CandidateQuestion, response: str) -> None:
        self.prior = posterior(self.prior, q, response)
        self.asked.append(q.id)
        self.transcript.append((q.id, response))

    @property
    def leading(self) -> Tuple[str, float]:
        h = max(self.prior.items(), key=lambda kv: (kv[1], kv[0]))
        return h

    def is_confident(self, threshold: float = 0.80) -> bool:
        return self.leading[1] >= threshold

    def remaining_uncertainty(self) -> float:
        return entropy(list(self.prior.values()))


def run_adaptive(hypotheses: Sequence[Hypothesis],
                 candidates: Sequence[CandidateQuestion],
                 responder,
                 max_questions: int = 6,
                 confidence: float = 0.80) -> DiagnosticRun:
    """Ask, observe, re-select. Stops as soon as it is confident enough.

    `responder(question) -> response` supplies the student's answer; in tests it is a
    simulated student, in the app it is the grader's category for the real answer.
    """
    run = DiagnosticRun(prior=prior_map(hypotheses))
    for _ in range(max_questions):
        if run.is_confident(confidence):
            break
        q = select_next(run.prior, candidates, run.asked)
        if q is None:
            break
        run.observe(q, responder(q))
    return run
