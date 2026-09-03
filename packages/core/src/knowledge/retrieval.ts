/**
 * Retrieval (§39).
 *
 * An honest note on what this is and is not. §39 asks for semantic search that
 * understands meaning. True semantic retrieval needs embeddings, which need a
 * model provider. Rather than claim semantics we do not have, this ships:
 *
 *   1. BM25 lexical ranking — strong, well-understood, works offline, no deps.
 *   2. Graph expansion — blocks connected to matched concepts are pulled in
 *      even when they share no vocabulary with the query. This recovers some
 *      genuine meaning-based recall ("elasticity" finding a block about
 *      "responsiveness to price" because both attach to the same concept).
 *   3. An `Embedder` interface that upgrades (1) to hybrid dense retrieval as
 *      a provider swap, not a rewrite.
 *
 * The product does not claim semantic search until an embedder is configured.
 * That is §50's "no fake intelligence" applied to our own feature list.
 */

import type { Block, Id } from "../types/index.ts";
import type { Store } from "../store/index.ts";
import { tokenize } from "./concepts.ts";

const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length normalisation

export interface RetrievedBlock {
  block: Block;
  score: number;
  /** Why this block was retrieved — surfaced in the "why this answer" view. */
  via: "lexical" | "graph";
  matchedTerms: string[];
}

interface Posting {
  blockId: Id;
  tf: number;
}

/**
 * An inverted index over one user's blocks. Rebuilt when the block count
 * changes; for a single user's corpus this is milliseconds, and it avoids a
 * whole class of staleness bugs that incremental indexing invites.
 */
export class BlockIndex {
  private postings = new Map<string, Posting[]>();
  private lengths = new Map<Id, number>();
  private blocks = new Map<Id, Block>();
  private avgLength = 0;
  private builtFrom = -1;

  build(store: Store, userId: Id): void {
    const all = store.blocks.list(userId);
    this.postings.clear();
    this.lengths.clear();
    this.blocks.clear();

    let total = 0;
    for (const block of all) {
      const terms = tokenize(block.text);
      this.blocks.set(block.id, block);
      this.lengths.set(block.id, terms.length);
      total += terms.length;

      const counts = new Map<string, number>();
      for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const [term, tf] of counts) {
        let list = this.postings.get(term);
        if (!list) this.postings.set(term, (list = []));
        list.push({ blockId: block.id, tf });
      }
    }
    this.avgLength = all.length > 0 ? total / all.length : 0;
    this.builtFrom = all.length;
  }

  ensureFresh(store: Store, userId: Id): void {
    if (store.blocks.count(userId) !== this.builtFrom) this.build(store, userId);
  }

  get size(): number {
    return this.blocks.size;
  }

  search(query: string, limit: number): RetrievedBlock[] {
    const terms = tokenize(query);
    if (terms.length === 0 || this.blocks.size === 0) return [];

    const N = this.blocks.size;
    const scores = new Map<Id, number>();
    const matched = new Map<Id, Set<string>>();

    for (const term of new Set(terms)) {
      const postings = this.postings.get(term);
      if (!postings) continue;
      const df = postings.length;
      // BM25 idf, floored at zero so terms present in most blocks cannot
      // subtract from a score.
      const idf = Math.max(0, Math.log(1 + (N - df + 0.5) / (df + 0.5)));

      for (const { blockId, tf } of postings) {
        const dl = this.lengths.get(blockId) ?? 0;
        const norm = 1 - B + (B * dl) / (this.avgLength || 1);
        const contribution = (idf * (tf * (K1 + 1))) / (tf + K1 * norm);
        scores.set(blockId, (scores.get(blockId) ?? 0) + contribution);
        let set = matched.get(blockId);
        if (!set) matched.set(blockId, (set = new Set()));
        set.add(term);
      }
    }

    return [...scores.entries()]
      .map(([blockId, score]) => ({
        block: this.blocks.get(blockId)!,
        score,
        via: "lexical" as const,
        matchedTerms: [...(matched.get(blockId) ?? [])],
      }))
      .sort((a, b) => b.score - a.score || a.block.index - b.block.index)
      .slice(0, limit);
  }
}

/** Pluggable dense retrieval. Unimplemented by default — and says so. */
export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface RetrieveOptions {
  limit?: number;
  /** Restrict to these documents (e.g. the open document, or a project). */
  documentIds?: Id[];
  /** Pull in blocks linked to the same concepts as the lexical hits (§9). */
  expandViaGraph?: boolean;
}

const indexCache = new WeakMap<Store, Map<Id, BlockIndex>>();

function indexFor(store: Store, userId: Id): BlockIndex {
  let byUser = indexCache.get(store);
  if (!byUser) indexCache.set(store, (byUser = new Map()));
  let index = byUser.get(userId);
  if (!index) byUser.set(userId, (index = new BlockIndex()));
  index.ensureFresh(store, userId);
  return index;
}

export function retrieve(
  store: Store,
  userId: Id,
  query: string,
  options: RetrieveOptions = {},
): RetrievedBlock[] {
  const limit = options.limit ?? 12;
  const index = indexFor(store, userId);

  // Over-fetch before filtering so a document restriction cannot starve results.
  const raw = index.search(query, options.documentIds ? limit * 8 : limit * 2);

  let results = raw;
  if (options.documentIds?.length) {
    const allowed = new Set(options.documentIds);
    results = results.filter((r) => allowed.has(r.block.documentId));
  }
  results = results.slice(0, limit);

  if (options.expandViaGraph !== false && results.length > 0) {
    results = [...results, ...expandViaGraph(store, userId, results, limit)];
  }

  return results.slice(0, limit);
}

/**
 * Recall that pure lexical matching cannot reach: blocks that sit under the
 * same concept as a strong hit, but share no words with the query.
 */
function expandViaGraph(
  store: Store,
  userId: Id,
  seeds: RetrievedBlock[],
  limit: number,
): RetrievedBlock[] {
  const seen = new Set(seeds.map((s) => s.block.id));
  const conceptIds = new Set<Id>();

  // Concepts reachable from the strongest few hits, via their document.
  for (const seed of seeds.slice(0, 3)) {
    for (const edge of store.edges.list(userId, {
      where: { fromType: "document", fromId: seed.block.documentId, kind: "teaches" } as never,
    })) {
      conceptIds.add(edge.toId);
    }
  }
  if (conceptIds.size === 0) return [];

  const out: RetrievedBlock[] = [];
  for (const conceptId of conceptIds) {
    for (const edge of store.edges.list(userId, {
      where: { toType: "concept", toId: conceptId, fromType: "block" } as never,
      limit: 20,
    })) {
      if (seen.has(edge.fromId)) continue;
      const block = store.blocks.get(userId, edge.fromId);
      if (!block) continue;
      seen.add(block.id);
      // Graph hits rank below lexical hits by construction: they are weaker
      // evidence, and should never displace a direct textual match.
      out.push({ block, score: edge.weight * 0.25, via: "graph", matchedTerms: [] });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Graph neighbourhood of any node, used by the context ranker. */
export function neighbours(
  store: Store,
  userId: Id,
  nodeType: string,
  nodeId: Id,
  maxHops = 1,
): Array<{ type: string; id: Id; distance: number; weight: number }> {
  const seen = new Set<string>([`${nodeType}:${nodeId}`]);
  let frontier = [{ type: nodeType, id: nodeId, weight: 1 }];
  const out: Array<{ type: string; id: Id; distance: number; weight: number }> = [];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const outgoing = store.edges.list(userId, {
        filter: (e) =>
          (e.fromType === node.type && e.fromId === node.id) ||
          (e.toType === node.type && e.toId === node.id),
      });
      for (const edge of outgoing) {
        const isForward = edge.fromType === node.type && edge.fromId === node.id;
        const type = isForward ? edge.toType : edge.fromType;
        const id = isForward ? edge.toId : edge.fromId;
        const key = `${type}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const weight = node.weight * edge.weight;
        out.push({ type, id, distance: hop, weight });
        next.push({ type, id, weight });
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out.sort((a, b) => b.weight - a.weight);
}
