"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, cx } from "@/components/marketlab/ui/primitives";
import type { Question } from "@/lib/marketlab/learn/lessons";

/**
 * Practice questions.
 *
 * Every question explains its answer whether you got it right or wrong, because
 * the explanation is the teaching and the score is not. Nothing is recorded,
 * nothing is graded, and there is no streak to protect — a student should be
 * able to guess without a cost, which is how you find out what you do not know.
 *
 * These are original questions written for MarketLab. They are not past-paper
 * questions and are not taken from any exam board's materials.
 */
export function Practice({ questions }: { questions: Question[] }) {
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;

  return (
    <Card>
      <CardHeader
        title="Practice"
        description="Original questions written for MarketLab. Nothing is recorded and there is no score to protect — guess freely."
        actions={answered > 0 ? <Badge tone="neutral">{correct} of {answered} right</Badge> : null}
      />
      <CardBody>
        <ol className="space-y-6">
          {questions.map((q, i) => {
            const chosen = answers[i];
            const done = chosen !== undefined;
            return (
              <li key={q.prompt}>
                <p className="ml-body font-medium text-ml-text">
                  <span className="ml-num mr-2 text-ml-text-4">{i + 1}.</span>{q.prompt}
                </p>
                <ul className="mt-3 space-y-2">
                  {q.options.map((opt, j) => {
                    const isAnswer = j === q.answer;
                    const isChosen = chosen === j;
                    return (
                      <li key={opt}>
                        <button
                          type="button"
                          disabled={done}
                          onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                          aria-pressed={isChosen}
                          className={cx(
                            "flex w-full items-start gap-2.5 rounded-ml-sm border px-3.5 py-2.5 text-left text-[0.9375rem] transition-colors",
                            !done && "border-ml-border bg-ml-surface hover:border-ml-border-strong hover:bg-ml-subtle",
                            done && isAnswer && "border-ml-positive bg-ml-positive-subtle text-ml-text",
                            done && isChosen && !isAnswer && "border-ml-negative bg-ml-negative-subtle text-ml-text",
                            done && !isAnswer && !isChosen && "border-ml-border bg-ml-surface text-ml-text-4",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cx(
                              "mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem]",
                              done && isAnswer && "border-ml-positive bg-ml-positive text-white",
                              done && isChosen && !isAnswer && "border-ml-negative bg-ml-negative text-white",
                              (!done || (!isAnswer && !isChosen)) && "border-ml-border-strong text-ml-text-4",
                            )}
                          >
                            {done && isAnswer ? <Check size={11} /> : done && isChosen ? <X size={11} /> : String.fromCharCode(65 + j)}
                          </span>
                          <span className="min-w-0">{opt}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {done ? (
                  <div className="ml-fade-in mt-3 rounded-ml-md border border-ml-border bg-ml-inset px-4 py-3">
                    <p className="ml-label text-ml-text-4">
                      {chosen === q.answer ? "Right" : "The answer is " + String.fromCharCode(65 + q.answer)}
                    </p>
                    <p className="ml-body mt-1 text-ml-text-2">{q.explain}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {answered > 0 ? (
          <div className="mt-6 border-t border-ml-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setAnswers({})}>Clear answers and try again</Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
