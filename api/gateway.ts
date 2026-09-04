/**
 * The gateway, as a function on the same origin as the app.
 *
 * This is the whole point of the architecture, finally wired up: the browser holds
 * no provider credential and never could. `ANTHROPIC_API_KEY` is a Vercel
 * environment variable, readable only by this function, and the page talks to
 * `/v1/tutor` on its own origin. There is nothing in the deployed HTML — and
 * nothing in anyone's browser storage — that could be stolen and billed to you.
 *
 * The routes, the context budgeting, the redaction, the deterministic grading and
 * the rate limiter are all `server/src`, unchanged. This file is only the adapter
 * between Vercel's request and `app.handle`.
 */

import { loadConfig } from "../server/src/config.ts";
import { createApp, type App } from "../server/src/http/app.ts";
import { AnthropicProvider } from "../server/src/providers/ai/anthropic.ts";
import { ElevenLabsVoice } from "../server/src/providers/voice/elevenlabs.ts";
import { Logger } from "../server/src/util/log.ts";

export const maxDuration = 60;

let app: App | null = null;
let startupError: string | null = null;

/**
 * Built on the first request rather than at module load, so a missing environment
 * variable produces an explanation the operator can act on instead of a cold-start
 * crash that reads as a platform fault.
 */
function gateway(): App | null {
  if (app || startupError) return app;
  try {
    const config = loadConfig();
    app = createApp({
      config,
      ai: new AnthropicProvider({
        apiKey: config.anthropicApiKey,
        models: config.models,
        defaultMaxOutputTokens: config.maxOutputTokens,
        defaultEffort: config.effort,
      }),
      voice: new ElevenLabsVoice({ apiKey: config.elevenLabsApiKey }),
      logger: new Logger(config.logLevel),
    });
  } catch (error) {
    startupError = error instanceof Error ? error.message : String(error);
  }
  return app;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * The rewrite carries the original path in `__p`, so routing never depends on how
 * the platform happens to rewrite a URL.
 */
async function handle(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const path = incoming.searchParams.get("__p") || incoming.pathname;

  const instance = gateway();
  if (!instance) {
    return json({
      error: {
        code: "notConfigured",
        message:
          "This deployment has no provider credentials yet. In the Vercel project, " +
          "add ANTHROPIC_API_KEY and SLATE_APP_TOKEN as environment variables and redeploy. " +
          "The key is only ever read here, on the server.",
        detail: startupError,
      },
    }, 503);
  }

  // The body has already been read off the socket by the platform, so it is safe to
  // rebuild the request against the effective path.
  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const rebuilt = new Request(`https://${incoming.host}${path}`, {
    method,
    headers: request.headers,
    ...(hasBody ? { body: await request.arrayBuffer() } : {}),
  });

  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded ? forwarded.split(",")[0]!.trim() : "unknown";
  return instance.handle(rebuilt, address);
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = (): Response =>
  new Response(null, { status: 204, headers: { allow: "GET, POST, OPTIONS" } });
