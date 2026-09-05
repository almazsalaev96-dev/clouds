/**
 * Session and plan generation.
 *
 * Two levels:
 *
 *  - **Session** — "I have 25 minutes." Produces an ordered set of blocks with
 *    real durations, chosen so the session has a shape that learning science
 *    supports: retrieve before you read, correct errors while they are warm,
 *    and finish on something that consolidates rather than something that
 *    opens a new front.
 *
 *  - **Plan** — the horizon from today to the exam, re-derived on every open.
 *    Nothing is "behind schedule": a plan that shames you for missing Tuesday
 *    is a plan you stop opening. Missed work is re-prioritised, not accumulated.
 */

import { clamp, clamp01, type Timestamp, type TopicId, type Unit, addDays, daysBetween } from "./types";
import type { PriorityScore, RecommendedAction } from "./priority";

export type BlockKind =
  | "recall"        // retrieval practice on due items
  | "learn"         // new or repaired understanding
  | "practise"      // questions at target difficulty
  | "mistake-fix"   // re-attempt of previously lost marks
  | "drill"         // isolated skill (chains, conclusions, calculations)
  | "exam-question" // one full exam-style question, timed
  | "mock"          // full paper
  | "consolidate";  // written summary / self-explanation to close the loop

export interface SessionBlock {
  kind: BlockKind;
  minutes: number;
  title: string;
  detail: string;
  topicId?: TopicId;
  /** Why this block is here at all. */
  because: string;
  /** Concrete target so the block has a definition of done. */
  target?: string;
}

export interface StudySession {
  minutes: number;
  blocks: SessionBlock[];
  headline: string;
  /** Expected marks recovered, honestly framed as an estimate. */
  expectedMarks: number;
  because: string[];
}

export interface SessionInput {
  minutes: number;
  priorities: PriorityScore[];
  /** Topic titles, so blocks can be described concretely. */
  titles: Record<string, string>;
  dueReviewCount: number;
  openMistakeCount: number;
  daysToExam?: number;
  /** Student's declared energy. Affects shape, not amount. */
  energy?: "low" | "normal" | "high";
  /** Skip retrieval warm-up (e.g. second session of the day). */
  skipWarmup?: boolean;
}

/**
 * Block proportions by session length. Short sessions cannot afford a warm-up
 * *and* a consolidation; long ones must include both or attention collapses.
 */
export function generateSession(input: SessionInput): StudySession {
  const m = Math.max(5, Math.round(input.minutes));
  const blocks: SessionBlock[] = [];
  const because: string[] = [];
  const top = input.priorities[0];
  const second = input.priorities[1];

  const cram = input.daysToExam !== undefined && input.daysToExam <= 7;
  const lastMinute = input.daysToExam !== undefined && input.daysToExam <= 1;

  // --- warm-up: retrieval first ------------------------------------------
  const wantsWarmup = !input.skipWarmup && input.dueReviewCount > 0 && m >= 10;
  if (wantsWarmup) {
    const mins = clamp(Math.round(m * (m <= 15 ? 0.3 : 0.2)), 3, 15);
    blocks.push({
      kind: "recall",
      minutes: mins,
      title: `Clear ${Math.min(input.dueReviewCount, mins * 3)} due review items`,
      detail: "Rapid retrieval on items your memory model says are fading.",
      because:
        "Retrieval before new material is the single most reliable finding in the learning literature, and due items are decaying now whether or not you study them.",
      target: `${Math.min(input.dueReviewCount, mins * 3)} items graded honestly`,
    });
  }

  // --- mistakes: fix what you already got wrong ---------------------------
  if (input.openMistakeCount > 0 && m >= 15) {
    const mins = clamp(Math.round(m * 0.18), 4, 20);
    blocks.push({
      kind: "mistake-fix",
      minutes: mins,
      title: `Re-attempt ${Math.min(input.openMistakeCount, Math.max(1, Math.floor(mins / 4)))} previous mistakes`,
      detail: "Questions where you have already lost marks, served again cold.",
      because:
        "A repeated mistake costs marks twice. Re-attempting a known failure is the highest-yield practice available, because the diagnosis is already done.",
      target: "Every re-attempt either scores full marks or gets a written note on why it did not",
    });
  }

  // --- main work -----------------------------------------------------------
  const used = blocks.reduce((s, b) => s + b.minutes, 0);
  const consolidateMins = m >= 25 ? clamp(Math.round(m * 0.12), 3, 10) : 0;
  let mainBudget = Math.max(0, m - used - consolidateMins);

  if (top && mainBudget > 0) {
    const primary = mainBlockFor(top.action, Math.round(mainBudget * (second && mainBudget > 20 ? 0.6 : 1)), top, input.titles);
    blocks.push(primary);
    mainBudget -= primary.minutes;

    if (second && mainBudget >= 8) {
      const secondary = mainBlockFor(second.action, mainBudget, second, input.titles);
      // Interleaving: a second topic in the same session is deliberate.
      secondary.because +=
        " Two topics in one session rather than one is deliberate — interleaving feels harder and produces better exam performance.";
      blocks.push(secondary);
      mainBudget = 0;
    } else if (mainBudget > 0) {
      blocks[blocks.length - 1]!.minutes += mainBudget;
      mainBudget = 0;
    }
  } else if (mainBudget > 0) {
    blocks.push({
      kind: "practise",
      minutes: mainBudget,
      title: "Mixed practice",
      detail: "No priority data yet — a short mixed set will produce the first measurements.",
      because: "Everything the planner does depends on evidence. This session creates it.",
    });
  }

  // --- exam framing near the exam -----------------------------------------
  if (cram && m >= 30) {
    // Take the time from the largest content block, and only as much as leaves
    // that block still viable — an exam-framing block is worth having, but not
    // at the cost of gutting the work it is meant to consolidate.
    const MIN_VIABLE = 5;
    const victim = blocks
      .filter((b) => b.kind === "practise" || b.kind === "learn")
      .sort((a, b) => b.minutes - a.minutes)[0];
    const steal = victim
      ? Math.min(10, Math.floor(m * 0.2), victim.minutes - MIN_VIABLE)
      : 0;
    if (victim && steal >= 4) {
      victim.minutes -= steal;
      blocks.push({
        kind: "exam-question",
        minutes: steal,
        title: "One full exam question, strictly timed",
        detail: "Real framing, real clock, stop when the time is up.",
        because:
          "Close to the exam, the binding constraint is usually performance under time rather than knowledge. Training it directly is worth more than another topic.",
        target: "Stopped on time, even mid-sentence",
      });
    }
  }

  // --- consolidation -------------------------------------------------------
  if (consolidateMins > 0 && !lastMinute) {
    blocks.push({
      kind: "consolidate",
      minutes: consolidateMins,
      title: "Close the loop",
      detail: "Blank paper: write what changed in your understanding this session, and one thing still unclear.",
      because:
        "Sessions that end with self-explanation retain markedly more than sessions that end at the last question. It also produces the note that seeds tomorrow's review.",
      target: "Three sentences, written from memory",
    });
  }

  // --- normalise to the requested length -----------------------------------
  normaliseDurations(blocks, m);

  const expectedMarks = estimateSessionMarks(blocks, input.priorities);

  if (cram) because.push(`Exam is ${input.daysToExam} days away, so the session front-loads retrieval and exam framing over new content.`);
  if (input.energy === "low")
    because.push("Energy marked low: the session leads with recall and correction, which are less cognitively expensive than new material.");
  if (input.dueReviewCount > 0) because.push(`${input.dueReviewCount} items are due for review.`);
  if (top) because.push(`Highest-value topic right now is ${input.titles[top.topicId] ?? top.topicId} at about ${top.marksPerHour.toFixed(1)} marks per hour.`);

  const headline = top
    ? `${m} minutes on ${input.titles[top.topicId] ?? "your weakest area"} — worth roughly ${expectedMarks.toFixed(1)} marks`
    : `${m}-minute session`;

  return { minutes: m, blocks, headline, expectedMarks, because };
}

function mainBlockFor(
  action: RecommendedAction,
  minutes: number,
  p: PriorityScore,
  titles: Record<string, string>,
): SessionBlock {
  const title = titles[p.topicId] ?? "this topic";
  const mins = Math.max(5, Math.round(minutes));
  const shared = { minutes: mins, topicId: p.topicId, because: p.because[0] ?? "" };

  switch (action) {
    case "learn":
      return { ...shared, kind: "learn", title: `Learn: ${title}`, detail: "Explanation first, then one question to check the mechanism landed.", target: "Able to write the mechanism from blank paper" };
    case "repair":
      return { ...shared, kind: "learn", title: `Repair: ${title}`, detail: "Find the exact point where your model diverges from the correct one.", target: "Named the specific step that was wrong" };
    case "review":
      return { ...shared, kind: "recall", title: `Retrieve: ${title}`, detail: "Closed-book recall, not rereading. Produce it, then check it.", target: "Written from memory before checking" };
    case "stretch":
      return { ...shared, kind: "practise", title: `Stretch: ${title}`, detail: "Unfamiliar contexts and cross-topic framing at a difficulty above your comfort.", target: "Two questions in contexts you have not seen" };
    case "technique":
      return { ...shared, kind: "drill", title: `Technique drill: ${title}`, detail: "Isolate the move you keep losing marks on and repeat it alone.", target: "Ten repetitions of the move, not one essay" };
    case "maintain":
      return { ...shared, kind: "recall", title: `Maintain: ${title}`, detail: "Light retrieval to keep a secure topic alive.", target: "Quick pass, no new material" };
    default:
      return { ...shared, kind: "practise", title: `Practise: ${title}`, detail: "Questions at the edge of your current ability, marked properly.", target: "Every wrong answer classified by cause" };
  }
}

function normaliseDurations(blocks: SessionBlock[], target: number) {
  const total = blocks.reduce((s, b) => s + b.minutes, 0);
  if (total === 0 || total === target) return;
  const factor = target / total;
  let running = 0;
  blocks.forEach((b, i) => {
    if (i === blocks.length - 1) b.minutes = Math.max(1, target - running);
    else {
      b.minutes = Math.max(1, Math.round(b.minutes * factor));
      running += b.minutes;
    }
  });
}

function estimateSessionMarks(blocks: SessionBlock[], priorities: PriorityScore[]): number {
  const byTopic = new Map(priorities.map((p) => [p.topicId as string, p]));
  let marks = 0;
  for (const b of blocks) {
    const p = b.topicId ? byTopic.get(b.topicId) : undefined;
    const rate = p ? p.marksPerHour : 4; // conservative default for generic blocks
    // Retrieval and mistake-fixing convert to marks faster than new learning.
    const efficiency = b.kind === "mistake-fix" ? 1.3 : b.kind === "recall" ? 1.15 : b.kind === "learn" ? 0.85 : 1;
    marks += (rate * efficiency * b.minutes) / 60;
  }
  return marks;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface PlanDay {
  date: string;
  /** Minutes the student said they have on this weekday. */
  availableMinutes: number;
  sessions: { minutes: number; focus: string; kind: BlockKind }[];
  isMockDay: boolean;
  isRestDay: boolean;
  note?: string;
}

export interface StudyPlan {
  generatedAt: Timestamp;
  from: string;
  to: string;
  days: PlanDay[];
  phases: PlanPhase[];
  totalMinutes: number;
  because: string[];
  warnings: string[];
}

export interface PlanPhase {
  name: string;
  from: string;
  to: string;
  emphasis: string;
  /** Share of remaining time. */
  share: Unit;
}

export interface PlanInput {
  now: Timestamp;
  examDate?: Timestamp;
  /** Minutes available per weekday, index 0 = Sunday. */
  weeklyMinutes: number[];
  priorities: PriorityScore[];
  titles: Record<string, string>;
  /** Days on which the student wants a full mock. */
  mockCadenceDays?: number;
  horizonDays?: number;
}

/**
 * Phase structure. Proportions of *remaining* time, so the same shape works
 * whether the exam is in three weeks or nine months.
 */
export function planPhases(now: Timestamp, examDate: string, ): PlanPhase[] {
  const total = Math.max(1, daysBetween(now, examDate));
  const shares: { name: string; share: number; emphasis: string }[] = [
    { name: "Diagnose", share: 0.04, emphasis: "One cold, timed paper before any revision, marked by assessment objective. Everything after this is aimed at your actual gap." },
    { name: "Content spine", share: 0.24, emphasis: "One page per topic, written from memory first and corrected in a second colour. The correction pass is the learning." },
    { name: "Skill drilling", share: 0.34, emphasis: "Analysis and evaluation trained in isolation from content, because they are skills and they transfer across every topic." },
    { name: "Timed papers", share: 0.28, emphasis: "Full papers under real time, self-marked against the official scheme the following day, with every lost mark classified." },
    { name: "Taper", share: 0.1, emphasis: "No new content. Spaced recall, timing rules, and the moves that are already working." },
  ];
  let cursor = 0;
  return shares.map((s) => {
    const from = addDays(now, Math.round(total * cursor));
    cursor += s.share;
    const to = addDays(now, Math.round(total * cursor));
    return { name: s.name, from: from.slice(0, 10), to: to.slice(0, 10), emphasis: s.emphasis, share: s.share };
  });
}

export function generatePlan(input: PlanInput): StudyPlan {
  const because: string[] = [];
  const warnings: string[] = [];
  const horizon = input.horizonDays ?? (input.examDate ? Math.min(180, Math.max(1, Math.ceil(daysBetween(input.now, input.examDate)))) : 28);

  const days: PlanDay[] = [];
  const mockCadence = input.mockCadenceDays ?? 7;
  let priorityCursor = 0;

  for (let i = 0; i < horizon; i++) {
    const date = addDays(input.now, i);
    const dow = new Date(date).getUTCDay();
    const available = input.weeklyMinutes[dow] ?? 0;
    const daysToExam = input.examDate ? daysBetween(date, input.examDate) : undefined;

    const isRest = available === 0;
    const isMockDay = !isRest && available >= 90 && i > 0 && i % mockCadence === 0;

    const sessions: PlanDay["sessions"] = [];
    if (!isRest) {
      if (isMockDay) {
        sessions.push({ minutes: Math.min(available, 120), kind: "mock", focus: "Full paper under exam conditions" });
        if (available > 130) sessions.push({ minutes: available - 120, kind: "recall", focus: "Light review only — self-mark tomorrow, not today" });
      } else {
        // Split long days into two sessions; attention, not stamina, is the limit.
        const chunks = available > 75 ? [Math.round(available * 0.55), available - Math.round(available * 0.55)] : [available];
        for (const c of chunks) {
          const p = input.priorities[priorityCursor % Math.max(1, input.priorities.length)];
          priorityCursor++;
          const focus = p ? `${input.titles[p.topicId] ?? p.topicId}` : "Mixed practice";
          const kind: BlockKind =
            daysToExam !== undefined && daysToExam <= 7 ? "recall" : p ? actionToBlock(p.action) : "practise";
          sessions.push({ minutes: c, kind, focus });
        }
      }
    }

    days.push({
      date: date.slice(0, 10),
      availableMinutes: available,
      sessions,
      isMockDay,
      isRestDay: isRest,
      note:
        daysToExam !== undefined && daysToExam <= 1
          ? "Exam imminent. Light retrieval only, and sleep — consolidation happens overnight, and a short night costs more marks than the cramming gains."
          : undefined,
    });
  }

  const totalMinutes = days.reduce((s, d) => s + d.sessions.reduce((t, x) => t + x.minutes, 0), 0);
  const weeklyTotal = input.weeklyMinutes.reduce((s, m) => s + m, 0);

  because.push(`Built from ${Math.round(weeklyTotal / 60)} hours a week that you said you have available.`);
  if (input.examDate)
    because.push(`Phased against an exam on ${input.examDate.slice(0, 10)} — ${Math.ceil(daysBetween(input.now, input.examDate))} days away.`);
  because.push("Topic order follows marks-per-hour, and it is re-derived every time you open the plan rather than fixed in advance.");

  if (weeklyTotal < 120)
    warnings.push("Under two hours a week is very little for a full syllabus. The plan will prioritise ruthlessly, but coverage will be partial — that is arithmetic, not pessimism.");
  if (input.examDate && daysBetween(input.now, input.examDate) < 14)
    warnings.push("Under two weeks: the plan switches to retrieval and exam technique. New content this close rarely converts into marks.");
  if (!input.examDate) warnings.push("No exam date set, so nothing can be prioritised by urgency. Adding one materially improves every recommendation.");

  return {
    generatedAt: input.now,
    from: input.now.slice(0, 10),
    to: addDays(input.now, horizon).slice(0, 10),
    days,
    phases: input.examDate ? planPhases(input.now, input.examDate) : [],
    totalMinutes,
    because,
    warnings,
  };
}

function actionToBlock(a: RecommendedAction): BlockKind {
  switch (a) {
    case "learn":
    case "repair":
      return "learn";
    case "review":
    case "maintain":
      return "recall";
    case "technique":
      return "drill";
    case "stretch":
      return "exam-question";
    default:
      return "practise";
  }
}

// ---------------------------------------------------------------------------
// Daily mission
// ---------------------------------------------------------------------------

export interface Mission {
  date: string;
  items: MissionItem[];
  totalMinutes: number;
  headline: string;
}

export interface MissionItem {
  id: string;
  label: string;
  minutes: number;
  kind: BlockKind;
  done: boolean;
  because: string;
}

export function buildMission(
  now: Timestamp,
  availableMinutes: number,
  session: StudySession,
): Mission {
  return {
    date: now.slice(0, 10),
    totalMinutes: availableMinutes,
    headline: session.headline,
    items: session.blocks.map((b, i) => ({
      id: `${now.slice(0, 10)}-${i}`,
      label: b.title,
      minutes: b.minutes,
      kind: b.kind,
      done: false,
      because: b.because,
    })),
  };
}

/** Session length presets offered on every screen. */
export const SESSION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

export function cramFocus(daysToExam: number): { title: string; points: string[] } {
  if (daysToExam <= 0)
    return {
      title: "Exam day",
      points: [
        "Read the whole paper before writing anything.",
        "Start with the question you can answer best — it settles arousal and buys momentum.",
        "When a question's time is up, stop mid-sentence and move on.",
        "State units. Circle the command word. Answer the question that was asked.",
      ],
    };
  if (daysToExam <= 1)
    return {
      title: "Tomorrow",
      points: [
        "No new content. Nothing learned today will be reliable tomorrow.",
        "One pass of your highest-value recall items and your formula sheet.",
        "Re-read your own mistake log — not the textbook.",
        "Rehearse the timing rules until they are automatic.",
        "Sleep a full night. Consolidation is the mechanism that turns this term's work into recall.",
      ],
    };
  if (daysToExam <= 3)
    return {
      title: "Final 72 hours",
      points: [
        "Retrieval only: closed-book production, then check.",
        "Your recurring mistakes, one at a time, until each is eliminated.",
        "One timed section per day — technique, not volume.",
        "Formulas and command words to blank recall.",
      ],
    };
  return {
    title: "Final week",
    points: [
      "Highest-weight topics first; leave the long tail alone.",
      "One full timed paper, self-marked the next day.",
      "Every recurring mistake explicitly re-attempted.",
      "Command words and timing rules rehearsed until reflexive.",
    ],
  };
}
