/**
 * Turning repeated wrong answers into one named pattern.
 *
 * The difference between a marking app and a teacher: four unrelated "incorrect" marks
 * are noise; "you have dropped a negative sign four times across three topics" is a
 * lesson.
 */
export const MIN_OCCURRENCES = 3;
export const MIN_DISTINCT_QUESTIONS = 2;
export const RECENCY_HALF_LIFE_DAYS = 14.0;

const WORDING = {
  calculation: "arithmetic slips",
  misconception: "the same misunderstanding",
  procedural: "steps applied in the wrong order",
  reading: "misread questions",
  interpretation: "misreadings of what the question asked for",
  application: "trouble applying a method you know",
  reasoningGap: "missing steps in your reasoning",
  examTechnique: "marks lost to how the answer was written",
  knowledgeGap: "a gap in the underlying idea",
  careless: "avoidable slips",
  timeManagement: "running out of time",
};

export function recencyWeight(at, now) {
  const days = Math.max(0, (now - at) / 86_400_000);
  return Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
}

export function headline(pattern) {
  const what = WORDING[pattern.errorType] ?? "the same kind of mistake";
  const scope = pattern.distinctConcepts > 1
    ? `across ${pattern.distinctConcepts} topics`
    : "in this topic";
  return `${pattern.occurrences} ${what} ${scope}.`;
}

/** Patterns worth telling the student about, strongest first. */
export function detect(attempts, now) {
  const buckets = new Map();
  for (const a of attempts) {
    if (a.outcome === "correct" || !a.errorType) continue;
    if (a.errorType === "unknown" || a.errorType === "unreadable") continue;
    if (!buckets.has(a.errorType)) buckets.set(a.errorType, []);
    buckets.get(a.errorType).push(a);
  }

  const out = [];
  for (const [errorType, group] of buckets) {
    const concepts = new Set(group.map((a) => a.conceptId));
    const questions = new Set(group.map((a) => a.questionId).filter(Boolean));
    if (group.length < MIN_OCCURRENCES) continue;
    if (Math.max(questions.size, 1) < MIN_DISTINCT_QUESTIONS) continue;

    const recency = group.reduce((sum, a) => sum + recencyWeight(a.at, now), 0);
    out.push({
      errorType,
      occurrences: group.length,
      distinctConcepts: concepts.size,
      distinctQuestions: questions.size,
      conceptIds: [...concepts].sort(),
      lastSeen: Math.max(...group.map((a) => a.at)),
      strength: group.length * Math.sqrt(concepts.size) * recency,
    });
  }
  out.sort((a, b) =>
    b.strength === a.strength ? a.errorType.localeCompare(b.errorType) : b.strength - a.strength);
  return out;
}
