"use client";

/**
 * Exam Readiness Centre.
 *
 * One page that answers "am I ready" honestly: a verdict, the eight dimensions
 * behind it, what is holding it down, and — prominently — what the number does
 * not know. A readiness score presented without its blind spots is worse than
 * no score at all.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { VERDICT_COPY } from "@/domain/readiness";
import { cramFocus } from "@/domain/planner";
import { Card, Callout, Chip, Empty, Meter, Stat, Why, Pct, relativeDays } from "@/ui/components";
import { Ring, BarChart } from "@/ui/charts";

export default function ReadinessPage() {
  const { state, ready } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [idx, setIdx] = useState(0);

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  if (!ready) return <p className="muted small">Loading…</p>;
  const view = views[Math.min(idx, views.length - 1)];
  if (!view) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  const verdict = VERDICT_COPY[view.readiness.verdict];
  const cram = view.daysToExam !== undefined && view.daysToExam <= 7 ? cramFocus(view.daysToExam) : null;

  // The 100% preparation checklist: every dimension plus content-level coverage.
  const checklist = [
    { label: "Every topic tested at least once", done: view.coverage >= 0.95, detail: `${Math.round(view.coverage * 100)}% of objectives have evidence` },
    { label: "No topic below competent", done: [...view.topicMastery.values()].every((m) => m.observations === 0 || m.score >= 0.55), detail: "Mastery floor across the syllabus" },
    { label: "Retention above 75%", done: view.readiness.dimensions.find((d) => d.key === "retention")!.score >= 0.75, detail: "Average probability of cold recall" },
    { label: "At least two full mocks sat", done: (view.readiness.dimensions.find((d) => d.key === "mock")?.observations ?? 0) >= 2, detail: "The strongest available predictor" },
    { label: "Timing measured under exam conditions", done: (view.readiness.dimensions.find((d) => d.key === "timing")?.observations ?? 0) > 0, detail: "Otherwise timing is assumed, not known" },
    { label: "No recurring mistakes outstanding", done: state.mistakes.filter((m) => m.status === "recurring").length === 0, detail: `${state.mistakes.filter((m) => m.status === "recurring").length} recurring` },
    { label: "Higher-order marks above 70%", done: view.readiness.dimensions.find((d) => d.key === "technique")!.score >= 0.7, detail: "Analysis and evaluation" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="stack loose">
      <header className="stack tight">
        <div className="row between">
          <p className="eyebrow">Exam readiness</p>
          {views.length > 1 && (
            <div className="pill-tabs">
              {views.map((v, i) => (
                <button key={v.syllabus.id} className="pill-tab" aria-selected={i === idx} onClick={() => setIdx(i)}>
                  {v.syllabus.subject}
                </button>
              ))}
            </div>
          )}
        </div>
        <h1>{verdict.label}</h1>
        <p className="lede">{verdict.meaning}</p>
      </header>

      {cram && (
        <Callout kind="warn" title={`${cram.title} — ${view.daysToExam} day${view.daysToExam === 1 ? "" : "s"} to go`}>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {cram.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Callout>
      )}

      <div className="grid two">
        <Card>
          <div className="row" style={{ gap: 22, alignItems: "center" }}>
            <Ring
              value={view.readiness.score}
              size={124}
              sublabel={verdict.label}
              tone={
                view.readiness.verdict === "ready" ? "var(--secure)"
                  : view.readiness.verdict === "almost-ready" ? "var(--stable)"
                  : view.readiness.verdict === "building" ? "var(--fading)"
                  : "var(--risk)"
              }
            />
            <div className="stack tight">
              <Stat label="Projected grade" value={view.forecast.central} note={`Plausible range ${view.forecast.range[1]}–${view.forecast.range[0]}`} />
              <Stat label="Target" value={view.enrolment.targetGrade} note={`${Math.round(view.forecast.targetProbability.value * 100)}% chance on current evidence`} small />
              <Stat label="Exam" value={view.daysToExam !== undefined ? relativeDays(view.daysToExam) : "Not set"} small />
            </div>
          </div>
          <Why because={view.forecast.targetProbability.because} label="How the projection is calculated" />
          <p className="tiny muted" style={{ marginTop: 10 }}>{view.forecast.method}</p>
        </Card>

        <Card title="What this number does not know">
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            {view.forecast.caveats.map((c, i) => <li key={i} style={{ marginBottom: 5 }}>{c}</li>)}
          </ul>
        </Card>
      </div>

      <Card title="The eight dimensions">
        <div className="stack">
          {view.readiness.dimensions.map((d) => (
            <div key={d.key} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
              <div className="row between" style={{ marginBottom: 5 }}>
                <span className="row" style={{ gap: 7 }}>
                  <strong style={{ fontSize: "0.93rem" }}>{d.label}</strong>
                  {d.observations === 0 && <Chip tone="fading">assumed, not measured</Chip>}
                  {view.readiness.limitingDimension?.key === d.key && <Chip tone="lost">limiting factor</Chip>}
                </span>
                <span className="num small"><Pct value={d.score} /></span>
              </div>
              <Meter value={d.score} label={d.label} />
              <p className="small muted" style={{ margin: "6px 0 0" }}>{d.because}</p>
              {d.score < 0.75 && <p className="small" style={{ margin: "3px 0 0", color: "var(--accent)" }}>→ {d.nextStep}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Preparation checklist · ${doneCount} of ${checklist.length}`}>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Completing this list does not guarantee a grade, and nothing here should be read as one. It
          means the things that can be checked have been checked.
        </p>
        <div className="stack tight">
          {checklist.map((c) => (
            <div key={c.label} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
              <span className="row" style={{ gap: 9 }}>
                <span style={{ color: c.done ? "var(--secure)" : "var(--faint)", fontFamily: "var(--mono)" }}>
                  {c.done ? "✓" : "○"}
                </span>
                <span className="small">{c.label}</span>
              </span>
              <span className="tiny muted">{c.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="row">
        <Link href="/mock" className="btn primary">Sit a mock</Link>
        <Link href="/practice" className="btn">Practise the weakest area</Link>
      </div>
    </div>
  );
}
