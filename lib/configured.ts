/**
 * Which providers the server itself holds a key for.
 *
 * `/api/models` answers this once at start-up and the answer lived in one
 * component's state, which is fine for drawing a list and wrong for anything
 * that has to make a decision outside React — and the decisions that matter
 * most are made there: which engine a one-shot call resolves to, and where a
 * turn goes when a company refuses.
 *
 * The cost of it being unreachable was not theoretical. `complete` resolved
 * every Armi id with `configured: {}`, so an installation whose keys live in
 * the server's environment rather than in the browser — the arrangement this
 * app recommends, because a key in a browser is a key in a browser — looked
 * to it like an installation with no keys at all.
 *
 * A module-level value rather than a store: it is the server's answer about
 * itself, it never changes while the tab is open, and persisting it would
 * turn a fact about a deployment into a stale setting.
 */
import type { ProviderId } from "./types";

let held: Record<string, boolean> = {};

export function setConfigured(next: Record<string, boolean>): void {
  held = next ?? {};
}

export function getConfigured(): Record<string, boolean> {
  return held;
}

/** Whether anybody at all can be called, from either side. */
export function anyKeyAnywhere(keys: Record<string, string>): boolean {
  return Object.values(held).some(Boolean) || Object.values(keys).some(Boolean);
}

export const serverHolds = (p: ProviderId): boolean => Boolean(held[p]);
