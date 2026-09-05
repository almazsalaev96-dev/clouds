"use client";

/**
 * Topic page.
 *
 * A complete learning loop rather than a page of notes. The tabs are the loop:
 * understand it, retrieve it, apply it under exam framing, and repair what you
 * got wrong — with the page opening on whichever step the evidence says you
 * actually need, rather than always on the explanation.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, estimateMinutes, type SubjectView } from "@/view/derive";
import { absoluteExamWeight, childTopics } from "@/domain/curriculum";
import { ACTION_COPY } from "@/domain/priority";
import { MASTERY_BANDS, retentionState, explainMastery } from "@/domain/mastery";
import { MARK_LOSS_LABELS } from "@/domain/question";
import { DEPTH_LABELS, type ExplanationDepth } from "@/ai/prompts";
import { Card, Callout, Chip, Empty, Meter, Stat, Tabs, Why, Pct, round1 } from "./components";
import { Practice } from "./practice";
import { Review } from "./review";

type Tab = "understand" | "practise" | "recall" | "exam" | "mistakes";

const DEPTHS: ExplanationDepth[] = ["thirty-second", "simple", "standard", "exam", "deep"];

export function TopicPage({ topicId }: { topicId: string }) {
  const { state } = useStore();
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

  const found = views
    .map((v) => ({ view: v, topic: v.syllabus.topics.find((t) => t.id === topicId) }))
    .find((x) => x.topic);

  const mastery = found ? found.view.topicMastery.get(topicId) : undefined;
  const priority = found?.view.priorities.find((p) => p.topicId === topicId);

  // Open on the step the evidence says is needed, not always on the explanation.
  const [tab, setTab] = useState<Tab>(() => {
    if (!mastery || mastery.observations === 0) return "understand";
    if (mastery.signals.retention < 0.55) return "recall";
    if (mastery.score < 0.35) return "understand";
    return "practise";
  });

  if (!found?.topic) {
    return <Empty title="Topic not found" action={<Link href="/subjects" className="btn">Browse subjects</Link>} />;
  }

  const { view, topic } = found;
  const lesson = bundle.lessons.find((l) => l.topicId === topicId);
  const questions = view.questions.filter((q) => q.topicIds.includes(topicId));
  const children = childTopics(view.syllabus, topicId);
  const cards = [...bundle.cards, ...state.cards].filter((c) => (c.topicIds ?? []).includes(topicId));
  const mistakes = state.mistakes.filter((m) => m.topicIds.includes(topicId));
  const weight = absoluteExamWeight(view.syllabus, topic);
  const qualificationMarks = view.syllabus.papers.reduce((s, p) => s + p.rawMarks, 0);
  const band = MASTERY_BANDS.find((b) => b.band === mastery?.band);

  const prereqs = (topic.prerequisites ?? [])
    .map((pid) => ({ topic: view.syllabus.topics.find((t) => t.id === pid), mastery: view.topicMastery.get(pid) }))
    .filter((p) => p.topic);
  const weakPrereqs = prereqs.filter((p) => (p.mastery?.observations ?? 0) > 0 && (p.mastery?.score ?? 0) < 0.45);

  return (
    <div className="stack loose">
      <header className="stack tight">
        <p className="eyebrow">
          <Link href={`/subjects/${view.syllabus.id}`}>{view.syllabus.subject}</Link> · {topic.code}
          {topic.stage === "a2" ? " · A Level extension" : ""}
        </p>
        <h1>{topic.title}</h1>
        {topic.summary && <p className="lede">{topic.summary}</p>}
      </header>

      <div className="grid four">
        <Card>
          <Stat label="Mastery" value={<Pct value={mastery?.score ?? 0} />} note={band?.label} tone={retentionState(view.topicRetention.get(topicId) ?? 0)} />
          <Meter value={mastery?.score ?? 0} target={0.88} label="Mastery" />
        </Card>
        <Card><Stat label="Recall now" value={<Pct value={view.topicRetention.get(topicId) ?? 0} />} note={mastery?.observations ? `${mastery.observations} attempts` : "No evidence"} /></Card>
        <Card><Stat label="Worth" value={`${(weight * qualificationMarks).toFixed(0)} marks`} note={`${Math.round(weight * 100)}% of the qualification`} /></Card>
        <Card>
          <Stat
            label="Recommended"
            value={priority ? ACTION_COPY[priority.action].verb : "Learn"}
            note={`~${estimateMinutes(view.syllabus, topic, mastery ?? ({ score: 0 } as never))} min`}
          />
        </Card>
      </div>

      {band && mastery && mastery.observations > 0 && (
        <Callout kind={mastery.score >= 0.72 ? "good" : mastery.score >= 0.4 ? "info" : "warn"} title={band.label}>
          {band.meaning}
          <Why because={explainMastery(mastery).because} label="How this was measured" />
        </Callout>
      )}

      {weakPrereqs.length > 0 && (
        <Callout kind="danger" title="A prerequisite is weak">
          Struggling here is often caused one level down.{" "}
          {weakPrereqs.map((p) => (
            <Link key={p.topic!.id} href={`/topics/${encodeURIComponent(p.topic!.id)}`} style={{ marginRight: 8 }}>
              {p.topic!.title} ({Math.round((p.mastery?.score ?? 0) * 100)}%)
            </Link>
          ))}
          — fix that before spending more time here.
        </Callout>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "understand", label: "Understand" },
          { id: "practise", label: "Practise", count: questions.length },
          { id: "recall", label: "Recall", count: cards.length },
          { id: "exam", label: "Exam" },
          { id: "mistakes", label: "Mistakes", count: mistakes.length },
        ]}
      />

      {tab === "understand" && <Understand lesson={lesson} topicTitle={topic.title} children={children} view={view} />}

      {tab === "practise" &&
        (questions.length === 0 ? (
          <Empty title="No questions for this topic yet" action={<Link href="/library" className="btn">See content status</Link>}>
            The engine is ready; this topic just has no material loaded. Adding questions here is the
            single highest-value thing you can do for this topic.
          </Empty>
        ) : (
          <Practice initialTopicId={topicId} />
        ))}

      {tab === "recall" &&
        (cards.length === 0 ? (
          <Empty title="No recall cards for this topic yet">
            Cards are created automatically from marks you lose, or can be added to the pack.
          </Empty>
        ) : (
          <Review topicId={topicId} />
        ))}

      {tab === "exam" && <ExamTab view={view} topicId={topicId} questions={questions} />}

      {tab === "mistakes" &&
        (mistakes.length === 0 ? (
          <Empty title="No mistakes recorded on this topic">Nothing to repair here yet.</Empty>
        ) : (
          <div className="stack tight">
            {mistakes.map((m) => (
              <Card key={m.id}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <Chip tone="lost">{MARK_LOSS_LABELS[m.category]}</Chip>
                  <span className="tiny muted">{round1(m.marksLost)} marks · seen {m.occurrences}×</span>
                </div>
                {m.requiredPoint && <p className="small" style={{ margin: 0 }}>{m.requiredPoint}</p>}
              </Card>
            ))}
            <Link href="/mistakes" className="btn">Open the Mistake Lab</Link>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Understand({
  lesson,
  topicTitle,
  children,
  view,
}: {
  lesson: ReturnType<typeof useContent>["lessons"][number] | undefined;
  topicTitle: string;
  children: { id: string; title: string; code: string }[];
  view: SubjectView;
}) {
  const [depth, setDepth] = useState<ExplanationDepth>("standard");

  if (!lesson) {
    return (
      <div className="stack">
        {children.length > 0 && (
          <Card title="Subtopics">
            <div className="stack tight">
              {children.map((c) => (
                <Link key={c.id} href={`/topics/${encodeURIComponent(c.id)}`} className="row between" style={{ padding: "7px 0", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                  <span className="small"><span className="num tiny muted">{c.code}</span> {c.title}</span>
                  <span className="tiny muted">
                    <Pct value={view.topicMastery.get(c.id)?.score ?? 0} />
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        <Empty title="No written explanation loaded for this topic yet" action={<Link href="/tutor" className="btn">Ask the tutor</Link>}>
          Explanations come from the content pack. Adding a lesson file for {topicTitle} makes this tab
          the first thing a student sees when the evidence says they have not learned it.
        </Empty>
      </div>
    );
  }

  const available = DEPTHS.filter((d) => lesson.explanations?.[d]);
  const shown = lesson.explanations?.[depth] ?? lesson.explanations?.standard ?? "";

  return (
    <div className="stack">
      {available.length > 1 && (
        <div className="row between">
          <span className="eyebrow">Explanation depth</span>
          <div className="pill-tabs">
            {available.map((d) => (
              <button key={d} className="pill-tab" aria-selected={depth === d} onClick={() => setDepth(d)}>
                {DEPTH_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card>
        <div className="prose" style={{ whiteSpace: "pre-wrap", lineHeight: 1.72 }}>{shown}</div>
      </Card>

      {lesson.microLessons?.length ? (
        <Card title="Broken into the smallest units">
          <div className="stack tight">
            {lesson.microLessons.map((m) => (
              <div key={m.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule)" }}>
                <strong className="small">{m.title}</strong>
                <p className="small muted" style={{ margin: "3px 0 0" }}>{m.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid two">
        {lesson.formulas?.length ? (
          <Card title="Formulas">
            <div className="stack">
              {lesson.formulas.map((f) => (
                <div key={f.name}>
                  <strong className="small">{f.name}</strong>
                  <p className="num" style={{ margin: "3px 0", fontSize: "0.95rem" }}>{f.expression}</p>
                  {f.rearrangements?.length ? (
                    <ul className="tiny muted" style={{ paddingLeft: 16, margin: "3px 0" }}>
                      {f.rearrangements.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  ) : null}
                  {f.commonMistakes?.length ? (
                    <p className="tiny" style={{ color: "var(--lost)", margin: "3px 0 0" }}>
                      Watch: {f.commonMistakes.join("; ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {lesson.misconceptions?.length ? (
          <Card title="Where people go wrong">
            <div className="stack tight">
              {lesson.misconceptions.map((m, i) => (
                <div key={i}>
                  <p className="small" style={{ margin: 0, textDecoration: "line-through", color: "var(--muted)" }}>{m.belief}</p>
                  <p className="small" style={{ margin: "2px 0 0" }}>{m.correction}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {lesson.limitations?.length ? (
          <Card title="This fails when…">
            <p className="tiny muted" style={{ marginBottom: 8 }}>
              These are your evaluation bank. Every "it fails when" is an AO4 sentence waiting to be used.
            </p>
            <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
              {lesson.limitations.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
            </ul>
          </Card>
        ) : null}

        {lesson.keyTerms?.length ? (
          <Card title="Key terms">
            <div className="stack tight">
              {lesson.keyTerms.map((t) => (
                <div key={t.term}>
                  <strong className="small">{t.term}</strong>
                  <span className="small muted"> — {t.definition}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {lesson.sources?.length ? (
        <p className="tiny muted">
          Sources:{" "}
          {lesson.sources.map((s, i) => (
            <span key={i}>
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.label}</a> : s.label}
              {i < lesson.sources!.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function ExamTab({
  view,
  topicId,
  questions,
}: {
  view: SubjectView;
  topicId: string;
  questions: SubjectView["questions"];
}) {
  const commandWords = [...new Set(questions.map((q) => q.commandWord).filter(Boolean))] as string[];
  const byPaper = new Map<string, number>();
  for (const q of questions) if (q.paperId) byPaper.set(q.paperId, (byPaper.get(q.paperId) ?? 0) + q.marks);

  return (
    <div className="stack">
      <Card title="How this topic is examined">
        {byPaper.size > 0 ? (
          <div className="stack tight">
            {[...byPaper].map(([paperId, marks]) => {
              const paper = view.syllabus.papers.find((p) => p.id === paperId);
              return (
                <div key={paperId} className="row between">
                  <span className="small">{paper ? `Paper ${paper.code} — ${paper.name}` : paperId}</span>
                  <span className="num tiny muted">{marks} marks in the bank</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="small muted">No paper mapping recorded for this topic&rsquo;s questions yet.</p>
        )}
      </Card>

      {commandWords.length > 0 && (
        <Card title="Command words used here">
          <div className="row" style={{ gap: 6 }}>
            {commandWords.map((w) => (
              <Link key={w} href={`/technique?word=${encodeURIComponent(w)}`} className="btn small">{w}</Link>
            ))}
          </div>
        </Card>
      )}

      <Card title="Exam-style practice">
        <p className="small muted" style={{ marginBottom: 10 }}>
          Highest-mark questions on this topic, under real time. Stopping when the clock runs out is
          itself the skill being trained.
        </p>
        <div className="row">
          <Link href={`/practice?topic=${encodeURIComponent(topicId)}&mode=timed`} className="btn primary">
            Timed practice
          </Link>
          <Link href="/mock" className="btn">Full mock paper</Link>
        </div>
      </Card>
    </div>
  );
}
