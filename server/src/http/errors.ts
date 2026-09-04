/**
 * What the student sees when something breaks.
 *
 * A student is not a systems engineer and their work is on the line. "HTTP 500" tells
 * them nothing except that they should worry. Every failure that reaches the app is
 * translated into a sentence that says what happened and, where it is true, that their
 * work is safe.
 */

export type ErrorCode =
  | "unauthorised" | "rateLimited" | "badRequest" | "tooLarge"
  | "tutorBusy" | "tutorUnavailable" | "voiceUnavailable" | "declined" | "internal";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: ErrorCode, message: string, retryable = false,
              retryAfterSeconds?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Written for the person, not the log. The log gets the real cause separately. */
export const MESSAGES: Record<ErrorCode, string> = {
  unauthorised: "This copy of the app is not set up to reach the tutor.",
  rateLimited: "You have asked a lot of questions very quickly. Try again in a moment.",
  badRequest: "Something about that request did not make sense. Your work is saved.",
  tooLarge: "That is more of the page than the tutor can look at in one go.",
  tutorBusy: "The tutor is busy. Try again in a moment. Your work is saved.",
  tutorUnavailable: "The tutor cannot be reached right now. Everything else still works offline.",
  voiceUnavailable: "The voice is unavailable right now. The written answer is still here.",
  declined: "The tutor could not answer this one. Your work is saved.",
  internal: "Something went wrong at our end. Your work is saved.",
};

export function badRequest(detail: string): HttpError {
  return new HttpError(400, "badRequest", `${MESSAGES.badRequest} (${detail})`);
}

export function toResponse(error: unknown, requestId: string): Response {
  const e = error instanceof HttpError
    ? error
    : new HttpError(500, "internal", MESSAGES.internal);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": requestId,
  };
  if (e.retryAfterSeconds !== undefined) {
    headers["retry-after"] = String(e.retryAfterSeconds);
  }
  return new Response(JSON.stringify({
    error: {
      code: e.code,
      message: e.message,
      retryable: e.retryable,
      requestId,
    },
  }), { status: e.status, headers });
}
