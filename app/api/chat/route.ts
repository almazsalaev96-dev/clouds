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

      if (!key) {
        const error: ChatError = {
          kind: "no_key",
          message: `No ${PROVIDERS[model.provider].name} key yet. Add one to use ${model.name}.`,
          action: "add_key",
        };
        emit({ type: "error", error });
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
