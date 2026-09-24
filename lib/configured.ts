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

import { plusAllowed, type PlusOffer } from "./plus";

let held: Record<string, boolean> = {};
let offer: PlusOffer = { on: false, price: "" };

export function setConfigured(next: Record<string, boolean>): void {
  held = next ?? {};
}

/** What the server said about Armi Plus, and whether our key checked out. */
export function setPlusOffer(next: PlusOffer | undefined): void {
  offer = next ?? { on: false, price: "" };
}
export function getPlusOffer(): PlusOffer {
  return offer;
}
/** The server's keys are ours through Plus — so only the engines a dollar covers. */
export const viaPlus = (): boolean => offer.on && offer.valid === true;

/**
 * Whether this browser can call this engine: its own key for the company,
 * or the server's — which, through Plus, covers the everyday engines only.
 */
export function canCall(modelId: string, provider: string, configured: Record<string, boolean>, keys?: Record<string, string | undefined>): boolean {
  if (keys?.[provider]) return true;
  if (!configured[provider]) return false;
  return !viaPlus() || plusAllowed(modelId);
}

export function getConfigured(): Record<string, boolean> {
  return held;
}

/** Whether anybody at all can be called, from either side. */
export function anyKeyAnywhere(keys: Record<string, string>): boolean {
  return Object.values(held).some(Boolean) || Object.values(keys).some(Boolean);
}

export const serverHolds = (p: ProviderId): boolean => Boolean(held[p]);
