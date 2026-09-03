/**
 * The gateway's routes.
 *
 * Handlers take a Web `Request` and return a Web `Response`, so the whole surface is
 * testable by calling a function — no sockets, no ports, no waiting.
 */

import { randomUUID } from "node:crypto";
import type { Config } from "../config.ts";
import { assemble, ContextTooLarge, type ContextPart } from "../context/budget.ts";
import { redact } from "../context/redact.ts";
import {
  CheckReply, DiagnosticHypotheses, DocumentAnalysis, FinalReviewFindings,
  HandwritingReading, ImprovementSuggestions, QuestionSet, TutorReply,
} from "../domain/contracts.ts";
import { SYSTEM_PROMPTS } from "../domain/prompts.ts";
import {
  validateDiagnostic, type DiagnosticQuestion, type Hypothesis,
} from "../generation/diagnostic.ts";
import { validateSet, type GeneratedQuestionValue } from "../generation/validate.ts";
import { grade, type ExpectedAnswer } from "../grading/grade.ts";
import { enrich, reconcile, type ModelJudgement } from "../grading/reconcile.ts";
import { AIRefusal, AIUnavailable, type AIProvider, type ImagePart } from "../providers/ai/provider.ts";
import { VoiceUnavailable, type VoiceProvider } from "../providers/voice/provider.ts";
import { authenticate } from "../security/auth.ts";
import { RateLimiter } from "../security/rateLimit.ts";
import { Logger } from "../util/log.ts";
import { badRequest, HttpError, MESSAGES, toResponse } from "./errors.ts";

export interface AppDeps {
  config: Config;
  ai: AIProvider;
  voice: VoiceProvider;
  logger?: Logger;
}

export interface App {
  handle(request: Request, remoteAddress?: string): Promise<Response>;
  readonly limiter: RateLimiter;
}

const json = (body: unknown, status = 200, requestId = ""): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });

export function createApp(deps: AppDeps): App {
  const { config, ai, voice } = deps;
  const log = deps.logger ?? new Logger(config.logLevel);
  const limiter = new RateLimiter(config.requestsPerMinute);

  async function body<T>(request: Request): Promise<T> {
    const raw = await request.text();
    if (raw.length > config.maxContextBytes * 3) {
      throw new HttpError(413, "tooLarge", MESSAGES.tooLarge);
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw badRequest("the body was not valid JSON");
    }
  }

  /**
   * Assemble, redact, budget. Every model-facing route funnels through here, so no
   * route can accidentally ship a whole document or a student's name.
   */
  function buildContext(parts: ContextPart[], redactTerms: string[] = []): string {
    const cleaned = parts.map((p) => ({ ...p, text: redact(p.text, redactTerms).text }));
    try {
      const built = assemble(cleaned, config.maxContextBytes);
      log.debug("context assembled", {
        bytes: built.bytes, included: built.included,
        dropped: built.dropped, truncated: built.truncated,
      });
      return built.text;
    } catch (e) {
      if (e instanceof ContextTooLarge) throw new HttpError(413, "tooLarge", MESSAGES.tooLarge);
      throw e;
    }
  }

  function images(input: unknown): ImagePart[] {
    if (!Array.isArray(input)) return [];
    return input.slice(0, 6).map((raw) => {
      const i = raw as { mediaType?: string; data?: string };
      if (typeof i.data !== "string" || !i.data) throw badRequest("an image had no data");
      const mediaType = i.mediaType === "image/jpeg" || i.mediaType === "image/webp"
        ? i.mediaType : "image/png";
      return { mediaType, data: i.data } as ImagePart;
    });
  }

  const routes: Record<string, (request: Request, requestId: string) => Promise<Response>> = {
    "POST /v1/grade": async (request, requestId) => {
      // Deterministic only. No model, no cost, no network beyond this hop — the app
      // calls this the instant a student taps Check, and shows the verdict while the
      // teaching half is still being written.
      const b = await body<{ submitted?: string; expected?: ExpectedAnswer[] }>(request);
      if (typeof b.submitted !== "string") throw badRequest("submitted must be a string");
      if (!Array.isArray(b.expected)) throw badRequest("expected must be an array");
      return json({ grade: grade(b.submitted, b.expected) }, 200, requestId);
    },

    "POST /v1/check": async (request, requestId) => {
      const b = await body<{
        submitted?: string;
        expected?: ExpectedAnswer[];
        questionText?: string;
        workingText?: string;
        previousAttempts?: string[];
        conceptIds?: string[];
        subject?: string;
        redactTerms?: string[];
        images?: unknown;
      }>(request);

      if (typeof b.submitted !== "string") throw badRequest("submitted must be a string");
      const expected = Array.isArray(b.expected) ? b.expected : [];
      const graderResult = grade(b.submitted, expected);

      const context = buildContext([
        { kind: "focus", label: "The answer being checked", text: b.submitted },
        { kind: "questionText", label: "The question", text: b.questionText ?? "" },
        { kind: "studentWork", label: "The student's working", text: b.workingText ?? "" },
        {
          kind: "attemptHistory", label: "Earlier attempts at this question",
          text: (b.previousAttempts ?? []).join("\n---\n"),
        },
        {
          kind: "masteryHints", label: "What the marker already decided",
          text: graderResult.verdict === "abstain"
            ? "The marker could not decide this by arithmetic; you are the only judge."
            : `Verdict: ${graderResult.verdict} (${graderResult.reason}).` +
              (graderResult.nearMiss ? ` How it missed: ${graderResult.nearMiss.detail}` : ""),
        },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ], b.redactTerms ?? []);

      const model = await ai.complete<ModelJudgement>({
        task: "check", system: SYSTEM_PROMPTS.check, prompt: context,
        schema: CheckReply, images: images(b.images),
      });

      const reconciled = enrich(reconcile(graderResult, model.value), graderResult);
      if (reconciled.modelOverruled) {
        log.warn("grader overruled the model", {
          graderVerdict: graderResult.verdict, modelVerdict: model.value.verdict,
        });
      }
      return json({ check: reconciled, grade: graderResult, usage: model.usage }, 200, requestId);
    },

    "POST /v1/tutor": async (request, requestId) => {
      const b = await body<{
        ask?: string;
        mode?: string;
        selection?: string;
        questionText?: string;
        workingText?: string;
        pageText?: string;
        neighbouringText?: string;
        figures?: string;
        conversation?: string[];
        previousAttempts?: string[];
        masteryHints?: string;
        subject?: string;
        redactTerms?: string[];
        images?: unknown;
      }>(request);

      if (typeof b.ask !== "string" || !b.ask.trim()) throw badRequest("ask must be a non-empty string");

      // The whole point of the Context Engine: "why?" with nothing selected still has
      // an antecedent, because the page, the question and the student's own working
      // are already here.
      const context = buildContext([
        {
          kind: "focus", label: "What the student asked",
          text: `${b.ask}${b.mode ? `\n(they tapped: ${b.mode})` : ""}` +
                (b.selection ? `\n\nThey have selected:\n${b.selection}` : ""),
        },
        { kind: "questionText", label: "The question they are on", text: b.questionText ?? "" },
        { kind: "studentWork", label: "What they have written so far", text: b.workingText ?? "" },
        {
          kind: "attemptHistory", label: "Their earlier attempts",
          text: (b.previousAttempts ?? []).join("\n---\n"),
        },
        { kind: "conversation", label: "Recent conversation", text: (b.conversation ?? []).join("\n") },
        { kind: "pageText", label: "The rest of this page", text: b.pageText ?? "" },
        { kind: "figures", label: "Figures on this page", text: b.figures ?? "" },
        { kind: "neighbouringPages", label: "Nearby pages", text: b.neighbouringText ?? "" },
        {
          kind: "masteryHints", label: "What this student has shown before",
          text: b.masteryHints ?? "",
        },
      ], b.redactTerms ?? []);

      const reply = await ai.complete({
        task: "tutor", system: SYSTEM_PROMPTS.tutor, prompt: context,
        schema: TutorReply, images: images(b.images),
      });
      return json({ reply: reply.value, usage: reply.usage }, 200, requestId);
    },

    "POST /v1/handwriting": async (request, requestId) => {
      const b = await body<{ images?: unknown; questionText?: string; subject?: string }>(request);
      const parts = images(b.images);
      if (parts.length === 0) throw badRequest("at least one image is required");

      const context = buildContext([
        {
          kind: "focus", label: "Task",
          text: "Transcribe the handwriting in the image. Mark crossed-out work. " +
                "Do not resolve ambiguous characters in the direction that makes the answer right.",
        },
        { kind: "questionText", label: "The question this answers", text: b.questionText ?? "" },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ]);

      const result = await ai.complete({
        task: "handwriting", system: SYSTEM_PROMPTS.handwriting, prompt: context,
        schema: HandwritingReading, images: parts,
      });
      return json({ reading: result.value, usage: result.usage }, 200, requestId);
    },

    "POST /v1/document": async (request, requestId) => {
      const b = await body<{ text?: string; images?: unknown; filename?: string }>(request);
      const context = buildContext([
        { kind: "focus", label: "Document", text: b.filename ?? "imported document" },
        { kind: "pageText", label: "Extracted text", text: b.text ?? "" },
      ]);
      const result = await ai.complete({
        task: "documentAnalysis", system: SYSTEM_PROMPTS.documentAnalysis, prompt: context,
        schema: DocumentAnalysis, images: images(b.images),
      });
      return json({ analysis: result.value, usage: result.usage }, 200, requestId);
    },

    "POST /v1/generate": async (request, requestId) => {
      const b = await body<{
        conceptIds?: string[]; subject?: string; count?: number;
        difficulty?: string; basedOn?: string; hypotheses?: unknown; purpose?: string;
      }>(request);

      const count = Math.max(1, Math.min(10, Number(b.count) || 3));
      const context = buildContext([
        {
          kind: "focus", label: "What to write",
          text: `Write ${count} ${b.purpose === "diagnostic" ? "diagnostic" : "practice"} ` +
                `question(s) at ${b.difficulty ?? "medium"} difficulty on: ` +
                `${(b.conceptIds ?? []).join(", ") || "the material below"}.`,
        },
        { kind: "questionText", label: "Modelled on this question", text: b.basedOn ?? "" },
        {
          kind: "masteryHints", label: "Hypotheses these questions must tell apart",
          text: Array.isArray(b.hypotheses) ? JSON.stringify(b.hypotheses, null, 2) : "",
        },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ]);

      const result = await ai.complete<{ questions: GeneratedQuestionValue[] }>({
        task: "generate", system: SYSTEM_PROMPTS.generate, prompt: context, schema: QuestionSet,
      });

      // Nothing generated reaches a student unchecked: every stated answer is put
      // through the same marker that will grade it.
      const { accepted, rejected } = validateSet(result.value.questions);
      if (rejected.length) {
        log.warn("generated questions rejected", {
          accepted: accepted.length, rejected: rejected.length,
          codes: rejected.flatMap((r) => r.problems.map((p) => p.code)),
        });
      }
      if (accepted.length === 0) {
        throw new HttpError(502, "tutorUnavailable",
          "Could not write questions that check out. Nothing unverified is shown.");
      }
      return json({
        questions: accepted,
        rejected: rejected.map((r) => ({ prompt: r.question.prompt, problems: r.problems })),
        usage: result.usage,
      }, 200, requestId);
    },

    "POST /v1/diagnose": async (request, requestId) => {
      const b = await body<{
        conceptIds?: string[]; subject?: string; recentErrors?: string[];
        wrongAnswers?: string[]; count?: number;
      }>(request);

      const concepts = (b.conceptIds ?? []).join(", ");
      if (!concepts) throw badRequest("conceptIds must name at least one concept");
      const count = Math.max(2, Math.min(6, Number(b.count) || 4));

      // Two calls, in this order, because the second depends on the first: you cannot
      // write a question that tells hypotheses apart before you have the hypotheses.
      const hypothesisContext = buildContext([
        {
          kind: "focus", label: "What to explain",
          text: `A student keeps going wrong on: ${concepts}. List the distinct reasons ` +
                `this could be happening. Make them mutually exclusive and worth telling ` +
                `apart — two hypotheses that imply the same lesson are one hypothesis.`,
        },
        {
          kind: "attemptHistory", label: "What they actually wrote",
          text: (b.wrongAnswers ?? []).join("\n---\n"),
        },
        {
          kind: "masteryHints", label: "Error types already seen",
          text: (b.recentErrors ?? []).join(", "),
        },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ]);

      const hypotheses = await ai.complete<{ hypotheses: Hypothesis[] }>({
        task: "generate", system: SYSTEM_PROMPTS.generate,
        prompt: hypothesisContext, schema: DiagnosticHypotheses,
      });

      const questionContext = buildContext([
        {
          kind: "focus", label: "What to write",
          text: `Write ${count} short questions that tell these hypotheses apart. For each ` +
                `question, give the probability of each response category under each ` +
                `hypothesis in "discriminates". A question every hypothesis answers the ` +
                `same way is worthless and will be rejected.`,
        },
        {
          kind: "questionText", label: "The hypotheses",
          text: JSON.stringify(hypotheses.value.hypotheses, null, 2),
        },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ]);

      const generated = await ai.complete<{ questions: DiagnosticQuestion[] }>({
        task: "generate", system: SYSTEM_PROMPTS.generate,
        prompt: questionContext, schema: QuestionSet,
      });

      // Two gates. The marker must be able to grade every question, and the questions
      // must actually discriminate — measured in bits, not asserted.
      const marked = validateSet(generated.value.questions as unknown as GeneratedQuestionValue[]);
      const gradeable = generated.value.questions.filter((q) =>
        marked.accepted.some((a) => a.prompt === q.prompt));

      const result = validateDiagnostic(hypotheses.value.hypotheses, gradeable);
      if (!result.ok) {
        log.warn("diagnostic rejected", {
          rejected: result.rejected.length,
          codes: result.rejected.flatMap((r) => r.problems.map((p) => p.code)),
        });
        throw new HttpError(502, "tutorUnavailable",
          "Could not write questions that would actually tell the possibilities apart. " +
          "Nothing that cannot discriminate is shown.");
      }

      return json({
        hypotheses: result.hypotheses,
        questions: result.questions,
        priorEntropyBits: result.priorEntropyBits,
        bestQuestionBits: result.bestQuestionBits,
        rejected: result.rejected,
        usage: {
          inputTokens: hypotheses.usage.inputTokens + generated.usage.inputTokens,
          outputTokens: hypotheses.usage.outputTokens + generated.usage.outputTokens,
          cacheReadTokens: hypotheses.usage.cacheReadTokens + generated.usage.cacheReadTokens,
          model: generated.usage.model,
        },
      }, 200, requestId);
    },

    "POST /v1/review": async (request, requestId) => {
      const b = await body<{ pages?: unknown; summary?: string; images?: unknown }>(request);
      const context = buildContext([
        {
          kind: "focus", label: "Task",
          text: "Check this finished work before submission. Report findings only; change nothing.",
        },
        { kind: "pageText", label: "Per-page summary", text: b.summary ?? "" },
        {
          kind: "studentWork", label: "Pages",
          text: Array.isArray(b.pages) ? JSON.stringify(b.pages, null, 2) : "",
        },
      ]);
      const result = await ai.complete({
        task: "review", system: SYSTEM_PROMPTS.review, prompt: context,
        schema: FinalReviewFindings, images: images(b.images),
      });
      return json({ review: result.value, usage: result.usage }, 200, requestId);
    },

    "POST /v1/improve": async (request, requestId) => {
      const b = await body<{ answer?: string; questionText?: string; subject?: string;
                             commandWord?: string; redactTerms?: string[] }>(request);
      if (typeof b.answer !== "string" || !b.answer.trim()) {
        throw badRequest("answer must be a non-empty string");
      }
      const context = buildContext([
        {
          kind: "focus", label: "The student's answer",
          text: b.answer,
        },
        { kind: "questionText", label: "The question", text: b.questionText ?? "" },
        {
          kind: "masteryHints", label: "Rules",
          text: "Suggest improvements. Quote their own words in `where`. Never rewrite " +
                "the answer for them; the student decides what to apply." +
                (b.commandWord ? ` The command word is "${b.commandWord}".` : ""),
        },
        { kind: "pageText", label: "Subject", text: b.subject ?? "" },
      ], b.redactTerms ?? []);

      const result = await ai.complete({
        task: "review", system: SYSTEM_PROMPTS.review, prompt: context,
        schema: ImprovementSuggestions,
      });
      return json({ improvements: result.value, usage: result.usage }, 200, requestId);
    },

    "POST /v1/voice": async (request, requestId) => {
      const b = await body<{ text?: string; voiceId?: string; speed?: number; format?: string }>(request);
      if (typeof b.text !== "string" || !b.text.trim()) throw badRequest("text must be a non-empty string");
      if (b.text.length > 5000) throw new HttpError(413, "tooLarge", MESSAGES.tooLarge);

      const spoken = await voice.speak({
        text: b.text,
        ...(b.voiceId ? { voiceId: b.voiceId } : {}),
        ...(typeof b.speed === "number" ? { speed: b.speed } : {}),
        format: b.format === "pcm" ? "pcm" : "mp3",
      });
      return new Response(spoken.stream, {
        status: 200,
        headers: {
          "content-type": spoken.contentType,
          "cache-control": "no-store",
          "x-request-id": requestId,
        },
      });
    },
  };

  return {
    limiter,
    async handle(request: Request, remoteAddress = "local"): Promise<Response> {
      const requestId = randomUUID();
      const url = new URL(request.url);
      const key = `${request.method} ${url.pathname}`;
      const started = Date.now();

      try {
        if (key === "GET /health") {
          return json({
            status: "ok",
            ai: ai.name,
            voice: voice.available ? voice.name : "unavailable",
            environment: config.environment,
          }, 200, requestId);
        }

        const auth = authenticate(request.headers, config.appToken, remoteAddress);
        if (!auth.ok) {
          log.warn("rejected caller", { reason: auth.reason, path: url.pathname });
          throw new HttpError(401, "unauthorised", MESSAGES.unauthorised);
        }

        const limit = limiter.check(auth.callerKey);
        if (!limit.allowed) {
          throw new HttpError(429, "rateLimited", MESSAGES.rateLimited, true, limit.retryAfterSeconds);
        }

        const handler = routes[key];
        if (!handler) throw new HttpError(404, "badRequest", "No such endpoint.");

        const response = await handler(request, requestId);
        log.info("handled", {
          path: url.pathname, status: response.status, ms: Date.now() - started,
        });
        return response;
      } catch (error) {
        const mapped = mapError(error);
        log[mapped.status >= 500 ? "error" : "warn"]("request failed", {
          path: url.pathname, status: mapped.status, code: mapped.code,
          ms: Date.now() - started, cause: error,
        });
        return toResponse(mapped, requestId);
      }
    },
  };
}

function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof AIRefusal) return new HttpError(422, "declined", MESSAGES.declined);
  if (error instanceof AIUnavailable) {
    return error.retryable
      ? new HttpError(503, "tutorBusy", MESSAGES.tutorBusy, true, 5)
      : new HttpError(502, "tutorUnavailable", MESSAGES.tutorUnavailable);
  }
  if (error instanceof VoiceUnavailable) {
    return new HttpError(error.retryable ? 503 : 502, "voiceUnavailable",
      MESSAGES.voiceUnavailable, error.retryable);
  }
  return new HttpError(500, "internal", MESSAGES.internal);
}
