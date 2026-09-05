"use client";

/**
 * Practice.
 *
 * A continuous adaptive loop rather than a fixed quiz. After each answer the
 * engine re-estimates ability, decides whether to go harder, easier, sideways
 * or back to a prerequisite, and picks the next question — so the difficulty
 * tracks the student instead of a preset sequence.
 *
 * The end-of-session report is not a celebration. It says what improved, what
 * is still weak, and what to do next, because a session that ends in confetti
 * teaches nothing about what to do tomorrow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { useRecordAttempt, uid } from "@/view/actions";
import {
  decideNextMove,
  selectNext,
  successProbability,
  type Candidate,
  type SelectionContext,
} from "@/domain/adaptive";
import { overallDifficulty, type AttemptMode, type Question } from "@/domain/question";
import { MARK_LOSS_LABELS } from "@/domain/question";
import { QuestionView, type AnsweredResult } from "./question-view";
import { Card, Callout, Chip, Empty, Marks, Meter, Stat, Why, round1 } from "./components";

export interface PracticeFilters {
  topicIds: string[];
  types: string[];
  minMarks?: number;
  maxMarks?: number;
  onlyPreviouslyWrong: boolean;
  onlyUnseen: boolean;
  commandWord?: string;
}

const EMPTY_FILTERS: PracticeFilters = {
  topicIds: [],
  types: [],
  onlyPreviouslyWrong: false,
  onlyUnseen: false,
};

export function Practice({
  initialTopicId,
  mode = "adaptive",
  minutes,
}: {
  initialTopicId?: string;
  mode?: AttemptMode;
  minutes?: number;
}) {
  const { state } = useStore();
  const bundle = useContent();
  const record = useRecordAttempt();
  const now = new Date().toISOString();

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  const [subjectIdx, setSubjectIdx] = useState(0);
  const view = views[Math.min(subjectIdx, views.length - 1)];

  const [filters, setFilters] = useState<PracticeFilters>(
    initialTopicId ? { ...EMPTY_FILTERS, topicIds: [initialTopicId] } : EMPTY_FILTERS,
  );
  const [sessionId] = useState(() => uid("sess"));
  const [running, setRunning] = useState(Boolean(initialTopicId));
  const [answered, setAnswered] = useState<AnsweredResult[]>([]);
  const [current, setCurrent] = useState<Question | null>(null);
  const [ability, setAbility] = useState(0.5);
  const [streaks, setStreaks] = useState({ right: 0, wrong: 0 });
  const [lastReason, setLastReason] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  if (!view) {
    return <Empty title="No subjects yet">Add a subject before practising.</Empty>;
  }

  const attemptsByQuestion = new Map<string, { count: number; lastFraction: number }>();
  for (const a of state.attempts) {
    const prev = attemptsByQuestion.get(a.questionId);
    attemptsByQuestion.set(a.questionId, {
      count: (prev?.count ?? 0) + 1,
      lastFraction: a.maxScore ? a.score / a.maxScore : 0,
    });
  }

  const pool = useMemo(() => {
    const topicSet = new Set(filters.topicIds);
    return view.questions.filter((q) => {
      if (topicSet.size && !q.topicIds.some((t) => topicSet.has(t))) return false;
      if (filters.types.length && !filters.types.includes(q.type)) return false;
      if (filters.minMarks !== undefined && q.marks < filters.minMarks) return false;
      if (filters.maxMarks !== undefined && q.marks > filters.maxMarks) return false;
      if (filters.commandWord && q.commandWord !== filters.commandWord) return false;
      const seen = attemptsByQuestion.get(q.id);
      if (filters.onlyUnseen && seen) return false;
      if (filters.onlyPreviouslyWrong && (!seen || seen.lastFraction >= 1)) return false;
      if (view.enrolment.stage === "as") {
        const topics = q.topicIds.map((t) => view.syllabus.topics.find((x) => x.id === t));
        if (topics.every((t) => t?.stage === "a2")) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filters, state.attempts]);

  const ctx: SelectionContext = {
    ability,
    session: answered.map((a) => ({
      questionId: a.question.id,
      topicId: a.question.topicIds[0],
      fraction: a.attempt.maxScore ? a.attempt.score / a.attempt.maxScore : 0,
      difficulty: overallDifficulty(a.question.difficulty),
    })),
    streakWrong: streaks.wrong,
    streakRight: streaks.right,
    minutesLeft: minutes ? Math.max(0, minutes - answered.reduce((s, a) => s + a.attempt.timeSpent / 60, 0)) : 999,
    interleave: state.settings.interleave && filters.topicIds.length !== 1,
  };

  // Guards against scheduling two selections for the same slot when React
  // re-renders between an answer being recorded and the next question landing.
  const picking = useRef(false);

  const pickNext = (exclude: string[] = []) => {
    picking.current = true;
    const decision = decideNextMove(ctx);
    if (decision.move === "stop") {
      picking.current = false;
      setFinished(true);
      setCurrent(null);
      return;
    }
    const candidates: Candidate[] = pool
      .filter((q) => !exclude.includes(q.id))
      .map((q) => {
        const seen = attemptsByQuestion.get(q.id);
        return {
          question: q,
          seenCount: seen?.count ?? 0,
          lastFraction: seen?.lastFraction,
          topicRetention: view.topicRetention.get(q.topicIds[0] ?? ""),
        };
      });
    const result = selectNext(candidates, decision, ctx);
    setLastReason(result.because);
    picking.current = false;
    if (!result.chosen) {
      setFinished(true);
      setCurrent(null);
      return;
    }
    setCurrent(result.chosen.question as Question);
  };

  /**
   * Advance the loop.
   *
   * This runs in an effect rather than during render. It was originally a
   * `queueMicrotask` scheduled from the render body, which worked most of the
   * time and then silently stalled the session: a re-render between recording
   * an answer and the next question arriving could leave the loop with no
   * pending selection and nothing to trigger another. An effect keyed on the
   * answer count has one clear trigger and cannot be lost.
   */
  useEffect(() => {
    if (!running || finished || current || picking.current) return;
    pickNext(answered.map((a) => a.question.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, finished, current, answered.length]);

  const start = () => {
    setRunning(true);
    setFinished(false);
    setAnswered([]);
    setStreaks({ right: 0, wrong: 0 });
    setCurrent(null); // the effect picks the first question
  };

  const onComplete = (result: AnsweredResult) => {
    record(result.question, result.attempt, sessionId);
    const fraction = result.attempt.maxScore ? result.attempt.score / result.attempt.maxScore : 0;
    const d = overallDifficulty(result.question.difficulty);
    const expected = successProbability(ability, d);
    setAbility((a) => Math.max(0, Math.min(1, a + 0.18 * (fraction - expected))));
    setStreaks((s) => (fraction >= 0.7 ? { right: s.right + 1, wrong: 0 } : { right: 0, wrong: s.wrong + 1 }));
    setAnswered((prev) => [...prev, result]);
    setCurrent(null);
  };

  // ------------------------------------------------------------- setup view
  if (!running) {
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Practise</p>
          <h1>Adaptive practice</h1>
          <p className="lede">
            Questions are chosen to sit at roughly a 75% chance of success — hard enough to require
            retrieval, easy enough that the retrieval succeeds. Difficulty follows you.
          </p>
        </header>

        {views.length > 1 && (
          <div className="pill-tabs">
            {views.map((v, i) => (
              <button key={v.syllabus.id} className="pill-tab" aria-selected={i === subjectIdx} onClick={() => setSubjectIdx(i)}>
                {v.syllabus.subject}
              </button>
            ))}
          </div>
        )}

        <div className="grid two">
          <Card title="What to practise">
            <div className="stack">
              <div className="field">
                <label>Topics</label>
                <p className="hint">Leave empty to let the priority engine choose, which is usually better.</p>
                <div className="row" style={{ gap: 5 }}>
                  {view.priorities.slice(0, 8).map((p) => {
                    const topic = view.syllabus.topics.find((t) => t.id === p.topicId);
                    if (!topic) return null;
                    const on = filters.topicIds.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        className={`btn small ${on ? "primary" : ""}`}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            topicIds: on ? f.topicIds.filter((t) => t !== topic.id) : [...f.topicIds, topic.id],
                          }))
                        }
                      >
                        {topic.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field">
                <label>Restrict to</label>
                <div className="row" style={{ gap: 5 }}>
                  <button
                    className={`btn small ${filters.onlyPreviouslyWrong ? "primary" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, onlyPreviouslyWrong: !f.onlyPreviouslyWrong, onlyUnseen: false }))}
                  >
                    Only what I got wrong
                  </button>
                  <button
                    className={`btn small ${filters.onlyUnseen ? "primary" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, onlyUnseen: !f.onlyUnseen, onlyPreviouslyWrong: false }))}
                  >
                    Only unseen
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Answer length</label>
                <div className="btn-group">
                  {[
                    { label: "Any", min: undefined, max: undefined },
                    { label: "Short (1–5)", min: 1, max: 5 },
                    { label: "Structured (6–12)", min: 6, max: 12 },
                    { label: "Essay (13+)", min: 13, max: undefined },
                  ].map((o) => (
                    <button
                      key={o.label}
                      className={`btn small ${filters.minMarks === o.min && filters.maxMarks === o.max ? "primary" : ""}`}
                      onClick={() => setFilters((f) => ({ ...f, minMarks: o.min, maxMarks: o.max }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="This set">
            <div className="stack">
              <Stat label="Questions available" value={pool.length} note={`${pool.reduce((s, q) => s + q.marks, 0)} marks`} />
              {pool.length === 0 ? (
                <Callout kind="warn" title="Nothing matches">
                  No questions match these filters. Widen them, or add material for these topics — the
                  Library page shows exactly which topics have no questions yet.
                </Callout>
              ) : (
                <>
                  <div className="stack tight">
                    <span className="stat-label">Difficulty spread</span>
                    <Meter value={pool.reduce((s, q) => s + overallDifficulty(q.difficulty), 0) / pool.length} label="Average difficulty" />
                  </div>
                  <button className="btn primary large" onClick={start}>Start practising</button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------- session report
  if (finished || (!current && answered.length > 0)) {
    return (
      <SessionReport
        answered={answered}
        view={view}
        onContinue={() => {
          setFinished(false);
          pickNext(answered.map((a) => a.question.id));
        }}
        canContinue={pool.length > answered.length}
      />
    );
  }

  if (!current) {
    // The effect above is selecting the next question.
    return <p className="muted small">Choosing your next question…</p>;
  }

  return (
    <div className="stack">
      <div className="row between">
        <span className="eyebrow">
          {view.syllabus.subject} · {answered.length} answered ·{" "}
          {round1(answered.reduce((s, a) => s + a.attempt.score, 0))}/
          {answered.reduce((s, a) => s + a.attempt.maxScore, 0)} marks
        </span>
        <button className="btn small ghost" onClick={() => setFinished(true)}>End session</button>
      </div>

      <QuestionView
        question={current}
        mode={mode}
        askConfidence={state.settings.confidenceRating}
        showWorking={state.settings.showWorking}
        onComplete={onComplete}
        onSkip={() => pickNext([...answered.map((a) => a.question.id), current.id])}
      />

      <Why because={lastReason} label="Why this question?" />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SessionReport({
  answered,
  view,
  onContinue,
  canContinue,
}: {
  answered: AnsweredResult[];
  view: SubjectView;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const earned = answered.reduce((s, a) => s + a.attempt.score, 0);
  const available = answered.reduce((s, a) => s + a.attempt.maxScore, 0);
  const minutes = answered.reduce((s, a) => s + a.attempt.timeSpent, 0) / 60;

  const losses = new Map<string, number>();
  for (const a of answered) {
    for (const e of a.attempt.ledger ?? []) {
      if (e.outcome === "hit" || !e.lossReason) continue;
      losses.set(e.lossReason, (losses.get(e.lossReason) ?? 0) + 1);
    }
  }
  const topLoss = [...losses.entries()].sort((a, b) => b[1] - a[1])[0];

  const weak = answered
    .filter((a) => a.attempt.maxScore > 0 && a.attempt.score / a.attempt.maxScore < 0.6)
    .map((a) => a.question.topicIds[0])
    .filter(Boolean) as string[];
  const weakTopics = [...new Set(weak)]
    .map((t) => view.syllabus.topics.find((x) => x.id === t)?.title)
    .filter(Boolean);

  const overconfident = answered.filter(
    (a) => (a.attempt.confidence ?? 0) >= 3 && a.attempt.maxScore > 0 && a.attempt.score / a.attempt.maxScore < 0.5,
  ).length;

  if (answered.length === 0) {
    return (
      <Empty title="Session ended" action={<Link href="/" className="btn">Back to command centre</Link>}>
        No questions were answered, so nothing was recorded.
      </Empty>
    );
  }

  return (
    <div className="stack loose">
      <header>
        <p className="eyebrow">Session complete</p>
        <h1><Marks earned={earned} available={available} /> marks in {Math.round(minutes)} minutes</h1>
      </header>

      <div className="grid three">
        <Card><Stat label="Questions" value={answered.length} /></Card>
        <Card><Stat label="Accuracy" value={`${Math.round(available ? (earned / available) * 100 : 0)}%`} /></Card>
        <Card><Stat label="Minutes per mark" value={available ? (minutes / available).toFixed(1) : "—"} note="Compare against the paper's budget" /></Card>
      </div>

      <div className="grid two">
        <Card title="What this session showed">
          <div className="stack tight">
            {topLoss && (
              <Callout kind="warn" title="Your commonest cause of lost marks here">
                {MARK_LOSS_LABELS[topLoss[0] as keyof typeof MARK_LOSS_LABELS]} — {topLoss[1]} time{topLoss[1] === 1 ? "" : "s"}.
              </Callout>
            )}
            {weakTopics.length > 0 && (
              <p className="small">
                Still weak: <strong>{weakTopics.join(", ")}</strong>. These have been pushed up your
                priority list and scheduled for review.
              </p>
            )}
            {overconfident > 0 && (
              <Callout kind="danger" title="Confidence gap">
                {overconfident} answer{overconfident === 1 ? "" : "s"} you were confident about scored
                below half marks. That gap between feeling fluent and being able to produce is the most
                common reason capable students underperform.
              </Callout>
            )}
            {!topLoss && weakTopics.length === 0 && overconfident === 0 && (
              <Callout kind="good">
                Clean session. The material you met is holding up — it has been scheduled for review
                before it decays.
              </Callout>
            )}
          </div>
        </Card>

        <Card title="What to do next">
          <div className="stack tight">
            {view.priorities.slice(0, 3).map((p) => {
              const topic = view.syllabus.topics.find((t) => t.id === p.topicId);
              if (!topic) return null;
              return (
                <div key={p.topicId} className="row between">
                  <Link href={`/topics/${encodeURIComponent(topic.id)}`} className="small" style={{ color: "var(--ink)", textDecoration: "none" }}>
                    {topic.title}
                  </Link>
                  <Chip tone="accent">{p.marksPerHour.toFixed(1)} m/h</Chip>
                </div>
              );
            })}
            <div className="row" style={{ marginTop: 10 }}>
              {canContinue && <button className="btn primary" onClick={onContinue}>Keep going</button>}
              <Link href="/mistakes" className="btn">Fix mistakes</Link>
              <Link href="/" className="btn ghost">Done</Link>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Every question in this session">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Topic</th>
                <th className="num">Marks</th>
                <th className="num">Time</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {answered.map((a, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 320 }}>{a.question.prompt.slice(0, 90)}{a.question.prompt.length > 90 ? "…" : ""}</td>
                  <td className="small muted">{view.syllabus.topics.find((t) => t.id === a.question.topicIds[0])?.title ?? "—"}</td>
                  <td className="num"><Marks earned={a.attempt.score} available={a.attempt.maxScore} /></td>
                  <td className="num">{Math.round(a.attempt.timeSpent)}s</td>
                  <td className="small muted">{a.attempt.confidence ? ["Guessing", "Unsure", "Fairly sure", "Certain"][a.attempt.confidence - 1] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
