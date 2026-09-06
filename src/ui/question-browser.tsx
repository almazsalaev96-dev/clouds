"use client";

/**
 * Topic questions.
 *
 * The browse-side counterpart to adaptive practice: the whole bank, filterable,
 * with every question's metadata visible so a student can choose deliberately
 * — "the 6-mark Analyse questions on ratio analysis I haven't tried" — instead
 * of only being served what the engine thinks is next.
 *
 * Both paths write the same attempts through the same recorder, so browsing
 * does not opt out of the evidence model. What you choose yourself counts
 * exactly as much as what you were given.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContent, useStore } from "@/store/provider";
import { buildSubjectView, type SubjectView } from "@/view/derive";
import { childTopics } from "@/domain/curriculum";
import { overallDifficulty, type Question } from "@/domain/question";
import { useRecordAttempt } from "@/view/actions";
import { QuestionView } from "./question-view";
import { Breadcrumbs, Difficulty } from "./navigator";
import { Card, Chip, Empty, Marks } from "./components";

type Status = "all" | "unseen" | "wrong" | "correct";

export function QuestionBrowser({ initialTopicId }: { initialTopicId?: string }) {
  const { state } = useStore();
  const bundle = useContent();
  const record = useRecordAttempt();
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
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [commandWord, setCommandWord] = useState("");
  const [type, setType] = useState("");
  const [band, setBand] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Question | null>(null);

  const view = views[Math.min(subjectIdx, views.length - 1)];
  if (!view) return <Empty title="No subjects yet">Add a subject first.</Empty>;

  // Attempt history, so each row can show what happened last time.
  const history = new Map<string, { count: number; best: number; lastFraction: number }>();
  for (const a of state.attempts) {
    const prev = history.get(a.questionId);
    const fraction = a.maxScore ? a.score / a.maxScore : 0;
    history.set(a.questionId, {
      count: (prev?.count ?? 0) + 1,
      best: Math.max(prev?.best ?? 0, fraction),
      lastFraction: fraction,
    });
  }

  const leaves = view.syllabus.topics.filter((t) => childTopics(view.syllabus, t.id).length === 0);
  const commandWords = [...new Set(view.questions.map((q) => q.commandWord).filter(Boolean))].sort() as string[];
  const types = [...new Set(view.questions.map((q) => q.type))].sort();

  const filtered = view.questions.filter((q) => {
    if (topicId && !q.topicIds.includes(topicId)) return false;
    if (commandWord && q.commandWord !== commandWord) return false;
    if (type && q.type !== type) return false;
    if (band === "short" && q.marks > 5) return false;
    if (band === "structured" && (q.marks < 6 || q.marks > 12)) return false;
    if (band === "essay" && q.marks < 13) return false;
    const seen = history.get(q.id);
    if (status === "unseen" && seen) return false;
    if (status === "wrong" && (!seen || seen.lastFraction >= 1)) return false;
    if (status === "correct" && (!seen || seen.lastFraction < 1)) return false;
    if (search && !`${q.prompt} ${q.commandWord ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (view.enrolment.stage === "as") {
      const topics = q.topicIds.map((t) => view.syllabus.topics.find((x) => x.id === t));
      if (topics.every((t) => t?.stage === "a2")) return false;
    }
    return true;
  });

  const topicTitle = (id: string) => view.syllabus.topics.find((t) => t.id === id)?.title ?? id;

  if (open) {
    return (
      <div className="stack">
        <div className="row between">
          <Breadcrumbs
            trail={[
              { label: "Topic questions", href: "/questions" },
              { label: topicTitle(open.topicIds[0] ?? ""), href: `/topics/${encodeURIComponent(open.topicIds[0] ?? "")}` },
              { label: `${open.marks}-mark question` },
            ]}
          />
          <button className="btn small ghost" onClick={() => setOpen(null)}>Back to the list</button>
        </div>
        <QuestionView
          question={open}
          mode="practice"
          askConfidence={state.settings.confidenceRating}
          showWorking={state.settings.showWorking}
          onComplete={(result) => {
            record(result.question, result.attempt);
            setOpen(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack loose">
      <header className="stack tight">
        <Breadcrumbs trail={[{ label: "Study materials" }, { label: "Topic questions" }]} />
        <div className="row between">
          <h1>Topic questions</h1>
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
        <p className="lede">
          The whole bank, filterable. Choosing your own questions records exactly the same evidence as
          being served them — or let{" "}
          <Link href="/practice">adaptive practice</Link> pick, which targets a 75% success rate.
        </p>
      </header>

      <div className="filters">
        <div className="filter" style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="qsearch">Search</label>
          <input id="qsearch" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Words in the question…" />
        </div>
        <div className="filter">
          <label htmlFor="qtopic">Topic</label>
          <select id="qtopic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">All topics</option>
            {leaves.map((t) => <option key={t.id} value={t.id}>{t.code} {t.title}</option>)}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="qcw">Command word</label>
          <select id="qcw" value={commandWord} onChange={(e) => setCommandWord(e.target.value)}>
            <option value="">Any</option>
            {commandWords.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="qband">Length</label>
          <select id="qband" value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">Any</option>
            <option value="short">Short · 1–5 marks</option>
            <option value="structured">Structured · 6–12</option>
            <option value="essay">Essay · 13+</option>
          </select>
        </div>
        <div className="filter">
          <label htmlFor="qtype">Type</label>
          <select id="qtype" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any</option>
            {types.map((t) => <option key={t} value={t}>{t.replace("-", " ")}</option>)}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="qstatus">Status</label>
          <select id="qstatus" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="all">All</option>
            <option value="unseen">Not yet attempted</option>
            <option value="wrong">Lost marks last time</option>
            <option value="correct">Full marks last time</option>
          </select>
        </div>
      </div>

      <Card
        title={`${filtered.length} question${filtered.length === 1 ? "" : "s"} · ${filtered.reduce((s, q) => s + q.marks, 0)} marks`}
        action={
          filtered.length > 0 ? (
            <button className="btn small primary" onClick={() => setOpen(filtered[0]!)}>
              Start with the first
            </button>
          ) : undefined
        }
        className="flush"
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 20 }}>
            <Empty title="Nothing matches these filters">
              Widen them, or check the Library for which topics have no questions loaded yet.
            </Empty>
          </div>
        ) : (
          <div>
            {filtered.map((q) => {
              const seen = history.get(q.id);
              return (
                <div className="q-row" key={q.id}>
                  <div>
                    <button
                      className="q-prompt"
                      onClick={() => setOpen(q)}
                      style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", width: "100%" }}
                    >
                      {q.prompt}
                    </button>
                    <div className="q-meta">
                      <span>{q.topicIds.map(topicTitle).join(" · ")}</span>
                      {q.commandWord && <Chip tone="accent">{q.commandWord}</Chip>}
                      <span className="num">{q.marks} marks</span>
                      <span>{Math.round(q.timeSeconds / 60)} min</span>
                      <Difficulty value={overallDifficulty(q.difficulty)} />
                      {q.source.kind === "ai-generated" && <Chip tone="fading">AI-generated</Chip>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                    {seen ? (
                      <Chip tone={seen.lastFraction >= 1 ? "secure" : seen.lastFraction >= 0.5 ? "fading" : "lost"}>
                        <Marks earned={seen.lastFraction * q.marks} available={q.marks} />
                      </Chip>
                    ) : (
                      <span className="tiny muted">unseen</span>
                    )}
                    <button className="btn small" onClick={() => setOpen(q)}>
                      {seen ? "Retry" : "Answer"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
