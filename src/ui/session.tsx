"use client";

/**
 * Session runner — "I have N minutes".
 *
 * A generated session with a shape: retrieve first, repair what is broken, then
 * new work, then consolidate. Each block has a timer and a definition of done,
 * and the session ends with a report on what changed rather than a celebration.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { generateSession, type SessionBlock } from "@/domain/planner";
import { Card, Callout, Chip, Empty, Timer, useTicker, Why, formatDuration } from "./components";
import { Practice } from "./practice";
import { Review } from "./review";
import { uid } from "@/view/actions";
import type { LearningEvent } from "@/domain/events";

const BLOCK_ROUTE: Record<SessionBlock["kind"], string> = {
  recall: "review",
  learn: "topic",
  practise: "practice",
  "mistake-fix": "mistakes",
  drill: "technique",
  "exam-question": "practice",
  mock: "mock",
  consolidate: "consolidate",
};

export function SessionRunner({ minutes }: { minutes: number }) {
  const { state, record } = useStore();
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

  const [subjectIdx, setSubjectIdx] = useState(0);
  const view = views[Math.min(subjectIdx, views.length - 1)];
  const [sessionId] = useState(() => uid("sess"));
  const [started, setStarted] = useState(false);
  const [blockIdx, setBlockIdx] = useState(0);
  const [focus, setFocus] = useState(false);
  const elapsed = useTicker(started && !focus ? false : started);

  const session = useMemo(() => {
    if (!view) return null;
    return generateSession({
      minutes,
      priorities: view.priorities,
      titles: Object.fromEntries(view.syllabus.topics.map((t) => [t.id, t.title])),
      dueReviewCount: view.dueCards.length,
      openMistakeCount: view.openMistakes,
      daysToExam: view.daysToExam,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, minutes]);

  useEffect(() => {
    if (!started || !session) return;
    const event: LearningEvent = {
      type: "session_started",
      at: new Date().toISOString(),
      sessionId,
      plannedMinutes: minutes,
      mode: "adaptive",
    };
    record(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!view || !session) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  const block = session.blocks[blockIdx];
  const complete = blockIdx >= session.blocks.length;

  const finish = () => {
    record({
      type: "session_ended",
      at: new Date().toISOString(),
      sessionId,
      actualMinutes: Math.round(elapsed / 60),
      blocksCompleted: blockIdx,
      blocksPlanned: session.blocks.length,
    });
  };

  // ------------------------------------------------------------- plan view
  if (!started) {
    return (
      <div className="stack loose">
        <header className="stack tight">
          <div className="row between">
            <p className="eyebrow">Session · {minutes} minutes</p>
            {views.length > 1 && (
              <div className="pill-tabs">
                {views.map((v, i) => (
                  <button key={v.syllabus.id} className="pill-tab" aria-selected={i === subjectIdx} onClick={() => setSubjectIdx(i)}>
                    {v.syllabus.subject}
                  </button>
                ))}
              </div>
            )}
          </div>
          <h1>{session.headline}</h1>
        </header>

        <Card title="The plan">
          <div className="stack tight">
            {session.blocks.map((b, i) => (
              <div key={i} className="row" style={{ alignItems: "flex-start", gap: 14, padding: "11px 0", borderBottom: i < session.blocks.length - 1 ? "1px solid var(--rule)" : undefined }}>
                <span className="num tiny muted" style={{ minWidth: 36, paddingTop: 3 }}>{b.minutes}m</span>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 7 }}>
                    <strong style={{ fontSize: "0.95rem" }}>{b.title}</strong>
                    <Chip>{b.kind.replace("-", " ")}</Chip>
                  </div>
                  <p className="small muted" style={{ margin: "3px 0 0" }}>{b.detail}</p>
                  {b.target && <p className="tiny" style={{ margin: "4px 0 0", color: "var(--accent)" }}>Done when: {b.target}</p>}
                  <Why because={[b.because]} label="Why this block" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="row">
          <button className="btn primary large" onClick={() => setStarted(true)}>Start session</button>
          <button className="btn" onClick={() => { setStarted(true); setFocus(true); }}>Start in focus mode</button>
          <div className="spacer" />
          <span className="small muted">
            Estimated value {session.expectedMarks.toFixed(1)} marks
          </span>
        </div>
        <Why because={session.because} />
      </div>
    );
  }

  // ---------------------------------------------------------- session done
  if (complete) {
    finish();
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Session complete · {formatDuration(elapsed)}</p>
          <h1>Every block done</h1>
        </header>
        <Callout kind="good" title="Close the loop">
          Before you leave: write three sentences from memory on what changed in your understanding,
          and one thing still unclear. Sessions that end with self-explanation retain markedly more
          than sessions that end at the last question.
        </Callout>
        <div className="row">
          <Link href="/" className="btn primary">Command centre</Link>
          <Link href="/progress" className="btn">See what changed</Link>
        </div>
      </div>
    );
  }

  const body = (
    <div className="stack">
      <div className="row between">
        <div className="row" style={{ gap: 8 }}>
          <span className="eyebrow">Block {blockIdx + 1} of {session.blocks.length}</span>
          <Chip tone="accent">{block!.kind.replace("-", " ")}</Chip>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Timer seconds={elapsed} budgetSeconds={minutes * 60} running mode="down" />
          <button className="btn small ghost" onClick={() => setFocus((f) => !f)}>
            {focus ? "Exit focus" : "Focus"}
          </button>
        </div>
      </div>

      <Card>
        <h2>{block!.title}</h2>
        <p className="small muted" style={{ marginTop: 4 }}>{block!.detail}</p>
        {block!.target && <p className="small" style={{ color: "var(--accent)", marginTop: 6 }}>Done when: {block!.target}</p>}
      </Card>

      {BLOCK_ROUTE[block!.kind] === "review" && <Review />}
      {(BLOCK_ROUTE[block!.kind] === "practice" || BLOCK_ROUTE[block!.kind] === "topic") && (
        <Practice initialTopicId={block!.topicId} minutes={block!.minutes} />
      )}
      {BLOCK_ROUTE[block!.kind] === "mistakes" && (
        <Callout kind="info" title="Re-attempt your recorded mistakes">
          <Link href="/mistakes" className="btn small primary" style={{ marginTop: 8 }}>Open the Mistake Lab</Link>
        </Callout>
      )}
      {BLOCK_ROUTE[block!.kind] === "technique" && (
        <Callout kind="info" title="Isolate the move and repeat it">
          Technique is a skill: train it alone before reintegrating it into full answers.
          <Link href="/technique" className="btn small primary" style={{ marginTop: 8 }}>Open technique drills</Link>
        </Callout>
      )}
      {BLOCK_ROUTE[block!.kind] === "consolidate" && (
        <Card title="Close the loop">
          <p className="small">
            Blank paper, no notes: write what changed in your understanding this session, and one thing
            still unclear. Three sentences is enough.
          </p>
        </Card>
      )}

      <div className="row">
        <button className="btn primary" onClick={() => setBlockIdx((i) => i + 1)}>
          {blockIdx === session.blocks.length - 1 ? "Finish session" : "Next block"}
        </button>
        <button className="btn ghost" onClick={() => setBlockIdx(session.blocks.length)}>End early</button>
      </div>
    </div>
  );

  if (focus) {
    return (
      <div className="focus-mode">
        <div style={{ width: "min(760px, 100%)" }}>{body}</div>
      </div>
    );
  }
  return body;
}
