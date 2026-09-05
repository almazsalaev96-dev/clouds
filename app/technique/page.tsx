"use client";

/**
 * Exam technique.
 *
 * The half of the qualification that is trainable in days rather than months.
 * Command words, answer structure by mark tally, and the evaluation moves —
 * each with what the examiner expects, the trap, and a weak answer beside a
 * strong one, because the contrast teaches more than either alone.
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { aoSplitForQuestion } from "@/domain/curriculum";
import { TECHNIQUE_LOSSES, MARK_LOSS_LABELS } from "@/domain/question";
import { buildLossProfile, PRESCRIPTIONS } from "@/domain/mistakes";
import { Card, Callout, Chip, Empty, Tabs, Why } from "@/ui/components";

type Tab = "command-words" | "structure" | "evaluation" | "diagnosis";

function TechniqueInner() {
  const params = useSearchParams();
  const { state, ready } = useStore();
  const bundle = useContent();
  const now = new Date().toISOString();
  const [tab, setTab] = useState<Tab>(params.get("word") ? "command-words" : "diagnosis");
  const [selected, setSelected] = useState<string | null>(params.get("word"));

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

  const commandWords = view.syllabus.commandWords;
  const active = commandWords.find((c) => c.word.toLowerCase() === (selected ?? "").toLowerCase()) ?? commandWords[0];
  const profile = buildLossProfile(state.mistakes);
  const techniqueLosses = profile.byCategory.filter((c) => TECHNIQUE_LOSSES.has(c.category));

  // Mark-tally guidance derived from the syllabus's own AO weightings rather
  // than invented: for a paper, an N-mark question splits roughly this way.
  const essayPaper = view.syllabus.papers.reduce((best, p) =>
    (p.sections.some((s) => /essay/i.test(s.name)) ? p : best), view.syllabus.papers[view.syllabus.papers.length - 1]!);

  const tallies = [1, 2, 3, 5, 8, 12, 20].filter((m) => m <= (essayPaper?.rawMarks ?? 20));

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">Exam technique</p>
        <h1>The marks that are not about knowing more</h1>
        <p className="lede">
          Technique losses transfer across every topic, which makes them the cheapest marks in the
          qualification to recover — and the ones most students never work on directly.
        </p>
      </header>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "diagnosis", label: "Your technique" },
          { id: "command-words", label: "Command words", count: commandWords.length },
          { id: "structure", label: "Answer structure" },
          { id: "evaluation", label: "Evaluation moves" },
        ]}
      />

      {tab === "diagnosis" && (
        <div className="stack">
          {techniqueLosses.length === 0 ? (
            <Empty title="No technique data yet" action={<Link href="/practice" className="btn primary">Practise</Link>}>
              Self-mark a few written answers and classify why each mark was lost. That classification
              is what turns a score into a diagnosis.
            </Empty>
          ) : (
            <>
              <Callout kind={profile.techniqueShare > 0.55 ? "danger" : "warn"} title={`${Math.round(profile.techniqueShare * 100)}% of your lost marks are technique`}>
                {profile.prescription}
              </Callout>
              <Card title="Your technique failures, ranked">
                <div className="stack tight">
                  {techniqueLosses.map((c) => (
                    <div key={c.category} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                      <div className="row between" style={{ marginBottom: 4 }}>
                        <strong style={{ fontSize: "0.93rem" }}>{c.label}</strong>
                        <span className="num tiny muted">{c.marks.toFixed(1)} marks · {Math.round(c.share * 100)}%</span>
                      </div>
                      <p className="small muted" style={{ margin: 0 }}>{PRESCRIPTIONS[c.category]}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "command-words" && (
        <div className="grid two">
          <Card title="Command words">
            <div className="stack tight">
              {commandWords.map((c) => (
                <button
                  key={c.word}
                  className="choice"
                  data-selected={active?.word === c.word}
                  onClick={() => setSelected(c.word)}
                >
                  <span>
                    <strong>{c.word}</strong>
                    <br />
                    <span className="tiny muted">Highest AO: {c.aoCeiling.join(", ") || "unspecified"}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {active && (
            <Card>
              <div className="stack">
                <div>
                  <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                    <h2>{active.word}</h2>
                    {active.aoCeiling.map((ao) => (
                      <Chip key={ao} tone={ao.toLowerCase() as "ao1"}>{ao}</Chip>
                    ))}
                  </div>
                  <p className="small">{active.officialDefinition ?? active.definition}</p>
                </div>

                <Callout kind="info" title="What the examiner expects">{active.expects}</Callout>

                {active.answerStructure.length > 0 && (
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 5 }}>Answer shape</p>
                    <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
                      {active.answerStructure.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
                    </ol>
                  </div>
                )}

                {active.weakExample && (
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 4, color: "var(--lost)" }}>Weak</p>
                    <p className="small" style={{ fontStyle: "italic", padding: "8px 12px", background: "var(--lost-wash)", borderRadius: "var(--radius-sm)" }}>
                      {active.weakExample}
                    </p>
                  </div>
                )}
                {active.strongExample && (
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 4, color: "var(--secure)" }}>Strong</p>
                    <p className="small" style={{ padding: "8px 12px", background: "var(--secure-wash)", borderRadius: "var(--radius-sm)", lineHeight: 1.65 }}>
                      {active.strongExample}
                    </p>
                  </div>
                )}
                {active.trap && <Callout kind="danger" title="The trap">{active.trap}</Callout>}

                <Link href={`/practice?command=${encodeURIComponent(active.word)}`} className="btn">
                  Practise {active.word} questions
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "structure" && (
        <Card title="How much to write, by mark tally">
          <p className="small muted" style={{ marginBottom: 14 }}>
            Derived from this syllabus&rsquo;s own published assessment-objective weightings for{" "}
            Paper {essayPaper?.code}, not from a rule of thumb. Count the marks before you write, and
            plan that many developed points.
          </p>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th className="num">Marks</th>
                  {view.syllabus.assessmentObjectives.map((ao) => <th key={ao.id} className="num">{ao.code}</th>)}
                  <th>What that means in practice</th>
                </tr>
              </thead>
              <tbody>
                {tallies.map((m) => {
                  const split = essayPaper ? aoSplitForQuestion(view.syllabus, essayPaper.id, m) : [];
                  const higher = split.filter((s) => /3|4/.test(s.aoCode)).reduce((s, x) => s + x.marks, 0);
                  return (
                    <tr key={m}>
                      <td className="num"><strong>{m}</strong></td>
                      {view.syllabus.assessmentObjectives.map((ao) => (
                        <td key={ao.id} className="num">{split.find((s) => s.aoCode === ao.code)?.marks ?? 0}</td>
                      ))}
                      <td className="small">
                        {m <= 2
                          ? "One precise sentence. Explanation here earns nothing."
                          : m <= 5
                            ? "Definition, then how it applies here, then the consequence. Two developed points."
                            : m <= 12
                              ? `${higher} of these marks are analysis and evaluation. One point per paragraph, each developed to a consequence.`
                              : `${higher} of ${m} marks are analysis and judgement. Knowledge alone caps you at ${m - higher}.`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Why
            because={[
              "Assessment objective weightings are published per paper as percentages; these rows apply those percentages to a question of each size.",
              "The point of the table is the last column: on a 20-mark essay, knowledge and application together are a small minority of the marks.",
            ]}
          />
        </Card>
      )}

      {tab === "evaluation" && (
        <div className="stack">
          <Card title="The eight evaluation moves">
            <p className="small muted" style={{ marginBottom: 12 }}>
              Deploy two or three per answer, always tied to specifics from the source material. Two
              well-used moves beat eight mentioned ones.
            </p>
            <div className="stack tight">
              {EVALUATION_MOVES.map((m, i) => (
                <div key={m.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                  <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                    <span className="num tiny muted">{i + 1}</span>
                    <strong style={{ fontSize: "0.93rem" }}>{m.name}</strong>
                  </div>
                  <p className="small" style={{ margin: 0 }}>{m.what}</p>
                  <p className="small" style={{ margin: "4px 0 0", fontStyle: "italic", color: "var(--muted)" }}>{m.example}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="The conclusion template">
            <p className="small muted" style={{ marginBottom: 10 }}>
              A full-mark conclusion is not a summary. It commits, justifies, weighs and conditions.
            </p>
            <blockquote className="prose" style={{ fontSize: "1rem" }}>
              On balance, [firm] should [decision], because [the decisive factor] — which in this case
              outweighs [the strongest counter-argument] since [case-specific reason]. This holds
              provided [condition from the case]; if [condition fails], [alternative] becomes
              preferable.
            </blockquote>
            <Callout kind="warn" title="What loses these marks">
              &ldquo;In conclusion, it depends on the situation.&rdquo; It names no decisive factor, weighs
              nothing, and commits to nothing — so there is nothing for a marker to credit.
            </Callout>
          </Card>
        </div>
      )}
    </div>
  );
}

const EVALUATION_MOVES = [
  { name: "Depends-on", what: "Name the single variable the whole answer hinges on, and say what the evidence suggests about it.", example: "This holds only if demand is price-inelastic; the 15% sales drop after a 5% price rise suggests it is not." },
  { name: "Short run versus long run", what: "A decision that hurts now and pays later, or the reverse — and which horizon should dominate here.", example: "The retraining cost falls in this financial year; the productivity gain does not arrive until the next." },
  { name: "Relative significance", what: "Of the factors discussed, which matters most and why. Ranking is evaluation; listing is not.", example: "Of the three constraints, financing is decisive, because the other two can be solved with money and this one cannot." },
  { name: "Stakeholder conflict", what: "Who gains, who loses, and whose claim is stronger in this specific case.", example: "Shareholders gain from the closure; the 200 employees and the town lose, and with a stated CSR commitment that claim is not easily dismissed." },
  { name: "Quality of the evidence", what: "Sample size, age of data, opinion presented as fact, assumptions inside a forecast.", example: "The 78% figure comes from a survey of 40 existing customers, who are the least likely group to report dissatisfaction." },
  { name: "Opportunity cost", what: "What else could that money, time or capacity have done?", example: "The $2m spent on the new plant is $2m not spent on the distribution problem the case identifies as the binding constraint." },
  { name: "Risk and reversibility", what: "How bad is failure, and can the decision be undone?", example: "A leased site can be exited in 12 months; a purchased one cannot, which matters more than the cost difference." },
  { name: "Assumption challenge", what: "The theory assumes X; in this business X does not hold.", example: "Herzberg assumes workers seek responsibility, but this workforce is largely seasonal and has no interest in advancement." },
];

export default function TechniquePage() {
  return (
    <Suspense fallback={<p className="muted small">Loading…</p>}>
      <TechniqueInner />
    </Suspense>
  );
}
