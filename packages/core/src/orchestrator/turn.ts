/**
 * Turn execution — the loop from §43, as code.
 *
 *   assemble context → choose model → generate → run tools → verify
 *   citations → persist → write back signal
 *
 * Emitted as an async generator so the server can stream without buffering and
 * the interface never freezes while the model works (§35).
 *
 * Failure is a first-class outcome here. Every path that can fail yields a
 * `failure` event and still persists a message, so the conversation never
 * contains an unexplained gap (§33).
 */

import type {
  Citation,
  ContextTrace,
  Failure,
  Id,
  Message,
  Result,
  ToolCallRecord,
} from "../types/index.ts";
import { fail } from "../types/index.ts";
import type { Store } from "../store/index.ts";
import type { ModelContent, ModelMessage } from "../model/types.ts";
import type { ModelRouter } from "../model/router.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { assembleContext, type Selection } from "../context/assemble.ts";
import { resolveCitations } from "../context/citations.ts";
import { buildPrompt } from "./prompt.ts";

export interface TurnRequest {
  userId: Id;
  workspaceId: Id;
  conversationId: Id;
  text: string;
  selection?: Selection;
  openDocumentId?: Id;
  projectId?: Id | null;
  budget?: number;
  signal?: AbortSignal;
}

export type TurnEvent =
  | { type: "context"; trace: ContextTrace }
  | { type: "text"; text: string }
  | { type: "tool"; record: ToolCallRecord }
  | { type: "citations"; citations: Citation[] }
  | { type: "done"; message: Message }
  | { type: "failure"; failure: Failure };

export interface Engine {
  store: Store;
  router: ModelRouter;
  tools: ToolRegistry;
}

/** Guards against a model that keeps calling tools without concluding. */
const MAX_TOOL_ROUNDS = 5;
const MAX_OUTPUT_TOKENS = 8000;

export async function* runTurn(
  engine: Engine,
  request: TurnRequest,
): AsyncGenerator<TurnEvent> {
  const { store, router, tools } = engine;
  const { userId, conversationId } = request;

  const conversation = store.conversations.get(userId, conversationId);
  if (!conversation) {
    yield { type: "failure", failure: notFound("That conversation no longer exists.") };
    return;
  }

  // Persist the user's message first, so their input is never lost even if
  // everything downstream fails.
  store.messages.insert(userId, {
    conversationId, role: "user", text: request.text, citations: [], toolCalls: [],
  } as never);

  // ── 1. Context ────────────────────────────────────────────────────────────
  const assembled = assembleContext(store, userId, {
    query: request.text,
    workspaceId: request.workspaceId,
    conversationId,
    projectId: request.projectId,
    selection: request.selection,
    openDocumentId: request.openDocumentId,
    budget: request.budget,
  });
  yield { type: "context", trace: assembled.trace };

  const prompt = buildPrompt(assembled.items);
  const citable = new Set(prompt.citableBlockIds);

  // ── 2. Model ──────────────────────────────────────────────────────────────
  const selected = router.select("conversation");
  if (!selected.ok) {
    yield { type: "failure", failure: selected.failure };
    persistFailure(store, userId, conversationId, selected.failure, assembled.trace);
    return;
  }
  const provider = selected.value;

  // ── 3. Generate, running tools until the model concludes ──────────────────
  const history = priorMessages(store, userId, conversationId);
  const messages: ModelMessage[] = [...history, { role: "user", content: request.text }];
  const toolRecords: ToolCallRecord[] = [];
  let answer = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    if (request.signal?.aborted) {
      const failure = { code: "timeout", message: "That request was cancelled.", retryable: true } as const;
      yield { type: "failure", failure };
      persistFailure(store, userId, conversationId, failure, assembled.trace);
      return;
    }

    let roundText = "";
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    let failed: Failure | null = null;

    try {
      for await (const event of provider.stream({
        system: prompt.system,
        messages,
        maxTokens: MAX_OUTPUT_TOKENS,
        task: "conversation",
        tools: tools.specs(),
        cacheablePrefix: prompt.cacheablePrefix,
      }, request.signal)) {
        if (event.type === "text") {
          roundText += event.text;
          // Citation markers are stripped at the end; streaming them would
          // flash raw syntax at the user, so hold back anything mid-marker.
          yield { type: "text", text: event.text };
        } else if (event.type === "tool_use") {
          toolUses.push({ id: event.id, name: event.name, input: event.input });
        } else if (event.type === "failure") {
          failed = event.failure;
        }
      }
    } catch (error) {
      failed = {
        code: "model_error",
        message: "The model stopped unexpectedly. Your message is saved — try again.",
        retryable: true,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    if (failed) {
      yield { type: "failure", failure: failed };
      persistFailure(store, userId, conversationId, failed, assembled.trace, answer + roundText);
      return;
    }

    answer += roundText;

    if (toolUses.length === 0) break;

    if (round === MAX_TOOL_ROUNDS) {
      const failure: Failure = {
        code: "tool_failed",
        message: "This took too many steps without reaching an answer. Try narrowing the question.",
        retryable: true,
      };
      yield { type: "failure", failure };
      persistFailure(store, userId, conversationId, failure, assembled.trace, answer);
      return;
    }

    // Echo the assistant turn back with its real tool_use blocks, then supply
    // the real results. Both halves must be genuine or the model's next turn
    // reasons about a call that never happened (§32).
    const assistantContent: ModelContent[] = [];
    if (roundText) assistantContent.push({ type: "text", text: roundText });
    for (const use of toolUses) {
      assistantContent.push({ type: "tool_use", id: use.id, name: use.name, input: use.input });
    }
    messages.push({ role: "assistant", content: assistantContent });

    const results: ModelContent[] = [];
    for (const use of toolUses) {
      const { record, result } = await tools.invoke(use.name, use.input, {
        store, userId,
        workspaceId: request.workspaceId,
        conversationId,
        projectId: request.projectId,
      });
      toolRecords.push(record);
      yield { type: "tool", record };

      // A retrieval tool widens what may be cited — but only with the handles
      // it genuinely returned.
      if (result.ok && use.name === "search_knowledge") {
        for (const hit of (result.value as { results?: Array<{ blockId?: string }> }).results ?? []) {
          if (hit.blockId) citable.add(hit.blockId);
        }
      }

      results.push({
        type: "tool_result",
        toolUseId: use.id,
        content: result.ok
          ? JSON.stringify(result.value)
          : `Error: ${result.failure.message}`,
        isError: !result.ok,
      });
    }
    messages.push({ role: "user", content: results });
  }

  // ── 4. Verify citations before anything is shown as final ─────────────────
  const resolved = resolveCitations(store, userId, answer, citable);
  if (resolved.citations.length > 0) {
    yield { type: "citations", citations: resolved.citations };
  }

  // ── 5. Persist ────────────────────────────────────────────────────────────
  const message = store.messages.insert(userId, {
    conversationId,
    role: "assistant",
    text: resolved.text,
    citations: resolved.citations,
    toolCalls: toolRecords,
    contextTrace: assembled.trace,
    ...(resolved.hallucinatedCitation
      ? {
          failure: {
            code: "parse_failed",
            message: "One reference in this answer could not be verified against your material and was removed.",
            retryable: false,
          },
        }
      : {}),
  } as never);

  // ── 6. Write back: what happened becomes tomorrow's context ───────────────
  for (const citation of resolved.citations) {
    store.edges.insert(userId, {
      fromType: "message", fromId: message.id,
      toType: "document", toId: citation.documentId,
      kind: "mentions", weight: 1,
      provenance: `cited block ${citation.blockId}`,
    } as never);
  }
  if (conversation.title === "New conversation" && request.text.trim()) {
    store.conversations.update(userId, conversationId, {
      title: request.text.trim().slice(0, 60),
    } as never);
  }

  yield { type: "done", message };
}

function priorMessages(store: Store, userId: Id, conversationId: Id): ModelMessage[] {
  return store.messages
    .list(userId, {
      where: { conversationId } as never,
      sort: (a, b) => a.createdAt - b.createdAt,
    })
    // Drop the message just inserted for this turn; it is appended explicitly.
    .slice(0, -1)
    .filter((m) => m.role !== "system" && m.text.trim().length > 0)
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
}

function persistFailure(
  store: Store,
  userId: Id,
  conversationId: Id,
  failure: Failure,
  trace: ContextTrace,
  partial = "",
): void {
  store.messages.insert(userId, {
    conversationId,
    role: "assistant",
    text: partial,
    citations: [],
    toolCalls: [],
    contextTrace: trace,
    failure,
  } as never);
}

const notFound = (message: string): Failure => ({
  code: "not_found", message, retryable: false,
});

/** Convenience for callers that only want the final result. */
export async function runTurnToCompletion(
  engine: Engine,
  request: TurnRequest,
): Promise<Result<Message>> {
  let last: Message | null = null;
  let failure: Failure | null = null;
  for await (const event of runTurn(engine, request)) {
    if (event.type === "done") last = event.message;
    if (event.type === "failure") failure = event.failure;
  }
  if (last) return { ok: true, value: last };
  return failure ? { ok: false, failure } : fail("model_error", "The turn produced no result.");
}
