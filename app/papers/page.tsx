"use client";

/**
 * Past papers.
 *
 * Lodestar does not host past papers. Awarding bodies own them, and the fact
 * that a PDF can be found somewhere does not make it redistributable — so this
 * page links to the official source rather than mirroring it, which is the rule
 * the content loader enforces for `link-only` material.
 *
 * What it does host is everything Lodestar can legitimately give you about a
 * paper: its real structure, its timing arithmetic, where its marks fall by
 * assessment objective, and a mock assembled from original questions written to
 * match it. That is the part that is actually actionable, and it is the part a
 * folder of PDFs never gives you.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { aoMarkSplit, minutesPerMark } from "@/domain/curriculum";
import { Breadcrumbs } from "@/ui/navigator";
import { Callout, Card, Chip, Empty, Marks, Stat } from "@/ui/components";

export default function PapersPage() {
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

  const official = (view.syllabus.officialResources ?? []).filter((r) =>
    /past|paper|threshold|mark scheme|examiner/i.test(`${r.kind} ${r.label}`),
  );
  const mocks = state.mocks.filter((m) => m.syllabusId === view.syllabus.id && m.completed);

  return (
    <div className="stack loose">
      <header className="stack tight">
        <Breadcrumbs trail={[{ label: "Study materials" }, { label: "Past papers" }]} />
        <div className="row between">
          <h1>Papers</h1>
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
        <p className="lede">
          What each paper is, where its marks fall, and how to sit one. Past papers themselves live
          with the awarding body — Lodestar links to them rather than republishing them.
        </p>
      </header>

      <div className="stack">
        {view.syllabus.papers.map((paper) => {
          const split = aoMarkSplit(view.syllabus, paper.id);
          const higher = split.filter((r) => /3|4/.test(r.aoCode)).reduce((s, r) => s + r.marks, 0);
          const bankMarks = view.questions
            .filter((q) => !q.paperId || q.paperId === paper.id)
            .reduce((s, q) => s + q.marks, 0);
          const attempted = mocks.filter((m) => m.paperId === paper.id);

          return (
            <Card key={paper.id}>
              <div className="row between" style={{ alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <span className="eyebrow">Paper {paper.code} · {paper.stage === "as" ? "AS" : paper.stage === "a2" ? "A Level" : "Both stages"}</span>
                  <h2 style={{ marginTop: 3 }}>{paper.name}</h2>
                  <p className="small muted" style={{ margin: "4px 0 0" }}>
                    {paper.durationMinutes} minutes · {paper.rawMarks} marks ·{" "}
                    {Math.round(paper.weightOfQualification * 100)}% of the qualification ·{" "}
                    <strong>{minutesPerMark(paper).toFixed(2)} min per mark</strong>
                  </p>
                </div>
                <Link href={`/mock?paper=${encodeURIComponent(paper.id)}`} className="btn primary small">
                  Sit a mock
                </Link>
              </div>

              <div className="grid two">
                <div className="stack tight">
                  <span className="eyebrow">Structure</span>
                  {paper.sections.length ? (
                    <table className="table">
                      <thead>
                        <tr><th>Section</th><th className="num">Marks</th><th>Format</th></tr>
                      </thead>
                      <tbody>
                        {paper.sections.map((s) => (
                          <tr key={s.code}>
                            <td className="small"><strong>{s.code}</strong> {s.name}</td>
                            <td className="num">{s.marks}</td>
                            <td className="small muted">
                              {s.questionCount ? `${s.questionCount} question${s.questionCount === 1 ? "" : "s"}` : ""}
                              {s.choice ? ` · ${s.choice}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="small muted">No section breakdown in the pack for this paper.</p>
                  )}
                  {paper.materials?.length ? (
                    <p className="tiny muted">Materials: {paper.materials.join(" · ")}</p>
                  ) : null}
                </div>

                <div className="stack tight">
                  <span className="eyebrow">Where the marks are</span>
                  <table className="table">
                    <thead>
                      <tr><th>AO</th><th className="num">Share</th><th className="num">Marks</th></tr>
                    </thead>
                    <tbody>
                      {split.map((row) => (
                        <tr key={row.aoCode}>
                          <td><Chip tone={row.aoCode.toLowerCase() as "ao1"}>{row.aoCode}</Chip></td>
                          <td className="num">{Math.round(row.fraction * 100)}%</td>
                          <td className="num"><strong>{row.marks}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {higher >= paper.rawMarks / 2 && (
                    <p className="tiny" style={{ color: "var(--ao3)" }}>
                      {higher} of {paper.rawMarks} marks are analysis and evaluation. Knowledge alone
                      caps this paper at {paper.rawMarks - higher}.
                    </p>
                  )}
                </div>
              </div>

              {paper.notes && (
                <p className="small muted" style={{ marginTop: 12 }}>{paper.notes}</p>
              )}

              <div className="row between" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
                <span className="small muted">
                  {bankMarks} marks of original questions available for this paper
                </span>
                {attempted.length > 0 && (
                  <span className="small">
                    Best mock:{" "}
                    <Marks
                      earned={Math.max(...attempted.map((m) => m.score))}
                      available={Math.max(...attempted.map((m) => m.maxScore))}
                    />
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid two">
        <Card title="Official past papers">
          <Callout kind="info" title="Why they are not hosted here">
            Past papers, mark schemes and examiner reports belong to the awarding body. Lodestar links
            to the official source rather than mirroring it — the same rule the content loader
            enforces on every pack.
          </Callout>
          {official.length > 0 ? (
            <ul className="small" style={{ paddingLeft: 18, marginTop: 12 }}>
              {official.map((r) => (
                <li key={r.url} style={{ marginBottom: 5 }}>
                  <a href={r.url} target="_blank" rel="noreferrer noopener">{r.label}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ marginTop: 12 }}>
              This pack lists no official links yet. Add them under <code>officialResources</code> in
              the syllabus file.
            </p>
          )}
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Working through a real paper and self-marking it against the official scheme the next day
            is the single highest-value activity available. Record the result under Mock exams and it
            joins your readiness evidence.
          </p>
        </Card>

        <Card title="Your mock record">
          {mocks.length === 0 ? (
            <Empty title="No mocks sat yet" action={<Link href="/mock" className="btn primary small">Sit one</Link>}>
              A full paper under real conditions is the strongest single predictor of exam performance,
              and the one thing question-level practice cannot substitute for.
            </Empty>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Paper</th><th className="num">Score</th><th className="num">Time</th></tr>
                </thead>
                <tbody>
                  {mocks.slice().reverse().map((m) => {
                    const paper = view.syllabus.papers.find((p) => p.id === m.paperId);
                    return (
                      <tr key={m.id}>
                        <td className="small">{(m.submittedAt ?? m.startedAt).slice(0, 10)}</td>
                        <td className="small">Paper {paper?.code ?? m.paperId}</td>
                        <td className="num"><Marks earned={m.score} available={m.maxScore} /></td>
                        <td className="num">
                          <Chip tone={m.minutesUsed > m.minutesAllowed ? "forgotten" : "secure"}>
                            {m.minutesUsed}/{m.minutesAllowed}m
                          </Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid three">
        <Card><Stat label="Papers" value={view.syllabus.papers.length} note={`${view.syllabus.papers.reduce((s, p) => s + p.rawMarks, 0)} raw marks total`} /></Card>
        <Card><Stat label="Mocks sat" value={mocks.length} note={mocks.length ? "Counts toward readiness" : "Readiness is provisional without one"} /></Card>
        <Card><Stat label="Exam" value={view.daysToExam !== undefined ? `${view.daysToExam}d` : "—"} note={view.enrolment.examDate ?? "No date set"} /></Card>
      </div>
    </div>
  );
}
