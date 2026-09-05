"use client";

/**
 * Mock exams.
 *
 * A real simulation: the paper's own duration, its own mark total, a question
 * palette, review flags, and no feedback until submission. The post-exam
 * analysis is where the value is — not the score, but where the time went and
 * which assessment objective the marks were lost against.
 *
 * Papers are assembled from the question bank to match the real paper's shape
 * as closely as the loaded content allows, and the UI says plainly when it
 * cannot fill a paper rather than quietly building a shorter one.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { minutesPerMark } from "@/domain/curriculum";
import { interleaveByTopic } from "@/domain/adaptive";
import type { Question } from "@/domain/question";
import { QuestionView, type AnsweredResult } from "./question-view";
import { useRecordAttempt, uid } from "@/view/actions";
import { Card, Callout, Chip, Empty, Marks, Stat, Timer, useTicker, formatDuration, round1 } from "./components";
import { BarChart } from "./charts";
import type { MockRecord } from "@/store/types";

export function MockExam({ paperId }: { paperId?: string }) {
  const { state, update, record } = useStore();
  const bundle = useContent();
  const recordAttempt = useRecordAttempt();
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

  const [view, setView] = useState<SubjectView | undefined>(views[0]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | undefined>(paperId);
  const [running, setRunning] = useState(false);
  const [paper, setPaper] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnsweredResult>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [mockId] = useState(() => uid("mock"));
  const [submitted, setSubmitted] = useState<MockRecord | null>(null);
  const elapsed = useTicker(running && !submitted);

  const activeView = view ?? views[0];
  const activePaper = activeView?.syllabus.papers.find((p) => p.id === selectedPaperId) ?? activeView?.syllabus.papers[0];

  // Assemble the paper. Marks are matched to the real total as closely as the
  // bank allows, interleaved across topics the way a real paper is.
  const assemble = (v: SubjectView, paperCode: string, targetMarks: number): Question[] => {
    const eligible = v.questions.filter(
      (q) => !q.paperId || q.paperId === paperCode,
    );
    const ordered = interleaveByTopic(eligible, (q) => q.topicIds[0] ?? "misc");
    const out: Question[] = [];
    let marks = 0;
    for (const q of ordered) {
      if (marks >= targetMarks) break;
      out.push(q);
      marks += q.marks;
    }
    return out;
  };

  useEffect(() => {
    if (views.length && !view) setView(views[0]);
  }, [views, view]);

  if (!activeView || !activePaper) {
    return <Empty title="No subjects yet">Add a subject before sitting a mock.</Empty>;
  }

  const start = () => {
    const questions = assemble(activeView, activePaper.id, activePaper.rawMarks);
    if (!questions.length) return;
    setPaper(questions);
    setIndex(0);
    setAnswers({});
    setRunning(true);
    record({ type: "mock_started", at: new Date().toISOString(), mockId, paperId: activePaper.id });
  };

  const submit = () => {
    const results = Object.values(answers);
    const score = results.reduce((s, r) => s + r.attempt.score, 0);
    const maxScore = paper.reduce((s, q) => s + q.marks, 0);
    const at = new Date().toISOString();

    for (const r of results) recordAttempt(r.question, { ...r.attempt, mode: "mock" }, mockId);

    const mock: MockRecord = {
      id: mockId,
      syllabusId: activeView.syllabus.id,
      paperId: activePaper.id,
      startedAt: at,
      submittedAt: at,
      minutesAllowed: activePaper.durationMinutes,
      minutesUsed: Math.round(elapsed / 60),
      questionIds: paper.map((q) => q.id),
      score,
      maxScore,
      timePerQuestion: Object.fromEntries(results.map((r) => [r.question.id, r.attempt.timeSpent])),
      flagged: [...flags],
      completed: true,
    };

    update((s) => ({ ...s, mocks: [...s.mocks, mock] }), [
      {
        type: "mock_completed",
        at,
        mockId,
        paperId: activePaper.id,
        score,
        maxScore,
        minutesUsed: mock.minutesUsed,
        minutesAllowed: mock.minutesAllowed,
      },
    ]);
    setSubmitted(mock);
    setRunning(false);
  };

  // ------------------------------------------------------------- report
  if (submitted) {
    return <MockReport mock={submitted} paper={paper} answers={answers} view={activeView} />;
  }

  // ------------------------------------------------------------- setup
  if (!running) {
    const previous = state.mocks.filter((m) => m.completed).slice(-5).reverse();
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Mock exams</p>
          <h1>Sit a paper under real conditions</h1>
          <p className="lede">
            A full mock is the strongest single predictor of exam performance available, and it is the
            one thing question-level practice cannot substitute for — it measures timing, stamina and
            decision-making under pressure, none of which appear in untimed work.
          </p>
        </header>

        <div className="grid two">
          <Card title="Choose a paper">
            <div className="stack tight">
              {views.length > 1 && (
                <div className="pill-tabs" style={{ marginBottom: 8 }}>
                  {views.map((v) => (
                    <button key={v.syllabus.id} className="pill-tab" aria-selected={v.syllabus.id === activeView.syllabus.id} onClick={() => setView(v)}>
                      {v.syllabus.subject}
                    </button>
                  ))}
                </div>
              )}
              {activeView.syllabus.papers.map((p) => {
                const available = assemble(activeView, p.id, p.rawMarks);
                const availableMarks = available.reduce((s, q) => s + q.marks, 0);
                const short = availableMarks < p.rawMarks;
                return (
                  <button
                    key={p.id}
                    className="choice"
                    data-selected={activePaper.id === p.id}
                    onClick={() => setSelectedPaperId(p.id)}
                  >
                    <span>
                      <strong>Paper {p.code} — {p.name}</strong>
                      <br />
                      <span className="small muted">
                        {p.durationMinutes} min · {p.rawMarks} marks · {minutesPerMark(p).toFixed(2)} min/mark
                      </span>
                      {short && (
                        <>
                          <br />
                          <span className="small" style={{ color: "var(--fading)" }}>
                            Bank holds {availableMarks} of {p.rawMarks} marks — this will be a partial paper.
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Before you start">
            <ul className="small" style={{ paddingLeft: 18, marginBottom: 14 }}>
              <li>The clock runs for the paper&rsquo;s real duration and does not pause.</li>
              <li>No feedback until you submit. That is the point.</li>
              <li>When a question&rsquo;s time is up, stop mid-sentence and move on — the last 5 marks of an over-run question are the hardest on the paper.</li>
              <li>Self-mark it <strong>tomorrow</strong>, not today. Delayed feedback retains better, and you will mark more honestly.</li>
            </ul>
            <button className="btn primary large" onClick={start}>
              Start Paper {activePaper.code}
            </button>
          </Card>
        </div>

        {previous.length > 0 && (
          <Card title="Previous mocks">
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Paper</th><th className="num">Score</th><th className="num">Time used</th></tr>
                </thead>
                <tbody>
                  {previous.map((m) => (
                    <tr key={m.id}>
                      <td>{(m.submittedAt ?? m.startedAt).slice(0, 10)}</td>
                      <td>{m.paperId}</td>
                      <td className="num"><Marks earned={m.score} available={m.maxScore} /></td>
                      <td className="num">{m.minutesUsed}/{m.minutesAllowed} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------- sitting
  const question = paper[index]!;
  const totalSeconds = activePaper.durationMinutes * 60;
  const remaining = totalSeconds - elapsed;

  return (
    <div className="stack">
      <div className="row between" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--ground)", padding: "6px 0" }}>
        <span className="eyebrow">
          Paper {activePaper.code} · {Object.keys(answers).length} of {paper.length} answered
        </span>
        <div className="row" style={{ gap: 8 }}>
          <Timer seconds={elapsed} budgetSeconds={totalSeconds} running mode="down" />
          <button className="btn small" onClick={submit}>Submit paper</button>
        </div>
      </div>

      {remaining < 300 && remaining > 0 && (
        <Callout kind="danger" title={`${Math.ceil(remaining / 60)} minutes left`}>
          Move to the questions you can still earn marks on. Abandoning a question on time is worth
          more than any content you know.
        </Callout>
      )}

      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        {paper.map((q, i) => (
          <button
            key={q.id}
            className={`btn small ${i === index ? "primary" : ""}`}
            style={{
              minWidth: 34,
              borderColor: flags.has(q.id) ? "var(--fading)" : answers[q.id] ? "var(--secure)" : undefined,
            }}
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[q.id] ? ", answered" : ""}${flags.has(q.id) ? ", flagged" : ""}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="row">
        <button
          className={`btn small ${flags.has(question.id) ? "primary" : "ghost"}`}
          onClick={() =>
            setFlags((f) => {
              const next = new Set(f);
              if (next.has(question.id)) next.delete(question.id);
              else next.add(question.id);
              return next;
            })
          }
        >
          {flags.has(question.id) ? "Flagged for review" : "Flag for review"}
        </button>
        <div className="spacer" />
        <button className="btn small" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Previous</button>
        <button className="btn small" disabled={index >= paper.length - 1} onClick={() => setIndex((i) => i + 1)}>Next</button>
      </div>

      <QuestionView
        key={question.id}
        question={question}
        mode="mock"
        askConfidence={false}
        showWorking
        index={index}
        total={paper.length}
        onComplete={(result) => {
          setAnswers((a) => ({ ...a, [question.id]: result }));
          if (index < paper.length - 1) setIndex((i) => i + 1);
        }}
        onSkip={() => index < paper.length - 1 && setIndex((i) => i + 1)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MockReport({
  mock,
  paper,
  answers,
  view,
}: {
  mock: MockRecord;
  paper: Question[];
  answers: Record<string, AnsweredResult>;
  view: SubjectView;
}) {
  const results = Object.values(answers);
  const unanswered = paper.filter((q) => !answers[q.id]);
  const paperDef = view.syllabus.papers.find((p) => p.id === mock.paperId);
  const budget = paperDef ? minutesPerMark(paperDef) * 60 : 60;

  // Time efficiency by question size — where the minutes actually went.
  const buckets = new Map<string, { seconds: number; budget: number; n: number }>();
  for (const r of results) {
    const key = r.question.marks <= 2 ? "1–2 marks" : r.question.marks <= 5 ? "3–5 marks" : r.question.marks <= 12 ? "6–12 marks" : "13+ marks";
    const b = buckets.get(key) ?? { seconds: 0, budget: 0, n: 0 };
    b.seconds += r.attempt.timeSpent;
    b.budget += budget * r.question.marks;
    b.n++;
    buckets.set(key, b);
  }

  const overruns = [...buckets.entries()]
    .map(([label, b]) => ({ label, ratio: b.budget ? b.seconds / b.budget : 1, n: b.n }))
    .sort((a, b) => b.ratio - a.ratio);
  const worst = overruns[0];

  const aoLoss = new Map<string, { earned: number; available: number }>();
  for (const r of results) {
    const points = r.question.markScheme.points ?? [];
    const byId = new Map(points.map((p) => [p.id, p]));
    for (const e of r.attempt.ledger ?? []) {
      const p = byId.get(e.pointId);
      if (!p?.aoCode) continue;
      const cur = aoLoss.get(p.aoCode) ?? { earned: 0, available: 0 };
      cur.available += p.marks;
      cur.earned += e.outcome === "hit" ? p.marks : e.outcome === "partial" ? p.marks / 2 : 0;
      aoLoss.set(p.aoCode, cur);
    }
  }

  return (
    <div className="stack loose">
      <header>
        <p className="eyebrow">Mock complete · Paper {paperDef?.code}</p>
        <h1><Marks earned={mock.score} available={mock.maxScore} /> marks</h1>
      </header>

      <div className="grid four">
        <Card><Stat label="Percentage" value={`${Math.round(mock.maxScore ? (mock.score / mock.maxScore) * 100 : 0)}%`} /></Card>
        <Card><Stat label="Time used" value={`${mock.minutesUsed}m`} note={`of ${mock.minutesAllowed} allowed`} tone={mock.minutesUsed > mock.minutesAllowed ? "at-risk" : "secure"} /></Card>
        <Card><Stat label="Unanswered" value={unanswered.length} note={unanswered.length ? `${unanswered.reduce((s, q) => s + q.marks, 0)} marks left on the table` : "None"} tone={unanswered.length ? "at-risk" : "secure"} /></Card>
        <Card><Stat label="Flagged" value={mock.flagged.length} note="Marked for review during the paper" /></Card>
      </div>

      <Callout kind="warn" title="Mark this tomorrow, not now">
        Delayed self-marking retains better than immediate correction, and you will mark more honestly
        once the answers are no longer fresh. Your responses are saved.
      </Callout>

      <div className="grid two">
        <Card title="Where the time went">
          <BarChart
            horizontal
            data={overruns.map((o) => ({
              label: `${o.label} (${o.n})`,
              value: Math.round(o.ratio * 100),
              colour: o.ratio > 1.2 ? "var(--lost)" : o.ratio > 1 ? "var(--fading)" : "var(--secure)",
            }))}
            format={(n) => `${n}%`}
          />
          <p className="tiny muted" style={{ marginTop: 10 }}>
            100% means exactly on the paper&rsquo;s own minutes-per-mark budget.
          </p>
          {worst && worst.ratio > 1.15 && (
            <Callout kind="warn" title="Timing finding">
              You spent {Math.round((worst.ratio - 1) * 100)}% longer than the budget on{" "}
              {worst.label.toLowerCase()} questions. That time comes out of somewhere else on the paper.
            </Callout>
          )}
        </Card>

        <Card title="Marks by assessment objective">
          {aoLoss.size === 0 ? (
            <p className="small muted">
              Self-mark the paper against the mark scheme to get the AO breakdown — it is the analysis
              that tells you whether your problem is knowledge, application, analysis or judgement.
            </p>
          ) : (
            <BarChart
              horizontal
              data={[...aoLoss].map(([ao, v]) => ({
                label: ao,
                value: v.available ? Math.round((v.earned / v.available) * 100) : 0,
                colour: `var(--${ao.toLowerCase()})`,
              }))}
              format={(n) => `${n}%`}
            />
          )}
        </Card>
      </div>

      <Card title="Question by question">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th className="num">#</th><th>Question</th><th className="num">Marks</th><th className="num">Time</th><th className="num">vs budget</th></tr>
            </thead>
            <tbody>
              {paper.map((q, i) => {
                const r = answers[q.id];
                const spent = r?.attempt.timeSpent ?? 0;
                const qBudget = budget * q.marks;
                const ratio = qBudget ? spent / qBudget : 0;
                return (
                  <tr key={q.id}>
                    <td className="num">{i + 1}</td>
                    <td style={{ maxWidth: 300 }}>{q.prompt.slice(0, 80)}{q.prompt.length > 80 ? "…" : ""}</td>
                    <td className="num">{r ? <Marks earned={r.attempt.score} available={q.marks} /> : <span className="muted">— / {q.marks}</span>}</td>
                    <td className="num">{spent ? formatDuration(spent) : "—"}</td>
                    <td className="num">
                      {spent ? (
                        <Chip tone={ratio > 1.25 ? "forgotten" : ratio > 1 ? "fading" : "secure"}>{Math.round(ratio * 100)}%</Chip>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="row">
        <Link href="/readiness" className="btn primary">See what this changed</Link>
        <Link href="/mistakes" className="btn">Mistake lab</Link>
        <Link href="/" className="btn ghost">Command centre</Link>
      </div>
    </div>
  );
}
