"use client";

/**
 * Progress and analytics.
 *
 * Everything here is derived from the event log rather than stored, so metrics
 * can be improved retroactively over a student's whole history. The knowledge
 * heatmap is the centrepiece: topics against skill types, which is where hidden
 * weaknesses live — a student strong on recall and weak on evaluation looks
 * fine in any per-topic average, and is not fine.
 */

import { useMemo, useState } from "react";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { calibration, rollupByDay, studyStreak, timeEfficiency, ofType } from "@/domain/events";
import { childTopics } from "@/domain/curriculum";
import { retentionState } from "@/domain/mastery";
import { MARK_LOSS_LABELS, TECHNIQUE_LOSSES } from "@/domain/question";
import { Card, Callout, Chip, Empty, Stat, Tabs, Why, Pct, round1 } from "@/ui/components";
import { LineChart, BarChart, Heatmap } from "@/ui/charts";

type Tab = "trajectory" | "heatmap" | "calibration" | "time";

export default function ProgressPage() {
  const { state, ready } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [tab, setTab] = useState<Tab>("trajectory");
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

  /**
   * Heatmap cells: leaf topics × assessment objectives, from real ledger data.
   *
   * Declared here, above the early returns, because hooks must run in the same
   * order on every render. It previously sat lower down next to the chart it
   * feeds, which read better and crashed the page the moment a student had
   * enough attempts to get past the empty state.
   */
  const cellData = useMemo(() => {
    const map = new Map<string, { earned: number; available: number; n: number }>();
    const byId = new Map(bundle.questions.map((q) => [q.id, q]));
    for (const a of state.attempts) {
      const q = byId.get(a.questionId);
      if (!q) continue;
      const points = new Map((q.markScheme.points ?? []).map((p) => [p.id, p]));
      for (const e of a.ledger ?? []) {
        const p = points.get(e.pointId);
        if (!p?.aoCode) continue;
        for (const t of q.topicIds) {
          const key = `${t}::${p.aoCode}`;
          const cur = map.get(key) ?? { earned: 0, available: 0, n: 0 };
          cur.available += p.marks;
          cur.earned += e.outcome === "hit" ? p.marks : e.outcome === "partial" ? p.marks / 2 : 0;
          cur.n++;
          map.set(key, cur);
        }
      }
      // Objectively-marked questions contribute to their declared AO split.
      if (!a.ledger?.length && q.aoMarks) {
        const fraction = a.maxScore ? a.score / a.maxScore : 0;
        for (const [ao, marks] of Object.entries(q.aoMarks)) {
          for (const t of q.topicIds) {
            const key = `${t}::${ao}`;
            const cur = map.get(key) ?? { earned: 0, available: 0, n: 0 };
            cur.available += marks;
            cur.earned += marks * fraction;
            cur.n++;
            map.set(key, cur);
          }
        }
      }
    }
    return map;
  }, [state.attempts, bundle.questions]);

  if (!ready) return <p className="muted small">Loading…</p>;
  const view = views[Math.min(idx, views.length - 1)];
  if (!view) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  const rollups = rollupByDay(state.events);
  const streak = studyStreak(rollups, now.slice(0, 10));
  const calib = calibration(state.events);
  const efficiency = timeEfficiency(state.events);
  const answered = ofType(state.events, "question_answered");

  if (answered.length === 0) {
    return (
      <div className="stack loose">
        <header>
          <p className="eyebrow">Progress</p>
          <h1>Nothing measured yet</h1>
        </header>
        <Empty title="Answer some questions and this fills in">
          Every statistic here is derived from your own recorded work. There is no placeholder data,
          and nothing is shown that has not been measured.
        </Empty>
      </div>
    );
  }

  // Accuracy trajectory, with a 7-day rolling mean so single bad days do not
  // read as a trend.
  const daily = rollups.map((r) => ({
    x: r.date,
    y: r.marksAvailable ? r.marksEarned / r.marksAvailable : 0,
  }));
  const rolling = daily.map((_, i) => {
    const window = daily.slice(Math.max(0, i - 6), i + 1);
    return { x: daily[i]!.x, y: window.reduce((s, d) => s + d.y, 0) / window.length };
  });

  const leaves = view.syllabus.topics.filter((t) => childTopics(view.syllabus, t.id).length === 0);
  const skillColumns = view.syllabus.assessmentObjectives.map((ao) => ({ id: ao.code, label: ao.code }));


  const lossEvents = ofType(state.events, "mark_lost");
  const lossByCategory = new Map<string, number>();
  for (const e of lossEvents) lossByCategory.set(e.category, (lossByCategory.get(e.category) ?? 0) + e.marks);

  return (
    <div className="stack loose">
      <header className="stack tight">
        <div className="row between">
          <p className="eyebrow">Progress</p>
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
        <h1>What has actually changed</h1>
      </header>

      <div className="grid four">
        <Card><Stat label="Questions answered" value={answered.length} note={`${round1(answered.reduce((s, e) => s + e.score, 0))} marks earned`} /></Card>
        <Card><Stat label="Study streak" value={`${streak}d`} note="Consistency beats intensity" /></Card>
        <Card><Stat label="Mastery, weighted" value={<Pct value={view.readiness.dimensions.find((d) => d.key === "mastery")!.score} />} note="Weighted by marks at stake" /></Card>
        <Card><Stat label="Syllabus tested" value={<Pct value={view.coverage} />} /></Card>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "trajectory", label: "Trajectory" },
          { id: "heatmap", label: "Knowledge heatmap" },
          { id: "calibration", label: "Confidence" },
          { id: "time", label: "Time" },
        ]}
      />

      {tab === "trajectory" && (
        <div className="stack">
          <Card title="Accuracy over time">
            <LineChart
              series={[
                { label: "Daily", points: daily, colour: "var(--rule-strong)" },
                { label: "7-day mean", points: rolling, colour: "var(--accent)" },
              ]}
              yLabel="Accuracy"
            />
            <p className="tiny muted" style={{ marginTop: 8 }}>
              The rolling mean is the signal; single days are noise, and reading them as a trend is how
              students talk themselves out of a method that is working.
            </p>
          </Card>

          <div className="grid two">
            <Card title="Marks lost by cause">
              <BarChart
                horizontal
                data={[...lossByCategory]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([cat, marks]) => ({
                    label: MARK_LOSS_LABELS[cat as keyof typeof MARK_LOSS_LABELS] ?? cat,
                    value: marks,
                    colour: TECHNIQUE_LOSSES.has(cat as never) ? "var(--ao3)" : "var(--ao1)",
                  }))}
                format={(n) => round1(n)}
              />
            </Card>
            <Card title="Retention by topic">
              <BarChart
                horizontal
                data={[...view.topicRetention]
                  .filter(([tid]) => (view.topicMastery.get(tid)?.observations ?? 0) > 0)
                  .filter(([tid]) => childTopics(view.syllabus, tid).length === 0)
                  .sort((a, b) => a[1] - b[1])
                  .slice(0, 8)
                  .map(([tid, r]) => ({
                    label: view.syllabus.topics.find((t) => t.id === tid)?.title ?? tid,
                    value: Math.round(r * 100),
                    colour:
                      retentionState(r) === "secure" ? "var(--secure)"
                        : retentionState(r) === "stable" ? "var(--stable)"
                        : retentionState(r) === "fading" ? "var(--fading)"
                        : "var(--lost)",
                  }))}
                format={(n) => `${n}%`}
              />
            </Card>
          </div>
        </div>
      )}

      {tab === "heatmap" && (
        <Card title="Topics × assessment objectives">
          <p className="small muted" style={{ marginBottom: 14 }}>
            Colour is the score; paleness is thin evidence. A cell backed by two attempts is visibly
            paler than one backed by twenty, so a lucky run cannot look like a finding.
          </p>
          <Heatmap
            rows={leaves
              .filter((t) => skillColumns.some((c) => cellData.has(`${t.id}::${c.id}`)))
              .map((t) => ({ id: t.id, label: t.title }))}
            columns={skillColumns}
            value={(rowId, colId) => {
              const cell = cellData.get(`${rowId}::${colId}`);
              if (!cell || cell.available === 0) return null;
              return { score: cell.earned / cell.available, observations: cell.n };
            }}
          />
          {leaves.every((t) => !skillColumns.some((c) => cellData.has(`${t.id}::${c.id}`))) && (
            <Callout kind="info" title="Not enough ledger data yet">
              The heatmap is built from self-marked questions, because that is the only source that
              knows which assessment objective each mark belonged to. Self-mark a few written answers
              and this fills in.
            </Callout>
          )}
        </Card>
      )}

      {tab === "calibration" && (
        <Card title="Confidence against accuracy">
          <p className="small" style={{ marginBottom: 14 }}>{calib.verdict}</p>
          <BarChart
            data={calib.buckets.map((b) => ({
              label: b.label,
              value: Math.round(b.accuracy * 100),
              colour: b.gap < -0.15 ? "var(--lost)" : b.gap > 0.15 ? "var(--stable)" : "var(--secure)",
            }))}
            format={(n) => `${n}%`}
          />
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr><th>Stated confidence</th><th className="num">Attempts</th><th className="num">Actual accuracy</th><th className="num">Gap</th></tr>
              </thead>
              <tbody>
                {calib.buckets.map((b) => (
                  <tr key={b.confidence}>
                    <td>{b.label}</td>
                    <td className="num">{b.attempts}</td>
                    <td className="num">{b.attempts ? `${Math.round(b.accuracy * 100)}%` : "—"}</td>
                    <td className="num">
                      {b.attempts ? (
                        <Chip tone={Math.abs(b.gap) < 0.15 ? "secure" : b.gap < 0 ? "forgotten" : "stable"}>
                          {b.gap > 0 ? "+" : ""}{Math.round(b.gap * 100)}
                        </Chip>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Why
            because={[
              "Each confidence level is compared against the accuracy a perfectly calibrated student would show at that level.",
              "A large negative gap on 'Certain' is the fluency illusion: recognition mistaken for the ability to produce.",
              "This is one of the few metrics that predicts underperformance in students who are objectively knowledgeable.",
            ]}
          />
        </Card>
      )}

      {tab === "time" && (
        <Card title="Seconds per mark, by question size">
          <BarChart
            data={efficiency.map((e) => ({ label: e.bucket, value: Math.round(e.secondsPerMark) }))}
            format={(n) => `${n}s`}
          />
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Compare against the paper&rsquo;s own budget:{" "}
            {view.syllabus.papers.map((p) => `Paper ${p.code} allows ${Math.round((p.durationMinutes * 60) / p.rawMarks)}s per mark`).join(" · ")}.
          </p>
        </Card>
      )}
    </div>
  );
}
