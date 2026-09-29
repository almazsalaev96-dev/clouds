"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen, Camera, Check, ChevronLeft, ChevronRight, Clock, Layers, MessageCircle,
  NotebookPen, Plus, RefreshCw, Sparkles, Target, Timer, Trash2, X,
} from "lucide-react";
import { db, uid, addCards, createDeck, createNote } from "@/lib/db";
import { cheapestAvailable, complete, extractJson, whyItFailed } from "@/lib/complete";
import { draftCards } from "@/lib/generate";
import { dayKey, readiness, type Card } from "@/lib/study";
import {
  BOARDS, DIFFICULTIES, DIFFICULTY_LABEL, LEVELS,
  allTopics, courseMoves, courseName, courseScore, daysUntil, findTopic, marksFor,
  markPrompt, mockPrompt, notesPrompt, parseMarking, parseMock, parseQuestion, parseSyllabus,
  questionPrompt, syllabusFor, syllabusFromDocPrompt, syllabusPrompt, topicResult, weakestFirst,
  type Confidence, type Course, type CourseTopic, type Difficulty, type ExamQuestion,
  type MarkRow, type Marking, type Mock,
} from "@/lib/course";
import { extractPdf, isPdf, readTextFile, readingLine } from "@/lib/pdf";
import type { Note } from "@/lib/types";
import { Button } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import { RoomToggle } from "@/components/ui/RoomToggle";
import { RevisePicker, useReviseModel } from "@/components/chat/RevisePicker";
import { offerUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";

/**
 * Courses: the exam a student is actually sitting, cut the way the board
 * cuts it.
 *
 * Save My Exams sells this shape — a specification, notes per topic,
 * questions per topic with a mark scheme, a mock, a strength score — and
 * the shape is right. What a model adds is that none of it runs out: the
 * next question is written for the topic you are weakest on, what you
 * wrote is marked point by point, and your own answer comes back rewritten
 * to full marks, so the gap is a thing you can see rather than a number.
 */

/* ------------------------------------------------------------ shared -- */

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);

/** A topic's colour: what the marks say where there are marks, what the student says otherwise. */
function statusOf(course: Course, rows: MarkRow[], topicId: string): Confidence | null {
  const r = topicResult(rows, topicId);
  if (r.pct !== null) return r.pct >= 0.7 ? "green" : r.pct >= 0.4 ? "amber" : "red";
  return course.confidence?.[topicId] ?? null;
}

const DOT: Record<Confidence, string> = {
  green: "bg-[var(--success)]",
  amber: "bg-[var(--warning)]",
  red: "bg-[var(--danger)]",
};
const WORD: Record<Confidence, string> = { green: "Confident", amber: "Getting there", red: "Not yet" };

function useModel(configured: Record<string, boolean>) {
  const room = useReviseModel(configured);
  return room ?? cheapestAvailable(configured);
}

function cardReadyFor(cards: Card[], now: number) {
  return (title: string) => {
    const mine = cards.filter((c) => c.topic?.trim().toLowerCase() === title.trim().toLowerCase());
    return mine.length ? readiness(mine, now).score : null;
  };
}

function PanelHeader({ onBack, backLabel, configured, children }: {
  onBack: () => void;
  backLabel: string;
  configured: Record<string, boolean>;
  children?: React.ReactNode;
}) {
  const toggle = React.useContext(RoomToggle);
  return (
    <header className="glass safe-top sticky top-0 z-10 border-b border-line">
      <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-2 px-3 py-3">
        {toggle && <div className="has-room-toggle -ml-1">{toggle}</div>}
        <button
          onClick={onBack}
          aria-label={backLabel}
          className="ctl focus-inset flex [--ctl:2rem] shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-0 flex-1" />
        <RevisePicker configured={configured} />
        {children}
      </div>
    </header>
  );
}

function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} aria-hidden>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------ course strip -- */

/**
 * The courses on the Study index: one tile each, with the one number that
 * matters, and the way to add one.
 */
export function CourseStrip({ courses, rows, cards, now, onOpen, onAdd }: {
  courses: Course[];
  rows: MarkRow[];
  cards: Card[];
  now: number;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  if (!courses.length) {
    return (
      <section aria-label="Your courses" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <Target size={18} className="shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-secondary">
          <span className="font-medium text-primary">Preparing for an exam?</span> Add your course.
        </p>
        <Button size="sm" variant="primary" onClick={onAdd}>
          <Plus size={13} /> Add a course
        </Button>
      </section>
    );
  }
  const ready = cardReadyFor(cards, now);
  return (
    <section aria-label="Your courses" className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-medium text-primary">Your courses</h2>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onAdd}>
          <Plus size={13} /> Add a course
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {courses.map((c) => {
          const mine = rows.filter((r) => r.courseId === c.id);
          const s = courseScore(c, mine, ready);
          const days = daysUntil(c.examAt, now);
          return (
            <li key={c.id}>
              <button
                onClick={() => onOpen(c.id)}
                aria-label={`Open course ${c.name}`}
                className="focus-ring group flex w-full flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="flex w-full items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-primary">{c.subject}</span>
                    <span className="block truncate text-xs text-tertiary">{[c.level, c.board].filter((x) => x && x !== "Other" && x !== "My course").join(" · ")}</span>
                  </span>
                  <span className="tnum text-xl font-medium leading-none text-primary">{Math.round(s.likely * 100)}%</span>
                </span>
                <Meter value={s.likely} />
                <span className="flex w-full items-center gap-2 text-xs text-tertiary tnum">
                  <span>{s.covered} of {s.total} topics tried</span>
                  {days !== null && days >= 0 && <span>· exam in {days} day{days === 1 ? "" : "s"}</span>}
                  <span className="flex-1" />
                  <ChevronRight size={14} className="opacity-60 group-hover:opacity-100" aria-hidden />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------- add course -- */

export function AddCourse({ configured, onDone, onCancel }: {
  configured: Record<string, boolean>;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = React.useState("");
  const [level, setLevel] = React.useState<(typeof LEVELS)[number]>("GCSE");
  const [board, setBoard] = React.useState<string>(BOARDS.GCSE[0]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  /* The official specification, when they have it: the course is then
     built from the document itself — its topics, its codes, its words —
     and every note and question reads the part for its topic. */
  const [spec, setSpec] = React.useState<{ name: string; text: string } | null>(null);
  const [reading, setReading] = React.useState<string | null>(null);
  const specRef = React.useRef<HTMLInputElement>(null);
  const modelId = useModel(configured);

  React.useEffect(() => { setBoard(BOARDS[level][0] ?? "Other"); }, [level]);

  const takeSpec = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    setReading(`Reading ${file.name}…`);
    try {
      let text = "";
      if (isPdf(file)) {
        const out = await extractPdf(file, (page, all) => setReading(readingLine(file.name, page, all)));
        if (out.imageOnly) { setNotice("That PDF is a scan with no text in it. Try the board's downloadable PDF instead."); return; }
        text = out.text;
      } else text = (await readTextFile(file)).text;
      if (!text.trim()) { setNotice("Nothing could be read from that file."); return; }
      setSpec({ name: file.name, text });
    } catch {
      setNotice("That file could not be opened.");
    } finally {
      setReading(null);
    }
  };

  const build = async () => {
    if (!subject.trim() || busy) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setBusy(true);
    setNotice(null);
    try {
      const raw = await complete(spec ? syllabusFromDocPrompt(subject, level, board, spec.text) : syllabusPrompt(subject, level, board), { modelId, maxTokens: 10_000, temperature: 0.2 });
      const units = parseSyllabus(extractJson(raw ?? ""));
      if (!units) { setNotice("The specification did not come back in a shape that could be read. Try again, or name the subject more exactly."); return; }
      const now = Date.now();
      const course: Course = {
        id: uid(), subject: subject.trim(), level, board, name: courseName(subject, level, board),
        units, confidence: {}, notes: {}, createdAt: now, updatedAt: now,
        ...(spec ? { syllabus: { name: spec.name, text: spec.text.slice(0, 2_000_000) } } : {}),
      };
      await db.courses.add(course);
      onDone(course.id);
    } catch (err) {
      setNotice(whyItFailed(err, "The course could not be built. Check the key and the connection."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Add a course" className="mt-4 rounded-xl border border-line bg-surface px-4 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-medium text-primary">Add a course</h2>
        <span className="flex-1" />
        <button onClick={onCancel} aria-label="Close" className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary">
          <X size={14} />
        </button>
      </div>
      <p className="mt-1 text-xs text-tertiary">The specification is written out topic by topic for your board, so every question and note is aimed at what you will actually be examined on.</p>
      <label className="mt-3 block text-xs font-medium text-secondary" htmlFor="course-subject">Subject</label>
      <input
        id="course-subject"
        autoFocus
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void build(); }}
        placeholder="Subject"
        aria-label="Subject"
        className="field mt-1 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
      />
      <p className="mt-3 text-xs font-medium text-secondary">Level</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Level">
        {LEVELS.map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={l === level}
            onClick={() => setLevel(l)}
            className={cn("focus-ring rounded-full border px-3 py-1 text-xs transition-colors",
              l === level ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-secondary">Exam board</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Exam board">
        {[...BOARDS[level], ...(BOARDS[level].includes("Other") ? [] : ["Other"])].map((b) => (
          <button
            key={b}
            role="radio"
            aria-checked={b === board}
            onClick={() => setBoard(b)}
            className={cn("focus-ring rounded-full border px-3 py-1 text-xs transition-colors",
              b === board ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle")}
          >
            {b}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-secondary">Your syllabus</p>
      <div className="mt-1 flex flex-wrap items-center gap-2" aria-label="Your syllabus">
        {spec ? (
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-subtle py-1 pl-3 pr-1 text-xs text-secondary">
            <span className="max-w-[16rem] truncate">{spec.name}</span>
            <button onClick={() => setSpec(null)} aria-label="Remove the syllabus" className="ctl focus-inset flex [--ctl:1.5rem] items-center justify-center rounded-full text-tertiary hover:text-primary"><X size={12} /></button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => specRef.current?.click()} disabled={Boolean(reading)}>
            {reading ?? "Add the specification (PDF)"}
          </Button>
        )}
        <span className="text-xs text-tertiary">{spec ? "Topics, codes and wording come from it." : "Recommended: the course is then built from the real document."}</span>
        <input ref={specRef} type="file" accept=".pdf,.txt,.md,text/*,application/pdf" aria-label="Choose the specification" className="sr-only" tabIndex={-1} onChange={(e) => { void takeSpec(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!subject.trim() || busy || Boolean(reading)} onClick={() => void build()}>
          {busy ? (spec ? "Reading the specification…" : "Writing out the specification…") : "Build the course"}
        </Button>
        {notice && <p role="status" className="text-xs text-warning">{notice}</p>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- course page -- */

export function CoursePanel({ courseId, configured, cards, onBack, onOpenTopic, onOpenMock }: {
  courseId: string;
  configured: Record<string, boolean>;
  cards: Card[];
  onBack: () => void;
  onOpenTopic: (topicId: string, tab?: Tab) => void;
  onOpenMock: (mockId: string) => void;
}) {
  const course = useLiveQuery(() => db.courses.get(courseId), [courseId]);
  const rows = useLiveQuery(() => db.marks.where("courseId").equals(courseId).toArray(), [courseId], [] as MarkRow[]);
  const mocks = useLiveQuery(() => db.mocks.where("courseId").equals(courseId).reverse().sortBy("createdAt"), [courseId], [] as Mock[]);
  const modelId = useModel(configured);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const now = Date.now();
  if (!course) return <div className="flex-1" />;

  const s = courseScore(course, rows, cardReadyFor(cards, now));
  const moves = courseMoves(course, rows);
  const days = daysUntil(course.examAt, now);

  const rate = async (topicId: string, c: Confidence) => {
    const next = { ...course.confidence };
    if (next[topicId] === c) delete next[topicId];
    else next[topicId] = c;
    await db.courses.update(course.id, { confidence: next, updatedAt: Date.now() });
  };

  const startMock = async (minutes: number) => {
    if (busy) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setBusy(`mock-${minutes}`);
    setNotice(null);
    try {
      const topics = weakestFirst(course, rows).slice(0, minutes <= 20 ? 5 : 12);
      const raw = await complete(mockPrompt(course, topics, minutes), { modelId, maxTokens: 12_000, temperature: 0.4 });
      const questions = parseMock(extractJson(raw ?? ""), topics.map((t) => t.id));
      if (!questions) { setNotice("The paper did not come back in a shape that could be read. Try again."); return; }
      const mock: Mock = { id: uid(), courseId: course.id, createdAt: Date.now(), minutes, questions, answers: questions.map(() => ""), startedAt: Date.now() };
      await db.mocks.add(mock);
      onOpenMock(mock.id);
    } catch (err) {
      setNotice(whyItFailed(err, "The paper could not be written. Check the key and the connection."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const snapshot = { course, marks: rows, mocks };
    await db.transaction("rw", db.courses, db.marks, db.mocks, async () => {
      await db.courses.delete(course.id);
      await db.marks.where("courseId").equals(course.id).delete();
      await db.mocks.where("courseId").equals(course.id).delete();
    });
    onBack();
    offerUndo(course.name, async () => {
      await db.courses.put(snapshot.course);
      await db.marks.bulkPut(snapshot.marks);
      await db.mocks.bulkPut(snapshot.mocks);
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PanelHeader onBack={onBack} backLabel="Back to Study" configured={configured}>
        <Button size="sm" variant="ghost" onClick={() => void remove()} aria-label="Delete this course">
          <Trash2 size={13} />
        </Button>
        <Button size="sm" variant="primary" disabled={Boolean(busy)} onClick={() => void startMock(15)}>
          <Timer size={13} /> {busy === "mock-15" ? "Writing…" : "Quick test"}
        </Button>
      </PanelHeader>

      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-5">
        <h1 className="title-field text-primary">{course.subject}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-base text-tertiary">
          <span>{[course.level, course.board].filter((x) => x && x !== "Other" && x !== "My course").join(" · ")}</span>
          <span>· {s.total} topics</span>
          <label className="flex items-center gap-1.5">
            <span>·</span>
            {days !== null && days >= 0 ? <span className="text-secondary">exam in {days} day{days === 1 ? "" : "s"}</span> : <span>exam date</span>}
            <input
              type="date"
              aria-label="Exam date"
              /* The local day, not the UTC one: stored as 09:00 local, which east of
                 UTC+9 is still the day before in UTC, so the field showed a day early. */
              value={course.examAt ? dayKey(course.examAt) : ""}
              onChange={(e) => void db.courses.update(course.id, { examAt: e.target.value ? new Date(e.target.value + "T09:00").getTime() : undefined })}
              className="rounded-md border border-line bg-transparent px-1.5 py-0.5 text-xs text-secondary"
            />
          </label>
        </p>

        {/* The result, first: what this course would likely come to today. */}
        <section aria-label="Course result" className="mt-5 rounded-xl border border-line bg-surface px-4 py-3.5">
          <div className="flex items-end gap-3">
            <span className="tnum text-[2.5rem] font-medium leading-none tracking-[-0.02em] text-primary" aria-label={`Likely marks ${Math.round(s.likely * 100)} per cent`}>
              {Math.round(s.likely * 100)}%
            </span>
            <span className="mb-1 flex flex-col">
              <span className="text-sm font-medium text-primary">likely marks</span>
              <span className="text-xs text-tertiary">if the exam were today</span>
            </span>
          </div>
          <Meter value={s.likely} className="mt-3" />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-tertiary tnum">
            <span><span className="text-secondary">{s.covered}</span> of {s.total} topics tried</span>
            {s.out > 0 && <span><span className="text-secondary">{s.got}</span> of {s.out} marks on the questions answered ({pct(s.marks)})</span>}
            {mocks.filter((m) => m.finishedAt).length > 0 && <span>{mocks.filter((m) => m.finishedAt).length} mock{mocks.filter((m) => m.finishedAt).length === 1 ? "" : "s"} sat</span>}
          </p>
          <p className="mt-1 text-xs text-tertiary">A topic not tried yet counts as nothing, because on the day it is worth nothing. Every topic you touch lifts this.</p>
          {moves.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-secondary">Most marks for your time</p>
              <ul className="mt-1.5 space-y-1.5" aria-label="Where the next marks are">
                {moves.map((m, i) => (
                  <li key={m.key} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="text-primary">{m.label}</span>
                      <span className="text-tertiary"> — {m.why}</span>
                    </span>
                    <Button size="sm" variant={i === 0 ? "primary" : "secondary"} aria-label={m.label} onClick={() => onOpenTopic(m.topicId, m.kind)}>Go</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Mocks: a paper aimed at the gaps, timed, marked. */}
        <section aria-label="Mock exams" className="mt-4 rounded-xl border border-line bg-surface px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-primary">Mock exams</h2>
            <span className="text-xs text-tertiary">written for you, weakest topics first, timed and marked</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ m: 15, l: "Quick test · 15 min" }, { m: 45, l: "Mock paper · 45 min" }, { m: 90, l: "Full paper · 90 min" }].map(({ m, l }) => (
              <Button key={m} size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void startMock(m)}>
                <Clock size={13} /> {busy === `mock-${m}` ? "Writing the paper…" : l}
              </Button>
            ))}
          </div>
          {mocks.length > 0 && (
            <ul className="mt-3 divide-y divide-line" aria-label="Papers sat">
              {mocks.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <button onClick={() => onOpenMock(m.id)} className="focus-inset flex w-full items-center gap-3 py-2 text-left text-sm hover:text-primary">
                    <span className="min-w-0 flex-1 truncate text-secondary">
                      {m.minutes}-minute paper · {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                    <span className="tnum text-tertiary">
                      {m.finishedAt && m.out ? `${m.got} / ${m.out} · ${Math.round(((m.got ?? 0) / m.out) * 100)}%` : "not finished"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notice && <p role="status" className="mt-2 text-xs text-warning">{notice}</p>}
        </section>

        {/* The specification, as a checklist that marks itself. */}
        <section aria-label="Specification" className="mt-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-medium text-primary">Specification</h2>
            <span className="flex items-center gap-2 text-xs text-tertiary">
              {(["green", "amber", "red"] as Confidence[]).map((c) => (
                <span key={c} className="flex items-center gap-1"><span className={cn("size-2 rounded-full", DOT[c])} />{WORD[c]}</span>
              ))}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-tertiary">A topic's colour comes from your marks once you have answered on it; before that, from how sure you say you are.</p>
          {course.units.map((u) => (
            <div key={u.id} className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-tertiary">{u.title}</h3>
              <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line bg-surface" aria-label={u.title}>
                {u.topics.map((t) => {
                  const st = statusOf(course, rows, t.id);
                  const r = topicResult(rows, t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                      <span className={cn("size-2.5 shrink-0 rounded-full", st ? DOT[st] : "border border-[var(--border-strong)]")} aria-label={st ? WORD[st] : "Not started"} />
                      <button onClick={() => onOpenTopic(t.id)} className="focus-inset min-w-0 flex-1 truncate text-left text-sm text-primary hover:underline" aria-label={`Open ${t.title}`}>
                        {t.code && <span className="mr-1.5 text-tertiary tnum">{t.code}</span>}
                        {t.title}
                      </button>
                      <span className="tnum hidden text-xs text-tertiary sm:inline">{r.out ? `${r.got}/${r.out}` : ""}</span>
                      <span className="flex shrink-0 gap-0.5" role="group" aria-label={`How sure are you about ${t.title}`}>
                        {(["red", "amber", "green"] as Confidence[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => void rate(t.id, c)}
                            aria-label={WORD[c]}
                            aria-pressed={course.confidence?.[t.id] === c}
                            title={WORD[c]}
                            className={cn("ctl focus-ring flex [--ctl:1.5rem] items-center justify-center rounded-md hover:bg-subtle")}
                          >
                            <span className={cn("size-2 rounded-full transition-opacity", DOT[c], course.confidence?.[t.id] === c ? "opacity-100 ring-2 ring-offset-1 ring-offset-[var(--bg-surface)] ring-[var(--border-strong)]" : "opacity-35")} />
                          </button>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- topic page -- */

type Tab = "questions" | "notes" | "cards";

export function TopicPanel({ courseId, topicId, tab: initial, configured, cards, onBack, onPractise, onAsk, onOpenPage }: {
  courseId: string;
  topicId: string;
  tab?: Tab;
  configured: Record<string, boolean>;
  cards: Card[];
  onBack: () => void;
  onPractise: (topicTitle: string) => void;
  onAsk?: (question: string) => void;
  onOpenPage?: (id: string) => void;
}) {
  const course = useLiveQuery(() => db.courses.get(courseId), [courseId]);
  const rows = useLiveQuery(() => db.marks.where("topicId").equals(topicId).toArray(), [topicId], [] as MarkRow[]);
  const [tab, setTab] = React.useState<Tab>(initial ?? "questions");
  if (!course) return <div className="flex-1" />;
  const topic = findTopic(course, topicId);
  if (!topic) return <div className="flex-1" />;
  const mine = rows.filter((r) => r.courseId === courseId).sort((a, b) => b.at - a.at);
  const r = topicResult(mine, topicId);
  const topicCards = cards.filter((c) => c.topic?.trim().toLowerCase() === topic.title.trim().toLowerCase());

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PanelHeader onBack={onBack} backLabel={`Back to ${course.subject}`} configured={configured} />
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-5">
        <p className="text-xs text-tertiary">{course.subject} · {topic.unit}</p>
        <h1 className="title-field mt-1 text-primary">{topic.code && <span className="mr-2 text-tertiary tnum">{topic.code}</span>}{topic.title}</h1>
        <p className="mt-1 text-sm text-tertiary tnum">
          {r.out ? <><span className="text-secondary">{r.got} of {r.out} marks</span> on your last {r.tried} answer{r.tried === 1 ? "" : "s"} ({pct(r.pct)})</> : "Not tried yet"}
          {topicCards.length > 0 && <> · {topicCards.length} card{topicCards.length === 1 ? "" : "s"}</>}
        </p>
        {topic.points.length > 0 && (
          <details className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-secondary">What the specification asks</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
              {topic.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </details>
        )}

        <div className="mt-5 flex gap-1 border-b border-line" role="tablist" aria-label="Topic">
          {([["questions", "Questions", Target], ["notes", "Notes", BookOpen], ["cards", "Flashcards", Layers]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("focus-inset -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                tab === id ? "border-[var(--text-primary)] text-primary" : "border-transparent text-tertiary hover:text-secondary")}
            >
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "questions" && <Questions course={course} topic={topic} rows={mine} configured={configured} onAsk={onAsk} />}
          {tab === "notes" && <Notes course={course} topic={topic} configured={configured} onOpenPage={onOpenPage} onQuestions={() => setTab("questions")} />}
          {tab === "cards" && <TopicCards course={course} topic={topic} cards={topicCards} configured={configured} onPractise={() => onPractise(topic.title)} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- notes -- */

function Notes({ course, topic, configured, onOpenPage, onQuestions }: {
  course: Course;
  topic: CourseTopic;
  configured: Record<string, boolean>;
  onOpenPage?: (id: string) => void;
  onQuestions: () => void;
}) {
  const noteId = course.notes?.[topic.id];
  const note = useLiveQuery(() => (noteId ? db.notes.get(noteId) : undefined), [noteId]) as Note | undefined;
  const modelId = useModel(configured);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const write = async () => {
    if (busy) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setBusy(true);
    setNotice(null);
    try {
      const text = await complete(notesPrompt(course, topic, syllabusFor(course, topic)), { modelId, maxTokens: 5_000, temperature: 0.3 });
      if (!text?.trim()) throw new Error("Nothing came back.");
      const title = `${course.subject} — ${topic.title}`;
      if (note) await db.notes.update(note.id, { content: text.trim(), updatedAt: Date.now() });
      else {
        const created = await createNote({ title, content: text.trim() });
        await db.courses.update(course.id, { notes: { ...(course.notes ?? {}), [topic.id]: created.id }, updatedAt: Date.now() });
      }
    } catch (err) {
      setNotice(whyItFailed(err, "The notes could not be written."));
    } finally {
      setBusy(false);
    }
  };

  if (!note) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-4">
        <p className="text-sm text-secondary">Notes for exactly this topic on your specification: the key points a mark scheme looks for, the terms, a worked example, the common mistakes and what examiners reward.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void write()}>
            <NotebookPen size={14} /> {busy ? "Writing the notes…" : "Write the revision notes"}
          </Button>
          {notice && <p role="status" className="text-xs text-warning">{notice}</p>}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onQuestions}><Target size={13} /> Test me on it</Button>
        {onOpenPage && <Button size="sm" variant="ghost" onClick={() => onOpenPage(note.id)}><NotebookPen size={13} /> Open in Notebook</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void write()}><RefreshCw size={13} /> {busy ? "Rewriting…" : "Rewrite"}</Button>
        {notice && <p role="status" className="text-xs text-warning">{notice}</p>}
      </div>
      <article aria-label="Revision notes" className="rounded-xl border border-line bg-surface px-4 py-3 sm:px-6 sm:py-5">
        <Markdown content={note.content} />
      </article>
    </div>
  );
}

/* ------------------------------------------------------------- cards -- */

function TopicCards({ course, topic, cards, configured, onPractise }: {
  course: Course;
  topic: CourseTopic;
  cards: Card[];
  configured: Record<string, boolean>;
  onPractise: () => void;
}) {
  const modelId = useModel(configured);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const now = Date.now();
  const ready = cards.length ? readiness(cards, now) : null;

  const make = async () => {
    if (busy) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setBusy(true);
    setNotice(null);
    try {
      const had = cards.map((c) => `- ${c.front}`).join("\n");
      const drafts = await draftCards(
        `${course.name}\nTopic: ${topic.title}\n${topic.points.map((p) => `- ${p}`).join("\n")}${had ? `\n\nCards already made, not to be repeated:\n${had}` : ""}`,
        { about: `${topic.title} (${course.name})`, modelId },
      );
      if (!drafts) { setNotice("Nothing usable came back."); return; }
      const deckId = await deckFor(course);
      const n = await addCards(deckId, drafts.map((d) => ({ ...d, topic: topic.title })), course.name);
      setNotice(n ? `${n} card${n === 1 ? "" : "s"} added to the ${course.subject} deck.` : "Everything it wrote was already there.");
    } catch (err) {
      setNotice(whyItFailed(err, "The cards could not be made."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      {cards.length ? (
        <p className="text-sm text-secondary tnum">
          {cards.length} card{cards.length === 1 ? "" : "s"} on this topic
          {ready?.score !== null && ready?.score !== undefined && <> · <span className="text-primary">{Math.round(ready.score * 100)}% ready</span></>}
          . They come back on a schedule, sooner whenever you get one wrong.
        </p>
      ) : (
        <p className="text-sm text-secondary">Cards for the facts this topic is marked on, asked again on a schedule until they stick.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cards.length > 0 && <Button variant="primary" onClick={onPractise}>Practise {cards.length} card{cards.length === 1 ? "" : "s"}</Button>}
        <Button variant={cards.length ? "secondary" : "primary"} disabled={busy} onClick={() => void make()}>
          <Plus size={14} /> {busy ? "Making cards…" : cards.length ? "More cards" : "Make cards for this topic"}
        </Button>
        {notice && <p role="status" className="text-xs text-tertiary">{notice}</p>}
      </div>
    </div>
  );
}

async function deckFor(course: Course): Promise<string> {
  if (course.deckId && (await db.decks.get(course.deckId))) return course.deckId;
  const deck = await createDeck(course.name, "course");
  await db.courses.update(course.id, { deckId: deck.id, updatedAt: Date.now() });
  return deck.id;
}

/* --------------------------------------------------------- questions -- */

export async function markAnswer(
  course: Pick<Course, "subject" | "level" | "board">,
  q: ExamQuestion,
  answer: string,
  modelId: string,
  photo?: { mimeType: string; data: string } | null,
): Promise<Marking | null> {
  const prompt = markPrompt(course, q, photo ? `${answer.trim()}\n(Their working is also in the photo attached; mark what is written there too.)` : answer);
  const raw = await complete(prompt, {
    modelId,
    maxTokens: 4_000,
    temperature: 0,
    ...(photo ? { turns: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }, { type: "image" as const, mimeType: photo.mimeType, data: photo.data, name: "working.jpg" }] }] } : {}),
  });
  return parseMarking(extractJson(raw ?? ""), q);
}

function Questions({ course, topic, rows, configured, onAsk }: {
  course: Course;
  topic: CourseTopic;
  rows: MarkRow[];
  configured: Record<string, boolean>;
  onAsk?: (question: string) => void;
}) {
  const modelId = useModel(configured);
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium");
  const [q, setQ] = React.useState<ExamQuestion | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [photo, setPhoto] = React.useState<{ mimeType: string; data: string; url: string } | null>(null);
  const [result, setResult] = React.useState<Marking | null>(null);
  const [busy, setBusy] = React.useState<"writing" | "marking" | "cards" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showScheme, setShowScheme] = React.useState(false);
  const [review, setReview] = React.useState<MarkRow | null>(null);
  const photoRef = React.useRef<HTMLInputElement>(null);

  const write = async (d: Difficulty = difficulty) => {
    if (busy) return;
    if (!modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setBusy("writing");
    setNotice(null);
    setReview(null);
    try {
      const avoid = [...(q ? [q.question] : []), ...rows.slice(0, 8).map((r) => r.question)];
      const raw = await complete(questionPrompt(course, topic, d, avoid, syllabusFor(course, topic)), { modelId, maxTokens: 3_000, temperature: 0.7 });
      const next = parseQuestion(extractJson(raw ?? ""), topic.id, d);
      if (!next) { setNotice("The question did not come back in a shape that could be read. Try again."); return; }
      setQ(next);
      setAnswer("");
      setPhoto(null);
      setResult(null);
      setShowScheme(false);
    } catch (err) {
      setNotice(whyItFailed(err, "The question could not be written."));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!q || busy || !modelId) return;
    if (!answer.trim() && !photo) { setNotice("Write your answer first, or add a photo of your working."); return; }
    setBusy("marking");
    setNotice(null);
    try {
      const m = await markAnswer(course, q, answer, modelId, photo);
      if (!m) { setNotice("The marking did not come back in a shape that could be read. Press Mark again."); return; }
      setResult(m);
      await db.marks.add({
        id: uid(), at: Date.now(), courseId: course.id, topicId: topic.id, topic: topic.title,
        question: q.question, marks: q.marks, got: m.got, difficulty: q.difficulty,
        answer: answer.trim() || "(photo of working)", points: m.points, feedback: m.feedback, better: m.better,
        model: q.model, tip: q.tip,
      });
    } catch (err) {
      setNotice(whyItFailed(err, "The answer could not be marked."));
    } finally {
      setBusy(null);
    }
  };

  const takePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) { setNotice("That photo is over 8MB. Take it again a little further away."); return; }
    const url = await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(r.error);
      r.readAsDataURL(file);
    });
    setPhoto({ mimeType: file.type || "image/jpeg", data: url.split(",")[1] ?? "", url });
  };

  const missedToCards = async () => {
    if (!q || !result || busy) return;
    const missed = result.points.filter((p) => !p.got);
    if (!missed.length) return;
    setBusy("cards");
    try {
      const deckId = await deckFor(course);
      const stem = q.question.replace(/\s*\[\d+\]\s*$/, "").slice(0, 200);
      const n = await addCards(deckId, missed.map((p) => ({ front: `${stem} — what earns the mark here?`.slice(0, 400), back: p.point, topic: topic.title })), course.name);
      setNotice(n ? `${n} card${n === 1 ? "" : "s"} made from what you missed. They come back tomorrow.` : "Those are already cards.");
    } finally {
      setBusy(null);
    }
  };

  const shown = review ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-line p-0.5" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={d === difficulty}
              onClick={() => setDifficulty(d)}
              className={cn("focus-ring rounded-full px-3 py-1 text-xs transition-colors",
                d === difficulty ? "bg-cta text-cta-fg" : "text-secondary hover:bg-subtle")}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <Button variant={q ? "secondary" : "primary"} size="sm" disabled={Boolean(busy)} onClick={() => void write()}>
          <Sparkles size={13} /> {busy === "writing" ? "Writing a question…" : q ? "New question" : "Give me a question"}
        </Button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs text-warning">{notice}</p>}

      {q && !shown && (
        <section aria-label="Exam question" className="mt-4 rounded-xl border border-line bg-surface px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <span className="rounded-full bg-subtle px-2 py-0.5">{DIFFICULTY_LABEL[q.difficulty]}</span>
            <span className="tnum">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
            <span className="flex-1" />
            <button onClick={() => void write(q.difficulty)} disabled={Boolean(busy)} className="focus-ring rounded px-1 text-xs text-tertiary hover:text-secondary" aria-label="Something wrong with this question? Replace it">
              Something wrong? Replace it
            </button>
          </div>
          <div className="mt-2 text-[0.95rem] leading-relaxed text-primary"><Markdown content={q.question} /></div>

          {!result ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={Math.min(14, Math.max(4, q.marks + 2))}
                aria-label="Your answer"
                placeholder=""
                className="field mt-3 w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-sm leading-relaxed text-primary outline-none focus:border-[var(--accent)]"
              />
              {photo && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Your working" className="h-16 w-auto rounded-md border border-line object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => setPhoto(null)} aria-label="Remove the photo"><X size={13} /></Button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" disabled={Boolean(busy)} onClick={() => void submit()}>
                  <Check size={14} /> {busy === "marking" ? "Marking against the scheme…" : "Mark my answer"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => photoRef.current?.click()} aria-label="Add a photo of your working">
                  <Camera size={13} /> Photo of working
                </Button>
                <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Photo of your working" onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                <span className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => setShowScheme((v) => !v)} aria-expanded={showScheme}>
                  {showScheme ? "Hide the mark scheme" : "Show the mark scheme"}
                </Button>
              </div>
              {showScheme && <Scheme q={q} />}
            </>
          ) : (
            <Result
              q={q}
              result={result}
              answer={answer}
              busy={busy}
              onSimilar={() => void write(q.difficulty)}
              onHarder={() => { const d = DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, DIFFICULTIES.indexOf(q.difficulty) + 1)]; setDifficulty(d); void write(d); }}
              onRetry={() => { setResult(null); }}
              onCards={() => void missedToCards()}
              onAsk={onAsk ? () => onAsk(`I answered this ${course.name} exam question and got ${result.got} out of ${result.out}.\n\nQuestion: ${q.question}\n\nMy answer: ${answer.trim() || "(in a photo)"}\n\nMark scheme:\n${q.scheme.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWhat I missed: ${result.points.filter((p) => !p.got).map((p) => p.point).join("; ") || "nothing"}\n\nExplain what I got wrong, then ask me one question to check I understand it now.`) : undefined}
            />
          )}
        </section>
      )}

      {shown && (
        <section aria-label="An answer you gave" className="mt-4 rounded-xl border border-line bg-surface px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <span>{new Date(shown.at).toLocaleDateString()}</span>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setReview(null)} aria-label="Close"><X size={13} /></Button>
          </div>
          <div className="mt-2 text-[0.95rem] leading-relaxed text-primary"><Markdown content={shown.question} /></div>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-subtle px-3 py-2 text-sm text-secondary">{shown.answer}</p>
          <Result
            q={{ topicId: shown.topicId, question: shown.question, marks: shown.marks, scheme: shown.points.map((p) => p.point), model: shown.model, tip: shown.tip, difficulty: shown.difficulty }}
            result={{ got: shown.got, out: shown.marks, points: shown.points, feedback: shown.feedback, better: shown.better }}
            answer={shown.answer}
            busy={busy}
            onSimilar={() => { setDifficulty(shown.difficulty); void write(shown.difficulty); }}
          />
        </section>
      )}

      {!q && !shown && (
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-4 text-sm text-secondary">
          <p>Exam-style questions on exactly this topic, as many as you want, never the same one twice. Write your answer, or photograph your working, and it is marked point by point against the mark scheme, the way an examiner would.</p>
          <p className="mt-2 text-tertiary">Then you see your own answer rewritten to full marks, so you can see exactly what to add.</p>
        </div>
      )}

      {rows.length > 0 && (
        <section aria-label="Your answers on this topic" className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-tertiary">Your answers</h3>
          <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line bg-surface">
            {rows.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button onClick={() => { setReview(r); }} className="focus-inset flex w-full items-center gap-3 px-3 py-2 text-left">
                  <span className={cn("size-2 shrink-0 rounded-full", r.got / r.marks >= 0.7 ? DOT.green : r.got / r.marks >= 0.4 ? DOT.amber : DOT.red)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm text-secondary">{r.question.replace(/\s*\[\d+\]\s*$/, "")}</span>
                  <span className="tnum text-xs text-tertiary">{r.got}/{r.marks}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Scheme({ q }: { q: Pick<ExamQuestion, "scheme" | "model" | "tip"> }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line px-3 py-2.5">
      <div>
        <p className="text-xs font-medium text-secondary">Mark scheme</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-secondary">
          {q.scheme.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
      {q.model && (
        <div>
          <p className="text-xs font-medium text-secondary">Model answer</p>
          <div className="mt-1 text-sm text-secondary"><Markdown content={q.model} /></div>
        </div>
      )}
      {q.tip && <p className="text-xs text-tertiary"><span className="font-medium text-secondary">Examiner tip.</span> {q.tip}</p>}
    </div>
  );
}

export function Result({ q, result, answer, busy, onSimilar, onHarder, onRetry, onCards, onAsk }: {
  q: ExamQuestion;
  result: Marking & { marks?: number };
  answer: string;
  busy: string | null;
  onSimilar?: () => void;
  onHarder?: () => void;
  onRetry?: () => void;
  onCards?: () => void;
  onAsk?: () => void;
}) {
  const share = result.out ? result.got / result.out : 0;
  const missed = result.points.filter((p) => !p.got).length;
  return (
    <div className="mt-4" aria-label="Marked">
      <div className="flex items-end gap-3">
        <span className="tnum text-[2rem] font-medium leading-none text-primary" aria-label={`${result.got} out of ${result.out} marks`}>
          {result.got}<span className="text-tertiary">/{result.out}</span>
        </span>
        <span className={cn("mb-0.5 text-sm font-medium", share >= 0.7 ? "text-[var(--success)]" : share >= 0.4 ? "text-warning" : "text-danger")}>
          {share === 1 ? "Full marks" : share >= 0.7 ? "Strong" : share >= 0.4 ? "Part of the way" : "Not there yet"}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5" aria-label="Mark points">
        {result.points.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", p.got ? "bg-[var(--success)] text-[var(--bg-canvas)]" : "border border-[var(--border-strong)] text-tertiary")} aria-label={p.got ? "Earned" : "Missed"}>
              {p.got ? <Check size={11} strokeWidth={3} /> : <X size={10} />}
            </span>
            <span className="min-w-0">
              <span className={p.got ? "text-primary" : "text-secondary"}>{p.point}</span>
              {p.why && <span className="block text-xs text-tertiary">{p.why}</span>}
            </span>
          </li>
        ))}
      </ul>
      {result.feedback && answer.trim() && !/^\(not answered\)$/.test(answer.trim()) && <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm text-secondary">{result.feedback}</p>}
      {result.better && result.got < result.out && (
        <div className="mt-3">
          <p className="text-xs font-medium text-secondary">{!answer.trim() || /^\(not answered\)$/.test(answer.trim()) ? "A full-mark answer" : "Your answer, to full marks"}</p>
          <div className="mt-1 rounded-lg border border-accent/30 px-3 py-2 text-sm text-primary"><Markdown content={result.better} /></div>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-secondary">Mark scheme and model answer</summary>
        <Scheme q={q} />
      </details>
      <div className="mt-4 flex flex-wrap gap-2">
        {onSimilar && <Button size="sm" variant="primary" disabled={Boolean(busy)} onClick={onSimilar}><Sparkles size={13} /> Similar question</Button>}
        {onHarder && q.difficulty !== "exam" && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={onHarder}>Harder one</Button>}
        {onRetry && result.got < result.out && <Button size="sm" variant="secondary" onClick={onRetry}>Try it again</Button>}
        {onCards && missed > 0 && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={onCards}><Layers size={13} /> Turn what I missed into cards</Button>}
        {onAsk && <Button size="sm" variant="ghost" onClick={onAsk}><MessageCircle size={13} /> Explain it to me</Button>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- mock -- */

export function MockExam({ mockId, configured, onBack, onOpenTopic }: {
  mockId: string;
  configured: Record<string, boolean>;
  onBack: () => void;
  onOpenTopic?: (topicId: string) => void;
}) {
  const mock = useLiveQuery(() => db.mocks.get(mockId), [mockId]);
  /* null: this paper belongs to no course. undefined: still loading. */
  const course = useLiveQuery(
    async (): Promise<Course | null | undefined> => {
      if (!mock) return undefined;
      if (!mock.courseId) return null;
      return (await db.courses.get(mock.courseId)) ?? null;
    },
    [mock?.courseId, Boolean(mock)],
  );
  const rows = useLiveQuery(() => db.marks.where("mockId").equals(mockId).toArray(), [mockId], [] as MarkRow[]);
  const modelId = useModel(configured);
  const [answers, setAnswers] = React.useState<string[] | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [clock, setClock] = React.useState(Date.now());

  React.useEffect(() => { if (mock && !answers) setAnswers(mock.answers ?? mock.questions.map(() => "")); }, [mock, answers]);
  /* The clock starts when the paper is first opened, not when it was written. */
  React.useEffect(() => {
    if (mock && !mock.startedAt && !mock.finishedAt && mock.kind !== "quiz") void db.mocks.update(mockId, { startedAt: Date.now() });
  }, [mock, mockId]);
  React.useEffect(() => {
    if (!mock || mock.finishedAt) return;
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [mock]);
  /* Answers are kept as they are typed, so a paper survives a reload. */
  const save = React.useRef<number | null>(null);
  const setAnswer = (i: number, v: string) => {
    setAnswers((a) => {
      const next = [...(a ?? [])];
      next[i] = v;
      if (save.current) window.clearTimeout(save.current);
      save.current = window.setTimeout(() => void db.mocks.update(mockId, { answers: next }), 400);
      return next;
    });
  };

  if (!mock || course === undefined || !answers) return <div className="flex-1" />;
  const about = course ?? { subject: mock.about?.subject || mock.title || "", level: mock.about?.level ?? "", board: mock.about?.board ?? "" };
  const heading = course?.name ?? mock.title ?? "Paper";
  const quiz = mock.kind === "quiz" || mock.questions.every((q) => q.options?.length);
  const topicOf = (q: ExamQuestion) => (course ? findTopic(course, q.topicId)?.title : undefined) ?? q.topic ?? "";
  const keyOf = (q: ExamQuestion) => q.topicId || `t:${q.topic ?? ""}`;
  const out = mock.questions.reduce((s, q) => s + q.marks, 0);
  const left = mock.startedAt ? mock.startedAt + mock.minutes * 60_000 - clock : mock.minutes * 60_000;
  const mm = Math.max(0, Math.floor(left / 60_000));
  const ss = Math.max(0, Math.floor((left % 60_000) / 1000));
  const letter = (i: number) => String.fromCharCode(65 + i);

  /* Multiple choice is marked here: there is one right option and the
     reasons for every option are already written. */
  const choiceMark = (q: ExamQuestion, ans: string): Marking => {
    const chosen = ans === "" ? -1 : Number(ans);
    const right = q.answer ?? 0;
    const ok = chosen === right;
    return {
      got: ok ? 1 : 0,
      out: 1,
      points: [{ point: `${letter(right)}. ${q.options?.[right] ?? ""}`, got: ok, why: q.why?.[right] ?? "" }],
      feedback: chosen < 0 ? "Not answered." : ok ? (q.why?.[right] ?? "Right.") : `You chose ${letter(chosen)}: ${q.why?.[chosen] ?? "not the best answer."}`,
      better: "",
    };
  };

  const finish = async () => {
    if (progress) return;
    const needsModel = mock.questions.some((q, i) => !q.options?.length && (answers[i] ?? "").trim());
    if (needsModel && !modelId) { setNotice("No key configured yet — add one in Settings."); return; }
    setNotice(null);
    await db.mocks.update(mockId, { answers });
    let got = 0;
    const done: MarkRow[] = [];
    for (let i = 0; i < mock.questions.length; i += 1) {
      const q = mock.questions[i];
      const ans = answers[i] ?? "";
      let m: Marking | null = null;
      if (q.options?.length) m = choiceMark(q, ans);
      else if (!ans.trim()) m = { got: 0, out: q.marks, points: q.scheme.map((p) => ({ point: p, got: false, why: "Not answered" })), feedback: "Not answered.", better: q.model };
      else {
        setProgress(`Marking question ${i + 1} of ${mock.questions.length}…`);
        try { m = await markAnswer(about, q, ans, modelId!); } catch (err) { setNotice(whyItFailed(err, "A question could not be marked.")); }
        if (!m) m = await markAnswer(about, q, ans, modelId!).catch(() => null);
      }
      if (!m) { setProgress(null); setNotice(`Question ${i + 1} could not be marked. Press Finish again to carry on.`); return; }
      got += m.got;
      done.push({
        id: uid(), at: Date.now(), courseId: mock.courseId, topicId: keyOf(q), topic: topicOf(q),
        question: q.question, marks: q.marks, got: m.got, difficulty: "exam",
        answer: q.options?.length ? (ans === "" ? "(not answered)" : `${letter(Number(ans))}. ${q.options[Number(ans)] ?? ""}`) : ans || "(not answered)",
        points: m.points, feedback: m.feedback, better: m.better, model: q.model, tip: q.tip, mockId,
      });
    }
    await db.transaction("rw", db.marks, db.mocks, async () => {
      await db.marks.where("mockId").equals(mockId).delete();
      await db.marks.bulkAdd(done);
      await db.mocks.update(mockId, { finishedAt: Date.now(), got, out, answers });
    });
    setProgress(null);
  };

  const finished = Boolean(mock.finishedAt);
  const byTopic = new Map<string, { label: string; got: number; out: number }>();
  for (const r of rows) {
    const t = byTopic.get(r.topicId) ?? { label: r.topic || "Other", got: 0, out: 0 };
    t.got += r.got;
    t.out += r.marks;
    byTopic.set(r.topicId, t);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PanelHeader onBack={onBack} backLabel={course ? `Back to ${course.subject}` : "Back"} configured={configured}>
        {!finished && !quiz && (
          <span className={cn("tnum flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs", left < 0 ? "text-danger" : left < 5 * 60_000 ? "text-warning" : "text-secondary")} role="timer" aria-label="Time left">
            <Clock size={12} /> {left < 0 ? "Time is up" : `${mm}:${String(ss).padStart(2, "0")}`}
          </span>
        )}
        {!finished && (
          <Button size="sm" variant="primary" disabled={Boolean(progress)} onClick={() => void finish()}>
            {progress ? "Marking…" : "Finish and mark"}
          </Button>
        )}
      </PanelHeader>
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-5">
        <p className="text-xs text-tertiary">{course ? course.name : [mock.about?.subject, mock.about?.level, mock.about?.board].filter(Boolean).join(" · ") || "Studio"}</p>
        <h1 className="title-field mt-1 text-primary">{course ? `${mock.minutes}-minute paper` : heading}</h1>
        <p className="mt-1 text-sm text-tertiary tnum">
          {mock.questions.length} questions · {out} marks{quiz ? " · pick one answer each" : ` · ${mock.minutes} minutes · answer every question`}
        </p>
        {progress && <p role="status" className="mt-3 text-sm text-secondary">{progress}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-warning">{notice}</p>}

        {finished && mock.out ? (
          <section aria-label="Paper result" className="mt-5 rounded-xl border border-line bg-surface px-4 py-3.5">
            <div className="flex items-end gap-3">
              <span className="tnum text-[2.5rem] font-medium leading-none text-primary">{mock.got}<span className="text-tertiary">/{mock.out}</span></span>
              <span className="mb-1 text-sm font-medium text-primary">{Math.round(((mock.got ?? 0) / mock.out) * 100)}% of the marks</span>
            </div>
            {byTopic.size > 1 && (
              <ul className="mt-3 space-y-1.5" aria-label="By topic">
                {[...byTopic.entries()].sort((a, b) => a[1].got / a[1].out - b[1].got / b[1].out).map(([tid, t]) => (
                  <li key={tid} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-secondary">{t.label}</span>
                    <span className="w-24"><Meter value={t.out ? t.got / t.out : 0} /></span>
                    <span className="tnum w-12 text-right text-xs text-tertiary">{t.got}/{t.out}</span>
                    {course && onOpenTopic && <Button size="sm" variant="ghost" onClick={() => onOpenTopic(tid)} aria-label={`Practise ${t.label}`}>Practise</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <ol className="mt-6 space-y-5" aria-label="Questions">
          {mock.questions.map((q, i) => {
            const r = rows.find((x) => x.question === q.question);
            const chosen = answers[i] ?? "";
            return (
              <li key={i} className="rounded-xl border border-line bg-surface px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-tertiary">
                  <span className="font-medium text-secondary">Question {i + 1}</span>
                  {topicOf(q) && <span>· {topicOf(q)}</span>}
                  <span className="flex-1" />
                  <span className="tnum">{r ? `${r.got}/${q.marks}` : `${q.marks} mark${q.marks === 1 ? "" : "s"}`}</span>
                </div>
                <div className="mt-2 text-[0.95rem] leading-relaxed text-primary"><Markdown content={q.question} /></div>
                {q.options?.length ? (
                  <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={`Options for question ${i + 1}`}>
                    {q.options.map((o, j) => {
                      const picked = chosen !== "" && Number(chosen) === j;
                      const right = finished && q.answer === j;
                      const wrong = finished && picked && q.answer !== j;
                      return (
                        <button
                          key={j}
                          role="radio"
                          aria-checked={picked}
                          disabled={finished}
                          onClick={() => setAnswer(i, String(j))}
                          className={cn("focus-ring flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            right ? "border-[var(--success)] bg-[var(--success)]/10" : wrong ? "border-[var(--danger)] bg-[var(--danger)]/10" : picked ? "border-[var(--text-primary)]" : "border-line hover:bg-subtle")}
                        >
                          <span className="tnum w-4 shrink-0 font-medium text-secondary">{letter(j)}</span>
                          <span className="min-w-0 flex-1 text-primary">
                            {o}
                            {finished && (right || wrong) && q.why?.[j] && <span className="mt-0.5 block text-xs text-tertiary">{q.why[j]}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : finished ? (
                  <>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-subtle px-3 py-2 text-sm text-secondary">{answers[i] || "(not answered)"}</p>
                    {r && <Result q={q} result={{ got: r.got, out: r.marks, points: r.points, feedback: r.feedback, better: r.better }} answer={r.answer} busy={null} />}
                  </>
                ) : (
                  <textarea
                    value={chosen}
                    onChange={(e) => setAnswer(i, e.target.value)}
                    rows={Math.min(14, Math.max(3, q.marks + 1))}
                    aria-label={`Answer to question ${i + 1}`}
                    className="field mt-3 w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-sm leading-relaxed text-primary outline-none focus:border-[var(--accent)]"
                  />
                )}
              </li>
            );
          })}
        </ol>
        {!finished && (
          <div className="mt-5 flex justify-end">
            <Button variant="primary" disabled={Boolean(progress)} onClick={() => void finish()}>
              {progress ? "Marking…" : "Finish and mark"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** How many marks a paper of this length carries, for the buttons. */
export const paperMarks = marksFor;
export type { Tab as TopicTab };
export { allTopics };
