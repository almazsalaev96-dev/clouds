/**
 * Ingestion: raw text → stored, addressable, connected knowledge.
 *
 * This is WOW 1 (§42): the user drops in a document and the system understands
 * its structure without being told how to organise it. Concretely that means
 * three things happen here — the document is decomposed into addressable
 * blocks, its declared topics become concepts, and edges are written so the
 * document is connected to the rest of the user's knowledge from the moment it
 * lands.
 */

import type { Block, Document, DocumentSourceKind, Id, Result } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";
import type { Store } from "../store/index.ts";
import { extractStructure } from "./structure.ts";
import { conceptKey } from "../knowledge/concepts.ts";

export interface IngestInput {
  workspaceId: Id;
  projectId?: Id | null;
  title?: string;
  text: string;
  mimeType?: string;
  sourceKind?: DocumentSourceKind;
}

export interface IngestOutput {
  document: Document;
  blocks: Block[];
  /** Concepts newly created by this document (not ones it merely re-mentions). */
  newConceptIds: Id[];
}

const MAX_TEXT_BYTES = 8 * 1024 * 1024;

/** Derives a title from the first heading, falling back to the first line. */
function deriveTitle(text: string, blocks: ReturnType<typeof extractStructure>): string {
  const heading = blocks.find((b) => b.kind === "heading");
  if (heading) return heading.text.replace(/^#+\s*/, "").trim().slice(0, 200);
  const firstLine = text.split("\n").find((l) => l.trim().length > 0);
  return (firstLine?.trim().slice(0, 80) || "Untitled").trim();
}

export function ingestDocument(
  store: Store,
  userId: Id,
  input: IngestInput,
): Result<IngestOutput> {
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    return fail("invalid_input", "That file appears to be empty, so there is nothing to read yet.");
  }
  if (Buffer.byteLength(input.text, "utf8") > MAX_TEXT_BYTES) {
    return fail(
      "unsupported_file",
      "That document is larger than 8 MB of text. Try splitting it into parts.",
    );
  }

  const extracted = extractStructure(input.text);
  if (extracted.length === 0) {
    return fail("parse_failed", "No readable text could be found in that document.");
  }

  const document = store.documents.insert(userId, {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    title: input.title?.trim() || deriveTitle(input.text, extracted),
    sourceKind: input.sourceKind ?? "paste",
    text: input.text,
    mimeType: input.mimeType ?? "text/plain",
    blockCount: extracted.length,
    ingestState: "ready",
  } as never);

  // Persist blocks in order so parentIndex can be resolved to a real block id.
  const blocks: Block[] = [];
  for (const e of extracted) {
    const parentBlockId = e.parentIndex !== null ? (blocks[e.parentIndex]?.id ?? null) : null;
    blocks.push(
      store.blocks.insert(userId, {
        documentId: document.id,
        kind: e.kind,
        text: e.text,
        startOffset: e.startOffset,
        endOffset: e.endOffset,
        depth: e.depth,
        index: e.index,
        pageNumber: e.pageNumber,
        parentBlockId,
      } as never),
    );
  }

  // Headings are the document's own declaration of what it is about. Using
  // them as the concept source is honest: it reports structure the author put
  // there, rather than inventing topics through guesswork.
  const newConceptIds: Id[] = [];
  const headings = blocks.filter((b) => b.kind === "heading");
  for (const heading of headings) {
    const name = heading.text.replace(/^#+\s*/, "").trim();
    if (name.length < 3 || name.length > 120) continue;
    const key = conceptKey(name);
    const existing = store.concepts.list(userId, { where: { key } as never })[0];
    const concept =
      existing ??
      store.concepts.insert(userId, {
        name, key, description: "", prerequisiteIds: [],
      } as never);
    if (!existing) newConceptIds.push(concept.id);

    store.edges.insert(userId, {
      fromType: "document", fromId: document.id,
      toType: "concept", toId: concept.id,
      kind: "teaches",
      // A top-level heading is a stronger claim about the document's subject
      // than a deeply nested one.
      weight: Math.max(0.3, 1 - (heading.depth - 1) * 0.15),
      provenance: `heading "${name}" at block ${heading.index}`,
    } as never);

    store.edges.insert(userId, {
      fromType: "block", fromId: heading.id,
      toType: "concept", toId: concept.id,
      kind: "about", weight: 1,
      provenance: "heading text",
    } as never);
  }

  // Content sitting under a heading is about that heading's concept. Linking
  // it makes the graph able to answer questions lexical matching cannot: a
  // paragraph defining "inelastic demand" is reachable from "elasticity" even
  // though the two share no words. This is read off the document's own
  // structure, not inferred, so the edge is honest.
  const conceptByHeadingId = new Map<Id, Id>();
  for (const edge of store.edges.list(userId, {
    where: { fromType: "block", kind: "about" } as never,
  })) {
    conceptByHeadingId.set(edge.fromId, edge.toId);
  }

  for (const block of blocks) {
    if (block.kind === "heading" || !block.parentBlockId) continue;
    const conceptId = conceptByHeadingId.get(block.parentBlockId);
    if (!conceptId) continue;
    store.edges.insert(userId, {
      fromType: "block", fromId: block.id,
      toType: "concept", toId: conceptId,
      kind: "about",
      // Weaker than the heading itself: the heading names the concept, the
      // body merely sits under it.
      weight: 0.6,
      provenance: `content under heading block ${block.parentBlockId}`,
    } as never);
  }

  return ok({ document, blocks, newConceptIds });
}

/** Re-reads a citation against the stored source. Used to verify provenance. */
export function resolveSpan(
  store: Store,
  userId: Id,
  documentId: Id,
  startOffset: number,
  endOffset: number,
): Result<string> {
  const doc = store.documents.get(userId, documentId);
  if (!doc) return fail("not_found", "That document no longer exists.");
  if (startOffset < 0 || endOffset > doc.text.length || startOffset >= endOffset) {
    return fail("not_found", "That citation points outside the document.");
  }
  return ok(doc.text.slice(startOffset, endOffset));
}
