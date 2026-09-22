import type { NextRequest } from "next/server";
import { adapterFor } from "@/lib/providers";
import { getModel, PROVIDERS } from "@/lib/models";
import type { ChatRequest, ChatError, StreamEvent } from "@/lib/types";

export const runtime = "edge";
export const maxDuration = 300;

function serverKey(provider: string): string | undefined {
  const v = process.env[PROVIDERS[provider as keyof typeof PROVIDERS].keyName];
  return v && v.trim() ? v.trim() : undefined;
}

function sse(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const model = getModel(body.modelId);
  // A server-side key always wins: it never reaches the browser at all. The
  // client-supplied key is the fallback for people who don't run the server.
  const key = serverKey(model.provider) ?? body.clientKey;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => {
        try {
          controller.enqueue(sse(e));
        } catch {
          /* client already went away */
        }
      };

      /* Bytes now, and bytes every ten seconds until the provider speaks.
         ---------------------------------------------------------------
         Seen on a revision pack from a 988-page book: "The connection ended
         before the answer did." Nothing had ended at the provider. A large
         source on a reasoning model can sit for half a minute before its
         first event, and everything between this browser and the model —
         the edge runtime's first-byte deadline, a proxy's idle timeout, a
         phone's radio — treats a silent connection as a dead one. The
         client then sees a stream that stopped without a `done` and reports
         the only thing it knows.

         SSE has a frame for exactly this: a comment line, which every
         parser in this app already skips. One goes out immediately so the
         first byte is instant, and one every ten seconds while the upstream
         is quiet, so nothing in the middle ever has a reason to hang up. */
      const enc = new TextEncoder();
      const comment = (s: string) => {
        try {
          controller.enqueue(enc.encode(`: ${s}\n\n`));
        } catch {
          /* gone */
        }
      };
      comment("open");
      const heartbeat = setInterval(() => comment("ping"), 10_000);

      if (!key) {
        const error: ChatError = {
          kind: "no_key",
          message: `No ${PROVIDERS[model.provider].name} key yet. Add one to use ${model.name}.`,
          action: "add_key",
        };
        emit({ type: "error", error });
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      const ac = new AbortController();
      // The user pressing stop must actually stop the upstream request, not
      // just stop rendering it — otherwise they keep paying for the tokens.
      req.signal.addEventListener("abort", () => ac.abort());

      try {
        for await (const event of adapterFor(body.modelId)(body, key, ac.signal)) {
          if (req.signal.aborted) break;
          emit(event);
        }
      } catch (err) {
        if (!req.signal.aborted) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          emit({
            type: "error",
            error: isAbort
              ? { kind: "timeout", message: "The request was cut short.", action: "retry" }
              : {
                  kind: "network",
                  message: `Couldn't reach ${PROVIDERS[model.provider].name}.`,
                  action: "retry",
                  detail: err instanceof Error ? err.message : String(err),
                },
          });
        }
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disables proxy buffering, which otherwise holds tokens back and
      // destroys the one thing this app is built around.
      "x-accel-buffering": "no",
    },
  });
}
