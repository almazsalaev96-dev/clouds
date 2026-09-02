/**
 * Caller authentication.
 *
 * The gateway is not a public API. In production it requires a shared token supplied by
 * the app; in development it runs open so a simulator build needs no setup.
 */

import { timingSafeEqual } from "node:crypto";

export interface AuthResult {
  ok: boolean;
  /** Stable per-caller key for rate limiting. Never a name, never an email. */
  callerKey: string;
  reason?: string;
}

export function authenticate(
  headers: Headers | Record<string, string | undefined>,
  expectedToken: string | null,
  remoteAddress: string,
): AuthResult {
  const get = (name: string): string | undefined =>
    headers instanceof Headers ? headers.get(name) ?? undefined : headers[name];

  const presented = stripBearer(get("authorization") ?? get("x-slate-token"));
  const device = get("x-slate-device") ?? "";

  if (!expectedToken) {
    return { ok: true, callerKey: device || remoteAddress };
  }
  if (!presented) {
    return { ok: false, callerKey: remoteAddress, reason: "missing token" };
  }
  if (!constantTimeEquals(presented, expectedToken)) {
    return { ok: false, callerKey: remoteAddress, reason: "bad token" };
  }
  // Rate limit by device where the app supplies one, so one misbehaving iPad cannot
  // exhaust the allowance for every other iPad sharing the deployment.
  return { ok: true, callerKey: device ? `device:${device}` : `addr:${remoteAddress}` };
}

function stripBearer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("Bearer ") ? value.slice(7).trim() : value.trim();
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against itself so the timing does not reveal the expected length.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
