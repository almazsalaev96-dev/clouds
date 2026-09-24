/**
 * Armi Plus: a dollar a month, and no keys to add.
 *
 * The app is bring-your-own-key, and the one thing that stops most people
 * at the door is the key. Plus is the other door: Armi's own keys, on the
 * server, unlocked by a subscription bought from Dodo Payments, which is the
 * merchant of record — it takes the card, the tax and the disputes, and
 * hands the subscriber a license key. That key is what the browser keeps,
 * and what every request to the server carries.
 *
 * What a dollar buys is said plainly, because a dollar is not much: the
 * everyday tiers — the engines under Nova 4, Mira 4.1 and Lumos 4 — with a
 * monthly allowance measured in what the models actually cost. The top of
 * the ladder (Astro 5, and the dearest engines under Parallax and
 * Constellation) still needs the person's own key. This file is the whole
 * of that promise, in one place, read by the browser and by the server.
 *
 * No secrets here. The server side — talking to Dodo, holding the keys —
 * is `lib/plus.server.ts`.
 */

export const PLUS_NAME = "Armi Plus";
export const PLUS_PRICE = "$1 a month";

/**
 * The engines a dollar covers, by id. The everyday tiers' writers and
 * checkers: fast, cheap, and the middle of each family. Nothing above two
 * dollars a million in, which is where a month's allowance would go in an
 * afternoon.
 */
export const PLUS_ALLOWED: readonly string[] = [
  "gpt-5.6-luna",
  "deepseek-flash",
  "claude-haiku-4-5",
  "kimi-k2.6",
  "gpt-5.6-terra",
  "claude-sonnet-5",
  "deepseek-v4-pro",
];

export function plusAllowed(modelId: string): boolean {
  return PLUS_ALLOWED.includes(modelId);
}

/**
 * A credit is a hundred-thousandth of a dollar of model cost, so a
 * request's price converts without decimals — Dodo's ledger takes whole
 * units at precision 0. Sixty thousand a month is sixty cents of models on
 * a dollar of subscription, which leaves the rest for the card fee and the
 * tax Dodo pays.
 */
export const PLUS_MONTHLY_CREDITS = 60_000;

export function creditsFor(usd: number): number {
  return Math.max(1, Math.ceil(usd * 100_000));
}

/** Roughly what a credit balance means in the words a person uses. */
export function creditsAsDollars(credits: number): string {
  return `$${(credits / 100_000).toFixed(2)}`;
}

/** What the browser keeps once a subscription is verified. */
export interface PlusMembership {
  key: string;
  customerId?: string;
  productId?: string;
  instanceId?: string;
  /** When the server last said this key was valid. */
  checkedAt: number;
}

/** What `/api/models` says about Plus on this installation. */
export interface PlusOffer {
  /** Plus is configured on the server at all. */
  on: boolean;
  price: string;
  /** The key the browser sent was valid, when it sent one. */
  valid?: boolean;
}
