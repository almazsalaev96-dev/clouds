/**
 * The context ranker — the centre of the product (§7, §11).
 *
 * Every turn asks the same question: of everything this user knows, which
 * twenty things should the model see right now? Conversation, documents,
 * memory, learning state and the graph all produce candidates; this module
 * scores them against the turn, packs them under a hard budget, and records
 * why — so the answer can be explained rather than merely produced.
 *
 * Three properties are treated as correctness, not quality, and are tested as
 * such:
 *
 *   1. What the user explicitly pointed at is always included.
 *   2. The budget is never exceeded.
 *   3. A large corpus can never evict the user's selection, their memories, or
 *      the conversation in progress.
 */

import type {
  ContextFeatures,
  ContextItem,
  ContextItemKind,
  ContextTrace,
  Id,
} from "../types/index.ts";
import type { Store } from "../store/index.ts";
import { retrieve, neighbours } from "../knowledge/retrieval.ts";
import { tokenize } from "../knowledge/concepts.ts";
import { masteryFor } from "../learning/mastery.ts";
import {
  BUDGET_FLOORS,
  DEFAULT_WEIGHTS,
  RECENCY_HALF_LIFE_MS,
  estimateTokens,
  type Weights,
} from "./weights.ts";

export interface Selection {
  documentId: Id;
  blockId?: Id;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ContextRequest {
  /** The user's message for this turn. Drives lexical matching. */
  query: string;
  workspaceId: Id;
  conversationId?: Id;
  projectId?: Id | null;
  /** What the user pointed at, if anything. Outranks everything else. */
  selection?: Selection;
  /** The document currently open in the workspace. */
  openDocumentId?: Id;
  /** Total token budget for retrieved context (excludes the system prompt). */
  budget?: number;
  now?: number;
  weights?: Partial<Weights>;
}

export interface AssembledContext {
  items: ContextItem[];
  trace: ContextTrace;
}

const DEFAULT_BUDGET = 6000;
const MAX_CANDIDATES = 400;

/**
 * Gather breadth scales with the budget, and deliberately over-gathers.
 *
 * A fixed retrieval depth leaves a large budget half-empty. The asymmetry here
 * matters: gathering too few candidates silently wastes context the user is
 * paying for, while gathering too many costs a local BM25 slice and a linear
 * scoring pass — microseconds. So the ranker over-supplies and lets the packer
 * decide, rather than guessing the right depth up front.
 *
 * The divisors assume short blocks (a heading, a list item, a sentence), which
 * is the common case; long blocks simply fill the budget sooner.
 */
function gatherBreadth(budget: number): { retrieval: number; window: number } {
  return {
    retrieval: Math.max(16, Math.min(150, Math.round(budget / 40))),
    window: Math.max(10, Math.min(120, Math.round(budget / 60))),
  };
}

const emptyFeatures = (): ContextFeatures => ({
  explicit: 0, lexicalMatch: 0, recency: 0, proximity: 0,
  graphDistance: 0, learningRelevance: 0, pinned: 0,
});

/** Exponential decay so "yesterday" and "last month" differ meaningfully. */
function recencyScore(timestamp: number, now: number): number {
  const age = Math.max(0, now - timestamp);
  return Math.pow(0.5, age / RECENCY_HALF_LIFE_MS);
}

function overlap(queryTerms: Set<string>, text: string): number {
  if (queryTerms.size === 0) return 0;
  const terms = new Set(tokenize(text));
  if (terms.size === 0) return 0;
  let hits = 0;
  for (const t of queryTerms) if (terms.has(t)) hits++;
  return hits / queryTerms.size;
}

export function assembleContext(
  store: Store,
  userId: Id,
  request: ContextRequest,
): AssembledContext {
  const started = Date.now();
  const now = request.now ?? Date.now();
  const budget = request.budget ?? DEFAULT_BUDGET;
  const weights = { ...DEFAULT_WEIGHTS, ...request.weights };
  const queryTerms = new Set(tokenize(request.query));
  const breadth = gatherBreadth(budget);

  const candidates: ContextItem[] = [];
  const add = (
    kind: ContextItemKind,
    refId: Id,
    text: string,
    features: Partial<ContextFeatures>,
    source: ContextItem["source"] = {},
  ): void => {
    if (!text || text.trim().length === 0) return;
    candidates.push({
      kind, refId, text,
      tokens: estimateTokens(text),
      source,
      features: { ...emptyFeatures(), ...features },
      score: 0,
    });
  };

  // ── 1. Selection: what the user actually pointed at ───────────────────────
  if (request.selection) {
    const doc = store.documents.get(userId, request.selection.documentId);
    add("selection", request.selection.blockId ?? request.selection.documentId,
      request.selection.text,
      { explicit: 1, proximity: 1, recency: 1 },
      {
        documentId: request.selection.documentId,
        documentTitle: doc?.title,
        blockId: request.selection.blockId,
      });
  }

  // ── 2. The open document: nearby structure, not the whole thing ───────────
  if (request.openDocumentId) {
    const doc = store.documents.get(userId, request.openDocumentId);
    if (doc) {
      const blocks = store.blocks.list(userId, {
        where: { documentId: doc.id } as never,
        sort: (a, b) => a.index - b.index,
      });
      // Anchor on the selection when there is one, otherwise the start.
      const anchorIndex = request.selection?.blockId
        ? (blocks.find((b) => b.id === request.selection!.blockId)?.index ?? 0)
        : 0;
      for (const block of blocks) {
        const distance = Math.abs(block.index - anchorIndex);
        // Headings stay relevant at any distance; they are the document's map.
        const proximity = block.kind === "heading"
          ? 0.6
          : Math.max(0, 1 - distance / breadth.window);
        if (proximity <= 0) continue;
        add("openDocument", block.id, block.text,
          {
            proximity,
            lexicalMatch: overlap(queryTerms, block.text),
            recency: recencyScore(doc.updatedAt, now),
          },
          {
            documentId: doc.id, documentTitle: doc.title,
            blockId: block.id, pageNumber: block.pageNumber,
          });
      }
    }
  }

  // ── 3. Retrieval across everything the user has ───────────────────────────
  if (queryTerms.size > 0) {
    const hits = retrieve(store, userId, request.query, { limit: breadth.retrieval });
    const top = hits[0]?.score || 1;
    for (const hit of hits) {
      const doc = store.documents.get(userId, hit.block.documentId);
      add("retrievedBlock", hit.block.id, hit.block.text,
        {
          lexicalMatch: hit.score / top,
          proximity: hit.block.documentId === request.openDocumentId ? 0.5 : 0,
          recency: doc ? recencyScore(doc.updatedAt, now) : 0,
          graphDistance: hit.via === "graph" ? 0.5 : 0,
        },
        {
          documentId: hit.block.documentId, documentTitle: doc?.title,
          blockId: hit.block.id, pageNumber: hit.block.pageNumber,
        });
    }
  }

  // ── 4. The conversation in progress ───────────────────────────────────────
  if (request.conversationId) {
    const conversation = store.conversations.get(userId, request.conversationId);
    const messages = store.messages.list(userId, {
      where: { conversationId: request.conversationId } as never,
      sort: (a, b) => b.createdAt - a.createdAt,
      limit: 24,
    });
    for (const message of messages) {
      add("conversationTurn", message.id, `${message.role}: ${message.text}`,
        {
          recency: recencyScore(message.createdAt, now),
          lexicalMatch: overlap(queryTerms, message.text),
        },
        { conversationId: request.conversationId });
    }
    // Documents the user explicitly attached to this conversation.
    for (const documentId of conversation?.pinnedDocumentIds ?? []) {
      const doc = store.documents.get(userId, documentId);
      if (!doc) continue;
      const blocks = store.blocks.list(userId, {
        where: { documentId } as never,
        sort: (a, b) => a.index - b.index,
        limit: Math.max(40, breadth.retrieval),
      });
      for (const block of blocks) {
        add("openDocument", block.id, block.text,
          {
            pinned: 1,
            lexicalMatch: overlap(queryTerms, block.text),
            recency: recencyScore(doc.updatedAt, now),
          },
          {
            documentId, documentTitle: doc.title,
            blockId: block.id, pageNumber: block.pageNumber,
          });
      }
    }
  }

  // ── 5. Memory (§8) ────────────────────────────────────────────────────────
  const user = store.users.get(userId, userId);
  if (!user || user.memoryEnabled !== false) {
    for (const memory of store.memories.list(userId)) {
      const relevance = overlap(queryTerms, memory.text);
      // A memory that never matches anything is noise; require either a
      // lexical connection or an explicit pin.
      if (relevance === 0 && !memory.pinned) continue;
      add("memory", memory.id, memory.text, {
        lexicalMatch: relevance,
        pinned: memory.pinned ? 1 : 0,
        recency: memory.lastUsedAt ? recencyScore(memory.lastUsedAt, now) : 0.3,
      });
    }
  }

  // ── 6. Project intent: what this work is for ──────────────────────────────
  if (request.projectId) {
    const project = store.projects.get(userId, request.projectId);
    if (project?.intent) {
      add("projectIntent", project.id, `Project "${project.name}": ${project.intent}`,
        { explicit: 0.5, proximity: 0.5 });
    }
  }

  // ── 7. Learning state: weak concepts this turn touches (§10) ──────────────
  if (queryTerms.size > 0) {
    for (const concept of store.concepts.list(userId, { limit: 200 })) {
      const relevance = overlap(queryTerms, concept.name);
      if (relevance === 0) continue;
      const mastery = masteryFor(store, userId, concept.id);
      // Only surface a concept as "weak" when there is evidence it is weak.
      // Without graded attempts we have no basis for the claim (§D).
      if (mastery.confidence < 0.3) continue;
      const weakness = 1 - mastery.estimate;
      if (weakness < 0.35) continue;
      add("concept", concept.id,
        `The user has struggled with "${concept.name}" (mastery ${(mastery.estimate * 100).toFixed(0)}% over ${mastery.attempts} attempts).`,
        { learningRelevance: weakness * relevance, lexicalMatch: relevance });
    }
  }

  // ── 8. Graph neighbours of the selection ──────────────────────────────────
  if (request.selection?.blockId) {
    const seen = new Set(candidates.map((c) => c.refId));
    for (const n of neighbours(store, userId, "block", request.selection.blockId, 2).slice(0, 8)) {
      if (n.type !== "block" || seen.has(n.id)) continue;
      const block = store.blocks.get(userId, n.id);
      if (!block) continue;
      const doc = store.documents.get(userId, block.documentId);
      add("retrievedBlock", block.id, block.text,
        { graphDistance: n.weight / n.distance, lexicalMatch: overlap(queryTerms, block.text) },
        {
          documentId: block.documentId, documentTitle: doc?.title,
          blockId: block.id, pageNumber: block.pageNumber,
        });
    }
  }

  // ── Deduplicate, keeping the strongest feature values per reference ───────
  const merged = new Map<string, ContextItem>();
  for (const candidate of candidates) {
    const key = `${candidate.kind === "selection" ? "selection" : "ref"}:${candidate.refId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }
    // The same block reached by two routes keeps the best evidence from each.
    for (const feature of Object.keys(existing.features) as Array<keyof ContextFeatures>) {
      existing.features[feature] = Math.max(existing.features[feature], candidate.features[feature]);
    }
    if (candidate.kind === "selection") existing.kind = "selection";
  }

  const scored = [...merged.values()]
    .map((item) => {
      let score = 0;
      for (const feature of Object.keys(item.features) as Array<keyof ContextFeatures>) {
        score += item.features[feature] * weights[feature];
      }
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score || a.refId.localeCompare(b.refId))
    .slice(0, MAX_CANDIDATES);

  const { included, dropped, used } = pack(scored, budget);

  return {
    items: included,
    trace: {
      budget,
      used,
      included: included.map((i) => ({
        kind: i.kind, refId: i.refId, score: i.score, tokens: i.tokens,
      })),
      dropped,
      candidateCount: scored.length,
      elapsedMs: Date.now() - started,
    },
  };
}

/**
 * Two-phase packing.
 *
 * Phase 1 honours the floors: each protected kind gets first claim on its
 * share, so a large document cannot starve the selection or the conversation.
 * Phase 2 fills whatever is left by pure score. Unused floor capacity returns
 * to the pool rather than being wasted.
 */
function pack(
  scored: ContextItem[],
  budget: number,
): { included: ContextItem[]; dropped: ContextTrace["dropped"]; used: number } {
  const included: ContextItem[] = [];
  const chosen = new Set<ContextItem>();
  let used = 0;

  for (const [kind, fraction] of Object.entries(BUDGET_FLOORS)) {
    if (!fraction) continue;
    let floorRemaining = Math.floor(budget * fraction);
    for (const item of scored) {
      if (item.kind !== kind || chosen.has(item)) continue;
      if (item.tokens > floorRemaining || used + item.tokens > budget) continue;
      chosen.add(item);
      included.push(item);
      floorRemaining -= item.tokens;
      used += item.tokens;
    }
  }

  const dropped: ContextTrace["dropped"] = [];
  for (const item of scored) {
    if (chosen.has(item)) continue;
    if (used + item.tokens <= budget) {
      chosen.add(item);
      included.push(item);
      used += item.tokens;
    } else {
      dropped.push({
        kind: item.kind,
        refId: item.refId,
        score: item.score,
        reason: item.tokens > budget ? "item exceeds entire budget" : "budget full",
      });
    }
  }

  included.sort((a, b) => b.score - a.score);
  return { included, dropped, used };
}
