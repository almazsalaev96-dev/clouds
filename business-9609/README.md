# Business 9609 — source notes

These two files predate the Lodestar application and are kept as-is because they
are useful in their own right:

- **`00-MASTER-PLAN.md`** — the A/A* preparation plan for Cambridge 9609: the
  mark arithmetic, what examiners reward, the syllabus map, the learning
  science, and a phased plan.
- **`mark-map.html`** — a standalone visual map of where the marks are.

Much of the substance of the master plan is now encoded as *behaviour* rather
than prose, in `content/cambridge-business-9609/`:

| From the plan | Where it lives now |
|---|---|
| AO weightings per paper, and their conversion to raw marks | `syllabus/business-9609.yaml` → rendered on the Subject page |
| Command words and their AO ceilings | `syllabus/business-9609.yaml` → the Technique trainer |
| The eight evaluation moves and the conclusion template | `lessons/evaluation-moves.md` and `/technique` |
| The application test ("cover the business name") | Mark-scheme points and the `no-application` loss category |
| Chains of analysis | The `no-chain` loss category and the `sk-chain` skill |
| Spacing at days 1, 3, 7, 16, 35 | The scheduler, which computes intervals from your own recall rather than a fixed ladder |
| Phases 0–4 with proportional lengths | `planPhases()` in `src/domain/planner.ts` |
| The error log | The Mistake Lab |
| The A* checklist | The readiness checklist |

The plan remains the better read for a human. The app is the version that acts.
