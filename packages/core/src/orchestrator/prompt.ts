/**
 * Prompt construction.
 *
 * The system prompt is deliberately short. Long prompts full of rules are a
 * symptom of trying to control behaviour that should be controlled
 * structurally: this product does not ask the model to avoid fabricating
 * citations, it makes fabricated citations unrenderable (see
 * context/citations.ts). What is left here is genuine guidance about how to
 * behave, not guarantees that belong in code.
 *
 * It is also assembled cache-friendly: the stable identity text first, the
 * volatile per-turn context last, so the prefix survives between turns.
 */

import type { ContextItem } from "../types/index.ts";
import { renderCitableBlock } from "../context/citations.ts";

/** Stable across every turn — the cacheable prefix. */
export const IDENTITY = `You are the intelligence inside a personal knowledge and work environment. The person you are helping uses you to understand material, learn it, research, think, and produce work.

How to behave:

- You are one assistant, not a set of modes. Adapt to what the person is doing rather than announcing which capability you are using.
- Work from the material you are given. When the answer is in their documents, use those documents and cite them.
- Cite by writing [[cite:BLOCK_ID]] immediately after a claim, using an id from the CONTEXT section exactly as written. Cite the block you actually used. If nothing in the context supports a claim, say so plainly instead of citing something adjacent.
- When a request is vague, use the context to infer what is meant and act, stating the assumption you made in one short clause. Ask a question only when two readings are genuinely equally likely.
- Use the calculate tool for arithmetic rather than doing it in your head. Use search_knowledge before answering questions about the person's own material.
- When the output is something they will keep, revise, or work from, create an artifact instead of writing it into the conversation.
- Be direct and concrete. No preamble, no restating the question, no praise. Say what is true, including when that is "this material does not say".
- If you are uncertain, be uncertain out loud. Confident wrongness costs more than an admission of doubt.`;

export interface PromptParts {
  system: string;
  /** The portion that is stable and worth caching. */
  cacheablePrefix: string;
  /** Block ids the model is permitted to cite this turn. */
  citableBlockIds: string[];
}

export function buildPrompt(items: ContextItem[]): PromptParts {
  const citableBlockIds: string[] = [];
  const sections: Record<string, string[]> = {};

  const push = (heading: string, line: string) => {
    (sections[heading] ??= []).push(line);
  };

  for (const item of items) {
    switch (item.kind) {
      case "selection":
        push("WHAT THEY HAVE SELECTED", item.text);
        break;

      case "openDocument":
      case "retrievedBlock": {
        const blockId = item.source.blockId;
        if (blockId) {
          citableBlockIds.push(blockId);
          push("THEIR MATERIAL", renderCitableBlock(
            blockId,
            item.source.documentTitle ?? "Untitled",
            item.source.pageNumber ?? null,
            item.text,
          ));
        } else {
          push("THEIR MATERIAL", item.text);
        }
        break;
      }

      case "memory":
        push("WHAT YOU KNOW ABOUT THEM", `- ${item.text}`);
        break;

      case "concept":
        push("THEIR LEARNING STATE", `- ${item.text}`);
        break;

      case "projectIntent":
        push("WHAT THEY ARE WORKING ON", item.text);
        break;

      case "conversationTurn":
        // Conversation is passed as real messages, not pasted into the system
        // prompt, so the model sees turn structure rather than a transcript.
        break;
    }
  }

  const order = [
    "WHAT THEY ARE WORKING ON",
    "WHAT YOU KNOW ABOUT THEM",
    "THEIR LEARNING STATE",
    "WHAT THEY HAVE SELECTED",
    "THEIR MATERIAL",
  ];

  const context = order
    .filter((heading) => sections[heading]?.length)
    .map((heading) => `## ${heading}\n\n${sections[heading].join("\n\n")}`)
    .join("\n\n");

  const system = context
    ? `${IDENTITY}\n\n---\n\n# CONTEXT\n\n${context}`
    : `${IDENTITY}\n\n---\n\nThe person has not added any material yet. Answer from your own knowledge, and say plainly that you are doing so rather than implying you have read something of theirs.`;

  return { system, cacheablePrefix: IDENTITY, citableBlockIds };
}
