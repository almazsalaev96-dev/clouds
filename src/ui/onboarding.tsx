"use client";

/**
 * Onboarding.
 *
 * Four questions, then a working plan. Everything else — diagnostic testing,
 * confidence by topic, previous results, study times — is offered later, in
 * context, once the student has seen the product do something for them.
 *
 * The design constraint: a student must reach a personalised first session in
 * under a minute. Every additional question asked up front is paid for by
 * students who never finish.
 */

import { useMemo, useState } from "react";
import { useContent, useStore } from "@/store/provider";
import { Callout, Card } from "./components";
import type { SubjectEnrolment } from "@/store/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Onboarding() {
  const bundle = useContent();
  const { update } = useStore();
  const [step, setStep] = useState(0);
  const [syllabusId, setSyllabusId] = useState(bundle.syllabuses[0]?.id ?? "");
  const [stage, setStage] = useState<SubjectEnrolment["stage"]>("a-level");
  const [targetGrade, setTargetGrade] = useState("A");
  const [examDate, setExamDate] = useState("");
  const [weeklyMinutes, setWeeklyMinutes] = useState<number[]>([30, 45, 45, 45, 45, 45, 60]);

  const syllabus = bundle.syllabuses.find((s) => s.id === syllabusId);
  const pack = bundle.packs.find((p) => p.manifest.id === (syllabus as { packId?: string } | undefined)?.packId);
  const gradeScale = pack?.manifest.qualification.gradeScale ?? ["A*", "A", "B", "C", "D", "E"];

  const weeklyHours = useMemo(
    () => (weeklyMinutes.reduce((s, m) => s + m, 0) / 60).toFixed(1),
    [weeklyMinutes],
  );

  if (bundle.syllabuses.length === 0) {
    return (
      <div className="stack loose" style={{ maxWidth: 640 }}>
        <div>
          <p className="eyebrow">Lodestar</p>
          <h1>No subject material is loaded yet</h1>
          <p className="lede">
            Lodestar is the engine; the syllabus content is supplied as packs. Drop a pack into{" "}
            <code>content/</code> and it appears here automatically.
          </p>
        </div>
        <Callout kind="info" title="How to add a subject">
          See <code>docs/AUTHORING.md</code> for the format. The shortest possible pack is a{" "}
          <code>pack.yaml</code> and a <code>syllabus.yaml</code> with a list of topics — questions,
          lessons and flashcards can be added afterwards, and everything degrades gracefully until
          they are.
        </Callout>
      </div>
    );
  }

  const finish = () => {
    const now = new Date().toISOString();
    const enrolment: SubjectEnrolment = {
      syllabusId,
      packId: (syllabus as { packId?: string } | undefined)?.packId ?? "",
      stage,
      targetGrade,
      examDate: examDate || undefined,
      addedAt: now,
    };
    update((s) => ({
      ...s,
      profile: {
        ...s.profile,
        weeklyMinutes,
        subjects: [...s.profile.subjects, enrolment],
        onboardedAt: s.profile.onboardedAt ?? now,
      },
    }));
  };

  return (
    <div className="stack loose" style={{ maxWidth: 660 }}>
      <div>
        <p className="eyebrow">Setting up · step {step + 1} of 4</p>
        <h1>{["What are you studying?", "How far are you going?", "When is the exam?", "How much time do you have?"][step]}</h1>
      </div>

      {step === 0 && (
        <Card>
          <div className="stack">
            {bundle.syllabuses.map((s) => (
              <button
                key={s.id}
                className="choice"
                data-selected={syllabusId === s.id}
                onClick={() => setSyllabusId(s.id)}
              >
                <span className="choice-key">{s.code.slice(0, 2)}</span>
                <span>
                  <strong>{s.subject}</strong>{" "}
                  <span className="muted small">
                    {s.code} · {s.version.label}
                  </span>
                  <br />
                  <span className="small muted">{s.title}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="stack">
            <div className="field">
              <label>Which qualification are you sitting?</label>
              <div className="stack tight">
                {(
                  [
                    { id: "as", label: "AS Level only", blurb: "AS papers only. A Level extension topics are hidden." },
                    { id: "a-level", label: "Full A Level", blurb: "Everything, including the A Level extension." },
                    { id: "igcse", label: "IGCSE", blurb: "IGCSE papers and content." },
                  ] as const
                ).map((o) => (
                  <button key={o.id} className="choice" data-selected={stage === o.id} onClick={() => setStage(o.id)}>
                    <span>
                      <strong>{o.label}</strong>
                      <br />
                      <span className="small muted">{o.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="target">Target grade</label>
              <p className="hint">
                This sets the mastery bar every recommendation is measured against. Aim high — it costs
                nothing and it changes what gets prioritised.
              </p>
              <div className="btn-group" id="target">
                {gradeScale.slice(0, 6).map((g) => (
                  <button key={g} className={`btn ${targetGrade === g ? "primary" : ""}`} onClick={() => setTargetGrade(g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div className="stack">
            <div className="field">
              <label htmlFor="date">Exam date</label>
              <p className="hint">
                Everything is scheduled backwards from this. Without it, nothing can be prioritised by
                urgency and review intervals cannot be compressed to land before the paper.
              </p>
              <input id="date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            {!examDate && (
              <Callout kind="warn">
                You can skip this, and Lodestar will still work — but the plan will be materially less
                useful, and the scheduler may put a review after your exam.
              </Callout>
            )}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <div className="stack">
            <p className="small muted">
              Be honest rather than aspirational. The plan is built from these numbers, and a plan built
              from a fantasy is abandoned in week two.
            </p>
            {WEEKDAYS.map((d, i) => (
              <div key={d} style={{ display: "grid", gridTemplateColumns: "44px 1fr 66px", gap: 12, alignItems: "center" }}>
                <span className="small muted">{d}</span>
                <input
                  type="range"
                  min={0}
                  max={240}
                  step={15}
                  value={weeklyMinutes[i]}
                  onChange={(e) => {
                    const next = [...weeklyMinutes];
                    next[i] = Number(e.target.value);
                    setWeeklyMinutes(next);
                  }}
                  aria-label={`Minutes available on ${d}`}
                />
                <span className="num small" style={{ textAlign: "right" }}>
                  {weeklyMinutes[i] === 0 ? "rest" : `${weeklyMinutes[i]}m`}
                </span>
              </div>
            ))}
            <p className="small muted">
              That is <strong className="num">{weeklyHours}</strong> hours a week. Days set to zero are
              treated as rest, not as failure.
            </p>
          </div>
        </Card>
      )}

      <div className="row">
        {step > 0 && (
          <button className="btn" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        <div className="spacer" />
        {step < 3 ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)} disabled={!syllabusId}>
            Continue
          </button>
        ) : (
          <button className="btn primary large" onClick={finish}>
            Build my plan
          </button>
        )}
      </div>
    </div>
  );
}
