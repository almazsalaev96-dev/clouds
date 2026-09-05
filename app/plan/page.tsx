"use client";

/**
 * Study plan.
 *
 * Re-derived on every open rather than stored. Nothing is ever "behind
 * schedule": a plan that accumulates guilt for missed days is a plan students
 * stop opening, and the missed work has not become more urgent because a date
 * passed — it has become more urgent because the exam got closer, which the
 * priority engine already knows.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { generatePlan } from "@/domain/planner";
import { reviewLoadForecast } from "@/domain/scheduling";
import { Card, Callout, Chip, Empty, Stat, Why } from "@/ui/components";
import { BarChart } from "@/ui/charts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlanPage() {
  const { state, update, ready } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [editing, setEditing] = useState(false);

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
  const view = views[0];
  if (!view) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  // Priorities are pooled across subjects so the plan allocates between them,
  // not just within one.
  const allPriorities = views.flatMap((v) => v.priorities).sort((a, b) => b.marksPerHour - a.marksPerHour);
  const titles = Object.fromEntries(
    views.flatMap((v) => v.syllabus.topics.map((t) => [t.id, `${v.syllabus.subject}: ${t.title}`])),
  );

  const plan = generatePlan({
    now,
    examDate: views.map((v) => v.enrolment.examDate).filter(Boolean).sort()[0],
    weeklyMinutes: state.profile.weeklyMinutes,
    priorities: allPriorities,
    titles,
    horizonDays: 28,
  });

  const load = reviewLoadForecast(Object.values(state.memory), now, 14);
  const peak = Math.max(...load.map((l) => l.due), 0);

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">Study plan · re-derived just now</p>
        <h1>Next four weeks</h1>
        <p className="lede">
          Topic order follows marks per hour and is recomputed every time you open this page. Missing a
          day changes what is most valuable next; it does not create a backlog.
        </p>
      </header>

      {plan.warnings.map((w, i) => (
        <Callout key={i} kind="warn">{w}</Callout>
      ))}

      {plan.phases.length > 0 && (
        <Card title="Phases">
          <div className="stack tight">
            {plan.phases.map((p) => {
              const active = now.slice(0, 10) >= p.from && now.slice(0, 10) <= p.to;
              return (
                <div key={p.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                  <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                    <strong style={{ fontSize: "0.95rem" }}>{p.name}</strong>
                    {active && <Chip tone="accent">now</Chip>}
                    <span className="tiny muted">
                      {p.from} → {p.to} · {Math.round(p.share * 100)}% of remaining time
                    </span>
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>{p.emphasis}</p>
                </div>
              );
            })}
          </div>
          <Why
            because={[
              "Phase lengths are proportions of the time remaining, so the same structure works whether the exam is in three weeks or nine months.",
              "Skill drilling gets the largest share because analysis and evaluation are skills rather than content, and they transfer across every topic.",
            ]}
          />
        </Card>
      )}

      <div className="grid two">
        <Card title="Time available" action={<button className="btn small ghost" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</button>}>
          {editing ? (
            <div className="stack tight">
              {WEEKDAYS.map((d, i) => (
                <div key={d} style={{ display: "grid", gridTemplateColumns: "44px 1fr 60px", gap: 12, alignItems: "center" }}>
                  <span className="small muted">{d}</span>
                  <input
                    type="range"
                    min={0}
                    max={240}
                    step={15}
                    value={state.profile.weeklyMinutes[i] ?? 0}
                    aria-label={`Minutes on ${d}`}
                    onChange={(e) => {
                      const next = [...state.profile.weeklyMinutes];
                      next[i] = Number(e.target.value);
                      update((s) => ({ ...s, profile: { ...s.profile, weeklyMinutes: next } }));
                    }}
                  />
                  <span className="num small" style={{ textAlign: "right" }}>
                    {(state.profile.weeklyMinutes[i] ?? 0) === 0 ? "rest" : `${state.profile.weeklyMinutes[i]}m`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Stat
              label="Per week"
              value={`${(state.profile.weeklyMinutes.reduce((s, m) => s + m, 0) / 60).toFixed(1)}h`}
              note={`${state.profile.weeklyMinutes.filter((m) => m === 0).length} rest days`}
            />
          )}
        </Card>

        <Card title="Review load, next 14 days">
          <BarChart
            data={load.map((l) => ({
              label: l.date.slice(5),
              value: l.due,
              colour: l.due > 40 ? "var(--lost)" : l.due > 25 ? "var(--fading)" : "var(--accent)",
            }))}
            format={(n) => String(n)}
          />
          {peak > 40 && (
            <Callout kind="warn" title="A pile-up is coming">
              {peak} items fall due on one day. Clearing some early spreads the load — the scheduler
              will absorb it, but a 40-card day is where people stop.
            </Callout>
          )}
        </Card>
      </div>

      <Card title="Day by day">
        <div className="stack tight">
          {plan.days.slice(0, 21).map((d) => {
            const isToday = d.date === now.slice(0, 10);
            return (
              <div
                key={d.date}
                style={{
                  display: "grid",
                  gridTemplateColumns: "88px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "9px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isToday ? "var(--accent-soft)" : undefined,
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <span className="small">
                  <span className="num tiny muted">{WEEKDAYS[new Date(d.date).getUTCDay()]}</span>{" "}
                  {d.date.slice(5)}
                  {isToday && <strong> · today</strong>}
                </span>
                <span className="small">
                  {d.isRestDay ? (
                    <span className="muted">Rest — deliberately, not by omission.</span>
                  ) : (
                    d.sessions.map((s, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        <span className="num tiny muted">{s.minutes}m</span> {s.focus}
                        {s.kind === "mock" && " (full paper)"}
                      </span>
                    ))
                  )}
                  {d.note && <><br /><span className="tiny" style={{ color: "var(--fading)" }}>{d.note}</span></>}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {d.isMockDay && <Chip tone="accent">mock</Chip>}
                  {isToday && !d.isRestDay && (
                    <Link href={`/session?minutes=${d.sessions[0]?.minutes ?? 25}`} className="btn small primary">Start</Link>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Why because={plan.because} label="How this plan was built" />
    </div>
  );
}
