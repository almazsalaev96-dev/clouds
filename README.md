# Atlas

An every-subject learning platform: spaced retrieval, exam-weighted practice, and
honest feedback about what you actually know. Web app now, mobile app next.

The full brief lives in **[MASTER-PROMPT.md](./MASTER-PROMPT.md)** — read that first.
It is the standing spec, and it outranks improvisation.

Current progress and what happens next: **[PROGRESS.md](./PROGRESS.md)**.

---

## What works today

- **FSRS-6 scheduling.** The modern spaced-repetition algorithm — difficulty,
  stability and retrievability per card, learning and relearning steps, and
  deterministic intervals that replay identically on any device.
- **A real syllabus.** Cambridge Business 9609 with its papers, durations and
  assessment-objective weightings, plus the mark arithmetic that shows each AO
  carrying exactly 50 of the 200 raw marks.
- **Marks-at-risk prioritisation.** Topics ranked by marks recoverable per hour,
  with confident-but-wrong blind spots and neglected topics pushed up the list.
- **Calibration.** Confidence is collected before every answer, so the app can tell
  you where you are confidently wrong — the failure mode that costs the most marks.
- **Offline.** The whole app runs with no network: service-worked shell, IndexedDB
  study log, everything derived on device.
- **Your data is yours.** One-tap JSON export of the complete event log; erase means
  erase.

## Run it

```bash
pnpm install
pnpm --filter @atlas/web dev      # http://localhost:3000
pnpm check                        # typecheck + tests across the workspace
```

Node 22+, pnpm 10+.

## Layout

```
apps/web            Next.js PWA — Today, Review, Syllabus map, Settings
packages/learning   the engine: FSRS, session building, mastery, calibration, priority
packages/content    schemas, syllabus model, mark arithmetic, seeded subject content
business-9609       the exam analysis this project started from
```

`packages/learning` is pure and dependency-free: no IO, no clock reads, no
randomness that isn't seeded. Everything the product believes about how people
learn is testable without a browser.

## Principles that are not negotiable

Outcomes over engagement. No hallucinated syllabus facts. The tutor coaches before
it answers. Offline is a requirement, not an enhancement. No dark patterns, and no
streak that shames you. See MASTER-PROMPT.md §1.
