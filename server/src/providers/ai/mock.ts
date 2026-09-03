/**
 * A deterministic provider for tests and for running the app with no network.
 *
 * It is not a stub that returns a fixed blob: it produces contract-shaped replies
 * derived from the request, so route tests exercise real validation rather than
 * proving that a constant matches itself.
 */

import { validate } from "../../domain/schema.ts";
import type { AIProvider, AIRequest, AIResult } from "./provider.ts";

export type MockHandler = (request: AIRequest) => unknown;

export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly calls: AIRequest[] = [];
  private handler: MockHandler;

  constructor(handler?: MockHandler) {
    this.handler = handler ?? defaultHandler;
  }

  setHandler(handler: MockHandler): void { this.handler = handler; }

  async complete<T>(request: AIRequest): Promise<AIResult<T>> {
    this.calls.push(request);
    const raw = this.handler(request);
    const checked = validate<T>(request.schema, raw);
    if (!checked.ok) {
      throw new Error(
        `MockProvider produced a reply that violates its own contract: ` +
        checked.issues.map((i) => `${i.path} ${i.message}`).join("; "),
      );
    }
    return {
      value: checked.value,
      usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, model: "mock" },
      repaired: false,
    };
  }
}

function defaultHandler(request: AIRequest): unknown {
  switch (request.task) {
    case "tutor":
      return {
        mode: "hint",
        message: "Your first two lines are right. Look again at how you expanded the bracket.",
        confidence: 0.8,
        conceptIds: ["expanding-brackets"],
        nextAction: { kind: "tryAgain", label: "Try that step again" },
      };
    case "check":
      return {
        verdict: "incorrect",
        whatIsRight: "The method is right and the substitution is correct.",
        whatToFix: "The sign changed between the third and fourth lines.",
        errorType: "calculation",
        errorConfidence: 0.7,
        conceptIds: ["expanding-brackets"],
        suggestedAssistance: "nudge",
        nextAction: { kind: "tryAgain", label: "Check line 3" },
      };
    case "handwriting":
      return {
        text: "x = 4",
        confidence: 0.9,
        lines: [{ text: "x = 4", confidence: 0.9, isCrossedOut: false }],
        unreadable: [],
        finalAnswer: "4",
      };
    case "documentAnalysis":
      return {
        title: "Quadratic Equations", subject: "Mathematics",
        documentType: "worksheet", confidence: 0.85,
        questions: [{ number: "1", text: "Solve x^2 - 5x + 6 = 0", conceptIds: ["quadratics"] }],
        figures: [], concepts: [{ id: "quadratics", name: "Quadratic equations" }],
      };
    case "generate":
      // Two contracts share the generate task: the hypothesis list and the questions.
      // The mock tells them apart the same way the caller does — by what was asked for.
      if (request.prompt.includes("List the distinct reasons")) {
        return {
          hypotheses: [
            { id: "sign", label: "Drops negative signs when expanding",
              prior: 0.4, conceptIds: ["expanding-brackets"] },
            { id: "formula", label: "Reaches for the wrong formula",
              prior: 0.3, conceptIds: ["quadratics"] },
            { id: "arithmetic", label: "Method is right, arithmetic slips",
              prior: 0.3, conceptIds: ["quadratics"] },
          ],
        };
      }
      if (request.prompt.includes("tell these hypotheses apart")) {
        return {
          questions: [{
            prompt: "Expand -(x - 3)^2",
            answerShape: "expression",
            acceptableAnswers: ["-x^2 + 6x - 9", "-(x^2 - 6x + 9)"],
            workedSolution: ["Square the bracket first", "Then apply the minus to all three terms"],
            conceptIds: ["expanding-brackets"], difficulty: "medium", marks: 2,
            discriminates: [
              { hypothesisId: "sign", responses: [
                { category: "correct", probability: 0.1 },
                { category: "signError", probability: 0.8 },
                { category: "other", probability: 0.1 }] },
              { hypothesisId: "formula", responses: [
                { category: "correct", probability: 0.8 },
                { category: "signError", probability: 0.1 },
                { category: "other", probability: 0.1 }] },
              { hypothesisId: "arithmetic", responses: [
                { category: "correct", probability: 0.6 },
                { category: "signError", probability: 0.1 },
                { category: "other", probability: 0.3 }] },
            ],
          }],
        };
      }
      return {
        questions: [{
          prompt: "Solve x^2 - 7x + 12 = 0",
          answerShape: "set",
          acceptableAnswers: ["3, 4", "x = 3, x = 4"],
          workedSolution: ["Factorise to (x - 3)(x - 4) = 0", "So x = 3 or x = 4"],
          conceptIds: ["quadratics"], difficulty: "medium", marks: 3,
        }],
      };
    case "review":
      return { findings: [] };
  }
}
