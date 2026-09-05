"use client";

/**
 * Question rendering and answering.
 *
 * One component handles every question type. The interesting design decision is
 * what happens *after* the answer: objective types are marked exactly by the
 * machine, and written types go to a mark-scheme ledger where the student
 * resolves each point themselves and classifies any mark they lost.
 *
 * That is not a workaround for having no AI. Self-marking against a real scheme
 * is the highest-value activity in written subjects — the thing being assessed
 * is the marker's model of a good answer, and the only way to learn a model is
 * to apply it. The ledger just makes it structured, and turns every unticked
 * point into a classified, schedulable mistake.
 */

import { useEffect, useMemo, useState } from "react";
import {
  isObjectivelyMarkable,
  markObjectively,
  scoreLedger,
  type Attempt,
  type AttemptMode,
  type AttemptResponse,
  type LedgerEntry,
  type MarkLossCategory,
  type PointOutcome,
  type Question,
  MARK_LOSS_LABELS,
} from "@/domain/question";
import { SELF_MARK_REASONS } from "@/store/types";
import { useContent, useStore } from "@/store/provider";
import { aoSplitForQuestion, findCommandWord } from "@/domain/curriculum";
import { Callout, Card, Chip, Timer, useTicker, Marks, round1 } from "./components";

/** Shape returned by POST /api/ai/mark. */
interface AIMarking {
  ledger: { pointId: string; outcome: PointOutcome; lossReason?: string; evidence?: string; note?: string }[];
  totalAwarded: number;
  whatYouDidWell?: string;
  theDecisiveGap: string;
  improvedAnswer: string;
  skillToPractise: string;
  uncertain: boolean;
  uncertaintyReason?: string;
  warnings?: string[];
}

const canReachServer = () =>
  typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);

export interface AnsweredResult {
  attempt: Omit<Attempt, "id">;
  question: Question;
}

export function QuestionView({
  question,
  mode,
  askConfidence,
  showWorking,
  onComplete,
  onSkip,
  index,
  total,
}: {
  question: Question;
  mode: AttemptMode;
  askConfidence: boolean;
  showWorking: boolean;
  onComplete: (result: AnsweredResult) => void;
  onSkip?: () => void;
  index?: number;
  total?: number;
}) {
  const [phase, setPhase] = useState<"answering" | "confidence" | "marking" | "done">("answering");
  const [startedAt] = useState(() => new Date().toISOString());
  const [response, setResponse] = useState<AttemptResponse>(() => blankResponse(question));
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | undefined>();
  const [hintLevel, setHintLevel] = useState(0);
  const elapsed = useTicker(phase === "answering");

  // A new question must reset everything, including the timer's phase.
  useEffect(() => {
    setPhase("answering");
    setResponse(blankResponse(question));
    setConfidence(undefined);
    setHintLevel(0);
  }, [question.id]);

  const objective = isObjectivelyMarkable(question.type);

  const submit = () => {
    if (askConfidence && confidence === undefined) {
      setPhase("confidence");
      return;
    }
    setPhase("marking");
  };

  return (
    <div className="stack">
      <Card>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            {index !== undefined && total !== undefined && (
              <span className="eyebrow">Question {index + 1} of {total}</span>
            )}
            {question.commandWord && <Chip tone="accent">{question.commandWord}</Chip>}
            <Chip>{question.marks} mark{question.marks === 1 ? "" : "s"}</Chip>
            {question.source.kind === "ai-generated" && <Chip tone="fading">AI-generated</Chip>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <ReportProblem questionId={question.id} />
            <Timer seconds={elapsed} budgetSeconds={question.timeSeconds} running={phase === "answering"} />
          </div>
        </div>

        {question.stimulus && (
          <div className="callout" style={{ marginBottom: 16, background: "var(--panel-2)" }}>
            {question.stimulus.title && <div className="callout-title">{question.stimulus.title}</div>}
            <div className="prose small" style={{ whiteSpace: "pre-wrap" }}>{question.stimulus.body}</div>
            {question.stimulus.table && (
              <div className="scroll-x" style={{ marginTop: 10 }}>
                <table className="table">
                  <thead>
                    <tr>{question.stimulus.table.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {question.stimulus.table.rows.map((r, i) => (
                      <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p style={{ fontFamily: "var(--serif)", fontSize: "1.14rem", lineHeight: 1.55, marginBottom: 8 }}>
          {question.prompt}
        </p>

        <Deconstruction question={question} />

        <ResponseInput
          question={question}
          response={response}
          onChange={setResponse}
          disabled={phase !== "answering"}
          showWorking={showWorking}
        />

        {phase === "answering" && (
          <>
            {question.hints?.length ? (
              <div className="stack tight" style={{ marginTop: 14 }}>
                {question.hints.slice(0, hintLevel).map((h, i) => (
                  <Callout key={i} kind="info" title={`Hint ${i + 1}`}>{h}</Callout>
                ))}
                {hintLevel < question.hints.length && (
                  <button className="btn small ghost" onClick={() => setHintLevel((l) => l + 1)}>
                    {hintLevel === 0 ? "Give me a hint" : "A stronger hint"}
                    <span className="muted"> · {question.hints.length - hintLevel} left</span>
                  </button>
                )}
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary" onClick={submit} disabled={isBlank(response)}>
                {objective ? "Check answer" : "Submit and mark"}
              </button>
              {onSkip && (
                <button className="btn ghost" onClick={onSkip}>Skip</button>
              )}
              <div className="spacer" />
              <span className="tiny muted">
                Expected time {Math.round(question.timeSeconds / 60)} min
              </span>
            </div>
          </>
        )}
      </Card>

      {phase === "confidence" && (
        <Card title="Before you see the answer">
          <p className="small muted" style={{ marginBottom: 12 }}>
            How confident are you? This is compared against what you actually score, which is the only
            way to detect the gap between feeling fluent and being able to produce.
          </p>
          <div className="row">
            {([1, 2, 3, 4] as const).map((c) => (
              <button
                key={c}
                className="btn"
                onClick={() => {
                  setConfidence(c);
                  setPhase("marking");
                }}
              >
                {["Guessing", "Unsure", "Fairly sure", "Certain"][c - 1]}
              </button>
            ))}
          </div>
        </Card>
      )}

      {phase === "marking" &&
        (objective ? (
          <ObjectiveResult
            question={question}
            response={response}
            onNext={(score) => {
              onComplete(buildResult(question, response, startedAt, elapsed, score, question.marks, "auto", confidence, mode));
              setPhase("done");
            }}
          />
        ) : (
          <LedgerMarking
            question={question}
            response={response}
            onDone={(score, ledger, markedBy) => {
              onComplete(
                buildResult(question, response, startedAt, elapsed, score, question.markScheme.totalMarks, markedBy, confidence, mode, ledger),
              );
              setPhase("done");
            }}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Response inputs
// ---------------------------------------------------------------------------

function ResponseInput({
  question,
  response,
  onChange,
  disabled,
  showWorking,
}: {
  question: Question;
  response: AttemptResponse;
  onChange: (r: AttemptResponse) => void;
  disabled: boolean;
  showWorking: boolean;
}) {
  const spec = question.response;

  switch (question.type) {
    case "mcq":
    case "true-false":
    case "multi-select": {
      const selected = response.kind === "choice" ? response.selected : [];
      const multi = question.type === "multi-select";
      return (
        <div className="stack tight" role={multi ? "group" : "radiogroup"}>
          {(spec?.choices ?? []).map((c, i) => (
            <button
              key={c.id}
              className="choice"
              disabled={disabled}
              data-selected={selected.includes(c.id)}
              role={multi ? "checkbox" : "radio"}
              aria-checked={selected.includes(c.id)}
              onClick={() =>
                onChange({
                  kind: "choice",
                  selected: multi
                    ? selected.includes(c.id) ? selected.filter((s) => s !== c.id) : [...selected, c.id]
                    : [c.id],
                })
              }
            >
              <span className="choice-key">{String.fromCharCode(65 + i)}</span>
              <span>{c.text}</span>
            </button>
          ))}
        </div>
      );
    }

    case "numeric": {
      const v = response.kind === "numeric" ? response : { value: null, working: "" };
      return (
        <div className="stack tight">
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="numeric-answer">Your answer{spec?.unit ? ` (${spec.unit})` : ""}</label>
            <input
              id="numeric-answer"
              type="number"
              step="any"
              disabled={disabled}
              value={v.value ?? ""}
              onChange={(e) =>
                onChange({ kind: "numeric", value: e.target.value === "" ? null : Number(e.target.value), working: v.working, unit: spec?.unit })
              }
            />
          </div>
          {showWorking && (
            <div className="field">
              <label htmlFor="working">Working</label>
              <p className="hint">Marks are usually available for method. Write the steps even when you are confident.</p>
              <textarea id="working" disabled={disabled} value={v.working ?? ""} onChange={(e) => onChange({ ...v, kind: "numeric", working: e.target.value })} />
            </div>
          )}
        </div>
      );
    }

    case "cloze":
    case "label-diagram": {
      const values = response.kind === "cloze" ? response.values : {};
      const parts = (question.stimulus?.body ?? question.prompt).split(/(\{\{[^}]+\}\})/g);
      return (
        <p style={{ lineHeight: 2.4, fontSize: "1.02rem" }}>
          {parts.map((part, i) => {
            const m = part.match(/^\{\{(.+)\}\}$/);
            if (!m) return <span key={i}>{part}</span>;
            const blankId = m[1]!.trim();
            return (
              <input
                key={i}
                type="text"
                disabled={disabled}
                value={values[blankId] ?? ""}
                aria-label={`Blank ${blankId}`}
                onChange={(e) => onChange({ kind: "cloze", values: { ...values, [blankId]: e.target.value } })}
                style={{ display: "inline-block", width: 150, margin: "0 4px", padding: "3px 8px" }}
              />
            );
          })}
        </p>
      );
    }

    case "match": {
      const pairs = response.kind === "match" ? response.pairs : {};
      const rights = (spec?.pairs ?? []).map((p) => ({ id: p.rightId, text: p.right }));
      return (
        <div className="stack tight">
          {(spec?.pairs ?? []).map((p) => (
            <div key={p.leftId} className="row" style={{ gap: 10 }}>
              <span className="small" style={{ flex: 1 }}>{p.left}</span>
              <select
                disabled={disabled}
                value={pairs[p.leftId] ?? ""}
                aria-label={`Match for ${p.left}`}
                style={{ maxWidth: 260 }}
                onChange={(e) => onChange({ kind: "match", pairs: { ...pairs, [p.leftId]: e.target.value } })}
              >
                <option value="">Choose…</option>
                {rights.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case "order": {
      const seq = response.kind === "order" ? response.sequence : (spec?.sequence ?? []).map((s) => s.id);
      const byId = new Map((spec?.sequence ?? []).map((s) => [s.id, s.text]));
      const move = (from: number, to: number) => {
        if (to < 0 || to >= seq.length) return;
        const next = [...seq];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item!);
        onChange({ kind: "order", sequence: next });
      };
      return (
        <ol className="stack tight" style={{ listStyle: "none", padding: 0 }}>
          {seq.map((sid, i) => (
            <li key={sid} className="row" style={{ gap: 8, padding: "8px 12px", border: "1px solid var(--rule)", borderRadius: "var(--radius-sm)" }}>
              <span className="num tiny muted">{i + 1}</span>
              <span className="small" style={{ flex: 1 }}>{byId.get(sid)}</span>
              <button className="btn small ghost" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">↑</button>
              <button className="btn small ghost" disabled={disabled || i === seq.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">↓</button>
            </li>
          ))}
        </ol>
      );
    }

    default: {
      const v = response.kind === "text" ? response : { text: "", working: "" };
      const words = v.text.trim() ? v.text.trim().split(/\s+/).length : 0;
      return (
        <div className="stack tight">
          <textarea
            className="answer-box"
            disabled={disabled}
            value={v.text}
            aria-label="Your answer"
            placeholder="Write your answer as you would in the exam — one developed point per paragraph."
            onChange={(e) => onChange({ kind: "text", text: e.target.value, working: v.working })}
          />
          <div className="row between">
            <span className="tiny muted">
              {words} words
              {spec?.suggestedWords ? ` · about ${spec.suggestedWords} expected` : ""}
            </span>
            <span className="tiny muted">
              {question.marks >= 6 ? "Plan the shape before you write. Count the marks, plan that many developed points." : ""}
            </span>
          </div>
        </div>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Objective marking
// ---------------------------------------------------------------------------

function ObjectiveResult({
  question,
  response,
  onNext,
}: {
  question: Question;
  response: AttemptResponse;
  onNext: (score: number) => void;
}) {
  const result = useMemo(() => markObjectively(question, response), [question, response]);
  if (!result) return null;
  const correct = result.score >= question.marks;
  const partial = result.score > 0 && !correct;

  return (
    <Card>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h3 style={{ color: correct ? "var(--secure)" : partial ? "var(--fading)" : "var(--lost)" }}>
          {correct ? "Correct" : partial ? "Partly correct" : "Not correct"}
        </h3>
        <Marks earned={result.score} available={question.marks} />
      </div>

      {response.kind === "choice" && (
        <div className="stack tight" style={{ marginBottom: 14 }}>
          {(question.response?.choices ?? []).map((c, i) => {
            const picked = response.selected.includes(c.id);
            const outcome = c.correct ? "correct" : picked ? "wrong" : undefined;
            return (
              <div key={c.id} className="choice" data-outcome={outcome} style={{ cursor: "default" }}>
                <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                <span>
                  {c.text}
                  {picked && !c.correct && c.misconception && (
                    <>
                      <br />
                      <span className="small" style={{ color: "var(--lost)" }}>{c.misconception}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {result.detail.length > 0 && (
        <Callout kind="warn" title="What went wrong">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.detail.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </Callout>
      )}

      {question.markScheme.modelAnswer && (
        <div style={{ marginTop: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Model answer</p>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{question.markScheme.modelAnswer}</p>
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={() => onNext(result.score)}>Continue</button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ledger marking
// ---------------------------------------------------------------------------

function LedgerMarking({
  question,
  response,
  onDone,
}: {
  question: Question;
  response: AttemptResponse;
  onDone: (score: number, ledger: LedgerEntry[], markedBy: Attempt["markedBy"]) => void;
}) {
  const points = question.markScheme.points ?? [];
  const [entries, setEntries] = useState<Record<string, LedgerEntry>>({});
  const [revealed, setRevealed] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const [aiProposal, setAiProposal] = useState<AIMarking | null>(null);
  const [aiError, setAiError] = useState<{ message: string; fallback: string } | null>(null);

  useEffect(() => {
    if (!canReachServer()) return;
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d: { available: boolean }) => !cancelled && setAiAvailable(Boolean(d.available)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const answerText = response.kind === "text" ? response.text : response.kind === "numeric" ? String(response.value ?? "") : "";
  const score = useMemo(() => scoreLedger(question.markScheme, Object.values(entries)), [entries, question.markScheme]);
  const allResolved = points.length > 0 && points.every((p) => entries[p.id]);

  const setOutcome = (pointId: string, outcome: PointOutcome, marks: number) => {
    setEntries((prev) => ({
      ...prev,
      [pointId]: {
        pointId,
        outcome,
        awarded: outcome === "hit" ? marks : outcome === "partial" ? marks / 2 : 0,
        lossReason: outcome === "hit" ? undefined : prev[pointId]?.lossReason,
      },
    }));
  };

  const setReason = (pointId: string, reason: MarkLossCategory) => {
    setEntries((prev) => ({ ...prev, [pointId]: { ...prev[pointId]!, lossReason: reason } }));
  };

  /**
   * Ask the model to propose a marking.
   *
   * Deliberately a *proposal*: it pre-fills the ledger and every row stays
   * editable, because the student applying the scheme themselves is where most
   * of the learning is. The AI is a first pass that saves time on the obvious
   * points, not a verdict — and where it says it is unsure, that is surfaced
   * rather than swallowed.
   */
  const askAI = async () => {
    setAiState("working");
    setAiError(null);
    try {
      const res = await fetch("/api/ai/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionPrompt: question.prompt,
          stimulus: question.stimulus?.body,
          commandWord: question.commandWord,
          marks: question.marks,
          markSchemePoints: points.map((p) => ({
            id: p.id,
            text: p.text,
            marks: p.marks,
            aoCode: p.aoCode,
            alternatives: p.alternatives,
            rejects: p.rejects,
          })),
          markSchemeLevels: question.markScheme.levels,
          studentAnswer: answerText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError({ message: data.error ?? "The AI could not mark this.", fallback: data.fallback ?? "" });
        setAiState("failed");
        return;
      }
      const proposal = data as AIMarking;
      setAiProposal(proposal);
      setEntries((prev) => {
        const next = { ...prev };
        for (const row of proposal.ledger) {
          const point = points.find((p) => p.id === row.pointId);
          if (!point) continue;
          next[row.pointId] = {
            pointId: row.pointId,
            outcome: row.outcome,
            awarded: row.outcome === "hit" ? point.marks : row.outcome === "partial" ? point.marks / 2 : 0,
            lossReason: row.outcome === "hit" ? undefined : (row.lossReason as MarkLossCategory | undefined),
            note: row.evidence,
          };
        }
        return next;
      });
      setAiState("done");
    } catch {
      setAiError({
        message: "The request did not reach the server.",
        fallback: "Mark it yourself against the scheme — your answer is saved either way.",
      });
      setAiState("failed");
    }
  };

  if (!revealed) {
    return (
      <Card>
        <h3>Now mark it yourself</h3>
        <p className="small" style={{ marginTop: 8 }}>
          You are about to see the mark scheme. Working through it point by point is the single
          highest-value activity in written subjects — the thing being assessed is the marker&rsquo;s model
          of a good answer, and applying that model is how you learn it.
        </p>
        <Callout kind="info" title="Mark honestly">
          Credit only what you actually wrote, not what you meant. An inflated self-mark buys nothing
          and corrupts every recommendation the system makes afterwards.
        </Callout>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={() => setRevealed(true)}>Show the mark scheme</button>
        </div>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card title="Your answer">
        <div className="prose small" style={{ whiteSpace: "pre-wrap", fontFamily: "var(--serif)", fontSize: "1rem" }}>
          {answerText || <span className="muted">(no answer written)</span>}
        </div>
      </Card>

      {aiAvailable && (
        <Card title="Marking assistance">
          {aiState === "idle" && (
            <div className="row between">
              <p className="small muted" style={{ margin: 0, maxWidth: "56ch" }}>
                The AI can propose a marking against this scheme. It pre-fills the ledger and every row
                stays editable — applying the scheme yourself is where most of the learning is.
              </p>
              <button className="btn" onClick={() => void askAI()}>Propose a marking</button>
            </div>
          )}
          {aiState === "working" && <p className="small muted">Marking against the scheme…</p>}
          {aiState === "failed" && aiError && (
            <Callout kind="warn" title={aiError.message}>{aiError.fallback}</Callout>
          )}
          {aiState === "done" && aiProposal && (
            <div className="stack tight">
              {aiProposal.uncertain && (
                <Callout kind="warn" title="The AI flagged this marking as uncertain">
                  {aiProposal.uncertaintyReason ?? "Check it carefully against the scheme yourself."}
                </Callout>
              )}
              {aiProposal.warnings?.length ? (
                <Callout kind="warn" title="Discarded">{aiProposal.warnings.join(" ")}</Callout>
              ) : null}
              <Callout kind="info" title="The decisive gap">{aiProposal.theDecisiveGap}</Callout>
              {aiProposal.whatYouDidWell && <p className="small">{aiProposal.whatYouDidWell}</p>}
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>Your answer, minimally repaired</p>
                <p className="small" style={{ whiteSpace: "pre-wrap", padding: "10px 12px", background: "var(--secure-wash)", borderRadius: "var(--radius-sm)", lineHeight: 1.65 }}>
                  {aiProposal.improvedAnswer}
                </p>
              </div>
              <p className="small"><strong>Practise next:</strong> {aiProposal.skillToPractise}</p>
              <p className="tiny muted">
                Proposal only. Every row below is still yours to change, and the mark that is saved is
                the one you agree with.
              </p>
            </div>
          )}
        </Card>
      )}

      <Card
        title="Mark scheme"
        action={<span className="num small">{round1(score)} / {question.markScheme.totalMarks}</span>}
      >
        <div className="stack tight">
          {points.map((p) => {
            const entry = entries[p.id];
            return (
              <div key={p.id} className="ledger-row" data-outcome={entry?.outcome}>
                <div>
                  <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                    <span className="num tiny muted">{p.marks} mark{p.marks === 1 ? "" : "s"}</span>
                    {p.aoCode && <Chip tone={p.aoCode.toLowerCase() as "ao1"}>{p.aoCode}</Chip>}
                  </div>
                  <p className="small" style={{ margin: 0 }}>{p.text}</p>
                  {p.alternatives?.length ? (
                    <p className="tiny muted" style={{ margin: "4px 0 0" }}>Also accept: {p.alternatives.join(" · ")}</p>
                  ) : null}
                  {p.rejects?.length ? (
                    <p className="tiny" style={{ margin: "4px 0 0", color: "var(--lost)" }}>Do not accept: {p.rejects.join(" · ")}</p>
                  ) : null}

                  {entry && entry.outcome !== "hit" && (
                    <div className="field" style={{ marginTop: 8, maxWidth: 320 }}>
                      <label className="tiny">Why did you lose this?</label>
                      <select
                        value={entry.lossReason ?? ""}
                        onChange={(e) => setReason(p.id, e.target.value as MarkLossCategory)}
                      >
                        <option value="">Choose a cause…</option>
                        {SELF_MARK_REASONS.map((r) => (
                          <option key={r} value={r}>{MARK_LOSS_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="btn-group">
                  <button className={`btn small ${entry?.outcome === "hit" ? "primary" : ""}`} onClick={() => setOutcome(p.id, "hit", p.marks)}>Hit</button>
                  <button className={`btn small ${entry?.outcome === "partial" ? "primary" : ""}`} onClick={() => setOutcome(p.id, "partial", p.marks)}>Part</button>
                  <button className={`btn small ${entry?.outcome === "missed" ? "primary" : ""}`} onClick={() => setOutcome(p.id, "missed", p.marks)}>Miss</button>
                </div>
              </div>
            );
          })}
        </div>

        {points.length === 0 && (
          <Callout kind="warn">
            This question has no point-by-point scheme in the pack, only level descriptors. Judge your
            answer against the levels below and record an honest mark.
          </Callout>
        )}

        {question.markScheme.levels?.length ? (
          <div style={{ marginTop: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Level descriptors</p>
            <div className="stack tight">
              {question.markScheme.levels.map((l) => (
                <div key={l.level} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
                  <strong>Level {l.level} ({l.marksFrom}–{l.marksTo})</strong> — {l.descriptor}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {question.markScheme.modelAnswer && (
        <Card title="What a strong answer looks like">
          <p className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "var(--serif)", fontSize: "1rem", lineHeight: 1.7 }}>
            {question.markScheme.modelAnswer}
          </p>
        </Card>
      )}

      {question.markScheme.nearMissAnswer && (
        <Card title="An answer that looks right and is not">
          <p className="small" style={{ whiteSpace: "pre-wrap", fontStyle: "italic" }}>{question.markScheme.nearMissAnswer}</p>
          {question.markScheme.examinerNotes && (
            <Callout kind="warn" title="Why it falls short">{question.markScheme.examinerNotes}</Callout>
          )}
        </Card>
      )}

      <Card>
        <div className="row between">
          <div>
            <span className="stat-label">Your mark</span>
            <div className="stat-value small">{round1(score)} / {question.markScheme.totalMarks}</div>
          </div>
          <button
            className="btn primary"
            disabled={points.length > 0 && !allResolved}
            onClick={() => onDone(score, Object.values(entries), aiProposal ? "ai" : "self")}
          >
            {points.length > 0 && !allResolved ? "Resolve every point first" : "Save and continue"}
          </button>
        </div>
        {points.length > 0 && !allResolved && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Every point needs a verdict. Skipping the ones you are unsure about is where the diagnosis
            gets lost.
          </p>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function blankResponse(q: Question): AttemptResponse {
  switch (q.type) {
    case "mcq":
    case "true-false":
    case "multi-select":
      return { kind: "choice", selected: [] };
    case "numeric":
      return { kind: "numeric", value: null, working: "" };
    case "cloze":
    case "label-diagram":
      return { kind: "cloze", values: {} };
    case "match":
      return { kind: "match", pairs: {} };
    case "order":
      return { kind: "order", sequence: (q.response?.sequence ?? []).map((s) => s.id) };
    default:
      return { kind: "text", text: "", working: "" };
  }
}

function isBlank(r: AttemptResponse): boolean {
  switch (r.kind) {
    case "choice": return r.selected.length === 0;
    case "numeric": return r.value === null;
    case "text": return r.text.trim().length === 0;
    case "cloze": return Object.values(r.values).every((v) => !v.trim());
    case "match": return Object.keys(r.pairs).length === 0;
    case "order": return false;
    default: return true;
  }
}

function buildResult(
  question: Question,
  response: AttemptResponse,
  startedAt: string,
  elapsed: number,
  score: number,
  maxScore: number,
  markedBy: Attempt["markedBy"],
  confidence: Attempt["confidence"],
  mode: AttemptMode,
  ledger?: LedgerEntry[],
): AnsweredResult {
  const now = new Date().toISOString();
  return {
    question,
    attempt: {
      questionId: question.id,
      questionVersion: question.version,
      startedAt,
      submittedAt: now,
      timeSpent: Math.round(elapsed),
      response,
      confidence,
      score,
      maxScore,
      markedBy,
      markedAt: now,
      ledger,
      mode,
    },
  };
}


/**
 * One-click content-quality feedback. A question bank rots quietly — a wrong
 * accepted value or an ambiguous prompt survives for months unless the person
 * who hits it can flag it in two seconds, from the question itself, without
 * breaking their session. Reports land in the event log and surface on the
 * Library page.
 */
function ReportProblem({ questionId }: { questionId: string }) {
  const { record } = useStore();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <span className="tiny muted">Reported — thank you</span>;

  if (!open) {
    return (
      <button className="btn ghost small" onClick={() => setOpen(true)} title="Report a problem with this question">
        ⚑
      </button>
    );
  }

  const report = (issue: string) => {
    record({ type: "content_reported", at: new Date().toISOString(), questionId, issue });
    setSent(true);
    setOpen(false);
  };

  return (
    <span className="row" style={{ gap: 4 }}>
      {["Wrong answer", "Ambiguous", "Marks don't add up", "Wrong topic", "Other"].map((issue) => (
        <button key={issue} className="btn small" onClick={() => report(issue)}>
          {issue}
        </button>
      ))}
      <button className="btn ghost small" onClick={() => setOpen(false)}>✕</button>
    </span>
  );
}


/**
 * Question deconstruction.
 *
 * Teaches the reading of exams, not just the answering of them: what the
 * command word licenses, where this question's marks sit by assessment
 * objective, and what the time budget implies. Collapsed by default — the goal
 * is that the student internalises the habit, not that they lean on the panel —
 * and everything in it is derived from the pack's own command-word definitions
 * and published AO weightings, never invented per question.
 */
function Deconstruction({ question }: { question: Question }) {
  const bundle = useContent();
  const syllabus = bundle.syllabuses.find((x) => x.id === question.syllabusId);
  if (!syllabus) return null;

  const cw = question.commandWord ? findCommandWord(syllabus, question.commandWord) : undefined;
  const split = question.aoMarks
    ? Object.entries(question.aoMarks).map(([aoCode, marks]) => ({ aoCode, marks }))
    : question.paperId
      ? aoSplitForQuestion(syllabus, question.paperId, question.marks).filter((r) => r.marks > 0)
      : [];

  if (!cw && split.length === 0) return null;

  const higher = split.filter((r) => /3|4/.test(r.aoCode)).reduce((t, r) => t + r.marks, 0);
  const minutes = Math.round(question.timeSeconds / 60);

  return (
    <details className="why" style={{ borderTop: "none", marginTop: 0, marginBottom: 14, paddingTop: 0 }}>
      <summary>How to read this question</summary>
      <div className="stack tight" style={{ marginTop: 10 }}>
        {cw && (
          <div className="callout" style={{ padding: "9px 12px" }}>
            <span className="small">
              <strong>{cw.word}</strong> — {cw.definition}{" "}
              {cw.aoCeiling.length > 0 && (
                <span className="muted">
                  Highest AO reachable: {cw.aoCeiling[cw.aoCeiling.length - 1]}.
                </span>
              )}{" "}
              {cw.expects}
            </span>
            {cw.trap && (
              <p className="tiny" style={{ margin: "5px 0 0", color: "var(--lost)" }}>Trap: {cw.trap}</p>
            )}
          </div>
        )}
        {split.length > 0 && (
          <p className="small" style={{ margin: 0 }}>
            <strong>Where the marks sit:</strong>{" "}
            {split.map((r) => `${r.aoCode} ≈ ${r.marks}`).join(" · ")}
            {higher > 0 && higher >= question.marks / 2 && (
              <span className="muted">
                {" "}— {higher} of the {question.marks} marks are analysis and judgement, so developed
                chains and a committed conclusion earn more here than extra knowledge.
              </span>
            )}
          </p>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>
          Budget: about {minutes} minute{minutes === 1 ? "" : "s"}. Plan {question.marks >= 6 ? "the shape before writing — count the marks, plan that many developed points" : "one precise answer; padding earns nothing"}.
        </p>
      </div>
    </details>
  );
}
