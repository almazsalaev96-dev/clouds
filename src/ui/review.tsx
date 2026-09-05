"use client";

/**
 * Review.
 *
 * Retrieval practice driven by the memory scheduler. Cards are ordered by marks
 * at risk rather than by due date, so a heavily-weighted topic slipping to 60%
 * recall is served before a footnote that went overdue yesterday.
 *
 * The four grades are shown with their real consequences — "Good · 12d" rather
 * than a bare button — because a student who can see the interval understands
 * what they are choosing, and grades more honestly as a result.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { newMemoryState, previewIntervals, review as reviewCard, GRADE_LABELS, type Grade } from "@/domain/scheduling";
import { retentionState } from "@/domain/mastery";
import { Card, Callout, Chip, Empty, Stat, Meter, Pct } from "./components";
import type { LearningEvent } from "@/domain/events";

export function Review({ topicId }: { topicId?: string }) {
  const { state, update } = useStore();
  const bundle = useContent();
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

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState<{ grade: Grade; interval: number }[]>([]);

  const queue = useMemo(() => {
    const rows = views.flatMap((v) =>
      v.dueCards
        .filter((d) => !topicId || (d.card.topicIds ?? []).includes(topicId))
        .map((d) => ({ ...d, view: v })),
    );
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, topicId]);

  const item = queue[index];

  if (views.length === 0) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  if (!item) {
    const graded = done.length;
    const again = done.filter((d) => d.grade === 1).length;
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Review</p>
          <h1>{graded > 0 ? "Queue cleared" : "Nothing is due"}</h1>
        </header>
        {graded > 0 ? (
          <div className="grid three">
            <Card><Stat label="Reviewed" value={graded} /></Card>
            <Card><Stat label="Lapsed" value={again} note={again ? "Returning tomorrow" : "None"} tone={again ? "at-risk" : "secure"} /></Card>
            <Card><Stat label="Next review" value={`${Math.min(...done.map((d) => d.interval))}d`} note="Soonest card" /></Card>
          </div>
        ) : (
          <Callout kind="good" title="Nothing is fading right now">
            The scheduler brings each item back just before you would forget it. Reviewing early feels
            productive and mostly wastes time — the retrieval is easy, so it strengthens memory very
            little. Practise something instead.
          </Callout>
        )}
        <div className="row">
          <Link href="/practice" className="btn primary">Practise instead</Link>
          <Link href="/" className="btn">Command centre</Link>
        </div>
      </div>
    );
  }

  const memory = state.memory[item.card.id!] ?? newMemoryState(now, "origin" in item.card ? item.card.origin : "authored");
  const intervals = previewIntervals(memory, now, {
    targetRetention: 0.9,
    maximumInterval: 365,
    examDate: item.view.enrolment.examDate,
  });

  const grade = (g: Grade) => {
    const outcome = reviewCard(memory, g, now, {
      targetRetention: 0.9,
      maximumInterval: 365,
      examDate: item.view.enrolment.examDate,
    });
    const event: LearningEvent = {
      type: "card_reviewed",
      at: now,
      cardId: item.card.id!,
      grade: g,
      intervalDays: outcome.intervalDays,
      retrievability: outcome.retrievabilityAtReview,
    };
    update((s) => ({ ...s, memory: { ...s.memory, [item.card.id!]: outcome.state } }), [event]);
    setDone((d) => [...d, { grade: g, interval: outcome.intervalDays }]);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const isMistakeCard = "origin" in item.card && item.card.origin === "mistake";

  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div className="row between">
        <span className="eyebrow">
          {index + 1} of {queue.length} due · {item.view.syllabus.subject}
        </span>
        <Chip tone={retentionState(item.retrievability)}>
          <Pct value={item.retrievability} /> recall
        </Chip>
      </div>
      <Meter value={index / Math.max(1, queue.length)} label="Progress through the queue" />

      <Card lift>
        <div className="stack">
          {isMistakeCard && (
            <Chip tone="lost">From a mark you lost</Chip>
          )}
          <p style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", lineHeight: 1.4, margin: "10px 0" }}>
            {item.card.front}
          </p>

          {revealed ? (
            <>
              <hr className="divider" />
              <p style={{ fontSize: "1.06rem", lineHeight: 1.68, whiteSpace: "pre-wrap" }}>{item.card.back}</p>
              {item.card.hint && <p className="small muted">{item.card.hint}</p>}
            </>
          ) : (
            <p className="small muted">
              Produce the answer out loud or on paper before revealing. Recognising the answer is not
              the same as being able to generate it, and the exam only rewards generating it.
            </p>
          )}
        </div>
      </Card>

      {revealed ? (
        <div className="stack tight">
          <span className="eyebrow">How well did you recall it?</span>
          <div className="row">
            {([1, 2, 3, 4] as Grade[]).map((g) => (
              <button key={g} className={`btn ${g === 3 ? "primary" : ""}`} onClick={() => grade(g)}>
                {GRADE_LABELS[g]}
                <span className="muted num tiny"> · {intervals[g]}d</span>
              </button>
            ))}
          </div>
          <p className="tiny muted">
            The interval shown is when the scheduler will bring this back. Grade honestly — the number
            is only useful if the grade was.
          </p>
        </div>
      ) : (
        <button className="btn primary large" onClick={() => setRevealed(true)}>Show answer</button>
      )}
    </div>
  );
}
