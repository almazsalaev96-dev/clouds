# Architecture

## The shape of the thing

Lodestar is an **adaptive learning system**, not a content site. The content is
data supplied in packs; the product is the set of engines that decide what a
student should do next, and the evidence model those decisions rest on.

```
content/                 subject material — YAML and Markdown, supplied by you
  <pack>/…               validated on load, referentially checked

src/domain/              the engines. Pure TypeScript: no IO, no React, no DOM
  types.ts               shared primitives, Estimate<T>
  curriculum.ts          Qualification → Syllabus → Paper → Topic → Objective
  question.ts            universal question model, mark schemes, attempts
  mastery.ts             six-signal mastery, forgetting curve
  scheduling.ts          exam-aware FSRS-family scheduler
  priority.ts            marks-per-hour ranking
  adaptive.ts            next-item selection, interleaving
  mistakes.ts            mark-loss taxonomy, repair ladders
  readiness.ts           eight-dimension readiness, grade forecasting
  planner.ts             session and plan generation
  events.ts              typed analytics log, calibration

src/content/             schemas, loader, validator
src/store/               local-first persistence, React provider
src/view/                joins content × student state → view models
src/ai/                  provider abstraction, prompts (server only)
src/ui/                  design system and screens
app/                     Next.js App Router; app/api/ai/* are the only routes
```

**The dependency rule:** `domain` depends on nothing. `view` depends on `domain`
and `content`. `ui` depends on all three. Nothing depends on `ui`. This is why
the engines can be unit-tested exhaustively without a browser, and why 75 tests
run in under a second.

---

## Why the engines are pure

The interesting failures in a product like this are not render bugs. They are
"mastery quietly rewards easy questions", "the scheduler puts a review after the
exam", "the ranking prefers topics that are cheap to finish over topics that are
worth marks". Those are all reasoning failures in a function, and they are only
catchable if the function can be called with fabricated evidence and asserted
against.

So every engine takes plain data and returns plain data. `computeMastery` takes
attempts and returns six signals. `review` takes a memory state and a grade and
returns the next state. `rankPriorities` takes topics and returns an ordering
with its own justification attached. None of them read state, and none of them
know what a component is.

---

## The explainability contract

Every derived number rendered in the product carries a `because: string[]`, and
every component that displays one renders a `<Why>` disclosure containing it.

This is a hard rule, not a nicety. A recommendation a student does not believe
is a recommendation they will not follow, and an adaptive system that cannot say
why it chose something is indistinguishable from a random one. `Estimate<T>` in
`domain/types.ts` bundles value, confidence, justification and observation count
so the four cannot drift apart.

The corollary is that the product refuses to state things it cannot support.
`forecastGrade` returns `sufficient: false` below eight recorded attempts rather
than mapping a sceptical prior through grade thresholds — which, before that
check existed, cheerfully told a student who had answered no questions that they
were projected a U.

---

## The evidence model

Everything derives from two immutable logs: **attempts** and **events**.
Nothing is incremented in place. Mastery, retention, priority, readiness,
calibration and every chart are recomputed from the log on each render.

This costs some CPU and buys three things: a metric can be improved
retroactively across a student's whole history, no two components can disagree
about the same fact, and exporting a student's data means exporting one object.

Attempts are versioned against the question they answered
(`questionVersion`), so editing a question never rewrites what a student did
last March.

---

## The marking model

Objectively-markable types (`mcq`, `numeric`, `cloze`, `match`, `order`, …) are
marked exactly by `markObjectively` — deterministic, no AI, no judgement,
including diagnostics for the missing ×100, the inverted formula and the wrong
unit.

Written answers go to a **mark-scheme ledger**: the student resolves each
scheme point to hit / partial / missed, and classifies the cause of any loss
from a fixed taxonomy. This is the single most important design decision in the
product, for three reasons:

1. It is pedagogically the strongest option available. The object of assessment
   in written subjects is the marker's model of a good answer, and applying that
   model is how you learn it.
2. It produces the richest data in the system. A score says 72%; a ledger says
   *seven of your nine lost marks were points made and never developed*, which
   is trainable in days and transfers across every topic.
3. It means the entire product works with no AI at all. AI marking, where
   configured, pre-fills the ledger as a proposal the student can override — it
   is an accelerant on a system that already functions.

---

## Persistence seam

Default persistence is local-first: the whole student record lives in the
browser's IndexedDB, is read and written whole (a heavy year of study is a few
megabytes, so partial updates would add consistency bugs for no gain), and can
be exported as one JSON file.

`src/store/local.ts` is the only module that touches storage, and
`migrate()` runs on every load so a schema change can never cost a student their
attempt history.

The state shape in `src/store/types.ts` is deliberately flat and serialisable so
the same records can later be written to Postgres row-for-row without a
migration of meaning. A server-backed adapter would implement the same read/write
surface; nothing above the store would change.

---

## AI orchestration

Three rules, enforced structurally rather than by convention:

1. **Server only.** `src/ai/index.ts` imports `server-only`. Every call goes
   through `app/api/ai/*`. No key can reach the client.
2. **The product works without it.** `NullProvider` throws a typed
   `AIUnavailableError` carrying the deterministic alternative, which the UI
   renders as a real path — never "something went wrong".
3. **Never the source of truth for assessment.** Prompts are constructed from
   *supplied* authoritative context: the pack's own command-word definitions,
   the actual mark scheme, the student's recorded standing. The model is
   instructed to work from that material and to say plainly when it does not
   have something, rather than producing a plausible mark scheme from memory.

Model routing is by task: mechanical work (classification, summarising) goes to
the fast model; work where being wrong costs the student marks (marking,
tutoring, generation) goes to the reasoning model. That routing, plus caching of
deterministic outputs and a daily request ceiling, is the cost control.

The marking route additionally discards any ledger entry referencing a mark
point that was not supplied — a model that resolves points it was never given
has hallucinated a scheme, and those entries are dropped rather than shown as
marks.

In the interface, AI marking appears as a *proposal*: it pre-fills the ledger,
surfaces its own uncertainty flag rather than swallowing it, and leaves every
row editable. The mark that is saved is the one the student agrees with, and the
attempt records `markedBy: "ai"` so the evidence model knows the difference.

---

## Board-agnosticism

Cambridge is a *configuration*, not an assumption. Assessment objectives, their
per-paper weightings, command words, paper structures, grade scales and grade
thresholds all live in pack data. The engines read them generically.

Adding Edexcel, AQA, OCR or IB is a content exercise, not an engineering one.
The one place boards differ structurally — level-of-response versus points-based
marking — is handled by `MarkScheme.style`, which supports `points`, `levels`
and `hybrid`.

---

## Testing

- **`npm test`** — 75 unit tests over the engines. They assert the properties
  that are easy to get subtly wrong: harder questions moving ability further
  than easy ones; wrong answers on *easy* questions being more informative than
  wrong answers on hard ones; intervals never crossing the exam date; leaf exam
  weights summing to one across a syllabus; technique-dominated mark loss
  producing different advice from knowledge-dominated loss; the forecaster
  refusing to project from nothing.
- **`npm run content:check`** — validates every pack, exits non-zero on errors.
- **`npm run test:e2e`** — drives a real browser through the whole loop and
  asserts against IndexedDB as well as the page, because the failures that
  matter here are a session that silently stops advancing, or attempts that look
  saved and are not.

---

## Deliberate omissions

Things that would be reasonable and are not here yet, listed so their absence
reads as a decision rather than an oversight — see `docs/ROADMAP.md`:

- **No server database.** Local-first is the right default for a single student
  and removes an entire deployment burden. The seam is documented above.
- **No accounts or sync.** Follows from the above.
- **No PDF ingestion.** Requires either a heavy client-side parser or a server
  pipeline; the authoring format covers the same ground for supplied material.
- **No voice mode.** Needs speech-to-text in the provider abstraction, which is
  specified in `AIProvider` but not implemented.
- **No teacher or class features.** These need multi-user storage, which is the
  first thing the persistence seam would be used for.
