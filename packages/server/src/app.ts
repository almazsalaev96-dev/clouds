/**
 * The API.
 *
 * Clients are views onto this; the intelligence lives behind it. Every handler
 * is scoped to the authenticated user by passing `ctx.userId` into the store,
 * which is the only way the store accepts a query at all.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createStore, type Store } from "../../core/src/store/index.ts";
import { ingestDocument } from "../../core/src/documents/ingest.ts";
import { retrieve } from "../../core/src/knowledge/retrieval.ts";
import { ModelRouter } from "../../core/src/model/router.ts";
import { defaultToolRegistry } from "../../core/src/tools/registry.ts";
import { runTurn, type Engine } from "../../core/src/orchestrator/turn.ts";
import { patchArtifact, renderArtifact } from "../../core/src/artifacts/index.ts";
import {
  editMemory, forget, listMemories, remember, setMemoryEnabled,
} from "../../core/src/memory/index.ts";
import { allMastery, masteryFor, isInsufficientEvidence } from "../../core/src/learning/mastery.ts";
import { detectMistakes } from "../../core/src/learning/mistakes.ts";
import { nextBestActions, recordAttempt } from "../../core/src/learning/nextAction.ts";
import { anthropicProviders } from "./providers/anthropic.ts";
import {
  EventStream, RateLimiter, Router, readCookie, readJson, sendError, sendJson,
  setSessionCookie, signSession, verifySession, type Ctx,
} from "./http.ts";

/**
 * Resolved lazily and defensively.
 *
 * `import.meta.url` is not always meaningful once the server has been bundled
 * for another runtime, and a throw at module scope takes down every route —
 * including the ones that never touch the filesystem. Static files are served
 * by the platform in that deployment anyway, so failing to locate them must
 * degrade to a 404, not to a dead function.
 */
let webRoot: string | null | undefined;
function resolveWebRoot(): string | null {
  if (webRoot !== undefined) return webRoot;
  try {
    webRoot = fileURLToPath(new URL("../../../apps/web/", import.meta.url));
  } catch {
    webRoot = null;
  }
  return webRoot;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

export interface AppOptions {
  store?: Store;
  engine?: Partial<Engine>;
  /** Set false in tests so cookies work over plain HTTP. */
  secureCookies?: boolean;
  /**
   * Whether writes survive the process. False on a serverless runtime with no
   * database attached, where the store lives only in a warm instance's memory.
   * Reported to the client so the interface can say so plainly (§33) instead
   * of letting someone discover it by losing a document.
   */
  durable?: boolean;
}

export interface App {
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  store: Store;
  engine: Engine;
}

/**
 * Builds the request handler without binding a port, so the same application
 * runs behind `createServer` locally and inside a serverless function on a
 * platform that owns the listener itself.
 */
export function createHandler(options: AppOptions = {}): App {
  const store = options.store ?? createStore();

  const router = new ModelRouter();
  for (const provider of options.engine?.router
    ? options.engine.router.registered
    : anthropicProviders()) {
    router.register(provider);
  }

  const engine: Engine = {
    store,
    router: options.engine?.router ?? router,
    tools: options.engine?.tools ?? defaultToolRegistry(),
  };

  // Generous enough that real use never notices; tight enough that a runaway
  // client cannot spend unbounded money.
  const turnLimiter = new RateLimiter(12, 30);
  const routes = buildRoutes(engine, turnLimiter, options.durable ?? true);
  const secure = options.secureCookies ?? process.env.NODE_ENV === "production";

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      // ── session ───────────────────────────────────────────────────────────
      let userId = verifySession(readCookie(req, "session"));
      if (userId && !store.users.get(userId, userId)) userId = null;
      if (!userId) {
        // §41: no signup wall. A workspace exists the moment someone arrives,
        // and identity can be attached later without losing anything.
        const user = store.createUser({ displayName: "You" });
        store.workspaces.insert(user.id, { name: "My workspace" } as never);
        userId = user.id;
        setSessionCookie(res, signSession(userId), secure);
      }

      if (url.pathname.startsWith("/api/")) {
        const matched = routes.match(req.method ?? "GET", url.pathname);
        if (!matched) return sendError(res, 404, "No such endpoint.", "not_found");
        await matched.handler({ req, res, url, params: matched.params, userId });
        return;
      }

      await serveStatic(url.pathname, res);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (detail === "payload too large") {
        return sendError(res, 413, "That file is too large to upload.", "unsupported_file");
      }
      // Never leak internals to the client; log them for the operator.
      console.error("[understory] unhandled:", error);
      if (!res.headersSent) sendError(res, 500, "Something went wrong on the server.", "model_error");
      else res.end();
    }
  };

  return { handler, store, engine };
}

export function createApp(options: AppOptions = {}): { server: Server; store: Store; engine: Engine } {
  const app = createHandler(options);
  return { server: createServer(app.handler), store: app.store, engine: app.engine };
}

async function serveStatic(pathname: string, res: import("node:http").ServerResponse): Promise<void> {
  const root = resolveWebRoot();
  if (!root) return sendError(res, 404, "Not found.", "not_found");

  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  // Path traversal guard: resolve the request, then ask whether the result is
  // still inside the web root. `relative` is used rather than a string prefix
  // because the root path ends in a separator, and prefix comparison against
  // it is easy to get subtly wrong in a way that fails closed on every file.
  const resolved = resolve(root, requested);
  const rel = relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    return sendError(res, 403, "Forbidden.", "forbidden");
  }
  try {
    const body = await readFile(resolved);
    res.writeHead(200, {
      "content-type": MIME[extname(resolved)] ?? "application/octet-stream",
      "content-length": body.length,
      "x-content-type-options": "nosniff",
    });
    res.end(body);
  } catch {
    sendError(res, 404, "Not found.", "not_found");
  }
}

function buildRoutes(engine: Engine, turnLimiter: RateLimiter, durable: boolean): Router {
  const { store } = engine;
  const router = new Router();

  /** The workspace a request belongs to, created on demand. */
  const workspaceFor = (userId: string): string => {
    const existing = store.workspaces.list(userId, { limit: 1 })[0];
    return (existing ?? store.workspaces.insert(userId, { name: "My workspace" } as never)).id;
  };

  // ── bootstrap ─────────────────────────────────────────────────────────────
  router.get("/api/state", ({ res, userId }: Ctx) => {
    const user = store.users.get(userId, userId)!;
    const workspaceId = workspaceFor(userId);
    const modelStatus = engine.router.select("conversation");

    sendJson(res, 200, {
      user: { id: user.id, displayName: user.displayName, memoryEnabled: user.memoryEnabled },
      workspaceId,
      documents: store.documents.list(userId, { sort: (a, b) => b.updatedAt - a.updatedAt })
        .map(summariseDocument),
      conversations: store.conversations.list(userId, { sort: (a, b) => b.updatedAt - a.updatedAt, limit: 30 })
        .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })),
      artifacts: store.artifacts.list(userId, { sort: (a, b) => b.updatedAt - a.updatedAt, limit: 30 })
        .map((a) => ({ id: a.id, title: a.title, kind: a.kind, version: a.version, updatedAt: a.updatedAt })),
      nextActions: nextBestActions(store, userId),
      // The interface must be able to say plainly that the AI is unavailable
      // rather than appearing broken (§33).
      model: modelStatus.ok
        ? { available: true, id: modelStatus.value.id }
        : { available: false, failure: modelStatus.failure },
      storage: {
        durable,
        note: durable
          ? null
          : "This deployment has no database attached, so anything you add lives only in memory and disappears when the server restarts.",
      },
    });
  });

  // ── documents ─────────────────────────────────────────────────────────────
  router.post("/api/documents", async ({ req, res, userId }: Ctx) => {
    const body = await readJson<{ title?: string; text?: string; mimeType?: string; sourceKind?: string }>(req);
    if (!body?.text) return sendError(res, 400, "Nothing to read — the file appears to be empty.");

    const result = ingestDocument(store, userId, {
      workspaceId: workspaceFor(userId),
      title: body.title,
      text: body.text,
      mimeType: body.mimeType,
      sourceKind: (body.sourceKind as never) ?? "upload",
    });
    if (!result.ok) return sendJson(res, 400, { failure: result.failure });

    sendJson(res, 201, {
      document: summariseDocument(result.value.document),
      blocks: result.value.blocks.length,
      concepts: result.value.newConceptIds.map((id) => store.concepts.get(userId, id)?.name).filter(Boolean),
    });
  });

  router.get("/api/documents/:id", ({ res, params, userId }: Ctx) => {
    const document = store.documents.get(userId, params.id);
    if (!document) return sendError(res, 404, "That document no longer exists.", "not_found");
    sendJson(res, 200, {
      document: summariseDocument(document),
      text: document.text,
      blocks: store.blocks.list(userId, {
        where: { documentId: document.id } as never,
        sort: (a, b) => a.index - b.index,
      }).map((b) => ({
        id: b.id, kind: b.kind, text: b.text, depth: b.depth,
        startOffset: b.startOffset, endOffset: b.endOffset, pageNumber: b.pageNumber,
      })),
    });
  });

  router.delete("/api/documents/:id", ({ res, params, userId }: Ctx) => {
    for (const block of store.blocks.list(userId, { where: { documentId: params.id } as never })) {
      store.blocks.delete(userId, block.id);
    }
    const removed = store.documents.delete(userId, params.id);
    if (!removed) return sendError(res, 404, "That document no longer exists.", "not_found");
    sendJson(res, 200, { deleted: true });
  });

  // ── search ────────────────────────────────────────────────────────────────
  router.get("/api/search", ({ res, url, userId }: Ctx) => {
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query) return sendJson(res, 200, { query, results: [] });

    const blocks = retrieve(store, userId, query, { limit: 20 }).map((hit) => {
      const document = store.documents.get(userId, hit.block.documentId);
      return {
        kind: "block" as const,
        blockId: hit.block.id,
        documentId: hit.block.documentId,
        documentTitle: document?.title ?? "Untitled",
        pageNumber: hit.block.pageNumber,
        text: hit.block.text,
        via: hit.via,
      };
    });

    // Search spans everything, not only documents (§39).
    const needle = query.toLowerCase();
    const conversations = store.conversations.list(userId)
      .filter((c) => c.title.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((c) => ({ kind: "conversation" as const, id: c.id, title: c.title }));
    const artifacts = store.artifacts.list(userId)
      .filter((a) => a.title.toLowerCase().includes(needle) ||
        a.blocks.some((b) => b.text.toLowerCase().includes(needle)))
      .slice(0, 5)
      .map((a) => ({ kind: "artifact" as const, id: a.id, title: a.title, artifactKind: a.kind }));

    sendJson(res, 200, { query, results: [...blocks, ...conversations, ...artifacts] });
  });

  // ── conversations ─────────────────────────────────────────────────────────
  router.post("/api/conversations", ({ res, userId }: Ctx) => {
    const conversation = store.conversations.insert(userId, {
      workspaceId: workspaceFor(userId), projectId: null,
      title: "New conversation", pinnedDocumentIds: [],
    } as never);
    sendJson(res, 201, { conversation: { id: conversation.id, title: conversation.title } });
  });

  router.get("/api/conversations/:id", ({ res, params, userId }: Ctx) => {
    const conversation = store.conversations.get(userId, params.id);
    if (!conversation) return sendError(res, 404, "That conversation no longer exists.", "not_found");
    sendJson(res, 200, {
      conversation: {
        id: conversation.id, title: conversation.title,
        pinnedDocumentIds: conversation.pinnedDocumentIds,
      },
      messages: store.messages.list(userId, {
        where: { conversationId: conversation.id } as never,
        sort: (a, b) => a.createdAt - b.createdAt,
      }).map((m) => ({
        id: m.id, role: m.role, text: m.text, citations: m.citations,
        toolCalls: m.toolCalls.map((t) => ({
          toolName: t.toolName, input: t.input, output: t.output,
          failure: t.failure, elapsedMs: t.elapsedMs,
        })),
        contextTrace: m.contextTrace, failure: m.failure, createdAt: m.createdAt,
      })),
    });
  });

  // ── the turn (streamed) ───────────────────────────────────────────────────
  router.post("/api/conversations/:id/turn", async (ctx: Ctx) => {
    const { req, res, params, userId } = ctx;
    const body = await readJson<{
      text?: string;
      openDocumentId?: string;
      selection?: { documentId: string; blockId?: string; text: string; startOffset: number; endOffset: number };
    }>(req);

    if (!body?.text?.trim()) return sendError(res, 400, "There is no message to send.");
    if (!turnLimiter.take(userId)) {
      return sendError(res, 429, "You are sending messages faster than they can be answered. Wait a moment.", "rate_limited");
    }

    const stream = new EventStream(res);
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
      for await (const event of runTurn(engine, {
        userId,
        workspaceId: workspaceFor(userId),
        conversationId: params.id,
        text: body.text,
        openDocumentId: body.openDocumentId,
        selection: body.selection,
        signal: controller.signal,
      })) {
        stream.send(event.type, event);
      }
    } catch (error) {
      stream.send("failure", {
        type: "failure",
        failure: {
          code: "model_error",
          message: "The answer stopped unexpectedly. Your message was saved.",
          retryable: true,
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      stream.close();
    }
  });

  // ── artifacts ─────────────────────────────────────────────────────────────
  router.get("/api/artifacts/:id", ({ res, params, userId }: Ctx) => {
    const artifact = store.artifacts.get(userId, params.id);
    if (!artifact) return sendError(res, 404, "That artifact no longer exists.", "not_found");
    sendJson(res, 200, { artifact, markdown: renderArtifact(artifact) });
  });

  router.patch("/api/artifacts/:id", async ({ req, res, params, userId }: Ctx) => {
    const body = await readJson<{ patches?: unknown[] }>(req);
    if (!Array.isArray(body?.patches)) return sendError(res, 400, "No changes were supplied.");
    const result = patchArtifact(store, userId, params.id, body.patches as never);
    if (!result.ok) return sendJson(res, result.failure.code === "not_found" ? 404 : 400, { failure: result.failure });
    sendJson(res, 200, { artifact: result.value });
  });

  // ── memory (§8) ───────────────────────────────────────────────────────────
  router.get("/api/memories", ({ res, userId }: Ctx) => {
    const user = store.users.get(userId, userId)!;
    sendJson(res, 200, { enabled: user.memoryEnabled, memories: listMemories(store, userId) });
  });

  router.post("/api/memories", async ({ req, res, userId }: Ctx) => {
    const body = await readJson<{ kind?: string; text?: string; quote?: string; pinned?: boolean }>(req);
    const result = remember(store, userId, {
      kind: (body?.kind as never) ?? "fact",
      text: body?.text ?? "",
      quote: body?.quote ?? body?.text ?? "",
      pinned: body?.pinned,
    });
    if (!result.ok) return sendJson(res, 400, { failure: result.failure });
    sendJson(res, 201, { memory: result.value });
  });

  router.patch("/api/memories/:id", async ({ req, res, params, userId }: Ctx) => {
    const body = await readJson<{ text?: string }>(req);
    const result = editMemory(store, userId, params.id, body?.text ?? "");
    if (!result.ok) return sendJson(res, result.failure.code === "not_found" ? 404 : 400, { failure: result.failure });
    sendJson(res, 200, { memory: result.value });
  });

  router.delete("/api/memories/:id", ({ res, params, userId }: Ctx) => {
    const result = forget(store, userId, params.id);
    if (!result.ok) return sendJson(res, 404, { failure: result.failure });
    sendJson(res, 200, { deleted: true });
  });

  router.post("/api/memory-settings", async ({ req, res, userId }: Ctx) => {
    const body = await readJson<{ enabled?: boolean }>(req);
    const result = setMemoryEnabled(store, userId, body?.enabled !== false);
    if (!result.ok) return sendJson(res, 400, { failure: result.failure });
    sendJson(res, 200, { enabled: body?.enabled !== false });
  });

  // ── learning (§10, §23) ───────────────────────────────────────────────────
  router.get("/api/learning", ({ res, userId }: Ctx) => {
    sendJson(res, 200, {
      concepts: allMastery(store, userId).map((m) => ({
        conceptId: m.conceptId,
        name: store.concepts.get(userId, m.conceptId)?.name ?? "Unknown",
        estimate: m.estimate,
        confidence: m.confidence,
        attempts: m.attempts,
        // The interface must show "not enough evidence yet" instead of a
        // number it cannot justify.
        reportable: !isInsufficientEvidence(m),
        lastPracticedAt: m.lastPracticedAt,
      })),
      nextActions: nextBestActions(store, userId),
    });
  });

  /** Every concept the user's material has raised, with mastery where known. */
  router.get("/api/concepts", ({ res, userId }: Ctx) => {
    sendJson(res, 200, {
      concepts: store.concepts.list(userId, { sort: (a, b) => a.name.localeCompare(b.name) })
        .map((concept) => {
          const mastery = masteryFor(store, userId, concept.id);
          const documentIds = store.edges
            .list(userId, { where: { toId: concept.id, kind: "teaches" } as never })
            .map((edge) => edge.fromId);
          return {
            id: concept.id,
            name: concept.name,
            documentIds,
            attempts: mastery.attempts,
            estimate: mastery.estimate,
            confidence: mastery.confidence,
            reportable: !isInsufficientEvidence(mastery),
          };
        }),
    });
  });

  router.post("/api/learning/attempt", async ({ req, res, userId }: Ctx) => {
    const body = await readJson<{
      conceptId?: string; prompt?: string; response?: string;
      correct?: boolean; difficulty?: number; artifactId?: string;
    }>(req);
    if (!body?.conceptId || typeof body.correct !== "boolean") {
      return sendError(res, 400, "An attempt needs a concept and whether it was correct.");
    }
    if (!store.concepts.get(userId, body.conceptId)) {
      return sendError(res, 404, "That concept no longer exists.", "not_found");
    }
    const { mastery } = recordAttempt(store, userId, {
      conceptId: body.conceptId,
      artifactId: body.artifactId ?? null,
      prompt: body.prompt ?? "",
      response: body.response ?? "",
      correct: body.correct,
      difficulty: body.difficulty,
    });
    detectMistakes(store, userId, body.conceptId);
    sendJson(res, 201, {
      mastery: { ...mastery, reportable: !isInsufficientEvidence(mastery) },
      nextActions: nextBestActions(store, userId),
    });
  });

  // ── account deletion (§34) ────────────────────────────────────────────────
  router.delete("/api/account", ({ res, userId }: Ctx) => {
    store.deleteUser(userId);
    res.setHeader("set-cookie", "session=; Path=/; HttpOnly; Max-Age=0");
    sendJson(res, 200, { deleted: true });
  });

  return router;
}

const summariseDocument = (d: {
  id: string; title: string; blockCount: number; sourceKind: string;
  mimeType: string; ingestState: string; updatedAt: number;
}) => ({
  id: d.id, title: d.title, blockCount: d.blockCount, sourceKind: d.sourceKind,
  mimeType: d.mimeType, ingestState: d.ingestState, updatedAt: d.updatedAt,
});
