/**
 * Configuration. Every secret arrives from the environment and none of it is ever
 * echoed back — not in a response, not in a log line, not in an error.
 */

export interface TaskModels {
  tutor: string;
  check: string;
  handwriting: string;
  documentAnalysis: string;
  generate: string;
  review: string;
}

export interface Config {
  port: number;
  anthropicApiKey: string;
  elevenLabsApiKey: string;
  models: TaskModels;
  /** Shared secret the app presents. Absent in development, required in production. */
  appToken: string | null;
  requestsPerMinute: number;
  maxContextBytes: number;
  maxOutputTokens: number;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  logLevel: "debug" | "info" | "warn" | "error";
  environment: "development" | "production";
}

/**
 * The default everywhere is the strongest model. Routing cheaper models onto simpler
 * tasks is a real saving and the specification asks for it, but which tasks are
 * "simple" is an operator's judgement about their own students' work, not ours, so it
 * is opt-in per task through the environment rather than a quiet default.
 */
const DEFAULT_MODEL = "claude-opus-5";

function required(env: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const v = env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(
      `${name} is not set. The gateway holds the provider credentials so the iPad app ` +
      `never has to; it cannot start without them.`,
    );
  }
  return v;
}

function int(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got ${JSON.stringify(raw)}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const environment = env["NODE_ENV"] === "production" ? "production" : "development";
  const appToken = env["SLATE_APP_TOKEN"] ?? null;
  if (environment === "production" && !appToken) {
    throw new Error("SLATE_APP_TOKEN must be set in production; an open gateway is a billing hole.");
  }
  const model = (task: string) => env[`SLATE_MODEL_${task}`] ?? env["SLATE_MODEL"] ?? DEFAULT_MODEL;

  return {
    port: int(env, "PORT", 8787),
    anthropicApiKey: required(env, "ANTHROPIC_API_KEY"),
    elevenLabsApiKey: env["ELEVENLABS_API_KEY"] ?? "",
    models: {
      tutor: model("TUTOR"),
      check: model("CHECK"),
      handwriting: model("HANDWRITING"),
      documentAnalysis: model("DOCUMENT"),
      generate: model("GENERATE"),
      review: model("REVIEW"),
    },
    appToken,
    requestsPerMinute: int(env, "SLATE_RPM", 60),
    maxContextBytes: int(env, "SLATE_MAX_CONTEXT_BYTES", 400_000),
    maxOutputTokens: int(env, "SLATE_MAX_OUTPUT_TOKENS", 16_000),
    effort: (env["SLATE_EFFORT"] as Config["effort"]) ?? "high",
    logLevel: (env["SLATE_LOG_LEVEL"] as Config["logLevel"]) ?? "info",
    environment,
  };
}

/** Never log a config object directly; log this. */
export function redactConfig(c: Config): Record<string, unknown> {
  return {
    port: c.port,
    environment: c.environment,
    models: c.models,
    effort: c.effort,
    requestsPerMinute: c.requestsPerMinute,
    maxContextBytes: c.maxContextBytes,
    anthropicApiKey: c.anthropicApiKey ? "set" : "missing",
    elevenLabsApiKey: c.elevenLabsApiKey ? "set" : "missing",
    appToken: c.appToken ? "set" : "not required (development)",
  };
}
