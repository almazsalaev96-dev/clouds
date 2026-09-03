/**
 * Citation resolution (§14, §17).
 *
 * "Never invent citations" cannot be a prompt instruction. Prompting is not a
 * control — it is a request, and a model under pressure will occasionally
 * decline it. In a product whose core promise is "I can show you where this
 * came from", one fabricated page reference is worse than ten refusals to
 * answer, because it teaches the user that the citations mean nothing.
 *
 * So the guarantee is structural, in four steps:
 *
 *   1. Retrieval emits blocks with real addresses.
 *   2. The prompt exposes only those handles.
 *   3. Emitted citations are resolved against the allowed set *and* re-read
 *      from the stored document at their recorded offsets.
 *   4. Anything that fails to resolve is stripped before render, and the
 *      response is flagged.
 *
 * A fabricated citation therefore cannot reach the user, whatever the model
 * emits. Step 3 matters as much as step 2: a block id that exists but whose
 * text has drifted from the document is no longer evidence.
 */

import type { Citation, Id } from "../types/index.ts";
import type { Store } from "../store/index.ts";

/** The marker the model is instructed to emit. */
const CITATION_PATTERN = /\[\[cite:([A-Za-z0-9_-]+)\]\]/g;

export interface ResolutionResult {
  /** Text with valid markers removed and invalid ones stripped. */
  text: string;
  /** Citations that resolved to real, verified spans. */
  citations: Citation[];
  /** How many markers referenced something that could not be verified. */
  stripped: number;
  /** True when the model cited something it was never shown. */
  hallucinatedCitation: boolean;
}

export function resolveCitations(
  store: Store,
  userId: Id,
  text: string,
  allowedBlockIds: Iterable<Id>,
): ResolutionResult {
  const allowed = new Set(allowedBlockIds);
  const citations: Citation[] = [];
  const seen = new Set<Id>();
  let stripped = 0;
  let hallucinated = false;

  const cleaned = text.replace(CITATION_PATTERN, (_match, blockId: string) => {
    // Step 1: was this block ever shown to the model?
    if (!allowed.has(blockId)) {
      stripped++;
      hallucinated = true;
      return "";
    }

    // Step 2: does the block still exist, for this user?
    const block = store.blocks.get(userId, blockId);
    if (!block) {
      stripped++;
      return "";
    }

    // Step 3: does the document still say what the block claims it says?
    // This is the check that makes a citation evidence rather than a label.
    const document = store.documents.get(userId, block.documentId);
    if (!document) {
      stripped++;
      return "";
    }
    const actual = document.text.slice(block.startOffset, block.endOffset);
    if (actual !== block.text) {
      stripped++;
      return "";
    }

    if (!seen.has(blockId)) {
      seen.add(blockId);
      citations.push({
        documentId: document.id,
        blockId: block.id,
        documentTitle: document.title,
        pageNumber: block.pageNumber,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        text: block.text,
      });
    }
    // The marker itself is removed; the UI renders citations from the list,
    // so provenance survives even though the inline token does not.
    return "";
  });

  return {
    text: tidy(cleaned),
    citations,
    stripped,
    hallucinatedCitation: hallucinated,
  };
}

/** Removes the whitespace artefacts left behind by stripping inline markers. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Renders context blocks with the handles the model is allowed to cite. */
export function renderCitableBlock(blockId: Id, title: string, page: number | null, text: string): string {
  const location = page !== null ? `${title}, page ${page}` : title;
  return `[block:${blockId}] (${location})\n${text}`;
}
