/**
 * Personal memory (§8).
 *
 * The design rule is that memory must be *useful, not creepy*, and the
 * difference is almost entirely about control and provenance:
 *
 *  - Every memory records the exact quote it came from. The user can always
 *    see why the system believes something.
 *  - Nothing is inferred silently. A memory is written from something the user
 *    said, not from something the system deduced about them.
 *  - Sensitive categories are refused at the write boundary rather than
 *    filtered later, so they are never stored at all.
 *  - Memory that never gets used is retired. A store that only grows becomes a
 *    liability, and an unused memory was not worth keeping.
 */

import type { Id, Memory, MemoryKind, Result } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";
import type { Store } from "../store/index.ts";

/**
 * Categories this system will not retain, however they arrive.
 *
 * An honest note on the limits: this is a coarse lexical guard, not a
 * classifier. It reliably catches the obvious cases and will miss oblique
 * phrasing. It is a floor, not a guarantee — which is why the user-facing
 * controls (inspect, edit, delete, disable) are the real protection, and this
 * check exists so the common case never reaches storage in the first place.
 */
const SENSITIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "health", pattern: /\b(diagnos(is|ed)|depress(ion|ed)|anxiety|adhd|autis(m|tic)|dyslexi[ac]|medication|therapy|therapist|disorder|illness|disabilit(y|ies)|pregnan(t|cy))\b/i },
  { label: "beliefs", pattern: /\b(muslim|christian|jewish|hindu|buddhist|atheist|religion|religious|church|mosque|synagogue)\b/i },
  { label: "politics", pattern: /\b(voted?|voting|political party|conservative|labour|republican|democrat|left.wing|right.wing)\b/i },
  { label: "sexuality", pattern: /\b(gay|lesbian|bisexual|transgender|queer|sexual orientation)\b/i },
  { label: "ethnicity", pattern: /\b(race|racial|ethnicity|ethnic background|immigrant status)\b/i },
  { label: "finances", pattern: /\b(salary|income|debt|bankrupt|benefits|welfare|(can'?t|can\s?not|could\s?n'?t)\s+afford|struggling financially)\b/i },
];

export interface RememberInput {
  kind: MemoryKind;
  text: string;
  /** The user's own words this was drawn from. Required — no silent inference. */
  quote: string;
  messageId?: Id | null;
  conversationId?: Id | null;
  pinned?: boolean;
}

export function remember(store: Store, userId: Id, input: RememberInput): Result<Memory> {
  const user = store.users.get(userId, userId);
  if (user && user.memoryEnabled === false) {
    return fail("forbidden", "Memory is turned off, so nothing was saved.");
  }

  const text = input.text?.trim();
  if (!text) return fail("invalid_input", "There is nothing to remember.");
  if (text.length > 500) {
    return fail("invalid_input", "That is too long to keep as a memory. Summarise it first.");
  }
  if (!input.quote?.trim()) {
    // Provenance is not optional: a memory without a source cannot be explained
    // to the user, and an unexplainable memory is exactly the creepy kind.
    return fail("invalid_input", "A memory must record where it came from.");
  }

  for (const { label, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return fail(
        "forbidden",
        `That looks like ${label} information, which this system does not keep.`,
      );
    }
  }

  // Don't store the same thing twice; refresh the existing entry instead.
  const existing = store.memories.list(userId).find(
    (m) => m.text.toLowerCase() === text.toLowerCase(),
  );
  if (existing) {
    const updated = store.memories.update(userId, existing.id, {
      pinned: input.pinned ?? existing.pinned,
    } as never);
    return updated ? ok(updated) : fail("not_found", "That memory no longer exists.");
  }

  return ok(store.memories.insert(userId, {
    kind: input.kind,
    text,
    provenance: {
      messageId: input.messageId ?? null,
      conversationId: input.conversationId ?? null,
      quote: input.quote.trim().slice(0, 300),
    },
    useCount: 0,
    lastUsedAt: null,
    pinned: input.pinned ?? false,
  } as never));
}

/** Records that a memory earned its place by being used in a turn. */
export function markUsed(store: Store, userId: Id, memoryIds: Id[], now = Date.now()): void {
  for (const id of memoryIds) {
    const memory = store.memories.get(userId, id);
    if (!memory) continue;
    store.memories.update(userId, id, {
      useCount: memory.useCount + 1,
      lastUsedAt: now,
    } as never);
  }
}

const RETIREMENT_AGE_MS = 1000 * 60 * 60 * 24 * 60; // sixty days

/**
 * Retires memories that were never used and have gone stale. Pinned memories
 * are never retired — an explicit pin is the user overriding this policy.
 */
export function retireUnusedMemories(store: Store, userId: Id, now = Date.now()): Memory[] {
  const retired: Memory[] = [];
  for (const memory of store.memories.list(userId)) {
    if (memory.pinned || memory.useCount > 0) continue;
    if (now - memory.createdAt < RETIREMENT_AGE_MS) continue;
    store.memories.delete(userId, memory.id);
    retired.push(memory);
  }
  return retired;
}

/** §8: the user can inspect everything the system believes about them. */
export function listMemories(store: Store, userId: Id): Memory[] {
  return store.memories.list(userId, {
    sort: (a, b) => Number(b.pinned) - Number(a.pinned) || b.useCount - a.useCount || b.createdAt - a.createdAt,
  });
}

export function editMemory(store: Store, userId: Id, id: Id, text: string): Result<Memory> {
  const trimmed = text.trim();
  if (!trimmed) return fail("invalid_input", "A memory cannot be empty.");
  for (const { label, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fail("forbidden", `That looks like ${label} information, which this system does not keep.`);
    }
  }
  const updated = store.memories.update(userId, id, { text: trimmed } as never);
  return updated ? ok(updated) : fail("not_found", "That memory no longer exists.");
}

export function forget(store: Store, userId: Id, id: Id): Result<true> {
  return store.memories.delete(userId, id)
    ? ok(true)
    : fail("not_found", "That memory no longer exists.");
}

/** §8 + §34: turning memory off also removes what was already stored. */
export function setMemoryEnabled(store: Store, userId: Id, enabled: boolean): Result<true> {
  const user = store.users.get(userId, userId);
  if (!user) return fail("not_found", "No such user.");
  store.users.update(userId, userId, { memoryEnabled: enabled } as never);
  if (!enabled) {
    for (const memory of store.memories.list(userId)) {
      store.memories.delete(userId, memory.id);
    }
  }
  return ok(true);
}
