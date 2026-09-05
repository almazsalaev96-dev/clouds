"use client";

/**
 * The command centre.
 *
 * It answers five questions, in this order, above the fold:
 *
 *   What should I do now?      → the mission, with a reason attached
 *   Why should I do it?        → the priority engine's own explanation
 *   Am I on track?             → readiness, with its limiting dimension named
 *   What is decaying?          → review load and fading topics
 *   What is costing me marks?  → the loss profile's headline
 *
 * Nothing here is decoration. If a number cannot lead to an action, it does not
 * belong on this page — which is why there is no "questions answered" counter
 * and no XP bar.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { generateSession } from "@/domain/planner";
import { ACTION_COPY } from "@/domain/priority";
import { VERDICT_COPY } from "@/domain/readiness";
import { retentionState } from "@/domain/mastery";
import { rollupByDay, studyStreak } from "@/domain/events";
import { Card, Callout, Chip, Meter, Stat, Why, Empty, relativeDays, Pct } from "./components";
import { Ring, Sparkline } from "./charts";

export function CommandCentre() {
  const { state } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // `now` intentionally excluded: recomputing on every tick would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  const [subjectIdx, setSubjectIdx] = useState(0);
  const view = views[Math.min(subjectIdx, views.length - 1)];

  if (!view) return <Empty title="No subjects yet">Add a subject to get started.</Empty>;

  const rollups = rollupByDay(state.events);
  const streak = studyStreak(rollups, now.slice(0, 10));
  const todayMinutes = state.profile.weeklyMinutes[new Date().getUTCDay()] ?? 30;

  const session = generateSession({
    minutes: todayMinutes,
    priorities: view.priorities,
    titles: Object.fromEntries(view.syllabus.topics.map((t) => [t.id, t.title])),
    dueReviewCount: view.dueCards.length,
    openMistakeCount: view.openMistakes,
    daysToExam: view.daysToExam,
  });

  const top = view.priorities[0];
  const topTopic = top ? view.syllabus.topics.find((t) => t.id === top.topicId) : undefined;
  const verdict = VERDICT_COPY[view.readiness.verdict];
  const limiting = view.readiness.limitingDimension;

  const fading = [...view.topicRetention.entries()]
    .map(([topicId, r]) => ({
      topic: view.syllabus.topics.find((t) => t.id === topicId),
      r,
      mastery: view.topicMastery.get(topicId),
    }))
    .filter((x) => x.topic && (x.mastery?.observations ?? 0) > 0 && x.r < 0.72)
    .sort((a, b) => a.r - b.r)
    .slice(0, 5);

  const accuracyTrend = rollups.slice(-14).map((r) => (r.marksAvailable ? r.marksEarned / r.marksAvailable : 0));

  return (
    <div className="stack loose">
      {/* ---------------------------------------------------------- header */}
      <header className="stack tight">
        <div className="row between">
          <p className="eyebrow">
            {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {views.length > 1 && (
            <div className="pill-tabs">
              {views.map((v, i) => (
                <button
                  key={v.syllabus.id}
                  className="pill-tab"
                  aria-selected={i === subjectIdx}
                  onClick={() => setSubjectIdx(i)}
                >
                  {v.syllabus.subject}
                </button>
              ))}
            </div>
          )}
        </div>
        <h1>{session.headline}</h1>
        {top && topTopic && (
          <p className="lede">
            {ACTION_COPY[top.action].blurb}{" "}
            <Link href={`/topics/${encodeURIComponent(topTopic.id)}`}>Open {topTopic.title} →</Link>
          </p>
        )}
      </header>

      {/* ------------------------------------------------------- the numbers */}
      <div className="grid four">
        <Card>
          <Stat
            label="Days to exam"
            value={view.daysToExam !== undefined ? view.daysToExam : "—"}
            note={
              view.enrolment.examDate
                ? new Date(view.enrolment.examDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                : "No date set"
            }
            tone={view.daysToExam !== undefined && view.daysToExam < 21 ? "at-risk" : undefined}
          />
        </Card>
        <Card>
          <Stat
            label="Projected"
            value={view.forecast.sufficient ? view.forecast.central : "—"}
            note={
              view.forecast.sufficient
                ? `Range ${view.forecast.range[1]}–${view.forecast.range[0]} · target ${view.enrolment.targetGrade}`
                : `Not enough evidence yet · target ${view.enrolment.targetGrade}`
            }
          />
          <Why
            because={view.forecast.targetProbability.because}
            label={view.forecast.sufficient ? "How is this calculated?" : "Why no projection?"}
          />
        </Card>
        <Card>
          <Stat label="Due for review" value={view.dueCards.length} note={view.dueCards.length ? "Decaying now" : "Nothing due"} tone={view.dueCards.length > 20 ? "fading" : undefined} />
        </Card>
        <Card>
          <Stat label="Open mistakes" value={view.openMistakes} note={`${Math.round(view.lossProfile.totalMarksLost)} marks lost so far`} tone={view.openMistakes > 6 ? "at-risk" : undefined} />
        </Card>
      </div>

      {/* -------------------------------------------------- today's mission */}
      <div className="grid two">
        <Card title="Today's mission" action={<Link href={`/session?minutes=${todayMinutes}`} className="btn primary small">Start</Link>}>
          <div className="stack tight">
            {session.blocks.map((b, i) => (
              <div key={i} className="row" style={{ alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: i < session.blocks.length - 1 ? "1px solid var(--rule)" : undefined }}>
                <span className="num tiny muted" style={{ minWidth: 34, paddingTop: 2 }}>{b.minutes}m</span>
                <span style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.93rem" }}>{b.title}</strong>
                  <br />
                  <span className="small muted">{b.detail}</span>
                </span>
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 6 }}>
              Estimated value: <strong className="num">{session.expectedMarks.toFixed(1)} marks</strong> — a projection
              from your own recorded rate of improvement, not a promise.
            </p>
          </div>
          <Why because={session.because} />
        </Card>

        <Card title="Readiness">
          <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
            <Ring
              value={view.readiness.score}
              sublabel={verdict.label}
              tone={
                view.readiness.verdict === "ready" ? "var(--secure)"
                  : view.readiness.verdict === "almost-ready" ? "var(--stable)"
                  : view.readiness.verdict === "building" ? "var(--fading)"
                  : "var(--risk)"
              }
            />
            <div className="stack tight" style={{ flex: 1, minWidth: 180 }}>
              <p className="small">{verdict.meaning}</p>
              {limiting && (
                <div className="callout warn" style={{ padding: "9px 12px" }}>
                  <div className="callout-title">Holding you back: {limiting.label}</div>
                  <p className="small" style={{ margin: 0 }}>{limiting.nextStep}</p>
                </div>
              )}
              <Link href="/readiness" className="small">Full breakdown →</Link>
            </div>
          </div>
          <Why because={view.readiness.caveats} label="What this number does not know" />
        </Card>
      </div>

      {/* ------------------------------------------------ priorities + decay */}
      <div className="grid two">
        <Card title="Highest value right now" action={<Link href="/practice" className="btn small">Practise</Link>}>
          <div className="stack tight">
            {view.priorities.slice(0, 5).map((p) => {
              const topic = view.syllabus.topics.find((t) => t.id === p.topicId);
              if (!topic) return null;
              const m = view.topicMastery.get(p.topicId);
              return (
                <div key={p.topicId} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                  <div className="row between" style={{ marginBottom: 5 }}>
                    <Link href={`/topics/${encodeURIComponent(topic.id)}`} style={{ fontWeight: 500, fontSize: "0.93rem", textDecoration: "none", color: "var(--ink)" }}>
                      {topic.title}
                    </Link>
                    <span className="row" style={{ gap: 6 }}>
                      <Chip tone="accent">{ACTION_COPY[p.action].verb}</Chip>
                      <span className="num tiny muted">{p.marksPerHour.toFixed(1)} m/h</span>
                    </span>
                  </div>
                  <Meter value={m?.score ?? 0} target={0.88} tone={retentionState(view.topicRetention.get(p.topicId) ?? 0)} label={`${topic.title} mastery`} />
                  <Why because={p.because} />
                </div>
              );
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Ranked by expected marks gained per hour of study — not by how incomplete each topic looks.
          </p>
        </Card>

        <div className="stack">
          <Card title="Beginning to fade" action={view.dueCards.length ? <Link href="/review" className="btn small">Review</Link> : undefined}>
            {fading.length === 0 ? (
              <p className="small muted">Nothing is decaying yet. This fills in as evidence accumulates.</p>
            ) : (
              <div className="stack tight">
                {fading.map(({ topic, r }) => (
                  <div key={topic!.id} className="row between">
                    <Link href={`/topics/${encodeURIComponent(topic!.id)}`} className="small" style={{ color: "var(--ink)", textDecoration: "none" }}>
                      {topic!.title}
                    </Link>
                    <Chip tone={retentionState(r)}>
                      <Pct value={r} /> recall
                    </Chip>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Where your marks are going">
            {view.lossProfile.totalMarksLost === 0 ? (
              <p className="small muted">
                No marked work yet. Complete and self-mark a question and this becomes the most useful panel on the page.
              </p>
            ) : (
              <div className="stack tight">
                <p className="small">{view.lossProfile.headline}</p>
                <Callout kind="warn">{view.lossProfile.prescription}</Callout>
                <Link href="/mistakes" className="small">Open the Mistake Lab →</Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ----------------------------------------------------------- footer */}
      <div className="grid three">
        <Card>
          <Stat label="Study streak" value={`${streak} day${streak === 1 ? "" : "s"}`} note={streak === 0 ? "Start today" : "Consistency beats intensity"} />
        </Card>
        <Card>
          <Stat label="Syllabus tested" value={<Pct value={view.coverage} />} note={`${view.attemptCount} attempts recorded`} />
        </Card>
        <Card>
          <div className="row between">
            <Stat label="Accuracy, 14 days" value={accuracyTrend.length ? <Pct value={accuracyTrend[accuracyTrend.length - 1] ?? 0} /> : "—"} small />
            <Sparkline values={accuracyTrend} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
