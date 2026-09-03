/**
 * Small HTTP helpers.
 *
 * Written directly against node:http rather than pulling in a framework. The
 * surface here is a dozen routes; a framework would add dependencies and
 * indirection without removing any of the code that actually matters.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  userId: string;
}

export type Handler = (ctx: Ctx) => Promise<void> | void;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/:([A-Za-z]+)/g, (_m, key: string) => {
        keys.push(key);
        return "([^/]+)";
      })}$`,
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get(path: string, handler: Handler) { return this.add("GET", path, handler); }
  post(path: string, handler: Handler) { return this.add("POST", path, handler); }
  patch(path: string, handler: Handler) { return this.add("PATCH", path, handler); }
  delete(path: string, handler: Handler) { return this.add("DELETE", path, handler); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(pathname);
      if (!match) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
      return { handler: route.handler, params };
    }
    return null;
  }
}

const MAX_BODY_BYTES = 12 * 1024 * 1024;

export async function readJson<T>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // Bounded so a large upload cannot exhaust memory before it is rejected.
    if (size > MAX_BODY_BYTES) throw new Error("payload too large");
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    // The API is same-origin only; no cross-origin reads of user knowledge.
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
}

export function sendError(res: ServerResponse, status: number, message: string, code = "invalid_input"): void {
  sendJson(res, status, { failure: { code, message, retryable: status >= 500 } });
}

// ─────────────────────────────────────────────────────────────── sessions ───

/**
 * Signed session cookies.
 *
 * The secret is generated per process unless one is supplied, so a restart
 * invalidates sessions rather than falling back to a hardcoded key — a
 * default secret in source is a real vulnerability, an unexpected logout is
 * an inconvenience.
 */
const SECRET = process.env.SESSION_SECRET
  ? Buffer.from(process.env.SESSION_SECRET)
  : randomBytes(32);

export function signSession(userId: string): string {
  const mac = createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${userId}.${mac}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const index = token.lastIndexOf(".");
  if (index <= 0) return null;
  const userId = token.slice(0, index);
  const provided = Buffer.from(token.slice(index + 1));
  const expected = Buffer.from(createHmac("sha256", SECRET).update(userId).digest("base64url"));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function setSessionCookie(res: ServerResponse, token: string, secure: boolean): void {
  res.setHeader("set-cookie",
    `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000` +
    (secure ? "; Secure" : ""));
}

// ─────────────────────────────────────────────────────────── rate limiting ───

/**
 * Per-user token bucket on the routes that cost money (§30). Refills
 * continuously rather than in windows, so a user is never locked out for a
 * whole minute by one burst.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updatedAt: number }>();
  private capacity: number;
  private refillPerMs: number;

  constructor(capacity: number, refillPerMinute: number) {
    this.capacity = capacity;
    this.refillPerMs = refillPerMinute / 60_000;
  }

  take(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const refilled = Math.min(
      this.capacity,
      bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs,
    );
    if (refilled < 1) {
      this.buckets.set(key, { tokens: refilled, updatedAt: now });
      return false;
    }
    this.buckets.set(key, { tokens: refilled - 1, updatedAt: now });
    return true;
  }
}

// ───────────────────────────────────────────────────────────────────  SSE ───

export class EventStream {
  private res: ServerResponse;
  private closed = false;

  constructor(res: ServerResponse) {
    this.res = res;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Defeats proxy buffering, which otherwise defers the whole stream.
      "x-accel-buffering": "no",
    });
  }

  send(event: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }
}
