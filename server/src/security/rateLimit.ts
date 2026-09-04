/**
 * Per-caller rate limiting.
 *
 * A gateway holding a paid API key with no limiter is an unbounded bill waiting for one
 * bug in a retry loop. Sliding window, in memory, deliberately simple: a single
 * instance is the shape this deploys in, and a distributed limiter is a Redis
 * dependency bought before it is needed.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(requestsPerMinute: number, windowMs = 60_000) {
    this.limit = Math.max(1, requestsPerMinute);
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): RateLimitDecision {
    const window = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > window);

    if (recent.length >= this.limit) {
      const oldest = recent[0]!;
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 };
  }

  /** Called on a timer so a long-lived process does not accumulate dead keys. */
  sweep(now = Date.now()): void {
    const window = now - this.windowMs;
    for (const [key, times] of this.hits) {
      const kept = times.filter((t) => t > window);
      if (kept.length === 0) this.hits.delete(key);
      else this.hits.set(key, kept);
    }
  }

  get size(): number { return this.hits.size; }
}
