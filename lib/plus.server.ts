/**
 * The server's half of Armi Plus: Dodo Payments, and the keys.
 *
 * Talks to Dodo over its REST API with the same paths the official SDK
 * uses (`/checkouts`, `/payments`, `/subscriptions`,
 * `/credit-entitlements/…/ledger-entries`), with plain `fetch` so it runs
 * on the edge runtime the chat route lives on. No license keys: the
 * payment is checked with Dodo once, and what the browser keeps is a pass
 * this server signed (`DODO_PLUS_SECRET`, or the merchant key when that is
 * not set). Everything here reads the
 * environment:
 *
 *   DODO_PAYMENTS_API_KEY   the merchant key (`dodo_test_…` / `dodo_live_…`)
 *   DODO_ENVIRONMENT        `test_mode` (default) or `live_mode`
 *   DODO_BASE_URL           an override, for the mock in tests
 *   DODO_PLUS_PRODUCT_ID    the $1-a-month subscription product
 *   DODO_PLUS_SECRET        optional: what the passes are signed with
 *   DODO_PLUS_CREDIT_ID     optional: the credit entitlement attached to that
 *                           product, for the monthly allowance
 *
 * With `DODO_PLUS_PRODUCT_ID` set, the server's provider keys are for Plus
 * members: a request without a valid pass uses the key the browser sent
 * or gets "no key". Without it, nothing changes from before — the server's
 * keys, where it has any, answer for everyone, which is the arrangement a
 * person hosting the app for themselves wants.
 */
import { PLUS_PRICE, creditsFor, type PlusOffer } from "./plus";

const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export function dodoBase(): string {
  return (env("DODO_BASE_URL") ?? (env("DODO_ENVIRONMENT") === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com")).replace(/\/$/, "");
}

/** Plus exists on this installation. */
export const plusConfigured = (): boolean => Boolean(env("DODO_PLUS_PRODUCT_ID"));
/** And, because it does, the server's keys are for members. */
export const plusGating = (): boolean => plusConfigured();

export function plusOffer(valid?: boolean): PlusOffer {
  return { on: plusConfigured(), price: PLUS_PRICE, ...(valid === undefined ? {} : { valid }) };
}

const headers = (withAuth: boolean): Record<string, string> => ({
  "content-type": "application/json",
  ...(withAuth ? { authorization: `Bearer ${env("DODO_PAYMENTS_API_KEY") ?? ""}` } : {}),
});

async function call<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T | null> {
  try {
    const res = await fetch(`${dodoBase()}${path}`, {
      method: init.method ?? "GET",
      headers: headers(init.auth ?? true),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`dodo ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${text.slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`dodo ${init.method ?? "GET"} ${path.split("?")[0]} → ${(e as Error).message}`);
    return null;
  }
}

/**
 * A look at the arrangement, for whoever hosts it — on only while
 * `DODO_PLUS_DEBUG` is set. Which mode the key is, which mode the app is
 * in, whether the product answers, and what Dodo says to a checkout.
 * Nothing secret: no key, no email, no amounts.
 */
export async function diagnose(): Promise<Record<string, unknown>> {
  const key = env("DODO_PAYMENTS_API_KEY") ?? "";
  const product = env("DODO_PLUS_PRODUCT_ID");
  const probe = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    try {
      const res = await fetch(`${dodoBase()}${path}`, { method: init.method ?? "GET", headers: headers(true), body: init.body === undefined ? undefined : JSON.stringify(init.body) });
      const text = await res.text().catch(() => "");
      return { status: res.status, body: text.slice(0, 300) };
    } catch (e) {
      return { status: 0, body: (e as Error).message };
    }
  };
  const prod = product ? await probe(`/products/${encodeURIComponent(product)}`) : { status: 0, body: "no product id" };
  const checkout = product
    ? await probe("/checkouts", { method: "POST", body: { product_cart: [{ product_id: product, quantity: 1 }], return_url: "https://example.com/?plus=done" } })
    : { status: 0, body: "no product id" };
  const payments = await probe("/payments?page_size=5");
  let recent: unknown = payments.body;
  try {
    const items = (JSON.parse(payments.body) as { items?: { payment_id?: string; status?: string; created_at?: string; subscription_id?: string }[] }).items ?? [];
    recent = items.map((p) => ({ id: p.payment_id, status: p.status, at: p.created_at, subscription: p.subscription_id }));
  } catch { /* left as text */ }
  return {
    keyMode: key.startsWith("dodo_test") ? "test" : key.startsWith("dodo_live") ? "live" : key ? "unrecognised prefix" : "no key",
    appMode: env("DODO_ENVIRONMENT") ?? "test_mode (default)",
    base: dodoBase(),
    product: product ?? null,
    productLookup: prod,
    checkoutSession: { status: checkout.status, body: checkout.body.replace(/https?:\/\/\S+/g, "<url>") },
    recentPayments: { status: payments.status, items: recent },
  };
}

/* ------------------------------------------------------------- the pass -- */

/**
 * No license keys. What the browser keeps is a pass the server signed
 * itself once Dodo confirmed the payment: who paid (the customer), which
 * subscription it is, and until when it stands on its own. Every request
 * carries it; the signature is checked here, and the subscription is asked
 * about at Dodo every ten minutes — so a cancelled one stops working
 * within the quarter-hour, and a Dodo that cannot be reached does not stop
 * a paid-up member until the pass's own date runs out.
 */
export interface Pass {
  customerId: string;
  subscriptionId?: string;
  paymentId?: string;
  /** Milliseconds since the epoch: stands on its own until then. */
  until: number;
}

const secret = () => env("DODO_PLUS_SECRET") ?? env("DODO_PAYMENTS_API_KEY") ?? "";

const b64u = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string): string => {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
};

async function hmac(text: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

export async function signPass(pass: Pass): Promise<string> {
  const body = b64u(new TextEncoder().encode(JSON.stringify(pass)));
  return `v1.${body}.${await hmac(body)}`;
}

/** The pass, if the signature is ours; nothing otherwise. */
export async function readPass(token: string): Promise<Pass | null> {
  const [v, body, sig] = token.trim().split(".");
  if (v !== "v1" || !body || !sig || !secret()) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const p = JSON.parse(unb64u(body)) as Pass;
    return p && typeof p.customerId === "string" && typeof p.until === "number" ? p : null;
  } catch {
    return null;
  }
}

/* Remembered for ten minutes on this isolate, so a turn is not a round
   trip to Dodo before its first token. */
const seen = new Map<string, { valid: boolean; at: number }>();
const REMEMBER = 10 * 60_000;
const LIVE = new Set(["active", "on_hold"]);

export async function validatePass(token: string): Promise<boolean> {
  const t = token.trim();
  if (!t || !plusConfigured()) return false;
  const had = seen.get(t);
  if (had && Date.now() - had.at < REMEMBER) return had.valid;
  const pass = await readPass(t);
  let valid = false;
  if (pass) {
    const own = pass.until > Date.now();
    if (pass.subscriptionId && env("DODO_PAYMENTS_API_KEY")) {
      const sub = await call<{ status?: string }>(`/subscriptions/${encodeURIComponent(pass.subscriptionId)}`);
      /* Dodo answered: its word. Dodo did not: the pass's own date. */
      valid = sub?.status ? LIVE.has(sub.status) : own;
    } else valid = own;
  }
  seen.set(t, { valid, at: Date.now() });
  return valid;
}

/** Who a pass belongs to, for the ledger. */
export async function passCustomer(token: string): Promise<string | undefined> {
  return (await readPass(token))?.customerId;
}

/**
 * Dodo's own payment link for the product — a URL that needs no merchant
 * key at all. `redirect_url` brings the person back to the app, and Dodo
 * appends the payment id to it, which is all the claim below needs.
 */
export function staticCheckout(returnTo: string): string | null {
  const product = env("DODO_PLUS_PRODUCT_ID");
  if (!product) return null;
  const host = env("DODO_ENVIRONMENT") === "live_mode" ? "https://checkout.dodopayments.com" : "https://test.checkout.dodopayments.com";
  return `${host}/buy/${encodeURIComponent(product)}?quantity=1&redirect_url=${encodeURIComponent(returnTo)}`;
}

/** A hosted checkout for the subscription; the person is sent there. */
export async function createCheckout(returnTo: string, email?: string): Promise<{ url: string; sessionId: string } | null> {
  const product = env("DODO_PLUS_PRODUCT_ID");
  if (!product) return null;
  /* No merchant key: the static link does the same job. */
  if (!env("DODO_PAYMENTS_API_KEY")) {
    const url = staticCheckout(returnTo);
    return url ? { url, sessionId: "" } : null;
  }
  const out = await call<{ session_id?: string; checkout_url?: string | null }>("/checkouts", {
    method: "POST",
    body: {
      product_cart: [{ product_id: product, quantity: 1 }],
      ...(email ? { customer: { email } } : {}),
      return_url: returnTo,
      metadata: { app: "armi", plan: "plus" },
    },
  });
  if (!out?.checkout_url || !out.session_id) {
    /* The merchant call failed — a test key against live, a network
       blip — and the person is still owed a way to pay. Dodo's own link
       does the same job without the call. */
    const url = staticCheckout(returnTo);
    return url ? { url, sessionId: "" } : null;
  }
  return { url: out.checkout_url, sessionId: out.session_id };
}

/** A month and a few days' grace: what a pass stands on its own for. */
const A_MONTH = 35 * 24 * 60 * 60_000;

/**
 * The pass, made from the payment the person just came back from — or
 * from a payment id off their receipt. The payment is looked up at Dodo
 * (never trusted from the address bar), must have succeeded, and must be
 * for this product where Dodo says which. Nothing along the way returns
 * nothing.
 */
export async function claimPass(from: { sessionId?: string; paymentId?: string; subscriptionId?: string }): Promise<{ pass: string; customerId: string; until: number } | null> {
  const product = env("DODO_PLUS_PRODUCT_ID");
  if (!env("DODO_PAYMENTS_API_KEY")) return null;
  let paymentId = from.paymentId?.trim() || "";
  if (!paymentId && from.sessionId) {
    const session = await call<{ payment_id?: string | null }>(`/checkouts/${encodeURIComponent(from.sessionId)}`);
    paymentId = session?.payment_id ?? "";
  }
  if (!paymentId) return null;
  const payment = await call<{
    status?: string;
    customer?: { customer_id?: string };
    subscription_id?: string | null;
    product_cart?: { product_id?: string }[] | null;
  }>(`/payments/${encodeURIComponent(paymentId)}`);
  const customerId = payment?.customer?.customer_id;
  if (!customerId || (payment?.status && payment.status !== "succeeded")) return null;
  const bought = (payment?.product_cart ?? []).map((p) => p.product_id).filter(Boolean);
  if (product && bought.length && !bought.includes(product)) return null;
  const subscriptionId = payment?.subscription_id ?? from.subscriptionId?.trim() ?? undefined;
  let until = Date.now() + A_MONTH;
  if (subscriptionId) {
    const sub = await call<{ status?: string; next_billing_date?: string; product_id?: string }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (sub?.status && !LIVE.has(sub.status) && sub.status !== "pending") return null;
    if (product && sub?.product_id && sub.product_id !== product) return null;
    const next = sub?.next_billing_date ? Date.parse(sub.next_billing_date) : NaN;
    if (Number.isFinite(next)) until = next + 5 * 24 * 60 * 60_000;
  }
  const pass = await signPass({ customerId, subscriptionId: subscriptionId || undefined, paymentId, until });
  return { pass, customerId, until };
}

/* ------------------------------------------------------------ allowance -- */

const creditId = () => env("DODO_PLUS_CREDIT_ID");

/** What is left this month, or null when no allowance is configured. */
export async function balance(customerId: string): Promise<number | null> {
  const cid = creditId();
  if (!cid || !customerId) return null;
  const out = await call<{ balance?: string }>(`/credit-entitlements/${encodeURIComponent(cid)}/balances/${encodeURIComponent(customerId)}`);
  if (!out || out.balance === undefined) return null;
  const n = Number(out.balance);
  return Number.isFinite(n) ? n : null;
}

/** Take a request's cost off the allowance. Never throws; a ledger that is down does not stop an answer. */
export async function debit(customerId: string, usd: number, what: string): Promise<void> {
  const cid = creditId();
  if (!cid || !customerId || !(usd > 0)) return;
  await call(`/credit-entitlements/${encodeURIComponent(cid)}/balances/${encodeURIComponent(customerId)}/ledger-entries`, {
    method: "POST",
    body: {
      credit_entitlement_id: cid,
      amount: String(creditsFor(usd)),
      entry_type: "debit",
      idempotency_key: `${customerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      metadata: { what },
    },
  });
}

/** The one sentence said when the month's allowance is gone. */
export const USED_UP = "Your Armi Plus allowance for this month is used up. It refills on your renewal date — or add a key of your own in Settings.";
