/**
 * In-memory token bucket.
 *
 * Deliberately not Redis. One proxy instance serving a school is well within
 * what a Map handles, and adding a datastore to count requests would add a
 * failure mode that takes tutoring down with it. If this ever runs behind
 * several instances, swap the store — the interface is three methods.
 *
 * Buckets refill continuously rather than resetting on a boundary, so a
 * student who asks four questions in a burst isn't blocked for the rest of the
 * minute.
 */
export class RateLimiter {
  /**
   * @param {number} capacity  requests allowed in a burst
   * @param {number} windowMs  time to refill from empty to full
   */
  constructor(capacity, windowMs) {
    this.capacity = capacity;
    this.windowMs = windowMs;
    this.refillPerMs = capacity / windowMs;
    /** @type {Map<string, {tokens: number, updatedAt: number}>} */
    this.buckets = new Map();
    this.lastSweep = Date.now();
  }

  /**
   * @returns {{ allowed: true } | { allowed: false, retryAfterSeconds: number }}
   */
  take(key, now = Date.now(), cost = 1) {
    this.sweep(now);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, updatedAt: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = Math.max(0, now - bucket.updatedAt);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
    bucket.updatedAt = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true };
    }

    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(deficit / this.refillPerMs / 1000)),
    };
  }

  /** Drops buckets that have refilled completely; they carry no information. */
  sweep(now = Date.now()) {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }

  get size() {
    return this.buckets.size;
  }
}
