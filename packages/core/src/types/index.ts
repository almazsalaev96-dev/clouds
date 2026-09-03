/**
 * Core entity model (§44).
 *
 * Two deliberate departures from the specification, both documented in
 * docs/ARCHITECTURE.md §E:
 *
 *  - `Block` replaces `Page`. Pages are a rendering artifact of PDFs; blocks
 *    are the semantic unit that retrieval and citation actually address. A
 *    block carries a page number when its source has one.
 *
 *  - `Edge` is a first-class entity rather than implicit foreign keys, so any
 *    node can relate to any node with a reason and a weight attached (§9).
 */

export type Id = string;
export type Timestamp = number;

/** Every node kind that can participate in the knowledge graph. */
export type NodeKind =
  | "document"
  | "block"
  | "conversation"
  | "message"
  | "artifact"
  | "concept"
  | "memory"
  | "mistake"
  | "task"
  | "project"
  | "annotation";

export interface Entity {
  id: Id;
  userId: Id;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────── identity ───

export interface User extends Entity {
  userId: Id; // self-referential; keeps the store interface uniform
  displayName: string;
  /** §8: memory is opt-out at the user level, not buried in settings. */
  memoryEnabled: boolean;
}

export interface Workspace extends Entity {
  name: string;
}

export interface Project extends Entity {
  workspaceId: Id;
  name: string;
  /** Free-text statement of what this project is for. Feeds context (§7). */
  intent: string;
}

// ─────────────────────────────────────────────────────────────── documents ───

export type DocumentSourceKind = "upload" | "paste" | "web" | "note" | "ink";

export interface Document extends Entity {
  workspaceId: Id;
  projectId: Id | null;
  title: string;
  sourceKind: DocumentSourceKind;
  /** Original bytes are stored separately; this is the extracted plain text. */
  text: string;
  mimeType: string;
  /** Populated once structure extraction completes. */
  blockCount: number;
  ingestState: "pending" | "ready" | "failed";
  ingestError?: string;
}

export type BlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "listItem"
  | "table"
  | "code"
  | "formula"
  | "question"
  | "caption"
  | "quote";

/**
 * The citation unit. A block's offsets address the exact characters of its
 * parent document, which is what makes provenance verifiable rather than
 * asserted (§14).
 */
export interface Block extends Entity {
  documentId: Id;
  kind: BlockKind;
  text: string;
  /** Character offsets into Document.text. Half-open: [start, end). */
  startOffset: number;
  endOffset: number;
  /** Heading depth for `heading`, nesting depth otherwise. */
  depth: number;
  /** Ordinal position within the document. */
  index: number;
  /** Present when the source medium has pages (PDF, scan). */
  pageNumber: number | null;
  /** id of the nearest enclosing heading block, for structural context. */
  parentBlockId: Id | null;
}

export interface Annotation extends Entity {
  documentId: Id;
  blockId: Id | null;
  startOffset: number;
  endOffset: number;
  kind: "highlight" | "note" | "ink";
  body: string;
}

// ──────────────────────────────────────────────────────────── conversation ───

export interface Conversation extends Entity {
  workspaceId: Id;
  projectId: Id | null;
  title: string;
  /** Documents explicitly attached by the user; always high-priority context. */
  pinnedDocumentIds: Id[];
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message extends Entity {
  conversationId: Id;
  role: MessageRole;
  text: string;
  /** Citations that survived provenance resolution (§D). */
  citations: Citation[];
  /** Tool calls actually executed for this message — never narrated (§32). */
  toolCalls: ToolCallRecord[];
  /** Populated for assistant messages: what the ranker chose and why. */
  contextTrace?: ContextTrace;
  /** Set when generation failed; the message still exists so the UI can show it. */
  failure?: Failure;
}

/** A citation that has been resolved against real retrieved content. */
export interface Citation {
  documentId: Id;
  blockId: Id;
  /** Denormalised for display without a second fetch. */
  documentTitle: string;
  pageNumber: number | null;
  /** The exact quoted span within the block. */
  startOffset: number;
  endOffset: number;
  text: string;
}

// ────────────────────────────────────────────────────────────── artifacts ───

export type ArtifactKind =
  | "note"
  | "studyGuide"
  | "report"
  | "essay"
  | "table"
  | "quiz"
  | "flashcards"
  | "plan"
  | "summary";

/**
 * §16: artifacts are editable objects, not static cards. Content is a block
 * list so both the user and the model can address and patch individual pieces
 * rather than regenerating the whole thing.
 */
export interface Artifact extends Entity {
  workspaceId: Id;
  projectId: Id | null;
  conversationId: Id | null;
  kind: ArtifactKind;
  title: string;
  blocks: ArtifactBlock[];
  /** Documents this artifact was derived from, for provenance. */
  sourceDocumentIds: Id[];
  version: number;
}

export interface ArtifactBlock {
  id: Id;
  kind: BlockKind | "quizQuestion" | "flashcard";
  text: string;
  /** Populated for quizQuestion / flashcard blocks. */
  answer?: string;
  /** Options for multiple-choice questions. */
  options?: string[];
  /** Concept this block exercises, when known. */
  conceptId?: Id;
  citations?: Citation[];
}

// ─────────────────────────────────────────────────────────────── learning ───

export interface Concept extends Entity {
  name: string;
  /** Normalised key for deduplication: lowercased, punctuation-stripped. */
  key: string;
  description: string;
  /** Concepts that should be understood first (§10). */
  prerequisiteIds: Id[];
}

/**
 * One graded retrieval attempt. Mastery moves only on these (§D, departure
 * from §10) — conversational "I get it now" is not evidence.
 */
export interface LearningEvent extends Entity {
  conceptId: Id;
  artifactId: Id | null;
  /** The question posed. */
  prompt: string;
  response: string;
  correct: boolean;
  /** 0..1 partial credit where the grader supports it. */
  score: number;
  /** How hard the item was, 0..1. Feeds difficulty adaptation. */
  difficulty: number;
}

/**
 * A recognised *pattern* across events — distinct from a single wrong answer.
 * This is what §23's "you've made this mistake three times" requires.
 */
export interface Mistake extends Entity {
  conceptId: Id;
  /** Human-readable description of the misconception. */
  description: string;
  /** Events exhibiting this pattern. */
  eventIds: Id[];
  occurrences: number;
  lastSeenAt: Timestamp;
  resolved: boolean;
}

export interface Mastery {
  conceptId: Id;
  /** 0..1 estimate. Meaningless without `confidence`. */
  estimate: number;
  /** 0..1. Low means "not enough evidence yet" and must be shown as such. */
  confidence: number;
  attempts: number;
  lastPracticedAt: Timestamp | null;
}

// ───────────────────────────────────────────────────────────────── memory ───

export type MemoryKind =
  | "goal"
  | "preference"
  | "subject"
  | "difficulty"
  | "project"
  | "fact";

/**
 * §8: every memory records where it came from. Nothing is silently inferred,
 * and the user can inspect, edit, delete and disable.
 */
export interface Memory extends Entity {
  kind: MemoryKind;
  text: string;
  /** Where this came from — quoted source and its location. */
  provenance: {
    messageId: Id | null;
    conversationId: Id | null;
    quote: string;
  };
  /** Times this memory was actually selected into context. Drives decay. */
  useCount: number;
  lastUsedAt: Timestamp | null;
  /** User-set: pinned memories are never decayed or evicted. */
  pinned: boolean;
}

// ───────────────────────────────────────────────────────────────── tasks ───

export interface Task extends Entity {
  workspaceId: Id;
  projectId: Id | null;
  title: string;
  done: boolean;
  dueAt: Timestamp | null;
}

// ─────────────────────────────────────────────────────────────── graph ───

export type EdgeKind =
  | "mentions"
  | "teaches"
  | "assesses"
  | "derived_from"
  | "contradicts"
  | "practices"
  | "about";

export interface Edge extends Entity {
  fromType: NodeKind;
  fromId: Id;
  toType: NodeKind;
  toId: Id;
  kind: EdgeKind;
  /** 0..1 strength. Retrieval uses this to weight graph expansion. */
  weight: number;
  /** Why this edge exists — so the graph is auditable, not magic. */
  provenance: string;
}

// ─────────────────────────────────────────────────────── context + failure ───

export type ContextItemKind =
  | "selection"
  | "openDocument"
  | "retrievedBlock"
  | "conversationTurn"
  | "memory"
  | "artifact"
  | "concept"
  | "projectIntent";

/** A candidate for inclusion in the model's context window. */
export interface ContextItem {
  kind: ContextItemKind;
  /** id of the underlying entity. */
  refId: Id;
  text: string;
  /** Estimated token cost. */
  tokens: number;
  /** Where this came from, for display and citation. */
  source: {
    documentId?: Id;
    documentTitle?: string;
    blockId?: Id;
    pageNumber?: number | null;
    conversationId?: Id;
  };
  /** Individual feature values, retained so ranking is explainable (§D). */
  features: ContextFeatures;
  score: number;
}

export interface ContextFeatures {
  explicit: number;
  lexicalMatch: number;
  recency: number;
  proximity: number;
  graphDistance: number;
  learningRelevance: number;
  pinned: number;
}

/** What the ranker chose, why, and what it had to drop. */
export interface ContextTrace {
  budget: number;
  used: number;
  included: Array<{ kind: ContextItemKind; refId: Id; score: number; tokens: number }>;
  /** Items that scored but did not fit. Shown in the "why this answer" view. */
  dropped: Array<{ kind: ContextItemKind; refId: Id; score: number; reason: string }>;
  candidateCount: number;
  elapsedMs: number;
}

export type FailureCode =
  | "no_api_key"
  | "model_unavailable"
  | "model_error"
  | "tool_failed"
  | "parse_failed"
  | "timeout"
  | "budget_exceeded"
  | "unsupported_file"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "invalid_input";

/**
 * §33: failure is data, not an exception, so every layer must decide how to
 * render it rather than discovering it at a stack trace.
 */
export interface Failure {
  code: FailureCode;
  /** Shown to the user. Must say what happened and what they can do. */
  message: string;
  /** Whether retrying could plausibly succeed. */
  retryable: boolean;
  detail?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T = never>(
  code: FailureCode,
  message: string,
  opts: { retryable?: boolean; detail?: string } = {},
): Result<T> => ({
  ok: false,
  failure: {
    code,
    message,
    retryable: opts.retryable ?? false,
    detail: opts.detail,
  },
});

// ───────────────────────────────────────────────────────────────── tools ───

export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  /** The actual result. Present only if the tool genuinely ran (§32). */
  output?: unknown;
  failure?: Failure;
  elapsedMs: number;
  startedAt: Timestamp;
}
