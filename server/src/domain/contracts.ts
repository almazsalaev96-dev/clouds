/**
 * Every AI task the product performs, declared as a contract.
 *
 * Nothing reaches the app as free-form prose. A tutor reply is a typed object with a
 * mode, a confidence and a next action, so the interface can render a hint differently
 * from a full solution and can show uncertainty honestly instead of hiding it in a
 * paragraph.
 */

import { S, type Schema } from "./schema.ts";

export const ASSISTANCE_LEVELS = ["none", "nudge", "hint", "guided", "worked", "solution"] as const;
export const ERROR_TYPES = [
  "knowledgeGap", "misconception", "procedural", "calculation", "reading",
  "interpretation", "application", "reasoningGap", "examTechnique", "careless",
  "timeManagement", "unreadable", "unknown",
] as const;
export const TUTOR_MODES = [
  "nudge", "hint", "explain", "steps", "check", "solve", "teach", "simplify",
  "example", "quiz",
] as const;
export const VERDICTS = ["correct", "partiallyCorrect", "incorrect", "unclear"] as const;
export const ANSWER_SHAPES = [
  "number", "quantity", "expression", "equation", "set", "boolean", "text",
] as const;

export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];
export type ErrorTypeName = (typeof ERROR_TYPES)[number];
export type TutorMode = (typeof TUTOR_MODES)[number];

/** Shared: what the tutor thinks should happen next, so the UI can offer exactly that. */
const nextAction = S.object({
  kind: S.enum([
    "tryAgain", "tryTheFirstStep", "askAQuestion", "showWorkedExample",
    "practiseSimilar", "moveOn", "reviewPrerequisite", "none",
  ]),
  label: S.string({ maxLength: 60, description: "Button text, imperative, no exclamation marks." }),
  conceptId: S.optional(S.string({ maxLength: 120 })),
}, ["kind", "label"]);

export const TutorReply: Schema = S.object({
  mode: S.enum(TUTOR_MODES),
  message: S.string({
    minLength: 1, maxLength: 1200,
    description:
      "Plain, specific, second person. Name what is right before what is wrong. " +
      "No praise adjectives, no exclamation marks, no offers of further help.",
  }),
  steps: S.optional(S.array(S.object({
    text: S.string({ maxLength: 400 }),
    isHidden: S.bool("True for steps that should stay collapsed until asked for."),
  }, ["text", "isHidden"]), { maxItems: 12 })),
  confidence: S.number({ min: 0, max: 1, description: "How sure the reply is. Reported, not hidden." }),
  uncertainty: S.optional(S.string({
    maxLength: 300,
    description: "What could not be determined, stated plainly. Empty when nothing is unclear.",
  })),
  conceptIds: S.array(S.string({ maxLength: 120 }), { maxItems: 6 }),
  nextAction,
}, ["mode", "message", "confidence", "conceptIds", "nextAction"]);

export const CheckReply: Schema = S.object({
  verdict: S.enum(VERDICTS),
  /** Where the reasoning first goes wrong, not merely that it does. */
  firstProblemStep: S.optional(S.int({ min: 1, max: 40 })),
  whatIsRight: S.string({ maxLength: 400 }),
  whatToFix: S.string({ maxLength: 400 }),
  errorType: S.enum(ERROR_TYPES),
  errorConfidence: S.number({ min: 0, max: 1 }),
  conceptIds: S.array(S.string({ maxLength: 120 }), { maxItems: 6 }),
  suggestedAssistance: S.enum(ASSISTANCE_LEVELS),
  nextAction,
}, ["verdict", "whatIsRight", "whatToFix", "errorType", "errorConfidence",
    "conceptIds", "suggestedAssistance", "nextAction"]);

export const HandwritingReading: Schema = S.object({
  /** What the strokes say, in the notation the student used. */
  text: S.string({ maxLength: 4000 }),
  confidence: S.number({ min: 0, max: 1 }),
  lines: S.array(S.object({
    text: S.string({ maxLength: 400 }),
    confidence: S.number({ min: 0, max: 1 }),
    isCrossedOut: S.bool(),
  }, ["text", "confidence", "isCrossedOut"]), { maxItems: 60 }),
  /** Named honestly rather than guessed at. */
  unreadable: S.array(S.string({ maxLength: 200 }), { maxItems: 20 }),
  finalAnswer: S.optional(S.string({ maxLength: 400 })),
}, ["text", "confidence", "lines", "unreadable"]);

export const DetectedQuestion: Schema = S.object({
  number: S.string({ maxLength: 20, description: "As printed: '3', '3(b)', 'Q7 (ii)'." }),
  text: S.string({ maxLength: 2000 }),
  marks: S.optional(S.int({ min: 0, max: 100 })),
  answerRegion: S.optional(S.object({
    page: S.int({ min: 0 }),
    x: S.number({ min: 0, max: 1 }), y: S.number({ min: 0, max: 1 }),
    width: S.number({ min: 0, max: 1 }), height: S.number({ min: 0, max: 1 }),
  }, ["page", "x", "y", "width", "height"])),
  conceptIds: S.array(S.string({ maxLength: 120 }), { maxItems: 6 }),
  commandWord: S.optional(S.string({ maxLength: 40 })),
}, ["number", "text", "conceptIds"]);

export const DocumentAnalysis: Schema = S.object({
  title: S.string({ maxLength: 200 }),
  subject: S.string({ maxLength: 60 }),
  documentType: S.enum(["worksheet", "pastPaper", "notes", "textbook", "handout", "unknown"]),
  confidence: S.number({ min: 0, max: 1 }),
  questions: S.array(DetectedQuestion, { maxItems: 200 }),
  figures: S.array(S.object({
    page: S.int({ min: 0 }),
    kind: S.enum(["diagram", "graph", "table", "photo", "equation", "other"]),
    caption: S.string({ maxLength: 300 }),
  }, ["page", "kind", "caption"]), { maxItems: 100 }),
  concepts: S.array(S.object({
    id: S.string({ maxLength: 120 }),
    name: S.string({ maxLength: 120 }),
  }, ["id", "name"]), { maxItems: 60 }),
}, ["title", "subject", "documentType", "confidence", "questions", "figures", "concepts"]);

export const GeneratedQuestion: Schema = S.object({
  prompt: S.string({ minLength: 4, maxLength: 1200 }),
  answerShape: S.enum(ANSWER_SHAPES),
  /** Every acceptable form, so a correct answer written differently is not marked wrong. */
  acceptableAnswers: S.array(S.string({ maxLength: 300 }), { minItems: 1, maxItems: 8 }),
  unit: S.optional(S.string({ maxLength: 40 })),
  significantFigures: S.optional(S.int({ min: 1, max: 10 })),
  workedSolution: S.array(S.string({ maxLength: 400 }), { minItems: 1, maxItems: 15 }),
  conceptIds: S.array(S.string({ maxLength: 120 }), { minItems: 1, maxItems: 6 }),
  difficulty: S.enum(["easy", "medium", "hard", "exam"]),
  marks: S.int({ min: 1, max: 25 }),
  /** Filled only for diagnostics: how each hypothesis would answer this. */
  discriminates: S.optional(S.array(S.object({
    hypothesisId: S.string({ maxLength: 120 }),
    responses: S.array(S.object({
      category: S.string({ maxLength: 60 }),
      probability: S.number({ min: 0, max: 1 }),
    }, ["category", "probability"]), { minItems: 2, maxItems: 6 }),
  }, ["hypothesisId", "responses"]), { maxItems: 8 })),
}, ["prompt", "answerShape", "acceptableAnswers", "workedSolution", "conceptIds",
    "difficulty", "marks"]);

export const QuestionSet: Schema = S.object({
  questions: S.array(GeneratedQuestion, { minItems: 1, maxItems: 20 }),
}, ["questions"]);

export const DiagnosticHypotheses: Schema = S.object({
  hypotheses: S.array(S.object({
    id: S.string({ maxLength: 120 }),
    label: S.string({ maxLength: 160, description: "Written to be shown to a student." }),
    prior: S.number({ min: 0, max: 1 }),
    conceptIds: S.array(S.string({ maxLength: 120 }), { maxItems: 6 }),
  }, ["id", "label", "prior", "conceptIds"]), { minItems: 2, maxItems: 8 }),
}, ["hypotheses"]);

export const ImprovementSuggestions: Schema = S.object({
  /** Suggestions only. The student's words are never replaced without them saying so. */
  suggestions: S.array(S.object({
    kind: S.enum([
      "missingDefinition", "weakExplanation", "noEvidence", "unclearStructure",
      "missingEvaluation", "commandWordIgnored", "missingUnits", "missingWorking",
    ]),
    where: S.string({ maxLength: 200, description: "Quote the student's own words." }),
    why: S.string({ maxLength: 300 }),
    suggestion: S.string({ maxLength: 400 }),
  }, ["kind", "where", "why", "suggestion"]), { maxItems: 10 }),
  strengths: S.array(S.string({ maxLength: 200 }), { maxItems: 5 }),
}, ["suggestions", "strengths"]);

export const FinalReviewFindings: Schema = S.object({
  findings: S.array(S.object({
    kind: S.enum([
      "blankAnswer", "partialAnswer", "unreadable", "strayMark", "pageOutOfOrder",
      "missingPage", "workingOffPage", "duplicatePage",
    ]),
    page: S.int({ min: 0 }),
    questionNumber: S.optional(S.string({ maxLength: 20 })),
    detail: S.string({ maxLength: 300 }),
  }, ["kind", "page", "detail"]), { maxItems: 60 }),
}, ["findings"]);

export const CONTRACTS = {
  TutorReply, CheckReply, HandwritingReading, DocumentAnalysis,
  GeneratedQuestion, QuestionSet, DiagnosticHypotheses,
  ImprovementSuggestions, FinalReviewFindings,
} as const;

export type ContractName = keyof typeof CONTRACTS;
