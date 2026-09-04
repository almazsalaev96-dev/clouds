# 0001 — FSRS-6, not SM-2

**Decision.** The scheduler is FSRS-6, implemented in `@atlas/learning`.

**Why.** SM-2 (1987) tracks one number per card, an ease factor. FSRS models memory
with three: difficulty, stability and retrievability, fitted on hundreds of millions
of real reviews. In practice that buys the same retention for roughly 20–30% fewer
reviews, and it has been Anki's default since 2023 — it is the modern standard, not
an experiment.

**How.** Ported from the reference implementation rather than from memory: the
default 21-weight vector, initial stability and difficulty, linear damping with mean
reversion, separate recall and forget stability, same-day short-term stability, and
the learning/relearning step machine. Parameter bounds are validated on construction
so a bad optimisation result fails loudly instead of quietly producing nonsense
intervals.

**Consequences.**
- Per-user parameter optimisation becomes possible later without changing any
  call site — the weights are already a constructor argument.
- Interval fuzz is seeded from the card id, not `Math.random`, so two devices
  replaying the same log agree on due dates. This matters for sync (Phase 2).
- The scheduler reads no clock. Every function takes `now`. That is what makes the
  engine testable and the study log replayable.
