"use client";

/**
 * The Mistake Lab.
 *
 * Most revision products show a red cross and move on. Here every lost mark is
 * a durable object with a cause, a repair path and a schedule, and the page
 * leads with the aggregate diagnosis rather than the list — because "your
 * biggest source of lost marks is that you never develop a consequence" is
 * actionable in a way that a list of forty wrong answers is not.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { buildLossProfile, dueForRedo, repairLadder, PRESCRIPTIONS, type Mistake } from "@/domain/mistakes";
import { MARK_LOSS_LABELS, TECHNIQUE_LOSSES, type MarkLossCategory } from "@/domain/question";
import { Card, Callout, Chip, Empty, Tabs, Stat, Why, round1 } from "./components";
import { BarChart } from "./charts";
import { QuestionView } from "./question-view";
import { useRecordAttempt } from "@/view/actions";

type View = "diagnosis" | "open" | "recurring" | "eliminated";

export function MistakeLab() {
  const { state } = useStore();
  const bundle = useContent();
  const record = useRecordAttempt();
  const now = new Date().toISOString();
  const [tab, setTab] = useState<View>("diagnosis");
  const [redoId, setRedoId] = useState<string | null>(null);

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  const topicTitle = (id: string) => {
    for (const v of views) {
      const t = v.syllabus.topics.find((x) => x.id === id);
      if (t) return t.title;
    }
    return id;
  };

  const profile = buildLossProfile(state.mistakes);
  const open = state.mistakes.filter((m) => m.status === "open" || m.status === "repairing");
  const recurring = state.mistakes.filter((m) => m.status === "recurring");
  const eliminated = state.mistakes.filter((m) => m.status === "eliminated");
  const queue = dueForRedo(state.mistakes, now, 50);

  const redoMistake = redoId ? state.mistakes.find((m) => m.id === redoId) : null;
  const redoQuestion = redoMistake ? bundle.questions.find((q) => q.id === redoMistake.questionId) : null;

  if (state.mistakes.length === 0) {
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Mistake lab</p>
          <h1>No mistakes recorded yet</h1>
          <p className="lede">
            Every mark you lose becomes an object here with a cause, a repair path and a review
            schedule — so the same mistake cannot quietly cost you marks twice.
          </p>
        </header>
        <Empty title="Answer and self-mark a question to start" action={<Link href="/practice" className="btn primary">Practise</Link>}>
          The diagnosis needs marked work. Classifying <em>why</em> each mark was lost is where nearly
          all of the value is — more than the score itself.
        </Empty>
      </div>
    );
  }

  if (redoQuestion && redoMistake) {
    return (
      <div className="stack">
        <div className="row between">
          <span className="eyebrow">Re-attempt · previously lost {round1(redoMistake.marksLost)} marks</span>
          <button className="btn small ghost" onClick={() => setRedoId(null)}>Back to the lab</button>
        </div>
        <Callout kind="warn" title={`Last time: ${MARK_LOSS_LABELS[redoMistake.category]}`}>
          {redoMistake.requiredPoint ? `The point you missed: ${redoMistake.requiredPoint}` : PRESCRIPTIONS[redoMistake.category]}
        </Callout>
        <QuestionView
          question={redoQuestion}
          mode="mistake-redo"
          askConfidence={state.settings.confidenceRating}
          showWorking={state.settings.showWorking}
          onComplete={(result) => {
            record(result.question, result.attempt);
            setRedoId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack loose">
      <header>
        <p className="eyebrow">Mistake lab</p>
        <h1>{Math.round(profile.totalMarksLost)} marks lost, and why</h1>
        <p className="lede">{profile.headline}</p>
      </header>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "diagnosis", label: "Diagnosis" },
          { id: "open", label: "Open", count: open.length },
          { id: "recurring", label: "Recurring", count: recurring.length },
          { id: "eliminated", label: "Eliminated", count: eliminated.length },
        ]}
      />

      {tab === "diagnosis" && (
        <div className="stack">
          <Callout kind={profile.techniqueShare > 0.55 ? "danger" : "warn"} title="What to do about it">
            {profile.prescription}
          </Callout>

          <div className="grid two">
            <Card title="Marks lost by cause">
              <BarChart
                horizontal
                data={profile.byCategory.slice(0, 9).map((c) => ({
                  label: c.label,
                  value: c.marks,
                  colour: TECHNIQUE_LOSSES.has(c.category) ? "var(--ao3)" : "var(--ao1)",
                }))}
                format={(n) => round1(n)}
              />
              <p className="tiny muted" style={{ marginTop: 12 }}>
                <span style={{ color: "var(--ao3)" }}>■</span> Technique — trainable in days, and it
                transfers across every topic.{" "}
                <span style={{ color: "var(--ao1)" }}>■</span> Knowledge — needs content work.
              </p>
              <Why
                because={[
                  `${Math.round(profile.techniqueShare * 100)}% of your lost marks are technique rather than knowledge.`,
                  "Technique losses transfer: fixing 'no chain' on one topic fixes it everywhere, which is why they are ranked separately.",
                  "Categories come from what you selected when self-marking, so the diagnosis is only as honest as the marking was.",
                ]}
              />
            </Card>

            <Card title="Marks lost by topic">
              <BarChart
                horizontal
                data={profile.byTopic.slice(0, 9).map((t) => ({ label: topicTitle(t.topicId), value: t.marks }))}
                format={(n) => round1(n)}
              />
            </Card>
          </div>

          {queue.length > 0 && (
            <Card title="Re-attempt queue" action={<span className="tiny muted">Most costly first</span>}>
              <div className="stack tight">
                {queue.slice(0, 6).map((m) => (
                  <MistakeRow key={m.id} mistake={m} topicTitle={topicTitle} onRedo={() => setRedoId(m.id)} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab !== "diagnosis" && (
        <div className="stack tight">
          {(tab === "open" ? open : tab === "recurring" ? recurring : eliminated).map((m) => (
            <MistakeRow key={m.id} mistake={m} topicTitle={topicTitle} onRedo={() => setRedoId(m.id)} expanded />
          ))}
          {(tab === "open" ? open : tab === "recurring" ? recurring : eliminated).length === 0 && (
            <Empty title={tab === "eliminated" ? "Nothing eliminated yet" : "Nothing here"}>
              {tab === "eliminated"
                ? "A mistake is only called eliminated after three clean re-encounters. One lucky correct answer is not evidence of repair."
                : "Nothing in this category."}
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}

function MistakeRow({
  mistake,
  topicTitle,
  onRedo,
  expanded,
}: {
  mistake: Mistake;
  topicTitle: (id: string) => string;
  onRedo: () => void;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ladder = repairLadder(mistake.category);
  const technique = TECHNIQUE_LOSSES.has(mistake.category);

  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, marginBottom: 5 }}>
            <Chip tone={technique ? "fading" : "lost"}>{MARK_LOSS_LABELS[mistake.category]}</Chip>
            <span className="tiny muted">
              {round1(mistake.marksLost)} marks · {mistake.topicIds.map(topicTitle).join(", ")}
            </span>
            {mistake.occurrences > 1 && <Chip tone="lost">×{mistake.occurrences}</Chip>}
            {mistake.status === "repairing" && <Chip tone="stable">{mistake.cleanRunsSince}/3 clean</Chip>}
            {mistake.status === "eliminated" && <Chip tone="secure">Eliminated</Chip>}
          </div>
          {mistake.requiredPoint && (
            <p className="small" style={{ margin: 0 }}>
              <strong className="muted">Missed:</strong> {mistake.requiredPoint}
            </p>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn small ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Explain"}
          </button>
          {mistake.status !== "eliminated" && (
            <button className="btn small primary" onClick={onRedo}>Re-attempt</button>
          )}
        </div>
      </div>

      {(open || expanded) && open && (
        <div className="stack tight" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
          {mistake.studentAnswer && (
            <div>
              <p className="eyebrow" style={{ marginBottom: 3 }}>What you wrote</p>
              <p className="small" style={{ fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                {mistake.studentAnswer.slice(0, 400)}
                {mistake.studentAnswer.length > 400 ? "…" : ""}
              </p>
            </div>
          )}
          <Callout kind="info" title="How to fix this">{PRESCRIPTIONS[mistake.category]}</Callout>
          <div>
            <p className="eyebrow" style={{ marginBottom: 5 }}>Repair path</p>
            <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
              {ladder.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <strong>{s.label}</strong> — <span className="muted">{s.rationale}</span>
                </li>
              ))}
            </ol>
          </div>
          {mistake.linkedCardId && (
            <p className="tiny muted">A review card was created from this and is scheduled more aggressively than normal.</p>
          )}
        </div>
      )}
    </div>
  );
}
