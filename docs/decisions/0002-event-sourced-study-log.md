# 0002 — The study log is append-only; everything else is a projection

**Decision.** We store review *events*. We never store derived state — not card
memory, not mastery, not streaks.

**Why.**
1. **Algorithm changes stay safe.** Tuning FSRS parameters or the mastery model
   re-derives every screen. There is no migration, because there is nothing stored
   to migrate.
2. **Sync cannot lose study.** Append-only events merge by union. A last-write-wins
   row for "card state" would let one device silently erase the other's reviews.
3. **Export is trivially complete.** The export *is* the log, so "your data is
   yours" is a property of the design rather than a feature someone has to maintain.
4. **Honest analytics.** Latency, confidence and grade are all captured at the
   moment they happened, so calibration and error analysis are measurements rather
   than reconstructions.

**Consequences.**
- Replay cost grows with history. At tens of thousands of events this is still a few
  milliseconds; beyond that we add periodic snapshots as a cache — a cache that can
  always be thrown away and rebuilt, never a source of truth.
- Every event needs enough context to be interpreted alone (card id, objective id,
  timestamp), which is why events carry `objectiveId` even though it is derivable.
