import type { NextRequest } from "next/server";
import { adapterFor } from "@/lib/providers";
import { getModel, PROVIDERS } from "@/lib/models";
import type { ChatRequest, ChatError, StreamEvent } from "@/lib/types";
import { PLUS_PRICE, plusAllowed } from "@/lib/plus";
import { USED_UP, balance, debit, passCustomer, plusGating, validatePass } from "@/lib/plus.server";

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
  /* Whose key answers. The server's, where it holds one — it never reaches
     the browser — unless Armi Plus is switched on, in which case the
     server's keys are for members: a valid Plus key on an engine the plan
     covers unlocks them, and anyone else uses the key their browser sent.
     Without Plus configured nothing changes: the server answers for all. */
  const plusKey = body.plusKey?.trim();
  const viaPlus = Boolean(plusKey && plusGating() && plusAllowed(model.id) && (await validatePass(plusKey)));
  const key = viaPlus || !plusGating() ? (serverKey(model.provider) ?? body.clientKey) : body.clientKey;
  /* Who to bill comes off the signed pass, never off the request body. */
  const member = viaPlus && plusKey ? await passCustomer(plusKey) : undefined;

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
          message: plusGating()
            ? plusKey && !plusAllowed(model.id)
              ? `${model.name} is not part of Armi Plus. Add a ${PROVIDERS[model.provider].name} key of your own to use it.`
              : `No ${PROVIDERS[model.provider].name} key yet. Add one in Settings, or Armi Plus for ${PLUS_PRICE}.`
            : `No ${PROVIDERS[model.provider].name} key yet. Add one to use ${model.name}.`,
          action: "add_key",
        };
        emit({ type: "error", error });
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      /* The allowance, where one is configured: a member whose month is
         spent is told so before a token is bought on their behalf. */
      if (member) {
        const left = await balance(member);
        if (left !== null && left <= 0) {
          emit({ type: "error", error: { kind: "quota", message: USED_UP, action: "add_key" } });
          clearInterval(heartbeat);
          controller.close();
          return;
        }
      }

      const ac = new AbortController();
      // The user pressing stop must actually stop the upstream request, not
      // just stop rendering it — otherwise they keep paying for the tokens.
      req.signal.addEventListener("abort", () => ac.abort());

      let spent = 0;
      try {
        for await (const event of adapterFor(body.modelId)(body, key, ac.signal)) {
          if (req.signal.aborted) break;
          if (event.type === "usage") spent = event.usage.costUsd ?? spent;
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
        /* Paid for after the fact, from what the provider said it cost. */
        if (member && spent > 0) await debit(member, spent, model.id).catch(() => undefined);
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
