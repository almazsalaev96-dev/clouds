/** Structured logging that never prints a secret or a student's work. */

export type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const SENSITIVE = /^(authorization|x-slate-token|api[-_]?key|anthropic[-_]?api[-_]?key|xi-api-key)$/i;

export class Logger {
  private readonly threshold: number;
  constructor(level: Level = "info") { this.threshold = ORDER[level]; }

  private write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
    if (ORDER[level] < this.threshold) return;
    const line = {
      time: new Date().toISOString(),
      level,
      message,
      ...scrub(fields),
    };
    const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
    out.write(`${JSON.stringify(line)}\n`);
  }

  debug(m: string, f?: Record<string, unknown>) { this.write("debug", m, f); }
  info(m: string, f?: Record<string, unknown>) { this.write("info", m, f); }
  warn(m: string, f?: Record<string, unknown>) { this.write("warn", m, f); }
  error(m: string, f?: Record<string, unknown>) { this.write("error", m, f); }
}

/**
 * Two things never reach a log line: credentials, and the content of a student's page.
 * The second is easy to forget, and a log of every question a child got wrong is
 * exactly the file nobody wants to be holding.
 */
function scrub(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE.test(key)) { out[key] = "[redacted]"; continue; }
    if (key === "prompt" || key === "context" || key === "text" || key === "submitted"
        || key === "answer" || key === "message") {
      out[`${key}Bytes`] = typeof value === "string" ? Buffer.byteLength(value) : undefined;
      continue;
    }
    out[key] = value instanceof Error ? { name: value.name, message: value.message } : value;
  }
  return out;
}
