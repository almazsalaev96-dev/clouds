"use client";

import * as React from "react";
import { CalendarClock, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { logStudyMinutes } from "@/lib/db";
import { dayKey } from "@/lib/study";
import { examLine, type DayPlan } from "@/lib/plan";
import { cn } from "@/lib/utils";

/**
 * Today, at the top of Study.
 *
 * Every line is a thing to do and a press that does it: what is due, the
 * topic slipping most, the page least recently read, the exam and how far
 * off it is. Worked out locally each time the room opens — no model, no
 * network — from the cards, the pages and the record. The reference apps
 * charge for a "study plan" that is a model's guess; this one is the
 * scheduler's own arithmetic, which is what a plan should be.
 */
export function Today({
  plan,
  onPractise,
  onOpenPage,
  exam,
  onSetExam,
}: {
  plan: DayPlan;
  onPractise: (topic: string) => void;
  onOpenPage?: (id: string) => void;
  exam: { name: string; date: string } | null;
  onSetExam: (e: { name: string; date: string } | null) => void;
}) {
  const [settingExam, setSettingExam] = React.useState(false);
  const [name, setName] = React.useState(exam?.name ?? "");
  const [date, setDate] = React.useState(exam?.date ?? "");
  const nothing = plan.due === 0 && !plan.weakTopic && !plan.reread && plan.examDays === null;

  return (
    <section aria-label="Today" className="mb-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-tiny font-medium uppercase tracking-wide text-tertiary">Today</h2>
        {plan.answeredToday > 0 && <span className="tnum text-tiny text-faint">{plan.answeredToday} answered</span>}
        {plan.minutesToday > 0 && <span className="tnum text-tiny text-faint">· {plan.minutesToday} min</span>}
        <span className="ml-auto">
          <SessionTimer />
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {plan.weakTopic && (
          <Row
            onPress={() => onPractise(plan.weakTopic!.topic)}
            label={<>Slipping most: <span className="text-primary">{plan.weakTopic.topic}</span> <span className="tnum text-tertiary">· {Math.round(plan.weakTopic.rate * 100)}%</span></>}
            action="Practise"
          />
        )}
        {plan.reread && onOpenPage && (
          <Row onPress={() => onOpenPage(plan.reread!.id)} label={<>Read again: <span className="text-primary">{plan.reread.title}</span></>} action="Open" />
        )}
        {plan.examDays !== null ? (
          <Row
            onPress={() => setSettingExam((v) => !v)}
            label={<><CalendarClock size={13} className="mr-1 inline -mt-0.5 text-tertiary" />{plan.examName ?? "Exam"} <span className={cn("tnum", plan.examDays <= 7 ? "text-warning" : "text-tertiary")}>· {examLine(plan.examDays)}</span></>}
            action="Change"
          />
        ) : (
          <li>
            <button onClick={() => setSettingExam((v) => !v)} className="focus-inset rounded text-xs text-tertiary underline decoration-[var(--border-strong)] underline-offset-2 hover:text-primary">
              Set the exam date
            </button>
          </li>
        )}
        {nothing && <li className="text-sm text-tertiary">Nothing waiting. Make a deck above, or set the exam date.</li>}
      </ul>
      {settingExam && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            onSetExam({ name: name.trim() || "Exam", date });
            setSettingExam(false);
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Which exam" aria-label="Exam name" className="tap h-9 min-w-0 flex-1 rounded-md border border-line bg-field px-2.5 text-sm text-primary outline-none placeholder:text-tertiary focus:border-accent" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Exam date" className="tap h-9 rounded-md border border-line bg-field px-2.5 text-sm text-primary outline-none focus:border-accent" />
          <Button size="sm" variant="primary" type="submit" disabled={!date}>Keep</Button>
          {exam && <Button size="sm" variant="ghost" type="button" onClick={() => { onSetExam(null); setSettingExam(false); }}>Clear</Button>}
        </form>
      )}
    </section>
  );
}

function Row({ label, action, onPress, primary }: { label: React.ReactNode; action: string; onPress: () => void; primary?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm text-secondary">{label}</span>
      <Button size="sm" variant={primary ? "primary" : "ghost"} className={primary ? "bloom" : undefined} onClick={onPress}>{action}</Button>
    </li>
  );
}

/**
 * A 25-minute session, then 5 off. Minutes are logged to the day when a
 * block ends, so the record can say how long as well as how many — the
 * number the calendar could not show before.
 */
const FOCUS = 25 * 60;
const BREAK = 5 * 60;

export function SessionTimer() {
  const [phase, setPhase] = React.useState<"idle" | "focus" | "break">("idle");
  const [left, setLeft] = React.useState(FOCUS);
  const endsAt = React.useRef<number>(0);

  React.useEffect(() => {
    if (phase === "idle") return;
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        if (phase === "focus") {
          void logStudyMinutes(dayKey(Date.now()), FOCUS / 60);
          setPhase("break");
          endsAt.current = Date.now() + BREAK * 1000;
          setLeft(BREAK);
        } else {
          setPhase("idle");
          setLeft(FOCUS);
        }
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [phase]);

  const start = () => { endsAt.current = Date.now() + FOCUS * 1000; setLeft(FOCUS); setPhase("focus"); };
  const stop = () => {
    /* A block stopped early still counts the minutes it had. */
    if (phase === "focus") {
      const sat = Math.round((FOCUS - left) / 60);
      if (sat >= 1) void logStudyMinutes(dayKey(Date.now()), sat);
    }
    setPhase("idle");
    setLeft(FOCUS);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  if (phase === "idle") {
    return (
      <button onClick={start} aria-label="Start a 25-minute session" className="btn-touch focus-inset flex items-center gap-1.5 rounded-full px-2 text-xs text-tertiary hover:text-primary">
        <Play size={12} /> 25-minute session
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2" role="timer" aria-label={phase === "focus" ? "Session running" : "Break"}>
      <span className={cn("tnum text-sm", phase === "focus" ? "text-primary" : "text-tertiary")}>{mm}:{ss}</span>
      <span className="text-tiny text-tertiary">{phase === "focus" ? "focus" : "break"}</span>
      <button onClick={stop} aria-label="Stop the session" className="focus-inset rounded-full p-1 text-tertiary hover:text-primary"><Square size={12} /></button>
    </span>
  );
}
