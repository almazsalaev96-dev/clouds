/**
 * Tool system (§32).
 *
 * Two properties are enforced structurally rather than asked for in a prompt:
 *
 *  - **A tool call is recorded only if it actually ran.** The transcript is
 *    generated from the invocation log, so "the AI said it calculated
 *    something but didn't" is not a state this system can produce.
 *  - **Results carry a trust level.** `computed` (deterministic, verifiable),
 *    `retrieved` (from the user's own corpus, citable), `external` (from
 *    outside, must be attributed). The generator treats them differently.
 */

import type { Id, Result, ToolCallRecord } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";
import type { Store } from "../store/index.ts";
import type { ToolSpec } from "../model/types.ts";
import { evaluateExpression } from "./calculator.ts";
import { retrieve } from "../knowledge/retrieval.ts";
import { createArtifact, patchArtifact } from "../artifacts/index.ts";
import type { ArtifactKind, BlockKind } from "../types/index.ts";

export type TrustLevel = "computed" | "retrieved" | "external";

export interface ToolContext {
  store: Store;
  userId: Id;
  workspaceId: Id;
  conversationId?: Id;
  projectId?: Id | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Whether running this changes stored state. Side-effecting tools are logged loudly. */
  sideEffecting: boolean;
  trust: TrustLevel;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<Result<unknown>>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Specs handed to the model. Only registered tools can ever be offered. */
  specs(): ToolSpec[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * Runs a tool and returns a record of what actually happened. A failure is
   * recorded as a failure — never silently swallowed, and never reported as a
   * success with invented output.
   */
  async invoke(
    name: string,
    input: unknown,
    ctx: ToolContext,
  ): Promise<{ record: ToolCallRecord; result: Result<unknown> }> {
    const startedAt = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      const result = fail("tool_failed", `There is no tool called "${name}".`);
      return {
        record: { toolName: name, input, failure: result.ok ? undefined : result.failure, elapsedMs: 0, startedAt },
        result,
      };
    }

    let result: Result<unknown>;
    try {
      result = await tool.run((input ?? {}) as Record<string, unknown>, ctx);
    } catch (error) {
      // A throwing tool is a bug, but it must not take down the turn (§33).
      result = fail("tool_failed", `${tool.name} could not complete.`, {
        retryable: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      record: {
        toolName: name,
        input,
        output: result.ok ? result.value : undefined,
        failure: result.ok ? undefined : result.failure,
        elapsedMs: Date.now() - startedAt,
        startedAt,
      },
      result,
    };
  }
}

// ─────────────────────────────────────────────────────────── built-in tools ───

const calculate: ToolDefinition = {
  name: "calculate",
  description:
    "Evaluate an arithmetic expression exactly. Use this for any calculation " +
    "rather than doing arithmetic mentally. Supports + - * / ^ %, brackets, " +
    "and sqrt, abs, round, floor, ceil, min, max, ln, log, exp.",
  inputSchema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "e.g. \"(340000 / 500000) * 100\"" },
    },
    required: ["expression"],
    additionalProperties: false,
  },
  sideEffecting: false,
  trust: "computed",
  async run(input) {
    const expression = String(input.expression ?? "");
    const result = evaluateExpression(expression);
    if (!result.ok) return result;
    return ok({ expression, value: result.value });
  },
};

const searchKnowledge: ToolDefinition = {
  name: "search_knowledge",
  description:
    "Search everything the user has added — documents, notes, pasted material — " +
    "and return passages with exact locations. Use this before answering any " +
    "question about the user's own material, and cite what comes back.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      documentId: { type: "string", description: "Optional: restrict to one document." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  sideEffecting: false,
  trust: "retrieved",
  async run(input, ctx) {
    const query = String(input.query ?? "");
    if (!query.trim()) return fail("invalid_input", "A search needs a query.");
    const documentId = input.documentId ? String(input.documentId) : undefined;

    const hits = retrieve(ctx.store, ctx.userId, query, {
      limit: 8,
      documentIds: documentId ? [documentId] : undefined,
    });

    return ok({
      query,
      results: hits.map((hit) => {
        const doc = ctx.store.documents.get(ctx.userId, hit.block.documentId);
        return {
          // These handles are what a citation must resolve against. The model
          // can only cite what appears here (§D).
          documentId: hit.block.documentId,
          documentTitle: doc?.title ?? "Untitled",
          blockId: hit.block.id,
          pageNumber: hit.block.pageNumber,
          startOffset: hit.block.startOffset,
          endOffset: hit.block.endOffset,
          text: hit.block.text,
          via: hit.via,
        };
      }),
    });
  },
};

const ARTIFACT_KINDS: ArtifactKind[] = [
  "note", "studyGuide", "report", "essay", "table", "quiz", "flashcards", "plan", "summary",
];

const createArtifactTool: ToolDefinition = {
  name: "create_artifact",
  description:
    "Create an editable document the user can keep and revise — notes, a study " +
    "guide, a quiz, a plan, a summary. Use this when the output is something to " +
    "work with rather than just read.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ARTIFACT_KINDS },
      title: { type: "string" },
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string" },
            text: { type: "string" },
            answer: { type: "string" },
            options: { type: "array", items: { type: "string" } },
          },
          required: ["kind", "text"],
        },
      },
      sourceDocumentIds: { type: "array", items: { type: "string" } },
    },
    required: ["kind", "title", "blocks"],
    additionalProperties: false,
  },
  sideEffecting: true,
  trust: "computed",
  async run(input, ctx) {
    const kind = String(input.kind ?? "note") as ArtifactKind;
    if (!ARTIFACT_KINDS.includes(kind)) {
      return fail("invalid_input", `"${kind}" is not a kind of artifact this system makes.`);
    }
    const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
    const blocks = rawBlocks.map((b) => {
      const block = b as Record<string, unknown>;
      return {
        kind: String(block.kind ?? "paragraph") as BlockKind,
        text: String(block.text ?? ""),
        ...(block.answer !== undefined ? { answer: String(block.answer) } : {}),
        ...(Array.isArray(block.options) ? { options: block.options.map(String) } : {}),
      };
    }).filter((b) => b.text.length > 0);

    const result = createArtifact(ctx.store, ctx.userId, {
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId ?? null,
      conversationId: ctx.conversationId ?? null,
      kind,
      title: String(input.title ?? ""),
      blocks,
      sourceDocumentIds: Array.isArray(input.sourceDocumentIds)
        ? input.sourceDocumentIds.map(String)
        : [],
    });
    if (!result.ok) return result;
    return ok({
      artifactId: result.value.id,
      title: result.value.title,
      kind: result.value.kind,
      blockCount: result.value.blocks.length,
    });
  },
};

const editArtifactTool: ToolDefinition = {
  name: "edit_artifact",
  description:
    "Change part of an existing artifact — rewrite one section, add or remove " +
    "content — without regenerating the whole thing and losing the user's edits.",
  inputSchema: {
    type: "object",
    properties: {
      artifactId: { type: "string" },
      patches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: ["setTitle", "replaceBlock", "insertBlock", "deleteBlock", "moveBlock"] },
            blockId: { type: "string" },
            afterBlockId: { type: "string" },
            title: { type: "string" },
            text: { type: "string" },
            answer: { type: "string" },
            toIndex: { type: "number" },
            block: { type: "object" },
          },
          required: ["op"],
        },
      },
    },
    required: ["artifactId", "patches"],
    additionalProperties: false,
  },
  sideEffecting: true,
  trust: "computed",
  async run(input, ctx) {
    const artifactId = String(input.artifactId ?? "");
    const patches = Array.isArray(input.patches) ? input.patches : [];
    const result = patchArtifact(ctx.store, ctx.userId, artifactId, patches as never);
    if (!result.ok) return result;
    return ok({ artifactId, version: result.value.version, blockCount: result.value.blocks.length });
  },
};

export function defaultToolRegistry(): ToolRegistry {
  return new ToolRegistry()
    .register(calculate)
    .register(searchKnowledge)
    .register(createArtifactTool)
    .register(editArtifactTool);
}
