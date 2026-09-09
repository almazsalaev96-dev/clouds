/** The one internal shape every provider is normalized into. §11. */

export type ProviderId = "openai" | "anthropic" | "google" | "deepseek";

export type Role = "user" | "assistant" | "system";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string; name?: string }
  | { type: "file"; mimeType: string; name: string; text: string };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type StopReason = "stop" | "length" | "aborted" | "error" | "refusal";

/**
 * Messages carry a parentId, so a conversation is a tree rendered as a linear
 * path. Edit and regenerate create siblings; nothing is ever destroyed.
 * Retrofitting this later is a rewrite, so it exists from the first commit.
 */
export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: Role;
  content: ContentBlock[];
  /** Reasoning trace, kept separate so it never outweighs the answer visually. */
  reasoning?: string;
  modelId?: string;
  usage?: Usage;
  latencyMs?: number;
  /** Time to first token — the number that actually predicts perceived speed. */
  ttftMs?: number;
  createdAt: number;
  stopReason?: StopReason;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  modelId: string;
  systemPrompt?: string;
  /** The current path through the message tree: the last message shown. */
  leafId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface ModelSpec {
  id: string;
  provider: ProviderId;
  /** The provider's own identifier, which is not always our id. */
  apiName: string;
  name: string;
  /** One line, plain language. Not marketing copy. */
  blurb: string;
  contextWindow: number;
  maxOutput: number;
  /** USD per 1M tokens. */
  priceIn: number;
  priceOut: number;
  vision: boolean;
  reasoning: boolean;
  tools: boolean;
  legacy?: boolean;
}

/** What a provider adapter emits. Every provider is reduced to this. */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "usage"; usage: Usage }
  | { type: "done"; stopReason: StopReason }
  | { type: "error"; error: ChatError };

/**
 * Errors are classified at the adapter boundary, so the UI never has to parse
 * a provider string and the user never sees one. §3, principle 6.
 */
export type ErrorKind =
  | "no_key"
  | "bad_key"
  | "rate_limit"
  | "quota"
  | "context_length"
  | "content_filter"
  | "unsupported_content"
  | "provider_down"
  | "network"
  | "timeout"
  | "unknown";

export interface ChatError {
  kind: ErrorKind;
  /** One sentence, plain language, addressed to the user. */
  message: string;
  /** What to do about it. Rendered as the action button's label. */
  action?: "retry" | "add_key" | "switch_model" | "shorten";
  retryAfterMs?: number;
  /** Kept for the console and the report-a-bug path. Never rendered raw. */
  detail?: string;
}

export interface ChatRequest {
  modelId: string;
  messages: Message[];
  systemPrompt?: string;
  params: ModelParams;
  /** Sent only when the server has no key for this provider. */
  clientKey?: string;
}

/* ---------------------------------------------------------------- study ---- */

export interface Note {
  id: string;
  title: string;
  /** Markdown. The same renderer draws it as the chat, so it is one format. */
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  /** Where it came from, so a note can point back at its conversation. */
  sourceConversationId?: string;
}

export interface Deck {
  id: string;
  title: string;
  createdAt: number;
  sourceNoteId?: string;
  sourceConversationId?: string;
}

export type Grade = "again" | "hard" | "good" | "easy";

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** SM-2 state. */
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: number;
  lastReviewed?: number;
  createdAt: number;
}

export interface Paper {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  /** Markdown body, laid out for print. */
  content: string;
  createdAt: number;
  updatedAt: number;
  format: "report" | "essay" | "notes";
}

/* ---------------------------------------------------------------- canvas -- */

/**
 * A document you and the model both edit.
 *
 * The difference from a note is who may write to it and what happens when they
 * do. A note is yours; the model can produce one but never touches it again.
 * A canvas is shared: you type in it directly, and you can ask for a change
 * and get the file back revised in place rather than pasted into the
 * conversation as a new copy you then have to reconcile by hand.
 *
 * Which is the whole point. Once an answer is longer than a screen, "here is
 * the updated version" is not help — it is homework.
 */
export interface Canvas {
  id: string;
  title: string;
  kind: "code" | "doc";
  /** Highlighting and the preview mode both key off this. */
  lang?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  /** The conversation it came out of, so it can point back at its origin. */
  sourceConversationId?: string;
}

/**
 * Every accepted state of a canvas, kept.
 *
 * A shared document without history is a document you cannot let anything else
 * write to: one bad revision and the work is gone. History is what makes it
 * safe to hand the pen over.
 */
export interface CanvasVersion {
  id: string;
  canvasId: string;
  content: string;
  by: "you" | "model";
  /** The instruction, when the model made it. */
  note?: string;
  createdAt: number;
}

/* -------------------------------------------------------------- practice -- */

/**
 * The scheduling state SM-2 owns. Extracted so anything with a forgetting
 * curve can be scheduled by the same code — a card, or a trap. Card's runtime
 * shape is unchanged, so this costs no migration.
 */
export interface SM2 {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: number;
  lastReviewed?: number;
}

/** A folder with a primer. It is not scheduled; its traps are. */
export interface Skill {
  id: string;
  name: string;
  goal: string;
  /** Markdown, short by design: the minimum needed to attempt one problem. */
  primer: string;
  /** Working difficulty, steered to hold the first-try error rate near 25%. */
  band: 1 | 2 | 3;
  state: "sketching" | "ready" | "failed";
  generationError?: string;
  sourceText?: string;
  sourceNoteId?: string;
  sourceConversationId?: string;
  /** Denormalised so the index never reads the traps table to draw a row. */
  trapCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * The scheduled unit: one named mistake with one forgetting curve.
 *
 * A topic is the wrong unit — "integration by parts" is four different things
 * you can get wrong, decaying at four different rates, and one due date over
 * them averages out exactly the information worth having.
 */
export interface Trap extends SM2 {
  id: string;
  skillId: string;
  /** Minted once and never changed: the join key for problems and evidence. */
  slug: string;
  /** The wrong move, phrased as a move — never a topic name. */
  label: string;
  /** One sentence, second person. Shown the moment you miss. */
  diagnosis: string;
  /** Verbatim from the source, when there was source material. */
  quote?: string;
  state: "unseen" | "open" | "held";
  /** Denormalised evidence, written with the attempt, so no scan to draw a row. */
  seen: number;
  firstTry: number;
  /** Last 8 outcomes, newest last: 1 first try, h hinted, r retried, x missed. */
  window: string;
  lastMissAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Problem {
  id: string;
  skillId: string;
  /** Every problem catches exactly one trap. There is no untagged problem. */
  trapId: string;
  band: 1 | 2 | 3;
  /**
   * No multiple choice. Recognition among four options puts the answer on
   * screen before every attempt and is defeatable by elimination — the format
   * least able to help someone who has read the explanation and still cannot
   * do the exercise.
   */
  kind: "cloze" | "numeric";
  prompt: string;
  answer: { accept?: string[]; value?: number; tolerance?: number };
  /** One sentence naming the rule, not a restatement of the steps. */
  explanation: string;
  /** A nudge that does not contain the answer. */
  hint: string;
  /** The first step performed, supplied for the scaffolded retry. */
  stepOne: string;
  servedAt?: number;
  retired?: boolean;
  createdAt: number;
}

/**
 * Append-only. Everything downstream is derived, so the scoring rule can be
 * replaced later without throwing away a single answer.
 */
export interface Attempt {
  id: string;
  skillId: string;
  trapId: string;
  problemId: string;
  kind: "first" | "retry";
  response: string;
  correct: boolean;
  hinted: boolean;
  /** Used "Show me". Grades as `again`, and the tooltip says so first. */
  shown: boolean;
  createdAt: number;
}

/* No duration field anywhere above. Speed must not enter the grade — slow
   because tired is indistinguishable from slow because shaky — and collecting
   a number the design has promised not to use is a tell. */
