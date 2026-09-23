/**
 * Routines: a prompt that runs on a schedule, when Armi is open.
 *
 * ChatGPT's scheduled tasks, Claude's scheduled tasks and Gemini's scheduled
 * actions all run on a server the person does not have. This app has no
 * server that knows anybody, so the honest version is the one the panel
 * says out loud: a routine runs the next time the app is open after its
 * time. "Every weekday at 7:30, quiz me on what is due" happens when the
 * app is opened on a weekday morning — which, for a study routine, is the
 * moment it was wanted anyway.
 *
 * Pure. `now` is passed in, so a test can sit on a Tuesday and watch.
 */
import type { Routine } from "./types";

const DAY = 86_400_000;

/** The most recent moment this routine was meant to run, at or before now. */
export function lastDueAt(r: Routine, now: number): number | null {
  const days = r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
  for (let back = 0; back < 8; back++) {
    const d = new Date(now - back * DAY);
    d.setHours(r.hour, r.minute, 0, 0);
    if (d.getTime() > now) continue;
    if (!days.includes(d.getDay())) continue;
    return d.getTime();
  }
  return null;
}

/** Whether it is owed a run: due since it was made, and not yet run for that time. */
export function isDue(r: Routine, now: number): boolean {
  if (!r.enabled) return false;
  const at = lastDueAt(r, now);
  if (at === null || at < r.createdAt) return false;
  return (r.lastRan ?? 0) < at;
}

/** The next moment it will be meant to run, after now. */
export function nextDueAt(r: Routine, now: number): number {
  const days = r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
  for (let ahead = 0; ahead < 8; ahead++) {
    const d = new Date(now + ahead * DAY);
    d.setHours(r.hour, r.minute, 0, 0);
    if (d.getTime() <= now) continue;
    if (!days.includes(d.getDay())) continue;
    return d.getTime();
  }
  return now + 7 * DAY;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Weekdays at 07:30", "Every day at 21:00", "Sat, Sun at 10:00". */
export function scheduleLine(r: Routine): string {
  const hh = String(r.hour).padStart(2, "0");
  const mm = String(r.minute).padStart(2, "0");
  const days = [...r.days].sort();
  const when =
    days.length === 0 || days.length === 7 ? "Every day"
    : days.join(",") === "1,2,3,4,5" ? "Weekdays"
    : days.join(",") === "0,6" ? "Weekends"
    : days.map((d) => DAY_NAMES[d]).join(", ");
  return `${when} at ${hh}:${mm}`;
}
