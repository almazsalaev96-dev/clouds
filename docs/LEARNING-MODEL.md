# The Learning Model

This is the normative specification. Both implementations — Python
(`tools/learning-sim/slatelearn`) and Swift (`SlateLearning`) — must produce identical
numbers, enforced by `fixtures/learning-golden.json`.

Every constant here was tuned against the simulation scenarios in
`tools/learning-sim/scenarios.py`, not guessed.

---

## 0. Vocabulary

- **Concept** — the smallest thing you can be good or bad at. "Completing the square",
  not "Quadratics". Concepts form a DAG through `prerequisites`.
- **Attempt** — one recorded try at a question tagged with concepts.
- **Evidence** — an attempt interpreted: outcome × assistance × kind × elapsed time.
- **Ability** — a latent logit per (student, concept): how likely an unaided correct
  answer is.
- **Stability** — how many days memory of the concept survives, in the FSRS sense.

---

## 1. Evidence weighting

An attempt carries three orthogonal facts. Conflating them is the classic mistake.

**Outcome** → raw score `s`

| outcome | s |
|---|---|
| `correct` | 1.0 |
| `partial` | 0.5 |
| `incorrect` | 0.0 |

**Assistance actually used before answering** → credit weight `w`

| assistance | w | meaning |
|---|---|---|
| `none` | 1.00 | solved unaided |
| `nudge` | 0.85 | "look at line 3" |
| `hint` | 0.70 | method named |
| `guided` | 0.50 | walked through with questions |
| `worked` | 0.25 | shown a worked example first |
| `solution` | 0.00 | shown the answer — no ability evidence at all |

A correct answer after being shown the solution is **not evidence of ability**. It is
still evidence of *exposure*, so it updates stability but not ability. This single rule is
what stops the product from congratulating a student for copying.

**Kind** → information gain multiplier `g`

| kind | g | why |
|---|---|---|
| `practice` | 1.00 | baseline |
| `retrieval` | 1.15 | recalled cold, days later |
| `transfer` | 1.30 | same concept, unfamiliar surface |
| `exam` | 1.20 | timed, unaided, realistic |
| `diagnostic` | 1.10 | chosen to discriminate |

Credit `c = s · w`.

---

## 2. Ability

Ability is held as **recency-weighted Beta pseudo-counts**, not a filtered logit.

```
α  successes   prior α₀ = 0.8
β  failures    prior β₀ = 1.2      ⇒  p₀ = 0.40
p  = α / (α + β)                      P(unaided correct when the memory is fresh)
n  = α + β − (α₀ + β₀)                how much evidence stands behind p
```

On each attempt, before the update, old evidence is aged toward the prior:

```
d = 0.5^(Δdays / 120)
α ← α₀ + (α − α₀)·d
β ← β₀ + (β − β₀)·d
```

then

```
α ← α + g · c
β ← β + g · (1 − c)          c = s · w,  g = kind gain
```

The `β` term is the important half. A correct answer *after a hint* is `c = 0.7`, so it
adds 0.7 of a success **and 0.3 of a failure** — because it is direct evidence that the
student could not do it unaided. This is what makes "always correct, always with help"
plateau at `developing` and never reach `reliable`.

**Why not a Kalman filter over a logit.** The first implementation did exactly that. Its
posterior variance collapses after five or six observations, the gain goes with it, and
six consecutive unaided successes stalled below the `reliable` threshold — a student
doing everything right, told they were still developing. Pseudo-counts converge properly
and, unlike a logit, are directly reportable: *six unaided successes, one slip*.

**Rules that override the update entirely:**

- `w = 0` (the solution was shown) → **no ability update at all.** Not a small one. A
  student who was handed the answer has produced no evidence about what they can do.
- `error = careless` → no ability update. A slip is not a knowledge claim.
- `error = unreadable` → nothing is updated except the attempt count. Guessing at
  handwriting we could not read is worse than admitting we could not read it.
- `n = 0` → the derived state is capped at `introduced` regardless of `p`, because `p`
  is then still the prior and a prior is not an achievement.

## 3. Memory: stability, difficulty, retrievability

Power forgetting curve (FSRS-4 form):

```
R(t) = (1 + t / (9·S))^(−1)
```

`t` = days since last review, `S` = stability in days. `R` is the probability of successful
unaided retrieval *right now*.

**On a successful retrieval** (`s ≥ 0.5`):

```
S' = S · (1 + e^A · (11 − D) · S^(−B) · (e^(C·(1−R)) − 1) · h)
A = 0.90, B = 0.22, C = 0.90
h = 1.0 for assistance none/nudge, 0.6 for hint/guided, 0.3 for worked, 0.15 for solution
```

The `(11 − D)` term makes easy concepts consolidate faster; `S^(−B)` gives diminishing
returns on already-strong memories; `e^(C·(1−R))` is the spacing effect — reviewing a
memory you had almost forgotten is worth far more than reviewing a fresh one.

A careless slip takes the **success** branch with `h ≤ 0.6`: the method was retrieved,
the hand slipped, and memory did consolidate.

**On a failure** (`s < 0.5`):

```
S' = max(S_MIN, 2.6 · D^(−0.28) · S^(0.44) · e^(0.36·(1−R)))
```

Failure does not reset stability to zero; partial memory survives a lapse.
`S_MIN = 0.4` days, `S` clipped to `[0.4, 3650]`.

**First exposure** seeds `S` from the outcome: `correct → 3.2`, `partial → 1.6`,
`incorrect → 0.8` days, scaled by `(11 − D)/10`.

**Difficulty** `D ∈ [1, 10]`, starts at 5.0, drifts on each attempt:

```
D' = clamp(D + 0.9 · (0.5 − s) − 0.05 · (D − 5.0), 1, 10)
```

The mean-reverting term stops one catastrophic session from marking a concept as
permanently hard.

---

## 4. Mastery states

Displayed state is derived, never stored. Inputs: `p = σ(θ − δ)`, evidence counts, and
current retrievability `R`.

| state | condition |
|---|---|
| `unseen` | no attempts |
| `introduced` | ≥1 attempt |
| `practicing` | `p ≥ 0.40` |
| `developing` | `p ≥ 0.55` and `n ≥ 3` |
| `reliable` | `p ≥ 0.75`, `independentCorrect ≥ 2`, sessions ≥ 2 |
| `transferable` | `reliable` and `transferCorrect ≥ 1` |
| `mastered` | `transferable`, `p ≥ 0.85`, and `retentionCorrect ≥ 1` where a retention correct is an unaided correct with elapsed ≥ 3 days |

`independentCorrect` counts only `outcome = correct` with `assistance ∈ {none, nudge}`.

**One attempt supplies at most one strong signal.** An unaided transfer success a week
later is both impressive and overdue, but it is still a single observation, so it counts
as transfer evidence *or* retention evidence, never both. Without this rule a single
question jumps a student straight from `reliable` to `mastered`, which is precisely the
overclaiming the state ladder exists to prevent.

**Decay.** The *effective* state at time `t` is downgraded one step for each threshold
crossed downward:

```
R < 0.80 → cap at reliable
R < 0.60 → cap at developing
R < 0.35 → cap at practicing
```

So "mastered" is not a trophy you keep. It expires unless the memory is refreshed, which
is the honest thing to show a student three weeks before an exam.

---

## 5. Scheduling

Next review is when retrievability decays to the target:

```
t_next = 9 · S · (1/R_target − 1)
```

`R_target` adapts:

| situation | R_target |
|---|---|
| default | 0.90 |
| exam within 14 days | 0.93 |
| exam within 5 days | 0.95 |
| concept is a prerequisite of something due | 0.93 |
| student marked it low priority | 0.85 |

Higher target ⇒ shorter interval ⇒ more frequent review as the exam approaches, which
falls out of the formula rather than being a special case.

---

## 6. Misconception inference

A wrong answer is classified into an `ErrorType`:

```
knowledgeGap · misconception · procedural · calculation · reading
interpretation · application · reasoningGap · examTechnique · careless
timeManagement · unreadable · unknown
```

The classifier is the model, but the *pattern* is ours. `MisconceptionDetector` scans the
event log for repeats:

```
signal strength = occurrences · distinctConcepts^0.5 · recencyWeight
recencyWeight   = Σ 0.5^(daysAgo / 14)
```

A pattern is surfaced when `occurrences ≥ 3` and it spans ≥ 2 distinct questions. The
message is then *"you have made this sign error four times across three topics"* rather
than four unrelated "incorrect" marks. This is the difference between a marking app and a
teacher.

`careless` is treated specially: it never lowers ability (it is not a knowledge claim)
and it consolidates memory rather than counting as a lapse, but it does raise an
exam-technique flag once it recurs.

---

## 7. Choosing the next question: expected information gain

For a diagnostic we hold hypotheses `H` — candidate causes — with prior `P(h)`. Each
candidate question `q` has a likelihood table `P(r | h)` over response categories `r`.

```
EIG(q) = H(P) − Σ_r P(r) · H(P(·|r))
P(r)   = Σ_h P(h) · P(r|h)
```

Pick `argmax EIG`, tie-break on shorter expected time. Six well-chosen questions beat
thirty random ones because each is selected to *split the remaining hypotheses*, not to
cover the syllabus.

Entropy is in bits. A question that every hypothesis answers the same way scores 0 and is
never selected — which is exactly the "don't ask what you already know" rule.

---

## 8. Next best action

Every candidate action is scored in **expected mastery gain per minute**:

```
value(a) = Σ_concepts  weight(c) · gain(a, c) · importance(c)
score(a) = value(a) / estimatedMinutes(a)
```

with

```
gain(fix weakness)      = (1 − p) · 0.55           learning a gap you have
gain(retrieval review)  = (1 − R) · p · 0.40       protecting what you know
gain(transfer probe)    = 0.25 if reliable and no transfer evidence, else 0
gain(finish assignment) = deadlineUrgency · 0.9    non-learning but real
gain(diagnostic)        = normalisedEntropy · 0.5  when the model is uncertain
gain(rest)              = fatigue² · 0.6           yes, resting can win
```

`importance(c)` combines exam weight, prerequisite fan-out in the concept DAG, and how
often the concept appears in the student's own upcoming work.

`deadlineUrgency` is `clamp(1 − hoursRemaining / 72, 0, 1)^1.5` so a Friday deadline
starts mattering on Wednesday, not on Friday.

**Rest is a real candidate action.** After 50 minutes of continuous work `fatigue` rises
and a short break can legitimately outscore more practice. A study product that can never
recommend stopping is optimising for the wrong thing.

---

## 9. Independence

Tracked because it is the actual goal.

```
independence = Σ w_i · s_i / Σ s_i      over the last 20 attempts on a concept
```

Reported, never used to gate features or scold. When independence is falling while
accuracy is flat, the tutor shifts its default rung down the ladder — offering a nudge
where it previously offered an explanation.

---

## 9b. Interventions: the shortest sequence that fixes it

"Fix this" is the product's most-used promise, so what sits behind it is derived from
the evidence rather than a fixed lesson template.

```
diagnose?  →  prerequisite?  →  teach  →  example?  →  guided  →  practise  →  verify
```

Which steps appear depends on the state:

| Situation | Plan |
|---|---|
| `reliable` but `R < 0.7` | `practise → verify` only. This is a recall problem; re-teaching it would be slower and mildly insulting. |
| `reliable`, no transfer evidence | `transfer` alone. |
| uncertain, or `0.25 < p < 0.55` with no known error | prepend `diagnose`. Teaching the wrong thing costs more than two minutes spent finding out. |
| a prerequisite is weak | prepend `prerequisite`. Fixing the symptom leaves the cause. |
| everything else | the full sequence, teaching with the next untried strategy. |

**Strategy escalation.** A failed explanation is never repeated in different words. The
order moves from telling towards asking:

```
explanation → workedExample → guidedQuestion → analogy → visual
            → prerequisite → counterexample → retrievalPrompt
```

If the teaching step is already a worked example, the separate example step is dropped:
it would be the same thing twice.

**Time budgeting.** Steps are removed in a fixed order —
`transfer, example, diagnose, guided, prerequisite, practise` — until the plan fits.
`verify` is not in that list. An intervention that skips verification has not been
shortened, it has been abandoned, so a three-minute budget produces `teach → verify`
rather than a lesson with nothing at the end of it.

**Follow-up** is scheduled from the stability the concept *would* have after one
successful unaided review, so the return visit is planned from where the student will
be rather than from where they are now.

**Did it work?** `verifyPassed` requires two things: the unaided probability moved, and
an independent success was added. Getting the last question right after being shown the
answer fails both, which is the point.

---

## 10. What the model refuses to do

- It will not call something mastered on a single correct answer.
- It will not credit ability to an answer produced after the solution was shown.
- It will not report a mastery state from handwriting the recogniser flagged as
  low-confidence; that evidence is recorded as `unreadable` and excluded.
- It will not silently keep old beliefs when the events behind them are deleted.
