/**
 * A course: the thing a student is actually sitting.
 *
 * Save My Exams, Seneca and the rest are organised the way an exam board
 * is — a subject, a level, a board, a specification cut into topics — and
 * that is the right shape, because it is the shape the marks come in. What
 * they cannot do is write a fresh question for the topic you are weakest
 * on, mark what you wrote point by point against the scheme, and show you
 * your own answer rewritten to full marks. A model can, so this file holds
 * the course, the prompts that fill it, and the arithmetic that turns what
 * was marked into a result a student can act on.
 *
 * Pure: text in, text or numbers out. The calls live in the component.
 */

export const LEVELS = ["GCSE", "IGCSE", "A level", "AS level", "IB", "AP", "Highers", "University", "Other"] as const;
export type Level = (typeof LEVELS)[number];

/** The boards each level is usually sat with. "Other" is always offered. */
export const BOARDS: Record<Level, string[]> = {
  GCSE: ["AQA", "Edexcel", "OCR", "WJEC / Eduqas", "CCEA"],
  IGCSE: ["Cambridge (CIE)", "Edexcel International", "Oxford AQA"],
  "A level": ["AQA", "Edexcel", "OCR", "WJEC / Eduqas", "Cambridge (CIE)"],
  "AS level": ["AQA", "Edexcel", "OCR", "Cambridge (CIE)"],
  IB: ["IB DP (SL)", "IB DP (HL)", "IB MYP"],
  AP: ["College Board"],
  Highers: ["SQA Higher", "SQA National 5", "SQA Advanced Higher"],
  University: ["My course"],
  Other: ["Other"],
};

export interface CourseTopic {
  id: string;
  /** The board's own number for it, where the model was sure of one. */
  code?: string;
  title: string;
  /** What the specification says a student must know or do. */
  points: string[];
}

export interface CourseUnit {
  id: string;
  title: string;
  topics: CourseTopic[];
}

/** How sure the student says they are: a specification checklist's colours. */
export type Confidence = "red" | "amber" | "green";

export interface Course {
  id: string;
  subject: string;
  level: string;
  board: string;
  /** "Subject · Level · Board", as it is shown. */
  name: string;
  units: CourseUnit[];
  confidence: Record<string, Confidence>;
  /** topicId → the Notebook page holding its revision notes. */
  notes: Record<string, string>;
  /** Where its cards go, once there are any. */
  deckId?: string;
  examAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const DIFFICULTIES = ["easy", "medium", "hard", "exam"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  exam: "Exam-style",
};

export interface ExamQuestion {
  topicId: string;
  question: string;
  marks: number;
  /** One line per mark, as a mark scheme lists them. */
  scheme: string[];
  /** A full-mark answer. */
  model: string;
  /** What examiners say students get wrong here. */
  tip: string;
  difficulty: Difficulty;
}

export interface PointMark {
  point: string;
  got: boolean;
  /** Where in the answer it was found, or what was missing. */
  why: string;
}

export interface Marking {
  got: number;
  out: number;
  points: PointMark[];
  /** Two or three sentences, the way a good teacher writes on a script. */
  feedback: string;
  /** Their own answer, changed as little as possible, to full marks. */
  better: string;
}

/** One marked answer, as stored (`db.marks`). */
export interface MarkRow {
  id: string;
  at: number;
  courseId: string;
  topicId: string;
  topic: string;
  question: string;
  marks: number;
  got: number;
  difficulty: Difficulty;
  answer: string;
  points: PointMark[];
  feedback: string;
  better: string;
  model: string;
  tip: string;
  mockId?: string;
}

export interface Mock {
  id: string;
  courseId: string;
  createdAt: number;
  minutes: number;
  questions: ExamQuestion[];
  answers: string[];
  startedAt?: number;
  finishedAt?: number;
  got?: number;
  out?: number;
}

/* ------------------------------------------------------------- helpers -- */

const str = (v: unknown, max = 4000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 600)).filter(Boolean).slice(0, max) : [];

export const courseName = (subject: string, level: string, board: string): string =>
  [subject.trim(), level, board && board !== "Other" && board !== "My course" ? board : ""].filter(Boolean).join(" · ");

export function allTopics(course: Pick<Course, "units">): (CourseTopic & { unit: string })[] {
  return course.units.flatMap((u) => u.topics.map((t) => ({ ...t, unit: u.title })));
}

export function findTopic(course: Pick<Course, "units">, topicId: string): (CourseTopic & { unit: string }) | undefined {
  return allTopics(course).find((t) => t.id === topicId);
}

const about = (c: Pick<Course, "subject" | "level" | "board">) =>
  `${c.subject}, ${c.level}${c.board && c.board !== "Other" ? `, ${c.board}` : ""}`;

/* ---------------------------------------------------------- the course -- */

export function syllabusPrompt(subject: string, level: string, board: string): string {
  return `Write the specification for this course, the way the exam board publishes it, so a student can revise from it topic by topic.

Course: ${subject.trim()}, ${level}${board && board !== "Other" ? `, ${board}` : ""}

Rules:
- Return JSON only, no prose and no fence: {"units":[{"title":"…","topics":[{"code":"…","title":"…","points":["…"]}]}]}
- Follow the real specification for this board and level as closely as you know it: its units in its order, its topic titles, and its own numbering in "code". If you are not sure of the board's exact number for a topic, leave "code" empty rather than invent one.
- 3 to 10 units. 2 to 10 topics in each. Every topic a student could be examined on, and nothing that is not on this course.
- "points": 2 to 6 short lines of what a student must know or be able to do for that topic, in the specification's own terms ("describe…", "calculate…", "explain…").
- Where the board has tiers or options, cover the higher tier and the most common options.
- Write in the language the course is taught in.`;
}

/** The units, with ids, or null when nothing usable came back. */
export function parseSyllabus(raw: unknown): CourseUnit[] | null {
  const obj = raw as { units?: unknown } | unknown[] | null;
  const list = Array.isArray(obj) ? obj : Array.isArray((obj as { units?: unknown })?.units) ? ((obj as { units: unknown[] }).units) : null;
  if (!list) return null;
  const units: CourseUnit[] = [];
  list.slice(0, 14).forEach((u, i) => {
    const unit = u as { title?: unknown; topics?: unknown };
    const title = str(unit?.title, 140);
    if (!title || !Array.isArray(unit.topics)) return;
    const topics: CourseTopic[] = [];
    unit.topics.slice(0, 16).forEach((t, j) => {
      const topic = t as { code?: unknown; title?: unknown; points?: unknown };
      const tt = str(topic?.title, 160);
      if (!tt) return;
      const code = str(topic.code, 20);
      topics.push({ id: `u${i + 1}t${j + 1}`, title: tt, points: strs(topic.points, 8), ...(code ? { code } : {}) });
    });
    if (topics.length) units.push({ id: `u${i + 1}`, title, topics });
  });
  return units.length ? units : null;
}

/* ---------------------------------------------------- revision notes -- */

export function notesPrompt(course: Pick<Course, "subject" | "level" | "board">, topic: CourseTopic): string {
  return `Write revision notes for one topic of this course, the kind a student reads the night before and comes away able to score full marks.

Course: ${about(course)}
Topic: ${topic.code ? `${topic.code} ` : ""}${topic.title}
The specification asks them to:
${topic.points.map((p) => `- ${p}`).join("\n") || "- (cover the topic as the board examines it)"}

Write in markdown, in this order:
## Key points
The facts, processes and ideas that carry marks, as short numbered points. Bold the words a mark scheme looks for.
## Key terms
A table: term | meaning, in the board's own wording.
## Worked example
One exam-style question with a full-mark answer set out step by step, where the topic has calculations or a standard method; otherwise a model paragraph for a typical 4–6 mark question.
## Common mistakes
Three or four things students lose marks on here, each with the fix.
## Examiner tips
Two or three lines on how the marks are awarded for this topic: command words, units, the phrasing that earns the point.

Rules: only what this course examines, at this level; no filler; under 900 words; the language the course is taught in.`;
}

/* ------------------------------------------------------- questions -- */

const DIFFICULTY_BRIEF: Record<Difficulty, string> = {
  easy: "Easy: 1 to 2 marks, recall or a single step (state, name, give, define).",
  medium: "Medium: 3 to 4 marks, applying or explaining the idea (describe, explain, calculate).",
  hard: "Hard: 5 to 6 marks, several steps or an unfamiliar context the student has to reason through.",
  exam: "Exam-style: exactly the kind of question this board sets on this topic, at the length and marks it usually sets, including extended-response questions where the board has them.",
};

export function questionPrompt(
  course: Pick<Course, "subject" | "level" | "board">,
  topic: CourseTopic,
  difficulty: Difficulty,
  avoid: string[] = [],
): string {
  return `Write one exam question on this topic, with its mark scheme, as the exam board would.

Course: ${about(course)}
Topic: ${topic.code ? `${topic.code} ` : ""}${topic.title}
${topic.points.length ? `The specification asks them to:\n${topic.points.map((p) => `- ${p}`).join("\n")}\n` : ""}
Difficulty: ${DIFFICULTY_BRIEF[difficulty]}
${avoid.length ? `\nDo not repeat or closely rephrase these questions they have already had:\n${avoid.slice(0, 8).map((q) => `- ${q.slice(0, 160)}`).join("\n")}\n` : ""}
Return JSON only, no prose and no fence:
{"question":"…","marks":N,"scheme":["…"],"model":"…","tip":"…"}

Rules:
- "question": worded exactly like a real paper, starting with its command word, with any data, context or units it needs. End it with the marks in square brackets, like [3].
- "scheme": one line per mark, in the order a mark scheme lists them, each the specific point that earns the mark, with accepted alternatives after a slash. The number of lines equals "marks".
- "model": a full-mark answer, no longer than the marks justify.
- "tip": one sentence on what examiners say students most often get wrong on a question like this.
- Use the notation, units and terms of this board and level. The language the course is taught in.`;
}

export function parseQuestion(raw: unknown, topicId: string, difficulty: Difficulty): ExamQuestion | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const question = str(o.question, 3000);
  const scheme = strs(o.scheme, 20);
  if (!question || !scheme.length) return null;
  const said = Number(o.marks);
  const marks = Number.isFinite(said) && said >= 1 && said <= 30 ? Math.round(said) : scheme.length;
  return { topicId, question, marks, scheme, model: str(o.model, 4000), tip: str(o.tip, 600), difficulty };
}

/* --------------------------------------------------------- marking -- */

export function markPrompt(course: Pick<Course, "subject" | "level" | "board">, q: Pick<ExamQuestion, "question" | "marks" | "scheme" | "model">, answer: string): string {
  return `Mark this answer the way an examiner would, against the mark scheme, point by point.

Course: ${about(course)}

QUESTION [${q.marks} mark${q.marks === 1 ? "" : "s"}]
${q.question}

MARK SCHEME
${q.scheme.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${q.model ? `\nA FULL-MARK ANSWER, for reference\n${q.model}\n` : ""}
THE STUDENT'S ANSWER
${answer.trim() || "(blank)"}

Return JSON only, no prose and no fence:
{"points":[{"point":"…","got":true,"why":"…"}],"got":N,"feedback":"…","better":"…"}

Rules:
- One entry in "points" for each line of the mark scheme, in its order. "got" is true only if the answer earns that mark as a real examiner would: equivalent wording and correct alternatives count; vague, contradictory or merely implied points do not; in a calculation carry an earlier error forward rather than penalising it twice.
- "why": a few words quoting or pointing at where the mark was earned, or saying exactly what was missing.
- "got": the total awarded, never more than ${q.marks}. For a levels-of-response question, award the level the answer reaches and say so in "feedback".
- "feedback": two or three sentences to the student, the way a good teacher writes on a script: what earned marks, and the single change that would earn the most more.
- "better": the student's own answer rewritten to full marks, keeping their words wherever they were right, so they can see exactly what to add. Blank answer: give the full-mark answer.
- Be fair and exact. Never award a mark for something that is not written.`;
}

export function parseMarking(raw: unknown, q: Pick<ExamQuestion, "marks" | "scheme">): Marking | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const given = Array.isArray(o.points) ? o.points : [];
  const points: PointMark[] = given.slice(0, 30).map((p, i) => {
    const pt = p as Record<string, unknown>;
    return { point: str(pt?.point, 400) || q.scheme[i] || `Mark ${i + 1}`, got: pt?.got === true, why: str(pt?.why, 400) };
  });
  if (!points.length && typeof o.got !== "number") return null;
  const counted = points.filter((p) => p.got).length;
  const said = Number(o.got);
  /* The model's total is the one a levels-of-response question needs; it
     is held to the marks available, and to nothing below zero. */
  const got = Math.max(0, Math.min(q.marks, Number.isFinite(said) ? Math.round(said) : counted));
  return { got, out: q.marks, points, feedback: str(o.feedback, 1500), better: str(o.better, 5000) };
}

/* ------------------------------------------------------------ mocks -- */

/** Roughly a mark a minute, which is how most papers are timed. */
export const marksFor = (minutes: number) => Math.max(10, Math.round(minutes));

export function mockPrompt(
  course: Pick<Course, "subject" | "level" | "board">,
  topics: Pick<CourseTopic, "id" | "title" | "code">[],
  minutes: number,
): string {
  const total = marksFor(minutes);
  return `Write a mock exam paper for this course, the way the board sets its papers.

Course: ${about(course)}
Time: ${minutes} minutes. Total: about ${total} marks.
Draw the questions from these topics, weighted towards the first ones listed (they are where this student is weakest), and covering as many of them as the marks allow:
${topics.map((t) => `- ${t.id}: ${t.code ? `${t.code} ` : ""}${t.title}`).join("\n")}

Return JSON only, no prose and no fence:
{"questions":[{"topicId":"…","question":"…","marks":N,"scheme":["…"],"model":"…","tip":"…"}]}

Rules:
- 5 to 12 questions, from short recall to at least one longer question, ordered as a real paper orders them (easier first).
- "topicId" is one of the ids above, exactly.
- "question": worded like the real paper, with its command word, any data it needs, and the marks in square brackets at the end.
- "scheme": one line per mark, each the specific point that earns it; the number of lines equals "marks".
- "model": a full-mark answer. "tip": one sentence on what students most often get wrong.
- The marks add up to about ${total}. The language the course is taught in.`;
}

export function parseMock(raw: unknown, topicIds: string[]): ExamQuestion[] | null {
  const o = raw as { questions?: unknown } | unknown[] | null;
  const list = Array.isArray(o) ? o : Array.isArray((o as { questions?: unknown })?.questions) ? (o as { questions: unknown[] }).questions : null;
  if (!list) return null;
  const known = new Set(topicIds);
  const out = list
    .slice(0, 16)
    .map((q) => {
      const tid = str((q as Record<string, unknown>)?.topicId, 20);
      return parseQuestion(q, known.has(tid) ? tid : topicIds[0] ?? "", "exam");
    })
    .filter((q): q is ExamQuestion => Boolean(q));
  return out.length ? out : null;
}

/* ---------------------------------------------------------- results -- */

export interface TopicResult {
  topicId: string;
  /** Marks got over marks tried, the latest answers first. */
  got: number;
  out: number;
  tried: number;
  /** got / out, or null when nothing was tried. */
  pct: number | null;
}

/**
 * How a topic is going, from its most recent answers.
 *
 * The last eight, not all of them: a student who got a topic wrong in
 * September and right every week since should see the topic they have now,
 * not an average that still remembers September.
 */
export function topicResult(rows: MarkRow[], topicId: string, recent = 8): TopicResult {
  const mine = rows.filter((r) => r.topicId === topicId).sort((a, b) => b.at - a.at).slice(0, recent);
  const got = mine.reduce((s, r) => s + r.got, 0);
  const out = mine.reduce((s, r) => s + r.marks, 0);
  return { topicId, got, out, tried: mine.length, pct: out ? got / out : null };
}

export interface CourseScore {
  /** Likely share of the marks if the exam were today, over every topic. */
  likely: number;
  /** Share of the marks on the topics tried so far. */
  marks: number | null;
  covered: number;
  total: number;
  green: number;
  amber: number;
  red: number;
  got: number;
  out: number;
}

/**
 * The course's result.
 *
 * Each topic weighs the same, as a specification does. A topic that has
 * been marked counts at its marks; one that has cards but no marked answer
 * counts at its cards' readiness; one with neither counts as nothing,
 * because on the day it is worth nothing. The honest number is therefore
 * low at the start and climbs with every topic touched, which is the point:
 * it rewards coverage as much as polish, and so does the exam.
 */
export function courseScore(
  course: Pick<Course, "units" | "confidence">,
  rows: MarkRow[],
  cardReady: (topicTitle: string) => number | null = () => null,
): CourseScore {
  const topics = allTopics(course);
  let sum = 0;
  let covered = 0;
  let got = 0;
  let out = 0;
  for (const t of topics) {
    const r = topicResult(rows, t.id);
    if (r.pct !== null) {
      sum += r.pct;
      covered += 1;
      got += r.got;
      out += r.out;
      continue;
    }
    const ready = cardReady(t.title);
    if (ready !== null) {
      sum += ready;
      covered += 1;
    }
  }
  const conf = Object.values(course.confidence ?? {});
  return {
    likely: topics.length ? sum / topics.length : 0,
    marks: out ? got / out : null,
    covered,
    total: topics.length,
    green: conf.filter((c) => c === "green").length,
    amber: conf.filter((c) => c === "amber").length,
    red: conf.filter((c) => c === "red").length,
    got,
    out,
  };
}

export interface CourseMove {
  key: string;
  topicId: string;
  label: string;
  why: string;
  kind: "questions" | "notes";
}

/**
 * Where the next marks are, in order.
 *
 * Marks lost on a topic already tried are the cheapest to win back; a
 * topic the student has marked red is the next; a topic never touched is
 * all its marks at once, but costs a first read. At most three, so the
 * list is a decision and not a menu.
 */
export function courseMoves(course: Pick<Course, "units" | "confidence">, rows: MarkRow[]): CourseMove[] {
  const topics = allTopics(course);
  const results = topics.map((t) => ({ t, r: topicResult(rows, t.id) }));
  const moves: CourseMove[] = [];
  const seen = new Set<string>();
  const push = (m: CourseMove) => {
    if (seen.has(m.topicId) || moves.length >= 3) return;
    seen.add(m.topicId);
    moves.push(m);
  };
  results
    .filter((x) => x.r.pct !== null && x.r.pct < 0.7)
    .sort((a, b) => (a.r.pct ?? 0) - (b.r.pct ?? 0))
    .forEach(({ t, r }) => push({
      key: `weak-${t.id}`, topicId: t.id, kind: "questions",
      label: `Practise ${t.title}`,
      why: `${r.got} of ${r.out} marks so far`,
    }));
  topics
    .filter((t) => course.confidence?.[t.id] === "red")
    .forEach((t) => push({ key: `red-${t.id}`, topicId: t.id, kind: "notes", label: `Revise ${t.title}`, why: "you marked it red" }));
  results
    .filter((x) => x.r.tried === 0)
    .forEach(({ t }) => push({ key: `new-${t.id}`, topicId: t.id, kind: "notes", label: `Start ${t.title}`, why: "not tried yet, so every mark is still to win" }));
  return moves;
}

/** Weakest first, for a mock that aims at the gaps. Untried topics last. */
export function weakestFirst(course: Pick<Course, "units" | "confidence">, rows: MarkRow[]): CourseTopic[] {
  const rank = (t: CourseTopic) => {
    const r = topicResult(rows, t.id);
    const conf = course.confidence?.[t.id];
    if (r.pct !== null) return r.pct;
    if (conf === "red") return 0.2;
    if (conf === "amber") return 0.5;
    if (conf === "green") return 0.9;
    return 0.6;
  };
  return allTopics(course).sort((a, b) => rank(a) - rank(b));
}

export function daysUntil(at: number | undefined, now: number): number | null {
  if (!at) return null;
  return Math.ceil((at - now) / 86_400_000);
}
