/** The one internal shape every provider is normalized into. §11. */

export type ProviderId = "openai" | "anthropic" | "moonshot" | "deepseek";

export type Role = "user" | "assistant" | "system";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string; name?: string }
  | { type: "file"; mimeType: string; name: string; text: string }
  /**
   * A tool the model asked this app to run, and what came back. Both live
   * only inside a turn: the finished answer keeps a record of what was done
   * (`Message.actions`) rather than the wire blocks, which are the
   * provider's shape and not worth a migration.
   */
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; name: string; text: string; ok: boolean };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type StopReason = "stop" | "length" | "aborted" | "error" | "refusal" | "tool";

/**
 * A tool this app offers the model — one of its own rooms, reachable from
 * any conversation. The schema is JSON Schema; each adapter wraps it in
 * its provider's envelope.
 */
export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** One request from the model to run a tool. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Something the model did in one of this app's rooms during an answer,
 * kept with the answer so the reader can see it, open it, and take it
 * back. Not the wire blocks: what was done, in words.
 */
export interface Action {
  id: string;
  name: string;
  /** "Saved 8 cards to “Osmosis”" — the line on the chip. */
  summary: string;
  ok: boolean;
  at: number;
  /** Where the thing it made lives, when it made one. */
  open?: { section: string; id?: string };
  /** Taken back, by the person, after the fact. */
  undone?: boolean;
}

/**
 * Messages carry a parentId, so a conversation is a tree rendered as a linear
 * path. Edit and regenerate create siblings; nothing is ever destroyed.
 * Retrofitting this later is a rewrite, so it exists from the first commit.
 */
export type RatingReason = "wrong" | "long" | "off" | "unclear";

export interface Rating {
  up: boolean;
  reason?: RatingReason;
  at: number;
}

export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: Role;
  content: ContentBlock[];
  /** Reasoning trace, kept separate so it never outweighs the answer visually. */
  reasoning?: string;
  modelId?: string;
  /**
   * Which Armi model wrote it, where one did.
   *
   * Stored rather than read off the thread, because the thread's model
   * changes and this answer's did not: an answer written by ARMI Parallax in
   * March is still ARMI Parallax's in June. The engine underneath stays in
   * `modelId` — it is what a retry, a second opinion and the token meter
   * all need, and it is what Settings names.
   */
  presetId?: string;
  /** The pages this answer drew on, numbered to match the markers in it. */
  sources?: WebSource[];
  /** What it did in this app's rooms on the way to the answer. */
  actions?: Action[];
  /**
   * The assistant turn as the provider sent it, when it asked for tools.
   *
   * In memory only, for the rest of that one turn: a provider that is
   * handed back its own tool calls wants them in its own shape — Anthropic
   * with the thinking blocks and their signatures intact, OpenAI with its
   * `tool_calls` array — and translating them through this app's blocks
   * and back would lose exactly the parts it checks. Never stored.
   */
  raw?: { provider: ProviderId; content: unknown };
  /**
   * Why this model, when the app chose it rather than the person.
   *
   * Kept with the answer because that is where the question arises, and
   * because a router you cannot see is a router you cannot correct. Absent on
   * every message where the model was picked by hand — there is nothing to
   * explain about a decision somebody made themselves.
   */
  routedWhy?: string;
  /**
   * What a second model said when asked whether this answer was right.
   *
   * Stored with the answer rather than recomputed, because it is evidence
   * about *this* text: regenerating the answer must not carry its predecessor's
   * verdict, and a check that quietly re-ran against new words would be worth
   * less than none.
   */
  verdict?: {
    agrees: "agrees" | "partly" | "disagrees";
    text: string;
    modelId: string;
  };
  /**
   * What the reader thought of it. Up is one press and stored as it is; down
   * asks why, because "not good" on its own is a number and a reason is
   * something the next answer can act on — which it does, through the same
   * per-reply note a Tighten uses.
   */
  rating?: Rating;
  usage?: Usage;
  latencyMs?: number;
  /** Time to first token — the number that actually predicts perceived speed. */
  ttftMs?: number;
  createdAt: number;
  stopReason?: StopReason;
  error?: string;
  /**
   * When the calculation in this answer was run and handed back.
   *
   * Set once. Without it, reopening a conversation would re-run the block
   * (which is free and correct — it is the same code over the same data)
   * and then ask the model to answer with it all over again, which is
   * neither. The run is idempotent; the turn it produces is not.
   */
  computedAt?: number;
  /**
   * The canvas this answer was built into, when the answer was a thing
   * rather than words. The transcript shows a card for it; the thing itself
   * runs beside the conversation and lives in Code.
   */
  canvasId?: string;
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
  /**
   * What the turns that no longer fit established, carried forward in their
   * place. Written when the window first overflows and extended when the
   * boundary moves; see `lib/recap.ts`.
   */
  recap?: Recap;
  /** The response style. Unset means the app default, which is Normal. */
  styleId?: string;
  /** Chat or Creative. Unset means the app default, which is Chat. */
  mode?: string;
  /** The current path through the message tree: the last message shown. */
  leafId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /**
   * Not kept. A temporary chat is left out of the sidebar, reads and writes
   * no memory, and is deleted the moment you leave it — the one you open to
   * ask something you would rather not have on the list.
   */
  temporary?: boolean;
  /**
   * Whether the model may search the web here.
   *
   * Per conversation and switchable mid-way, unlike `temporary`: a question
   * about last week's news wants it and a question about your own notes does
   * not, and both happen in one afternoon.
   */
  research?: boolean;
  /**
   * The thing this conversation is building, if it is building one. The
   * second answer that is a page updates this canvas rather than making a
   * new one, so "make the cards bigger" is a new version of the deck and not
   * a second deck.
   */
  madeId?: string;
}

/* ----------------------------------------------------------------- study -- */

/**
 * A subject you are learning, and the cards that ask you about it.
 *
 * Version 7 of this database dropped decks and cards, on the grounds that
 * five destinations for one activity was more sidebar than the activity
 * was getting used. That was true of five rooms. This is one, and it is
 * the one thing in the app that a chat window structurally cannot do:
 * remember, next Tuesday, what you got wrong today.
 */
export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** The conversation, note or subject it was made from. */
  source?: string;
}

/* ----------------------------------------------------------------- turns -- */

/**
 * What the app decided about one turn, and what became of it.
 *
 * The app has always decided several things before answering — what kind of
 * job this is, whether it wants words or a working thing, which model, how
 * hard to think, whether to check the answer — and then thrown every one of
 * those decisions away. So it could not get better at deciding: the
 * thousandth request was answered by the same reasoning as the first.
 *
 * A row here is a decision with its consequence attached. It is the whole of
 * the app's experience, it lives on this device like everything else, and it
 * is readable and deletable in Settings, because a record of your work that
 * you cannot see is not a record, it is surveillance.
 */
export interface Turn {
  id: string;
  conversationId: string;
  /** The answer this decision produced. */
  messageId: string;
  at: number;

  /* --- what was decided ------------------------------------------------ */
  kind: string;
  strategy: "compute" | "build" | "answer";
  mode: string;
  modelId: string;
  /**
   * Which Armi model the person had chosen, where they had chosen one.
   *
   * The rule this record feeds is keyed on the engine, because it is the
   * engine that is bad at a kind of work. The row on screen is keyed on this,
   * because "ARMI Nova needed another go" is something a person can act on
   * and the name of an engine they never picked is not.
   */
  presetId?: string;
  effort?: string;
  check: "none" | "lint" | "second";
  /** The one line that was shown, so the record says what the person saw. */
  why?: string;

  /* --- what happened --------------------------------------------------- */
  ms?: number;
  tokens?: number;
  stopReason?: StopReason;
  error?: string;
  /** What the app's own reader found wrong with the answer. */
  findings?: number;

  /**
   * What the person did about it, which is the only honest measure.
   *
   * Absent means nothing was done, which after a few minutes means it was
   * good enough — the commonest outcome and the one nobody clicks.
   */
  outcome?: TurnOutcome;
  /** Why it was not worth having, when they said. This is how the app
      learns that somebody wants shorter answers without being told twice
      in words. */
  reason?: RatingReason;
  /** The register it answered in, when the app chose it rather than the person. */
  styleId?: string;
}

/**
 * Rated up is the only unambiguous good. Everything else in this list is the
 * person spending effort the answer should have saved them.
 */
export type TurnOutcome = "good" | "bad" | "retried" | "edited" | "tightened";

/* ---------------------------------------------------------------- memory -- */

/**
 * One thing the app knows about the person across conversations, in their
 * own words. Kept on this device only, shown in full in Settings, and each
 * one deletable — a memory you cannot read is a rumour about you.
 */
/** A record of the turns a conversation can no longer afford to send. */
export interface Recap {
  text: string;
  /** The last message it covers. Remade only when the drop reaches past it. */
  throughId: string;
  at: number;
}

export interface Memory {
  id: string;
  text: string;
  createdAt: number;
  /** The conversation it was said in, if any, for "where did this come from". */
  source?: string;
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
  /**
   * How this model is told to think, which is a wire fact rather than a
   * capability.
   *
   * `budget` is the extended-thinking block — `thinking: {type: "enabled",
   * budget_tokens}` — which is what every Anthropic model took until the 4.6
   * generation. `effort` is `output_config.effort`, which replaced it: the
   * models that take effort *reject* the thinking block, so sending the old
   * shape to Opus 5 or Sonnet 5 is a 400 rather than a request that merely
   * thinks less. Absent means neither is sent.
   *
   * Separate from `reasoning`, which says whether the model thinks at all and
   * is what the interface and the router read. This says how to ask.
   */
  thinks?: "effort" | "budget";
  legacy?: boolean;
}

/** What a provider adapter emits. Every provider is reduced to this. */
/** The web tools a conversation may ask for. */
export type WebTool = "web_search" | "web_fetch";

/**
 * A page the answer drew on.
 *
 * Numbered in the order the model met them, so a marker in the text and a
 * row in the strip under it say the same thing. `quote` is the passage the
 * model cited where the provider reported one.
 */
export interface WebSource {
  n: number;
  url: string;
  title: string;
  quote?: string;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  /** The model is searching. Shown while it does, so the wait has a reason. */
  | { type: "searching"; query: string }
  /** A page found or fetched, as it arrives. */
  | { type: "source"; source: WebSource }
  /** The text just written rests on source `n`, quoting `quote` where known. */
  | { type: "cite"; n: number; quote?: string }
  /** The model is about to use one of this app's tools. Shown while it does. */
  | { type: "acting"; name: string }
  /**
   * The model stopped to have tools run. The client runs them, appends
   * this turn and the results to the transcript, and asks again.
   */
  | { type: "calls"; calls: ToolCall[]; raw: { provider: ProviderId; content: unknown } }
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
  /**
   * The part of the instructions that changes from turn to turn.
   *
   * Kept apart from `systemPrompt` for one reason, and it is worth money: the
   * system prompt is the app's cacheable prefix, and a provider's cache is an
   * exact prefix match. Fold a per-turn line into it and every turn pays full
   * price for the project knowledge above it. So this rides in its own block
   * after the cached one, where changing it costs only itself.
   */
  turnPrompt?: string;
  params: ModelParams;
  /** Sent only when the server has no key for this provider. */
  clientKey?: string;
  /**
   * Which web tools to offer the model. Opt-in per conversation: a search
   * sends the question, in the model's own words, to the provider's search,
   * and that is a thing to say yes to rather than have happen.
   */
  tools?: WebTool[];
  /**
   * This app's own tools, offered to the model for this turn: save cards,
   * write a page, look something up in the notebook. Run in the browser,
   * where the data is; the model only asks.
   */
  actions?: ToolSpec[];
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
  /**
   * Why it is not a citation you can open, when it is not.
   *
   * Three outcomes rather than two, because "not found in the source" is a
   * claim about the source and only one of these is that claim. "short" and
   * "unnamed" are admissions about the check: too few words to be evidence of
   * anything, and a file this page does not hold. Reporting either as a failed
   * citation tells the reader something untrue about a document that may be
   * perfectly sound, and the feature is believed exactly as far as its failures
   * are accurate.
   */
  why?: "missing" | "short" | "unnamed";
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

/* ---------------------------------------------------------------- tutor -- */

/**
 * A document you are working through with the app, rather than one you have
 * attached to a question.
 *
 * The difference is the bytes. A file dropped on the composer is read once
 * and becomes text; a lesson keeps the original, because the thing a person
 * points at is the *page* — a diagram, a working, a scanned answer — and a
 * page cannot be drawn again from an extraction of its words.
 */
export interface Lesson {
  id: string;
  /** What it is called, which is the file's name until it is renamed. */
  name: string;
  mimeType: string;
  /** The original, kept so any page can be drawn again. */
  bytes: Blob;
  /** Everything readable in it, with `--- page n ---` markers. Empty for a scan. */
  text: string;
  pages: number;
  /** Where you were when you last closed it. */
  atPage: number;
  createdAt: number;
  updatedAt: number;
}

/** One turn of the conversation beside a lesson. */
export interface LessonTurn {
  id: string;
  lessonId: string;
  at: number;
  role: "user" | "assistant";
  text: string;
  /** The page it was about, so the transcript can say where you were. */
  page?: number;
  /** The region of that page the question was about, as a data URL. */
  crop?: string;
  /** Which Armi model answered, for the line over the answer. */
  presetId?: string;
  /** Said plainly when the app had to choose a different engine. */
  why?: string;
}
