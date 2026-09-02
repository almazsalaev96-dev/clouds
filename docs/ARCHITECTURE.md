# Slate — Architecture

Slate is an AI-native study workspace for iPad. The PDF is the canvas, Apple Pencil is
the input, the tutor is contextual, and every piece of work the student does becomes
**evidence** that drives what happens next.

This document records the decisions. Where the source specification suggested one thing
and a better option existed, the deviation is recorded under **Decision** with a reason.

---

## 1. The one idea that shapes everything

> **Work produces evidence. Evidence derives understanding. Understanding decides what happens next.**

Concretely: nothing in the product stores a *conclusion* as primary state. There is one
append-only `LearningEvent` log. Mastery, weakness, recommendations, and study plans are
**derived projections** over that log.

Why this matters more than it sounds:

| Property | Consequence |
|---|---|
| Explainable | "Why am I being shown this?" is answered by replaying the events that produced the score. |
| Reversible | A student can delete a document, a session, or a whole subject and the model *recomputes* rather than carrying orphaned beliefs. |
| Improvable | When the mastery model is tuned in v2, historic evidence is re-scored. No migration of opinions. |
| Testable | The engine is a pure function `([Event], Date) -> Projection`. It has golden tests (§6). |

**Decision (deviation):** the spec described a "personal learning model" that accumulates.
An accumulating model cannot be corrected or explained. Slate stores facts and derives
opinions instead.

---

## 2. Layers

```
┌──────────────────────────────────────────────────────────────┐
│  SURFACE     Desk · Work · Study · Knowledge · Workspace      │
├──────────────────────────────────────────────────────────────┤
│  WORK        Documents · Ink · Annotations · Assignments      │
│              Export · Submission · Versions                    │
├──────────────────────────────────────────────────────────────┤
│  INTELLIGENCE  ContextEngine · Vision/OCR · QuestionMap       │
│                Tutor · Checker · Generator                     │
├──────────────────────────────────────────────────────────────┤
│  EVIDENCE    LearningEvent log (append-only, on device)       │
├──────────────────────────────────────────────────────────────┤
│  PROJECTION  Mastery · Retention · Misconceptions             │
│              NextBestAction · StudyPlan                        │
└──────────────────────────────────────────────────────────────┘
```

Layers only depend downward. The Surface never talks to a provider; it talks to
projections and engines. This is enforced by SPM module boundaries — `SlateUI` cannot
import `SlateAI`'s transport, only its protocol.

---

## 3. Where code runs

| Concern | Location | Reason |
|---|---|---|
| Documents, ink, annotations, export, versions | **Device** | Must work offline. Student work never needs a server to be usable. |
| Learning event log and all projections | **Device** | Privacy. The learning model is the most sensitive data in the product and it never leaves. |
| AI reasoning, vision, generation | **Gateway → provider** | Secrets cannot live in a client. |
| Voice synthesis | **Gateway → ElevenLabs** | Same. |
| Deterministic grading (numeric/symbolic/units) | **Gateway** | Needs a CAS; also lets us grade *before* spending a model call, and disagree with the model when it is wrong. |

**The client holds no API keys.** The gateway holds them in environment variables and is
the only network peer the app talks to.

```
iPad ──TLS──▶ Slate Gateway ──▶ Anthropic API
                    │
                    └──────────▶ ElevenLabs API
```

---

## 4. Why there is a deterministic grader

The single biggest failure mode of "AI checks my homework" is confident wrong marking.
A language model asked "is `x = -3/2` equal to `-1.5`?" usually says yes and sometimes
says no, and you cannot tell which run you got.

Slate splits the job:

1. **Deterministic first.** `server/src/grading` parses both the expected answer and the
   student's answer into an expression tree, normalises units, and decides equivalence by
   numeric probing at random sample points plus exact rational arithmetic. This answers
   *correct / incorrect* with certainty for anything algebraic or numeric.
2. **Model second, for meaning only.** The model is asked *why* it went wrong and how to
   teach it — never whether it is right, when the grader already knows.
3. **Model alone only when the grader abstains** (essays, explanations, diagrams), and
   then the response carries an explicit `confidence` and the UI says so.

**Decision:** the grader may *overrule* the model. If the grader says equivalent and the
model says wrong, the verdict is correct and the model's rationale is discarded. This is
implemented in `verdictReconciler` and tested.

---

## 5. Context Engine

The tutor is useless if the student has to explain what "this" means, and unaffordable if
every question ships the whole PDF.

`ContextEngine` builds a `TutorContext` under a **token budget** by priority:

```
1. focus          the selected region / tapped question       (always)
2. studentWork    ink strokes inside the answer region        (always if present)
3. questionText   OCR of the detected question                (always if present)
4. attemptHistory previous attempts on this question          (high)
5. conversation   last N turns, summarised beyond N           (high)
6. pageText       remaining text of the current page          (medium)
7. figures        diagrams intersecting the focus region      (medium)
8. neighbours     text of adjacent pages                      (low)
9. profile        concept-level mastery hints, no identity    (low)
```

Everything is assembled locally, budgeted, then **redacted** (§ PRIVACY.md) before it
leaves the device. The gateway independently enforces the same caps — the client is not
trusted to be small or clean.

---

## 6. Cross-language golden tests

The learning engine exists twice: once in Python (`tools/learning-sim`, the reference and
tuning harness) and once in Swift (`SlateLearning`, what actually ships).

To stop them drifting, the Python reference emits `fixtures/learning-golden.json`:
scenario inputs plus expected outputs to 9 decimal places. The Swift `XCTest` suite loads
the same file and asserts parity. A change to the model must regenerate the fixture, and
CI fails if the committed fixture does not match a fresh run.

This is why the numbers in the model can be trusted without a Mac in the loop.

---

## 7. Non-destructive document model

An imported PDF is copied once into `Documents/<id>/original.pdf` and then **never
written to again**. Everything the student does is a separate layer:

```
original.pdf        immutable source, checksummed at import
ink.slateink        PencilKit drawings, one per page, journalled
annotations.json    highlights, shapes, text boxes, images
typed.json          typed answers bound to question regions
versions/           snapshots: working, final, submitted
```

Export composites the layers onto a *copy* of the original. Submission freezes an exact
byte copy under `versions/submitted-<timestamp>.pdf` so "what did I actually send" is
always answerable.

---

## 8. Durability

Losing Pencil strokes is unforgivable, so saving is journalled rather than periodic:

- Every stroke commit appends a delta record to a write-ahead log (`ink.wal`).
- Every 30 seconds of idle, or 200 deltas, a snapshot is written to a temp file and
  atomically renamed over `ink.slateink`, then the WAL is truncated.
- On launch, if a WAL exists with records beyond the snapshot, they are replayed and the
  student is told *"Your recent work was recovered"* — after the recovery, not before.

The same journal pattern covers annotations and typed answers.

---

## 9. Module map

```
SlateKit (SPM)
├── SlateFoundation   ids, clock, result types, logging, feature flags
├── SlateModel        entities + the LearningEvent log + projections' inputs
├── SlateLearning     mastery, retention, misconceptions, scheduling, EIG, next action
├── SlateDocuments    import, PDF, question map, layers, versions, export
├── SlateInk          PencilKit integration, journal, recognition bridge
├── SlateAI           protocols + gateway client + context engine + contracts
├── SlateVoice        VoiceProvider protocol + streaming player
├── SlateDesign       tokens, type scale, components, motion
└── SlateUI           screens, composed from everything above
Slate (app target)    lifecycle, DI container, deep links, scenes
```

Dependency rule: a module may import modules listed above it, never below.
`SlateLearning` imports only `SlateFoundation` and `SlateModel` — this is what makes it
testable on any platform.

---

## 10. What the product is not

- Not a chat window bolted to a PDF. There is no persistent chat pane; the tutor is
  summoned to a place on the page and dismissed.
- Not an answer machine. The default assistance ladder starts at a nudge. The full
  solution is always one tap away and is never withheld, but it is never the default.
- Not a streak app. There are no XP, no leaderboards, no loss-aversion notifications.
- Not cloud-dependent. Every non-AI feature works in airplane mode.

---

## 11. Build order (each slice usable before the next starts)

1. **Canvas** — Desk → import → PDF → Pencil → journal → recover → export. *(source complete)*
2. **Tutor** — select → context → check/hint/explain, deterministic grading first. *(source + gateway complete)*
3. **Voice** — ElevenLabs streaming, barge-in. *(gateway complete, client player complete)*
4. **Assignments** — finish → review → export → send → history. *(source complete)*
5. **Assessment** — generate → answer in ink → grade → diagnose. *(gateway + engine complete)*
6. **Learning engine** — mastery, spacing, transfer, next action. *(complete + golden-tested)*
7. **Advanced** — adaptive diagnostics by information gain. *(complete + tested)*

See `STATUS.md` for what is verified versus what is written but uncompiled.
