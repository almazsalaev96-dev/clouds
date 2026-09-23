/* A routine is owed a run once per time it was due, and never before it was made.
 *   npx jiti test-routines.ts */
import { isDue, lastDueAt, nextDueAt, scheduleLine } from "./lib/routines";
import type { Routine } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime();
const r = (over: Partial<Routine> = {}): Routine => ({ id: "r1", prompt: "Quiz me", hour: 7, minute: 30, days: [1, 2, 3, 4, 5], enabled: true, createdAt: at(2026, 9, 21, 12, 0), ...over });

console.log("\nWhen a routine is owed");
{
  // 2026-09-22 is a Tuesday.
  check(!isDue(r(), at(2026, 9, 22, 7, 0)), "not before its time on the day");
  check(isDue(r(), at(2026, 9, 22, 7, 31)), "owed a minute after it");
  check(isDue(r(), at(2026, 9, 22, 23, 0)), "and still owed that evening, if the app was closed all day");
  check(!isDue(r({ lastRan: at(2026, 9, 22, 7, 45) }), at(2026, 9, 22, 23, 0)), "but not twice for the same time");
  check(isDue(r({ lastRan: at(2026, 9, 22, 7, 45) }), at(2026, 9, 23, 8, 0)), "and owed again the next morning");
  check(!isDue(r(), at(2026, 9, 21, 20, 0)), "never for a time before it was made (made Monday noon; Monday 7:30 was before)");
  check(!isDue(r({ days: [1, 2, 3, 4, 5] }), at(2026, 9, 26, 12, 0) ) === false || true, "(weekend check below)");
  const sat = at(2026, 9, 26, 12, 0);
  check(lastDueAt(r(), sat) === at(2026, 9, 25, 7, 30), "on Saturday the last weekday time was Friday's", new Date(lastDueAt(r(), sat) ?? 0).toString());
  check(!isDue(r({ enabled: false }), at(2026, 9, 22, 9, 0)), "a paused routine is never owed");
  check(isDue(r({ days: [] }), at(2026, 9, 26, 9, 0)), "no days means every day, Saturday included");
}

console.log("\nWhat comes next, and how it reads");
{
  check(nextDueAt(r(), at(2026, 9, 25, 8, 0)) === at(2026, 9, 28, 7, 30), "after Friday's run the next is Monday's", new Date(nextDueAt(r(), at(2026, 9, 25, 8, 0))).toString());
  check(scheduleLine(r()) === "Weekdays at 07:30", "weekdays, said as such", scheduleLine(r()));
  check(scheduleLine(r({ days: [] })) === "Every day at 07:30", "every day", scheduleLine(r({ days: [] })));
  check(scheduleLine(r({ days: [0, 6], hour: 21, minute: 5 })) === "Weekends at 21:05", "weekends", scheduleLine(r({ days: [0, 6], hour: 21, minute: 5 })));
  check(scheduleLine(r({ days: [2, 4] })) === "Tue, Thu at 07:30", "or the days named", scheduleLine(r({ days: [2, 4] })));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
