# The interface

The rule the whole design serves:

> **The interface should disappear when the student is learning.**

Priority order, on the screen and in the code: the student's work, then their
attention, then the AI, then navigation. Every decision below follows from that
ordering, and where a decision cost something, the cost is stated.

---

## The AI is a layer, not a screen

The failure mode this design exists to avoid is *PDF viewer with a chatbot bolted
to the side*. Three things prevent it.

**The interface knows what is being looked at.** `Workspace.context()` is the
single source of that knowledge — a question, a lassoed piece of the student's own
handwriting, or the page. Every AI surface reads from it: the composer's
placeholder ("Ask about this question…" / "Ask about your working…"), the actions
offered over a selection, and what the tutor is told. So "explain this" works with
nothing typed and nothing described, which is the entire point.

**The AI has one colour and it means one thing.** `--ai` (violet) appears only
where there is intelligence: the tutor mark, the context chip, suggestion chips,
the AI's own eyebrow labels. Primary blue does ordinary work — Check, Start,
selected tabs. A student learns the violet in a minute without being told, and it
stays trustworthy only because it is never spent on an ordinary button.

**The AI's signature is a dot.** No robot, no sparkles scattered through the
interface, no glow. `.ai-mark` breathes while a request is in flight and rests
otherwise. That is the whole visual language.

## Answers are edited, not chatted

An AI reply is a set of short titled sections — *The key idea*, *Why*, *Try* —
rather than one long bubble. Long-form prose in a speech balloon is the format of
a support chat, and it reads as one because that is what it is.

A wrong answer never produces "❌ Wrong". It produces four blocks, in this order:

    Your answer  →  What went wrong  →  The concept  →  Try again

"What went wrong" is the deterministic marker's finding, not a model's
speculation: a flipped sign, an inverted fraction, degrees where radians were
meant. That is why it can be specific without a server.

## Calm by construction

- No streaks, no points, no daily target, no counter designed to bring anyone back
  tomorrow. The Progress screen says so in as many words.
- The recommender will tell you to stop. `rest` is a real action with a real score.
- A pattern is only named after three occurrences across two different questions.
  A bad afternoon is not a pattern, and calling it one teaches the student to
  distrust everything else on the screen.
- Motion is 180ms for controls, 300ms for surfaces, and nothing celebrates.

## Paper stays paper

The sheet keeps its own token set — `--paper`, `--paper-ink`, `--paper-line` — and
does **not** invert in dark mode. A page you write on with a Pencil has to look
like paper for the writing to feel natural, so in dark mode the shell goes to
`#111111` and the sheet stays a dimmed cream with dark ink on it.

## The Pencil is the primary input

A pen always draws. A finger draws only when the student asks it to. That one rule
is also the palm rejection, and it is why there is no drawing mode to remember:
the hand keeps working the interface while the Pencil writes.

- `getCoalescedEvents()` recovers every digitiser sample between frames; without it
  a fast stroke is a polygon.
- Pressure varies the width along the stroke, segment by segment.
- Strokes are stored in page coordinates (0–1), not pixels, so they stay sharp at
  any zoom and survive a rotation.
- The lasso selects strokes by point-in-polygon and hands them to the AI layer as
  context — which is how "check my work" knows what "my work" means.
- Shape recognition is geometry, not guesswork: a closed path hugging its bounding
  box is a rectangle, a closed path that does not is an ellipse, anything else is a
  straight line.

## Layout

| Element | Size | Why |
|---|---|---|
| Rail | 84px | Icons plus a label, and a 44px target inside it |
| Tutor panel | 372px | Wide enough for the editorial layout at 16px |
| Page | ≤940px | Around 65 characters at body size |
| Sheet | ≤820px | The work is the largest thing on the screen |

Below 1180px the panel stops being a column and becomes a sheet from the bottom,
and it starts closed behind a dock button. The page keeps its full width either
way: squeezing the work in order to make room for commentary about it inverts the
priority the layout exists to state. Below 900px the rail becomes a bottom bar.

## Exam mode

The tutor is not hidden behind a tab during a test — it is not called. A student
who can reach for a hint is not measuring anything. It returns the moment the test
ends, and what it returns with is a diagnosis: which topics the errors were in,
what kind of errors they were, and what to do next. Never a bare mark.

## States

- **Empty**: "Your learning space is ready. Import your first worksheet and start
  learning." Never "Nothing here."
- **Loading**: what is actually happening — "Reading page 3 of 12…" — then the
  findings, one line at a time.
- **Error**: "Something went wrong reading this file. Your document is safe —
  nothing was changed." No status codes, no apology.

## Accessibility

Every control clears 44×44 (asserted in `web/tools/smoke.mjs`). Focus is visible
everywhere. `prefers-reduced-motion` disables all animation. The page is set in the
system face, so Dynamic Type and the reader's own size settings apply.

## What the design does not claim

The tutor's words need a server; without one the app gives written help and labels
it as written help. Handwriting is captured, not read. Both are stated in the
interface rather than implied away, because a study app that overstates what it
understands is teaching the student to trust it wrongly.
