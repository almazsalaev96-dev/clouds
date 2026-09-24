"use client";

import * as React from "react";
import { Button } from "@/components/ui/primitives";
import { mark } from "@/lib/grade";
import { clozeQuestion, isCloze, type Card } from "@/lib/study";

/** What a cloze card expects: the words inside the braces, a "c1::" prefix dropped. */
const clozeAnswer = (front: string) =>
  [...front.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].replace(/^c\d+::/, "").trim()).join(", ");
const expectedOf = (c: Card) => (isCloze(c.front) ? clozeAnswer(c.front) : c.back);
const questionOf = (c: Card) => (isCloze(c.front) ? clozeQuestion(c.front) : c.front);
import { cn } from "@/lib/utils";

/**
 * A test: ten questions, typed answers, a score.
 *
 * Flipping a card and pressing "good" is recognition; writing the answer
 * before seeing it is recall, and recall is what the exam asks for. Ten
 * cards — the ones due first, then the rest — each answered in a box,
 * each marked here by the same reader the session uses (`lib/grade`), then
 * the score and the ones that went wrong, with a way to study exactly
 * those. Nothing here touches the schedule: a test is a reading of where
 * you are, not a review.
 */
const SIZE = 10;

export function TestMode({ cards, now, onDone, onReview }: {
  cards: Card[];
  now: number;
  onDone: () => void;
  /** Study these again, in this order. */
  onReview: (cardIds: string[]) => void;
}) {
  const set = React.useMemo(() => {
    const due = cards.filter((c) => c.state !== "new" && c.due <= now);
    const rest = cards.filter((c) => !due.includes(c));
    const shuffled = [...rest].sort(() => Math.random() - 0.5);
    return [...due.sort((a, b) => a.due - b.due), ...shuffled].slice(0, SIZE);
  }, [cards, now]);
  const [i, setI] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [results, setResults] = React.useState<{ card: Card; typed: string; right: boolean; why: string }[]>([]);
  const card = set[i];
  const done = i >= set.length;

  const answer = () => {
    if (!card) return;
    const expected = expectedOf(card);
    const m = mark(typed, expected);
    setResults((r) => [...r, { card, typed, right: m.mark === "right", why: m.why }]);
    setTyped("");
    setI((n) => n + 1);
  };

  if (done) {
    const right = results.filter((r) => r.right).length;
    const wrong = results.filter((r) => !r.right);
    return (
      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-6" aria-label="Test result">
        <p className="text-2xl font-semibold tracking-[-0.02em] text-primary tnum">
          {right} of {results.length}
        </p>
        <p className="mt-1 text-sm text-tertiary">
          {right === results.length ? "Every one. The schedule already knows these; the test is just proof." : wrong.length === 1 ? "One to look at again." : `${wrong.length} to look at again.`}
        </p>
        {wrong.length > 0 && (
          <ul className="mt-4 space-y-2" aria-label="Wrong answers">
            {wrong.map((r) => (
              <li key={r.card.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <p className="text-sm text-primary">{questionOf(r.card)}</p>
                <p className="mt-1 text-xs text-secondary">Expected: {expectedOf(r.card)}</p>
                <p className="text-xs text-tertiary">You wrote: {r.typed.trim() || "nothing"}{r.why ? ` · ${r.why}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {wrong.length > 0 && (
            <Button size="sm" variant="primary" className="bloom" onClick={() => onReview(wrong.map((r) => r.card.id))}>
              Study these {wrong.length === 1 ? "one" : wrong.length} again
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDone}>Back to the deck</Button>
        </div>
      </div>
    );
  }

  const question = questionOf(card);
  return (
    <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-6">
      <p className="tnum text-tiny text-tertiary">Question {i + 1} of {set.length}</p>
      <p className="mt-2 text-lg text-primary">{question}</p>
      <textarea
        autoFocus
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); answer(); } }}
        aria-label="Your answer"
        placeholder="Write the answer, then Enter"
        rows={3}
        className="focus-inset mt-3 w-full resize-none rounded-md border border-line bg-field px-3 py-2 text-sm text-primary outline-none placeholder:text-tertiary focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={answer}>{i + 1 === set.length ? "Finish" : "Next"}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Stop</Button>
        <span className={cn("ml-auto tnum text-tiny text-faint")}>{results.filter((r) => r.right).length} right so far</span>
      </div>
    </div>
  );
}
