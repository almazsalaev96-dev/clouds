/**
 * AI provider abstraction.
 *
 * Three rules govern everything under `src/ai`:
 *
 *  1. **Server only.** No key ever reaches the client. Every call goes through
 *     a route handler in `app/api/ai/*`.
 *
 *  2. **The product works without it.** Every deterministic engine — spaced
 *     repetition, mastery, priority, adaptive selection, mistake analysis,
 *     readiness, planning, mocks, analytics — runs with no provider configured.
 *     AI is an accelerant on top of a system that already functions, never a
 *     dependency the student's revision is hostage to. When a call fails, the
 *     UI says what failed and offers the deterministic path, rather than
 *     showing "something went wrong".
 *
 *  3. **It is never the source of truth for assessment.** The model may explain,
 *     rephrase, draft and pre-fill. It may not invent a mark scheme, a syllabus
 *     requirement, a grade boundary or an official command-word definition.
 *     Where the pack has authoritative content, it is passed in and the model is
 *     instructed to work from it; where it does not, the model must say so.
 */

export type AIFeature =
  | "tutor"
  | "socratic"
  | "mark"
  | "explain"
  | "generate-questions"
  | "generate-cards"
  | "summarise"
  | "classify-mistake";

export interface GenerateOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  /** Reasoning-heavy work routes to the stronger model. */
  tier?: "fast" | "reasoning";
  feature: AIFeature;
  /** Deterministic outputs may be cached; student-specific ones may not. */
  cacheable?: boolean;
}

export interface GenerateResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  ms: number;
}

export interface StructuredOptions<T> extends GenerateOptions {
  /** JSON Schema the model must satisfy. */
  schema: Record<string, unknown>;
  schemaName: string;
  /** Runtime validation. A response that fails is a failure, not a warning. */
  validate: (raw: unknown) => T;
}

export interface AIProvider {
  readonly name: string;
  readonly available: boolean;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  generateStructured<T>(opts: StructuredOptions<T>): Promise<{ value: T; meta: GenerateResult }>;
}

/** Thrown when AI is unavailable or produced something unusable. */
export class AIUnavailableError extends Error {
  constructor(
    message: string,
    readonly fallback: string,
  ) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/**
 * The provider used when no key is configured. It does not pretend: it throws
 * a typed error carrying the deterministic alternative, which the UI renders.
 */
export class NullProvider implements AIProvider {
  readonly name = "none";
  readonly available = false;

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    throw new AIUnavailableError(
      "No AI provider is configured.",
      FALLBACKS[opts.feature],
    );
  }

  async generateStructured<T>(opts: StructuredOptions<T>): Promise<{ value: T; meta: GenerateResult }> {
    throw new AIUnavailableError("No AI provider is configured.", FALLBACKS[opts.feature]);
  }
}

/**
 * What the student is offered instead when a feature cannot run. Each of these
 * is a real, working path — several are pedagogically better than the AI route,
 * which is why they are the default rather than an apology.
 */
export const FALLBACKS: Record<AIFeature, string> = {
  tutor:
    "The tutor needs an AI provider. In the meantime, the topic's explanation, worked examples and misconceptions are all available offline.",
  socratic:
    "Guided questioning needs an AI provider. The hint ladder on each question works offline and serves the same purpose.",
  mark:
    "Self-marking against the mark scheme is available and is the higher-value option anyway: working through the scheme point by point is how you learn the marker's model of a good answer. Your answer has been saved either way.",
  explain:
    "The pack's own explanation, worked example and common-error notes are available offline.",
  "generate-questions":
    "The question bank filtered to this topic and difficulty is available offline.",
  "generate-cards":
    "Cards can be created by hand from any answer, mistake or note, and mistakes already generate cards automatically.",
  summarise: "The lesson's key terms and limitations are already extracted in the pack.",
  "classify-mistake":
    "Classify the cause yourself when self-marking — doing that deliberately is where most of the value is.",
};

// ---------------------------------------------------------------------------
// Cost control
// ---------------------------------------------------------------------------

/**
 * A deliberately simple in-process budget. It exists so a bug cannot produce a
 * surprising bill; it is not a billing system. Resets daily.
 */
export class RequestBudget {
  private count = 0;
  private day = new Date().toISOString().slice(0, 10);

  constructor(private readonly limit: number) {}

  check(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
    if (this.count >= this.limit) {
      throw new AIUnavailableError(
        `Daily AI request budget of ${this.limit} reached.`,
        "The deterministic engines are unaffected — practice, review, marking and planning all continue to work.",
      );
    }
    this.count++;
  }

  get used() {
    return this.count;
  }
}

/**
 * Cache for deterministic outputs. A topic explanation for a given syllabus
 * version is the same for every student, so it should be generated once.
 * Student-specific work (tutoring, marking) is never cached.
 */
export class ResponseCache {
  private map = new Map<string, { value: GenerateResult; at: number }>();
  constructor(private readonly ttlMs = 1000 * 60 * 60 * 24 * 7) {}

  key(opts: GenerateOptions): string {
    return JSON.stringify([opts.feature, opts.system, opts.messages, opts.tier]);
  }

  get(opts: GenerateOptions): GenerateResult | null {
    if (!opts.cacheable) return null;
    const hit = this.map.get(this.key(opts));
    if (!hit) return null;
    if (Date.now() - hit.at > this.ttlMs) {
      this.map.delete(this.key(opts));
      return null;
    }
    return { ...hit.value, cached: true };
  }

  put(opts: GenerateOptions, value: GenerateResult): void {
    if (!opts.cacheable) return;
    this.map.set(this.key(opts), { value, at: Date.now() });
  }
}
