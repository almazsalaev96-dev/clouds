/**
 * Process entry point: the only place that touches sockets, signals and secrets.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig, redactConfig } from "./config.ts";
import { createApp } from "./http/app.ts";
import { AnthropicProvider } from "./providers/ai/anthropic.ts";
import { ElevenLabsVoice } from "./providers/voice/elevenlabs.ts";
import { Logger } from "./util/log.ts";

const config = loadConfig();
const log = new Logger(config.logLevel);

const app = createApp({
  config,
  ai: new AnthropicProvider({
    apiKey: config.anthropicApiKey,
    models: config.models,
    defaultMaxOutputTokens: config.maxOutputTokens,
    defaultEffort: config.effort,
  }),
  voice: new ElevenLabsVoice({ apiKey: config.elevenLabsApiKey }),
  logger: log,
});

const sweep = setInterval(() => app.limiter.sweep(), 60_000);
sweep.unref();

const server = createServer((req, res) => { void bridge(req, res); });

async function bridge(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const response = await app.handle(await toWebRequest(req), remoteAddress(req));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    if (!response.body) { res.end(); return; }
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    log.error("failed to serve request", { cause: error });
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
    }
    res.end(JSON.stringify({
      error: { code: "internal", message: "Something went wrong at our end. Your work is saved." },
    }));
  }
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(`http://localhost${req.url ?? "/"}`, {
    method, headers,
    ...(hasBody ? { body: Buffer.concat(chunks) } : {}),
  });
}

function remoteAddress(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

server.listen(config.port, () => {
  log.info("gateway listening", { ...redactConfig(config) });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info("shutting down", { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
