"use client";

/**
 * Subject overview.
 *
 * The syllabus as a map of where you stand, not as a table of contents. Each
 * topic shows mastery against the target implied by the target grade, its
 * retention state, and the recommended action — so the page answers "what do I
 * do about this subject", not merely "what is in it".
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { absoluteExamWeight, childTopics, minutesPerMark, rootTopics, aoMarkSplit } from "@/domain/curriculum";
import { ACTION_COPY, chooseAction, masteryForGrade } from "@/domain/priority";
import { retentionState, MASTERY_BANDS } from "@/domain/mastery";
import { Card, Chip, Empty, Meter, Stat, Tabs, Why, Pct, relativeDays } from "./components";
import { Ring } from "./charts";

export function SubjectPage({ syllabusId }: { syllabusId?: string }) {
  const { state } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [tab, setTab] = useState<"map" | "papers" | "objectives">("map");

  const views = useMemo(
    () =>
      state.profile.subjects
        .filter((s) => !s.archived)
        .map((e) => buildSubjectView(state, bundle, e, now))
        .filter((v): v is SubjectView => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, bundle],
  );

  const view = syllabusId ? views.find((v) => v.syllabus.id === syllabusId) : views[0];
  if (!view) return <Empty title="Subject not found">Add it from the command centre, or pick another.</Empty>;

  const targetMastery = masteryForGrade(view.enrolment.targetGrade, ["A*", "A", "B", "C", "D", "E", "U"]);
  const sections = rootTopics(view.syllabus).filter(
    (t) => !(view.enrolment.stage === "as" && t.stage === "a2"),
  );

  return (
    <div className="stack loose">
      <header className="stack tight">
        <div className="row between">
          <p className="eyebrow">
            {view.syllabus.code} · {view.syllabus.version.label} ·{" "}
            {view.enrolment.stage === "as" ? "AS Level" : "Full A Level"}
          </p>
          {views.length > 1 && (
            <div className="pill-tabs">
              {views.map((v) => (
                <Link key={v.syllabus.id} href={`/subjects/${v.syllabus.id}`} className="pill-tab" aria-selected={v.syllabus.id === view.syllabus.id}>
                  {v.syllabus.subject}
                </Link>
              ))}
            </div>
          )}
        </div>
        <h1>{view.syllabus.subject}</h1>
        <p className="lede">{view.syllabus.title}</p>
      </header>

      <div className="grid four">
        <Card>
          <div className="row" style={{ gap: 14 }}>
            <Ring value={view.readiness.score} size={78} sublabel="ready" />
            <Stat label="Projected" value={view.forecast.central} note={`Target ${view.enrolment.targetGrade}`} small />
          </div>
        </Card>
        <Card><Stat label="Syllabus tested" value={<Pct value={view.coverage} />} note={`${view.attemptCount} attempts`} /></Card>
        <Card><Stat label="Exam" value={view.daysToExam !== undefined ? relativeDays(view.daysToExam) : "Not set"} note={view.enrolment.examSession} /></Card>
        <Card><Stat label="Questions available" value={view.questions.length} note={`${view.questions.reduce((s, q) => s + q.marks, 0)} marks`} /></Card>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "map", label: "Topic map" },
          { id: "papers", label: "Papers" },
          { id: "objectives", label: "Assessment objectives" },
        ]}
      />

      {tab === "map" && (
        <div className="stack">
          {sections.map((section) => {
            const children = childTopics(view.syllabus, section.id);
            const sectionMastery = view.topicMastery.get(section.id);
            return (
              <Card key={section.id}>
                <div className="row between" style={{ marginBottom: 12 }}>
                  <div>
                    <span className="eyebrow">Section {section.code}</span>
                    <h3 style={{ marginTop: 2 }}>{section.title}</h3>
                  </div>
                  <div style={{ minWidth: 130 }}>
                    <div className="row between">
                      <span className="tiny muted">Mastery</span>
                      <span className="num tiny">{Math.round((sectionMastery?.score ?? 0) * 100)}%</span>
                    </div>
                    <Meter value={sectionMastery?.score ?? 0} target={targetMastery} label={`${section.title} mastery`} />
                  </div>
                </div>

                <div className="stack tight">
                  {(children.length ? children : [section]).map((topic) => {
                    const m = view.topicMastery.get(topic.id);
                    const r = view.topicRetention.get(topic.id) ?? 0;
                    const priority = view.priorities.find((p) => p.topicId === topic.id);
                    const questionCount = view.questions.filter((q) => q.topicIds.includes(topic.id)).length;
                    const band = MASTERY_BANDS.find((b) => b.band === m?.band);
                    return (
                      <div
                        key={topic.id}
                        style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.6fr) 1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--rule)" }}
                      >
                        <div>
                          <Link href={`/topics/${encodeURIComponent(topic.id)}`} style={{ color: "var(--ink)", textDecoration: "none", fontSize: "0.92rem" }}>
                            <span className="num tiny muted">{topic.code}</span> {topic.title}
                          </Link>
                          <div className="row" style={{ gap: 5, marginTop: 3 }}>
                            {m && m.observations > 0 ? (
                              <>
                                <Chip tone={retentionState(r)} title={band?.meaning}>{band?.label}</Chip>
                                {m.limitingFactor && <span className="tiny muted">weakest: {m.limitingFactor}</span>}
                              </>
                            ) : (
                              <span className="tiny muted">
                                {questionCount === 0 ? "no questions in pack yet" : "untested"}
                              </span>
                            )}
                          </div>
                        </div>
                        <Meter value={m?.score ?? 0} target={targetMastery} tone={retentionState(r)} label={`${topic.title} mastery`} />
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end", minWidth: 140 }}>
                          {priority && <Chip tone="accent">{ACTION_COPY[priority.action].verb}</Chip>}
                          <Link href={`/topics/${encodeURIComponent(topic.id)}`} className="btn small ghost">Open</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "papers" && (
        <div className="stack">
          {view.syllabus.papers.map((paper) => {
            const split = aoMarkSplit(view.syllabus, paper.id);
            return (
              <Card key={paper.id} title={`Paper ${paper.code}`}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <div>
                    <h3>{paper.name}</h3>
                    <p className="small muted" style={{ margin: 0 }}>
                      {paper.durationMinutes} minutes · {paper.rawMarks} marks ·{" "}
                      {Math.round(paper.weightOfQualification * 100)}% of the qualification ·{" "}
                      {minutesPerMark(paper).toFixed(2)} min per mark
                    </p>
                  </div>
                  <Link href={`/mock?paper=${encodeURIComponent(paper.id)}`} className="btn small">Sit this paper</Link>
                </div>

                {paper.sections.length > 0 && (
                  <ul className="small" style={{ paddingLeft: 18, marginBottom: 12 }}>
                    {paper.sections.map((s) => (
                      <li key={s.code}>
                        <strong>Section {s.code}</strong> — {s.name}, {s.marks} marks
                        {s.choice ? ` (${s.choice})` : ""}
                        {s.description ? `. ${s.description}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="scroll-x">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Assessment objective</th>
                        <th className="num">Share</th>
                        <th className="num">Raw marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {split.map((row) => (
                        <tr key={row.aoCode}>
                          <td>
                            <Chip tone={row.aoCode.toLowerCase() as "ao1"}>{row.aoCode}</Chip>{" "}
                            {view.syllabus.assessmentObjectives.find((a) => a.code === row.aoCode)?.name}
                          </td>
                          <td className="num">{Math.round(row.fraction * 100)}%</td>
                          <td className="num"><strong>{row.marks}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {paper.notes && <p className="small muted" style={{ marginTop: 10 }}>{paper.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "objectives" && (
        <div className="stack">
          <Card title="Where the marks actually are">
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>AO</th>
                    {view.syllabus.papers.map((p) => <th key={p.id} className="num">P{p.code}</th>)}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {view.syllabus.assessmentObjectives.map((ao) => {
                    const cells = view.syllabus.papers.map((p) => Math.round((ao.weightByPaper[p.id] ?? 0) * p.rawMarks));
                    return (
                      <tr key={ao.id}>
                        <td>
                          <Chip tone={ao.code.toLowerCase() as "ao1"}>{ao.code}</Chip> {ao.name}
                        </td>
                        {cells.map((c, i) => <td key={i} className="num">{c}</td>)}
                        <td className="num"><strong>{cells.reduce((s, c) => s + c, 0)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Why
              because={[
                "Boards publish assessment objectives as percentages per paper. These are those percentages converted into raw marks.",
                "The conversion matters: a student reads '40% of Paper 4 is analysis' as trivia, and '8 of the 20 marks in this essay' as an instruction about how to write.",
              ]}
              label="Where these numbers come from"
            />
          </Card>

          <div className="grid two">
            {view.syllabus.assessmentObjectives.map((ao) => (
              <Card key={ao.id} title={`${ao.code} · ${ao.name}`}>
                <p className="small">{ao.description}</p>
              </Card>
            ))}
          </div>

          {view.syllabus.officialResources?.length ? (
            <Card title="Official sources">
              <p className="small muted" style={{ marginBottom: 8 }}>
                Lodestar links to awarding-body material; it does not republish it.
              </p>
              <ul className="small" style={{ paddingLeft: 18 }}>
                {view.syllabus.officialResources.map((r) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer noopener">{r.label}</a></li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
