"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Commit to an answer before you are shown one.
 *
 * The clearest result in the whole literature on explaining things visually is
 * also the least convenient: *exhibiting* something teaches nobody. Learning
 * appears when the reader is made to do something first — predict, answer,
 * commit — and the size of the effect tracks how much they had to produce,
 * not how good the explanation was. A beautiful, perfectly clear, entirely
 * receptive explanation underperforms a mediocre one that made you guess.
 *
 * Which a chat message physically cannot do. A stream is one pass: the model
 * asks "what do you think happens here?" and then, four lines later and
 * without waiting, tells you. Whatever the stance instructions say, the answer
 * is on screen before the reader has had a thought about it, and reading it is
 * the passive mode the research measures at nothing. The two teaching stances
 * that get around it do so by withholding *across turns*, which costs a round
 * trip and a model call per question.
 *
 * This is the in-message version. The model emits the question, the options
 * and the explanation together, in one stream, and the renderer refuses to
 * show the last part until the reader has chosen. Nothing is sent, nothing is
 * stored; the commitment is entirely local, which is the whole reason it can
 * be instant.
 *
 * ## What it is careful about
 *
 * The explanation is behind `hidden`, not behind a class that hides it, so a
 * screen reader cannot read ahead either — the gate is a real gate or it is
 * theatre. Right and wrong are marked with a glyph as well as a colour, on
 * this app's standing rule that nothing is ever said in colour alone. And on
 * paper the whole thing opens: a printed answer that withholds its own answer
 * is a worksheet nobody can mark.
 */
import { type PredictSpec, parsePredict } from "@/lib/predict";
export { parsePredict };

export function Predict({ spec }: { spec: PredictSpec }) {
  const [chose, setChose] = React.useState<number | null>(null);
  const revealRef = React.useRef<HTMLDivElement>(null);
  const right = chose === spec.answer;

  const pick = (i: number) => {
    if (chose !== null) return;
    setChose(i);
    // Move to the answer rather than announcing it from somewhere else: the
    // reader has just committed and the result is the thing they want next.
    window.setTimeout(() => revealRef.current?.focus(), 30);
  };

  return (
    <div
      data-predict
      className="my-4 rounded-lg border border-line bg-inset px-4 py-3 [box-shadow:var(--rim-sm)]"
    >
      <p className="eyebrow mb-1.5 text-faint">Before you read on</p>
      <p className="text-base text-primary">{spec.q}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={spec.q}>
        {spec.options.map((opt, i) => {
          const picked = chose === i;
          const correct = i === spec.answer;
          const settled = chose !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={settled}
              aria-pressed={picked}
              className={cn(
                "ctl-h press focus-inset flex items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-[var(--dur-fast)]",
                !settled && "border-line-strong bg-surface text-primary hover:bg-subtle",
                // Nothing is ever said in colour alone here: the glyph carries
                // it, and the colour agrees with the glyph.
                settled && correct && "border-[var(--go)] text-[var(--go)]",
                settled && !correct && picked && "border-[var(--stop)] text-[var(--stop)]",
                settled && !correct && !picked && "border-line text-tertiary opacity-60",
                settled && "disabled:opacity-100",
              )}
            >
              {settled && correct && <Check size={13} aria-hidden />}
              {settled && !correct && picked && <X size={13} aria-hidden />}
              {opt}
            </button>
          );
        })}
      </div>

      {/* `hidden`, not a class that hides it. A gate a screen reader can read
          past is not a gate — and the reason to commit is that the answer is
          genuinely not available yet. */}
      <div
        ref={revealRef}
        hidden={chose === null}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="mt-2.5 border-t border-line pt-2.5 text-sm text-secondary outline-none"
      >
        <span className={cn("font-medium", right ? "text-[var(--go)]" : "text-[var(--stop)]")}>
          {right ? "Right." : `Not quite — it is ${spec.options[spec.answer]}.`}
        </span>{" "}
        {spec.why}
      </div>
    </div>
  );
}
