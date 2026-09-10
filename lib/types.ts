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
  /** The project this belongs to, if any. Its instructions and knowledge apply. */
  projectId?: string;
  /** The response style. Unset means the app default, which is Normal. */
  styleId?: string;
  /** Chat or Creative. Unset means the app default, which is Chat. */
  mode?: string;
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
  /**
   * The name without its maker, for the composer, where the provider's own
   * mark is already sitting beside it. "Claude Sonnet 4.5" truncated to
   * "Claude So…" tells you which company and not which model — exactly
   * backwards, since the company is the one part the icon already says.
   */
  short: string;
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

/* ------------------------------------------------------------- notebook -- */

export interface Note {
  id: string;
  title: string;
  /** Markdown. The same renderer draws it as the chat, so it is one format. */
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  /** Where it came from, so a page can point back at its conversation. */
  sourceConversationId?: string;
  /**
   * When this page was last made from its sources, and which ones.
   *
   * Together these answer "is this still true of what it was made from" — a
   * source added or removed since is a page that may now be wrong, and saying
   * so is cheaper than a reader discovering it.
   */
  madeAt?: number;
  madeFrom?: string[];
  /** What was quoted for each claim, and whether it was really there. */
  citations?: Citation[];
}

/**
 * One claim, and where it was checked against.
 *
 * Stored with the page rather than re-derived, because what the model quoted
 * is not recoverable from the finished text — the page keeps a marker and the
 * evidence lives here beside it.
 */
export interface Citation {
  /** 1-based, matching the marker in the page. */
  n: number;
  sourceId?: string;
  sourceName: string;
  quote: string;
  at?: { start: number; end: number; page?: number };
  context?: string;
  /** False when the quoted words are not in the source it named. */
  found: boolean;
}

/**
 * Something a page was made from.
 *
 * The notebook used to hold exactly one of these, in memory, for as long as
 * you stayed on the page — attach a book, get lessons, and the book was gone
 * the moment you left. That makes the notebook a converter rather than a
 * place: everything it produced was cut loose from what it came from the
 * instant it existed, so there was no answering the only question that matters
 * about a generated page, which is "where did that come from".
 *
 * Kept, plural, and belonging to the page they made. The text is stored in
 * full — it is the thing a claim gets checked against, and a source you cannot
 * re-read is a citation you have to take on trust.
 */
export interface Source {
  id: string;
  /** The page this was brought in for. */
  noteId: string;
  name: string;
  /** Everything readable in it, as text. */
  text: string;
  /** For a PDF, so a location can be given as a page rather than an offset. */
  pages?: number;
  /** Bytes of the original, for the list. */
  size: number;
  addedAt: number;
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
  /**
   * "doc" and "code" are one document. "web" is a folder: its text lives in
   * `canvasFiles` and `content` stays empty, because a web page is never one
   * file — the markup, the styling and the behaviour are three, and pretending
   * otherwise is what makes a preview a toy.
   */
  kind: "code" | "doc" | "web";
  /** Highlighting and the preview mode both key off this. Unused by "web". */
  lang?: string;
  content: string;
  /**
   * Standing rules every edit to this canvas obeys — the language, the
   * conventions, the thing nobody is allowed to touch. `CLAUDE.md` for one
   * file: said once instead of retyped at the top of every request. Not
   * indexed, so it needs no migration; absent on everything made before it
   * existed, which is the correct reading of "no rules set".
   */
  rules?: string;
  /**
   * The project this belongs to, if any — so its instructions and knowledge
   * reach every edit made here, the same way they reach every chat started
   * inside it. Indexed, because the project page asks for its canvases by it.
   */
  projectId?: string;
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
/**
 * One file of a web canvas.
 *
 * `name` is the path as it appears in the markup — "index.html", "style.css" —
 * because the preview resolves `<link href>` and `<script src>` against these
 * names. What you write is real HTML that would work if you saved the folder,
 * rather than three panes that only mean anything inside this app.
 */
export interface CanvasFile {
  id: string;
  canvasId: string;
  name: string;
  lang: string;
  content: string;
  /** Tab order. index.html first, by convention and by construction. */
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasVersion {
  id: string;
  canvasId: string;
  /** Which file this state belongs to. Absent on a single-document canvas. */
  fileName?: string;
  content: string;
  by: "you" | "model";
  /** The instruction, when the model made it. */
  note?: string;
  createdAt: number;
}




/* No duration field anywhere above. Speed must not enter the grade — slow
   because tired is indistinguishable from slow because shaky — and collecting
   a number the design has promised not to use is a tell. */

/* ---------------------------------------------------------------- styles -- */

/**
 * A response style: how an answer is shaped, kept apart from what the model is
 * told to know. Built-ins are code, not rows, so they improve when the app does
 * rather than being frozen in whatever state a browser first saw them in.
 */
export interface Style {
  id: string;
  name: string;
  /** One line for the picker. */
  blurb: string;
  instructions: string;
  builtin?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------------------------------------------- projects -- */

/**
 * A project is a place with a memory: instructions that apply to every chat
 * started inside it, and material those chats can see without being re-pasted.
 */
export interface Project {
  id: string;
  name: string;
  /** One line, for the index. Not sent to the model. */
  description: string;
  /** Sent with every chat in the project. */
  instructions: string;
  createdAt: number;
  updatedAt: number;
}

/** A piece of project knowledge: a file, a note, anything with text in it. */
export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  text: string;
  /** Bytes of the original, for the capacity meter. */
  size: number;
  createdAt: number;
}
