/**
 * The server's half of Armi Plus: Dodo Payments, and the keys.
 *
 * Talks to Dodo over its REST API with the same paths the official SDK
 * uses (`/checkouts`, `/licenses/validate`, `/license_keys`,
 * `/credit-entitlements/…/ledger-entries`), with plain `fetch` so it runs
 * on the edge runtime the chat route lives on. Everything here reads the
 * environment:
 *
 *   DODO_PAYMENTS_API_KEY   the merchant key (`dodo_test_…` / `dodo_live_…`)
 *   DODO_ENVIRONMENT        `test_mode` (default) or `live_mode`
 *   DODO_BASE_URL           an override, for the mock in tests
 *   DODO_PLUS_PRODUCT_ID    the $1-a-month subscription product, which must
 *                           issue a license key on purchase
 *   DODO_PLUS_CREDIT_ID     optional: the credit entitlement attached to that
 *                           product, for the monthly allowance
 *
 * With `DODO_PLUS_PRODUCT_ID` set, the server's provider keys are for Plus
 * members: a request without a valid Plus key uses the key the browser sent
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
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* A key's validity, remembered for ten minutes on this isolate. Every turn
   would otherwise be a round trip to Dodo before the first token. */
const seen = new Map<string, { valid: boolean; at: number }>();
const REMEMBER = 10 * 60_000;

export async function validateKey(key: string): Promise<boolean> {
  const k = key.trim();
  if (!k || !plusConfigured()) return false;
  const had = seen.get(k);
  if (had && Date.now() - had.at < REMEMBER) return had.valid;
  const out = await call<{ valid?: boolean }>("/licenses/validate", { method: "POST", body: { license_key: k }, auth: false });
  const valid = Boolean(out?.valid);
  seen.set(k, { valid, at: Date.now() });
  return valid;
}

/**
 * Bind the key to this browser once, which is also how the customer and
 * product behind it are learned — `validate` says only yes or no.
 */
export async function activateKey(key: string, name: string): Promise<{ customerId?: string; productId?: string; instanceId?: string } | null> {
  const out = await call<{ id?: string; customer?: { customer_id?: string }; product?: { product_id?: string } }>("/licenses/activate", {
    method: "POST",
    body: { license_key: key.trim(), name },
    auth: false,
  });
  if (!out) return null;
  return { customerId: out.customer?.customer_id, productId: out.product?.product_id, instanceId: out.id };
}

/**
 * Dodo's own payment link for the product — a URL that needs no merchant
 * key at all, which is how Plus can be switched on with nothing but the
 * product id. `redirect_url` brings the person back to the app.
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

/**
 * The key, found from the checkout the person just came back from — so
 * they need not go to their email. Best effort: session → payment →
 * customer → the customer's active key for this product. Anything missing
 * along the way returns nothing, and the panel asks for the key instead.
 */
export async function claimKey(from: { sessionId?: string; paymentId?: string }): Promise<string | null> {
  const product = env("DODO_PLUS_PRODUCT_ID");
  if (!env("DODO_PAYMENTS_API_KEY")) return null;
  let paymentId = from.paymentId?.trim() || "";
  if (!paymentId && from.sessionId) {
    const session = await call<{ payment_id?: string | null }>(`/checkouts/${encodeURIComponent(from.sessionId)}`);
    paymentId = session?.payment_id ?? "";
  }
  if (!paymentId) return null;
  const payment = await call<{ customer?: { customer_id?: string } }>(`/payments/${encodeURIComponent(paymentId)}`);
  const customer = payment?.customer?.customer_id;
  if (!customer) return null;
  const q = new URLSearchParams({ customer_id: customer, status: "active" });
  if (product) q.set("product_id", product);
  const keys = await call<{ items?: { key?: string; product_id?: string; status?: string }[] }>(`/license_keys?${q}`);
  const hit = (keys?.items ?? []).find((k) => k.key && (!product || k.product_id === product));
  return hit?.key ?? null;
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
