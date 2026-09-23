/**
 * The monthly allowance on this installation's own keys, and the
 * subscription that raises it.
 *
 * Only spend on a key the *server* holds is counted. A person who pastes their
 * own key is paying their own provider and owes this app nothing, so nothing
 * they do on it is metered or ever blocked. Where the server holds no Dodo key
 * at all, billing is off and nothing here does anything: a self-hosted copy
 * behaves exactly as it did before this file existed.
 *
 * The meter lives in this browser, because there are no accounts and no
 * database for it to live anywhere else. That makes it an honest allowance
 * rather than a hard wall — clearing site data resets it — and it is written
 * down that way in Settings instead of being dressed up as more.
 *
 * The subscription is the part that is *not* taken on the browser's word.
 * The id Dodo hands back after checkout is checked with Dodo from the server
 * (`/api/billing`), and checked again every few hours, so a cancelled or
 * failed subscription stops raising the cap on its own.
 */
import type { ChatError, ProviderId } from "./types";
import { serverHolds } from "./configured";

export interface BillingConfig {
  enabled: boolean;
  checkoutUrl: string;
  /** What the subscription costs, as shown — "$1 / month". */
  price: string;
  freeCapUsd: number;
  proCapUsd: number;
}

export interface Verdict {
  active: boolean;
  status: string;
  subscriptionId?: string;
  nextBillingDate?: string;
}

interface Saved {
  /** "2026-09". The meter starts again when this stops being this month. */
  month: string;
  spentUsd: number;
  subscriptionId?: string;
  active?: boolean;
  status?: string;
  nextBillingDate?: string;
  checkedAt?: number;
}

const KEY = "armi.billing";
/** How long a verdict from Dodo is trusted before it is asked again. */
const RECHECK_MS = 6 * 60 * 60_000;

let config: BillingConfig = { enabled: false, checkoutUrl: "", price: "", freeCapUsd: 0, proCapUsd: 0 };
const listeners = new Set<() => void>();

function monthOf(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

function load(): Saved {
  let s: Saved | null = null;
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  } catch {
    /* private mode, blocked storage, or junk: start from nothing */
  }
  const month = monthOf();
  if (!s || typeof s.spentUsd !== "number") return { month, spentUsd: 0 };
  return s.month === month ? s : { ...s, month, spentUsd: 0 };
}

function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* the meter simply does not survive a reload here */
  }
  listeners.forEach((f) => f());
}

export function setBillingConfig(next: Partial<BillingConfig> | null | undefined): void {
  config = { ...config, ...(next ?? {}), enabled: Boolean(next?.enabled) };
  listeners.forEach((f) => f());
}

export function getBillingConfig(): BillingConfig {
  return config;
}

export function onBillingChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** What Settings draws: this month's spend, the cap it is measured against. */
export function billingState(): Saved & { capUsd: number; subscribed: boolean } {
  const s = load();
  const subscribed = Boolean(s.active);
  return { ...s, subscribed, capUsd: subscribed ? config.proCapUsd : config.freeCapUsd };
}

/** Whether this provider's calls are the installation's to pay for. */
function metered(provider: ProviderId): boolean {
  return config.enabled && serverHolds(provider);
}

/** Called with every `usage` event, once per round, so tool rounds count too. */
export function recordSpend(provider: ProviderId, costUsd: number): void {
  if (!metered(provider) || !(costUsd > 0)) return;
  const s = load();
  save({ ...s, spentUsd: s.spentUsd + costUsd });
}

/**
 * The error to show instead of sending, or null to send.
 *
 * Checked before a request leaves, not after: the allowance is spent by
 * answers already given, and the one that crosses the line is allowed to
 * finish rather than being cut off halfway through a sentence.
 */
export function limitFor(provider: ProviderId): ChatError | null {
  if (!metered(provider)) return null;
  const { spentUsd, capUsd, subscribed } = billingState();
  if (spentUsd < capUsd) return null;
  return {
    kind: "limit",
    action: "subscribe",
    message: subscribed
      ? "You've used this month's allowance. It resets on the 1st — or add your own API key in Settings to keep going now."
      : `You've reached this month's free limit. Subscribe for ${config.price} to raise it, or add your own API key in Settings.`,
  };
}

/** The checkout link, with the way back to this app attached. */
export function checkoutHref(): string {
  if (!config.checkoutUrl) return "";
  try {
    const url = new URL(config.checkoutUrl);
    url.searchParams.set("redirect_url", `${window.location.origin}/`);
    return url.toString();
  } catch {
    return config.checkoutUrl;
  }
}

async function ask(body: { subscriptionId?: string; paymentId?: string }): Promise<Verdict | null> {
  try {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as Verdict;
  } catch {
    return null;
  }
}

function remember(v: Verdict): void {
  const s = load();
  save({
    ...s,
    subscriptionId: v.subscriptionId ?? s.subscriptionId,
    active: v.active,
    status: v.status,
    nextBillingDate: v.nextBillingDate,
    checkedAt: Date.now(),
  });
}

/**
 * Checks a subscription with Dodo and remembers the answer.
 *
 * A fresh checkout often lands back here a moment before Dodo has finished
 * activating the subscription, so `pending` is asked again a few times
 * rather than read as a refusal.
 */
export async function verifySubscription(ids: { subscriptionId?: string; paymentId?: string }): Promise<Verdict | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const v = await ask(ids);
    if (!v) return null;
    remember(v);
    if (v.status !== "pending") return v;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return load().active ? { active: true, status: "active" } : { active: false, status: "pending" };
}

/**
 * On start: pick up a return from checkout, or re-check a subscription whose
 * last verdict has gone stale. Leaves the address bar clean either way.
 */
export async function resumeBilling(): Promise<void> {
  if (!config.enabled) return;
  const url = new URL(window.location.href);
  const subscriptionId = url.searchParams.get("subscription_id") ?? undefined;
  const paymentId = url.searchParams.get("payment_id") ?? undefined;
  if (subscriptionId || paymentId) {
    for (const k of ["subscription_id", "payment_id", "status", "email"]) url.searchParams.delete(k);
    window.history.replaceState(null, "", url.toString());
    await verifySubscription({ subscriptionId, paymentId });
    return;
  }
  const s = load();
  if (s.subscriptionId && (!s.checkedAt || Date.now() - s.checkedAt > RECHECK_MS)) {
    await verifySubscription({ subscriptionId: s.subscriptionId });
  }
}

/** Forget the subscription on this browser. It is still active at Dodo. */
export function forgetSubscription(): void {
  const s = load();
  save({ month: s.month, spentUsd: s.spentUsd });
}
