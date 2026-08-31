import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Anonymous device tokens.
 *
 * What a token is: a random id, an issue time, and an HMAC of both. What it is
 * not: an account, an email, an advertising identifier, or anything tied to a
 * person. Reinstalling the app produces a new one and nothing is carried over.
 *
 * It exists for two jobs only — rate limiting per install, and being able to
 * revoke a client that misbehaves. Stateless by design: verifying a token needs
 * no database, so the proxy can scale horizontally and holds no record of who
 * asked what.
 */

const VERSION = 'v1';
const SEPARATOR = '.';

/** Tokens older than this must be re-issued. */
export const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

export function issueToken(secret, now = Date.now()) {
  const deviceId = randomBytes(16).toString('base64url');
  const issuedAt = String(now);
  const payload = `${VERSION}${SEPARATOR}${deviceId}${SEPARATOR}${issuedAt}`;
  return `${payload}${SEPARATOR}${sign(payload, secret)}`;
}

/**
 * @returns {{ valid: true, deviceId: string, issuedAt: number } | { valid: false, reason: string }}
 */
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512) {
    return { valid: false, reason: 'malformed' };
  }

  const parts = token.split(SEPARATOR);
  if (parts.length !== 4) return { valid: false, reason: 'malformed' };

  const [version, deviceId, issuedAtRaw, signature] = parts;
  if (version !== VERSION) return { valid: false, reason: 'version' };

  const payload = `${version}${SEPARATOR}${deviceId}${SEPARATOR}${issuedAtRaw}`;
  if (!signaturesMatch(sign(payload, secret), signature)) {
    return { valid: false, reason: 'signature' };
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };
  // A token issued in the future means a clock problem or a forged payload
  // that happened to verify; either way, don't accept it.
  if (issuedAt > now + 60_000) return { valid: false, reason: 'future' };
  if (now - issuedAt > TOKEN_MAX_AGE_MS) return { valid: false, reason: 'expired' };

  return { valid: true, deviceId, issuedAt };
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Constant-time comparison, so a signature can't be discovered a byte at a time. */
function signaturesMatch(expected, received) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Pulls the token out of `Authorization: Bearer …`. */
export function bearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1].trim() : null;
}
