# Margin — the app

A working implementation of the product specified in [`../edu-ai/MASTER-PROMPT.md`](../edu-ai/MASTER-PROMPT.md):
an AI tutor that teaches against a real syllabus, refuses to hand over answers before you have
attempted, and marks your writing the way an examiner would — per assessment objective, quoting your
own words back as evidence.

## Run it

```
npm install
npm run dev      # API on :8787, web on :5173 with hot reload
```

Or build once and serve everything from the API process:

```
npm run serve    # http://localhost:8787
```

**It runs with no API keys.** With none set, every model call is served by a deterministic built-in
provider that reads the mark scheme and does the matching itself — enough to demonstrate marking,
tutoring and scheduling end to end. The interface says so rather than pretending; nothing degrades
silently. Copy `.env.example` to `.env` and set any of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GOOGLE_API_KEY`, `DEEPSEEK_API_KEY` to route real traffic. `server/providers/router.js` holds the
routing policy: which task class goes to which model, what it falls back to, and the rule that
DeepSeek never sees personal data or a UK/EU tenant.

Data lives in `margin.db` (SQLite, created on first run). Delete the file to reset. The seed pack is
an original Cambridge International Business 9609 course — syllabus tree, items, mark schemes and a
misconception library, all written for this repository; no board material is reproduced.

## What is where

| Path | What it holds |
|---|---|
| `server/db.js` | Schema and queries. Course, Item, MarkScheme, Attempt, Turn, Mark, LearnerState, Card. |
| `server/engine/` | The pedagogy: Effort Gate, Help Ladder, the turn lint, FSRS-6 scheduling, Mark-Yield ranking. |
| `server/marking/` | The exam engine: scheme model, the marker, and the renderer that turns a Mark into what the screen draws. |
| `server/providers/` | The vendor abstraction, four real adapters, the built-in provider, and the routing policy. |
| `server/routes/` | The API. `session.js` is the streaming Learn loop and the heart of it. |
| `server/packs/` | The seed curriculum and the loader. |
| `src/styles/tokens.css` | The design system: every colour in OKLCH, the type scale, spacing, motion, shell geometry. Components read tokens and never hard-code a value. |
| `src/screens/`, `src/components/` | The interface. |

## The rules the code actually enforces

These are the parts that would be easy to fake and are not:

- **Mastery only moves on unaided marks.** An answer that used the top rungs of the help ladder, or
  that followed a seen solution, does not raise your mastery — and the code says so where it happens.
- **"Just the answer" is never refused.** It is served, labelled as a seen solution, and retested.
  The label and the retest are the price; there is no lecture.
- **Quoted evidence is verified.** Every span the marker quotes is checked against your answer at the
  offset given, and dropped if it does not match. A fabricated quote is the fastest way to lose trust.
- **No streaks.** Weekly goals include rest days. There is one celebration at most, and only for
  something you did.
- **The degraded state is visible.** When no provider is configured the top bar says so.
