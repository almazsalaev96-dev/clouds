/**
 * Nothing generated reaches a student unchecked.
 *
 * A generated question is a promise that it has an answer, that the answer is the one
 * given, and that the question asks for it unambiguously. A model is good at writing
 * questions and bad at noticing when it has written an impossible one, so each
 * generated question is put through the same grader that will later mark it — if the
 * grader cannot confirm the stated answer, the question is rejected before anyone sees it.
 */

import { grade } from "../grading/grade.ts";
import { tryParse } from "../grading/parse.ts";

export interface GeneratedQuestionValue {
  prompt: string;
  answerShape: string;
  acceptableAnswers: string[];
  unit?: string;
  significantFigures?: number;
  workedSolution: string[];
  conceptIds: string[];
  difficulty: string;
  marks: number;
}

export interface QuestionProblem {
  code:
    | "unparseableAnswer" | "answersDisagree" | "emptyPrompt" | "noSolution"
    | "answerInPrompt" | "duplicate" | "ambiguousPlaceholder" | "unitMissing";
  detail: string;
}

export interface ValidatedQuestion {
  question: GeneratedQuestionValue;
  ok: boolean;
  problems: QuestionProblem[];
}

const PLACEHOLDER = /\[(?:insert|choose|value|number|answer|todo|xx+)\]|\.\.\.\s*\?|<[a-z ]+>/i;

export function validateQuestion(
  q: GeneratedQuestionValue,
  seenPrompts: ReadonlySet<string> = new Set(),
): ValidatedQuestion {
  const problems: QuestionProblem[] = [];

  if (q.prompt.trim().length < 5) {
    problems.push({ code: "emptyPrompt", detail: "The question has no readable prompt." });
  }
  if (PLACEHOLDER.test(q.prompt)) {
    problems.push({
      code: "ambiguousPlaceholder",
      detail: "The prompt still contains a placeholder rather than a real value.",
    });
  }
  if (q.workedSolution.length === 0) {
    problems.push({ code: "noSolution", detail: "There is no worked solution to check against." });
  }
  if (seenPrompts.has(normalisePrompt(q.prompt))) {
    problems.push({ code: "duplicate", detail: "This repeats a question already in the set." });
  }

  const shape = q.answerShape;
  const checkable = shape !== "text" && shape !== "boolean";

  if (checkable) {
    // Every acceptable answer must parse, or marking will abstain on a correct student.
    for (const answer of q.acceptableAnswers) {
      if (!tryParse(stripUnit(answer)).ok) {
        problems.push({
          code: "unparseableAnswer",
          detail: `The stated answer ${JSON.stringify(answer)} cannot be read by the marker.`,
        });
      }
    }

    // Every acceptable answer must agree with the first one, or the question has two
    // different "right" answers and will mark inconsistently.
    const [primary, ...rest] = q.acceptableAnswers;
    if (primary) {
      for (const alt of rest) {
        const r = grade(alt, [{
          text: primary, shape: shape as never,
          ...(q.unit ? { unit: q.unit } : {}),
        }]);
        if (r.verdict === "incorrect") {
          problems.push({
            code: "answersDisagree",
            detail: `"${alt}" and "${primary}" are both listed as correct but are not equal.`,
          });
        }
      }
    }
  }

  if ((shape === "quantity" || q.unit) && q.acceptableAnswers.every((a) => !/[a-zA-Z°Ω]/.test(a))) {
    problems.push({
      code: "unitMissing",
      detail: "The question expects a unit but no acceptable answer carries one.",
    });
  }

  // A prompt that already states its answer teaches nothing.
  for (const answer of q.acceptableAnswers) {
    const a = answer.trim();
    if (a.length >= 3 && q.prompt.includes(a) && !/^[0-9]$/.test(a)) {
      problems.push({
        code: "answerInPrompt",
        detail: `The prompt contains the answer ${JSON.stringify(a)}.`,
      });
      break;
    }
  }

  return { question: q, ok: problems.length === 0, problems };
}

export function validateSet(questions: readonly GeneratedQuestionValue[]): {
  accepted: GeneratedQuestionValue[];
  rejected: ValidatedQuestion[];
} {
  const seen = new Set<string>();
  const accepted: GeneratedQuestionValue[] = [];
  const rejected: ValidatedQuestion[] = [];
  for (const q of questions) {
    const result = validateQuestion(q, seen);
    if (result.ok) {
      accepted.push(q);
      seen.add(normalisePrompt(q.prompt));
    } else {
      rejected.push(result);
    }
  }
  return { accepted, rejected };
}

function normalisePrompt(p: string): string {
  return p.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s+\-*/^=().]/g, "").trim();
}

function stripUnit(answer: string): string {
  const m = /^(.*?)[\s]*[A-Za-zµ°Ω][A-Za-zµ°Ω0-9^/*\-.()\s]*$/.exec(answer.trim());
  return m && m[1]!.trim() ? m[1]!.trim() : answer;
}
