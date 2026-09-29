"use client";

import * as React from "react";
import { GraduationCap, Pencil, X } from "lucide-react";
import { useSettings, type Learner } from "@/lib/store";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STAGES: { id: Learner["stage"]; name: string; levels: string[]; boards: string[] }[] = [
  { id: "school", name: "School exams", levels: ["GCSE", "IGCSE", "A level", "AS level", "IB", "AP", "Highers", "National exam"], boards: ["AQA", "Edexcel", "OCR", "WJEC", "Cambridge", "IB", "College Board", "SQA"] },
  { id: "university", name: "University", levels: ["Foundation", "Year 1", "Year 2", "Year 3", "Master's", "PhD"], boards: [] },
  { id: "other", name: "Something else", levels: ["IELTS", "TOEFL", "Professional exam", "Self-study"], boards: [] },
];

const HIDE_KEY = "armi.learner.later";

/**
 * Who is studying, and for what — asked once, in a line, and then used by
 * everything that writes for them: the Studio's brief, a new course, and
 * the chat, which pitches every answer at their level and board.
 */
export function LearnerCard() {
  const learner = useSettings((s) => s.learner);
  const setLearner = useSettings((s) => s.setLearner);
  const [editing, setEditing] = React.useState(false);
  const [later, setLater] = React.useState(() => {
    try { return sessionStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
  });

  if (learner && !editing) {
    const bits = [learner.level, learner.board, learner.subjects].filter((b) => b.trim());
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm" aria-label="Your studies">
        <GraduationCap size={16} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-secondary">
          {bits.join(" · ") || "Your studies"}
          {learner.target.trim() && <span className="text-tertiary"> · aiming for {learner.target.trim()}</span>}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Change your studies"><Pencil size={13} /></Button>
      </div>
    );
  }
  if (!learner && later && !editing) return null;
  return (
    <LearnerForm
      initial={learner}
      onSave={(l) => { setLearner(l); setEditing(false); }}
      onClose={() => {
        setEditing(false);
        if (!learner) {
          setLater(true);
          try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* fine */ }
        }
      }}
    />
  );
}

function LearnerForm({ initial, onSave, onClose }: { initial: Learner | null; onSave: (l: Learner) => void; onClose: () => void }) {
  const [stage, setStage] = React.useState<Learner["stage"]>(initial?.stage ?? "school");
  const [level, setLevel] = React.useState(initial?.level ?? "");
  const [board, setBoard] = React.useState(initial?.board ?? "");
  const [subjects, setSubjects] = React.useState(initial?.subjects ?? "");
  const [target, setTarget] = React.useState(initial?.target ?? "");
  const s = STAGES.find((x) => x.id === stage) ?? STAGES[0];
  const field = "field mt-1 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]";
  const chip = (on: boolean) => cn("btn-touch focus-ring rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-transparent bg-cta text-cta-fg" : "border-line text-secondary hover:bg-subtle");

  return (
    <section aria-label="What are you studying for?" className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="shrink-0 text-accent" aria-hidden />
        <h2 className="flex-1 text-base font-medium text-primary">What are you studying for?</h2>
        <button onClick={onClose} aria-label={initial ? "Close" : "Not now"} className="ctl focus-inset flex [--ctl:1.75rem] items-center justify-center rounded-md text-tertiary hover:bg-subtle hover:text-primary"><X size={14} /></button>
      </div>
      <p className="mt-1 text-xs text-tertiary">Every note, card, question and answer is then pitched at it.</p>

      <div role="radiogroup" aria-label="Stage" className="mt-3 flex flex-wrap gap-1.5">
        {STAGES.map((x) => (
          <button key={x.id} role="radio" aria-checked={stage === x.id} onClick={() => setStage(x.id)} className={chip(stage === x.id)}>{x.name}</button>
        ))}
      </div>

      <label className="mt-3 block text-xs font-medium text-secondary" htmlFor="learner-level">{stage === "university" ? "Course and year" : "Level"}</label>
      <input id="learner-level" value={level} onChange={(e) => setLevel(e.target.value)} className={field} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {s.levels.map((l) => <button key={l} onClick={() => setLevel(l)} className={chip(level === l)}>{l}</button>)}
      </div>

      <label className="mt-3 block text-xs font-medium text-secondary" htmlFor="learner-board">{stage === "university" ? "University and module" : "Exam board"}</label>
      <input id="learner-board" value={board} onChange={(e) => setBoard(e.target.value)} className={field} />
      {s.boards.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {s.boards.map((b) => <button key={b} onClick={() => setBoard(b)} className={chip(board === b)}>{b}</button>)}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-secondary">
          Subjects
          <input value={subjects} onChange={(e) => setSubjects(e.target.value)} aria-label="Subjects" className={field} />
        </label>
        <label className="block text-xs font-medium text-secondary">
          Aiming for
          <input value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Aiming for" className={field} />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="primary" disabled={!level.trim() && !subjects.trim()} onClick={() => onSave({ stage, level: level.trim(), board: board.trim(), subjects: subjects.trim(), target: target.trim() })}>Save</Button>
        <Button variant="ghost" onClick={onClose}>{initial ? "Cancel" : "Not now"}</Button>
      </div>
    </section>
  );
}
