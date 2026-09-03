/**
 * A worked-in first run.
 *
 * An empty app shows nothing about what it does: no recommendation, no decay, no
 * pattern, an empty progress table. So a first run writes three weeks of example
 * history — a student who learned fractions and has since half-forgotten them,
 * and who is mid-way through linear equations with a habit of losing minus signs.
 *
 * It is example data and the app says so on the Desk, in the one place it would
 * otherwise be mistaken for the reader's own. Clearing it goes through the same
 * redaction path as deleting real work, so the conclusions drawn from it
 * disappear with it — which is the point being demonstrated.
 */

const DAY = 86_400_000;

/** [daysAgo, questionId, conceptId, outcome, errorType, assistance, kind] */
const HISTORY = [
  [22, "fr-1", "fractions", "correct", null, "hint", "practice"],
  [22, "fr-2", "fractions", "correct", null, "nudge", "practice"],
  [22, "fr-3", "fractions", "incorrect", "procedural", "none", "practice"],
  [21, "fr-3", "fractions", "correct", "none", "hint", "practice"],
  [18, "fr-2", "fractions", "correct", null, "none", "retrieval"],
  [18, "fr-4", "fractions", "correct", null, "none", "transfer"],
  [14, "fr-1", "fractions", "correct", null, "none", "retrieval"],

  [6, "li-1", "linear-equations", "correct", null, "none", "practice"],
  [6, "li-2", "linear-equations", "incorrect", "careless", "none", "practice"],
  [6, "li-2", "linear-equations", "correct", null, "nudge", "practice"],
  [5, "li-3", "linear-equations", "incorrect", "careless", "none", "practice"],
  [5, "li-3", "linear-equations", "incorrect", "procedural", "hint", "practice"],
  [4, "li-4", "linear-equations", "correct", null, "none", "practice"],
  [2, "li-1", "linear-equations", "correct", null, "none", "retrieval"],
  [2, "li-2", "linear-equations", "incorrect", "careless", "none", "retrieval"],

  [9, "ex-1", "expanding", "correct", null, "none", "practice"],
  [9, "ex-2", "expanding", "incorrect", "misconception", "none", "practice"],
  [8, "ex-2", "expanding", "correct", null, "worked", "practice"],
];

export function seed(store, now = Date.now()) {
  store.append({
    type: "worksheetOpened", assignmentId: "ws-linear", title: "Linear equations",
    conceptIds: ["linear-equations"], questionsTotal: 4,
    at: now - 6 * DAY, dueAt: now + 2 * DAY, example: true,
  });
  for (const [days, questionId, conceptId, outcome, errorType, assistance, kind] of HISTORY) {
    store.append({
      type: "attempt", at: now - days * DAY + (questionId.charCodeAt(3) % 7) * 90_000,
      questionId, conceptId, outcome, errorType, assistance, kind,
      submitted: "", graderReason: "example history", sessionId: `example-${days}`,
      example: true,
    });
  }
  store.setPref("exampleHistory", true);
  store.invalidate();
}

export function clearExample(store) {
  store.redact((e) => e.example === true, "the example history was cleared");
  store.setPref("exampleHistory", false);
  store.invalidate();
}
