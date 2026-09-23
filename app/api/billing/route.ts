import DodoPayments from "dodopayments";

/* Node, not edge: the Dodo SDK is the one thing in this app that is not
   written for the edge runtime, and this route is two small calls. */
export const runtime = "nodejs";

const DEFAULT_CHECKOUT = "https://test.checkout.dodopayments.com/buy/pdt_0NoDMr2u9jW7tmMlbYpnL?quantity=1";

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function apiKey(): string | undefined {
  const v = process.env.DODO_PAYMENTS_API_KEY;
  return v && v.trim() ? v.trim() : undefined;
}

function checkoutUrl(): string {
  return process.env.DODO_CHECKOUT_URL?.trim() || DEFAULT_CHECKOUT;
}

/** The product this installation sells, read off the checkout link. */
function productId(): string | undefined {
  return process.env.DODO_PRODUCT_ID?.trim() || checkoutUrl().match(/\/buy\/(pdt_[A-Za-z0-9]+)/)?.[1];
}

function client(): DodoPayments {
  /* A test-mode checkout link is a test-mode product: asking live mode about
     it is a 404 that reads exactly like "not subscribed". */
  const environment =
    process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ||
    (!process.env.DODO_PAYMENTS_ENVIRONMENT && !checkoutUrl().includes("test.checkout"))
      ? "live_mode"
      : "test_mode";
  return new DodoPayments({ bearerToken: apiKey(), environment });
}

/**
 * What the browser needs to draw the allowance and the paywall. Billing is on
 * only where the server holds a Dodo key: without one nothing could ever be
 * verified, and a paywall that cannot be paid through is just a wall.
 */
export async function GET() {
  return Response.json({
    enabled: Boolean(apiKey()),
    checkoutUrl: checkoutUrl(),
    price: process.env.DODO_PRICE_LABEL?.trim() || "$1 / month",
    freeCapUsd: num(process.env.FREE_MONTHLY_USD, 0.05),
    proCapUsd: num(process.env.PRO_MONTHLY_USD, 0.5),
  });
}

/**
 * Is this subscription real, current, and for this product?
 *
 * The browser brings an id — from the address Dodo sent it back to, or from
 * its own memory — and gets back a verdict it cannot forge, because the
 * verdict is Dodo's. A payment id is accepted too, since that is what some
 * checkouts return, and followed to the subscription it paid for.
 */
export async function POST(req: Request) {
  if (!apiKey()) return Response.json({ active: false, status: "disabled" });
  let body: { subscriptionId?: unknown; paymentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const id = (v: unknown, prefix: string) =>
    typeof v === "string" && v.startsWith(prefix) && /^[A-Za-z0-9_]{4,80}$/.test(v) ? v : undefined;
  let subscriptionId = id(body.subscriptionId, "sub_");
  const paymentId = id(body.paymentId, "pay_");
  if (!subscriptionId && !paymentId) return new Response("Bad request", { status: 400 });

  const dodo = client();
  try {
    if (!subscriptionId && paymentId) {
      const payment = await dodo.payments.retrieve(paymentId);
      subscriptionId = payment.subscription_id ?? undefined;
      if (!subscriptionId) return Response.json({ active: false, status: "not_a_subscription" });
    }
    const sub = await dodo.subscriptions.retrieve(subscriptionId!);
    const want = productId();
    if (want && sub.product_id !== want) {
      return Response.json({ active: false, status: "other_product", subscriptionId });
    }
    return Response.json({
      active: sub.status === "active",
      status: sub.status,
      subscriptionId,
      nextBillingDate: sub.next_billing_date,
    });
  } catch (err) {
    if (err instanceof DodoPayments.NotFoundError) {
      return Response.json({ active: false, status: "not_found" });
    }
    console.error("dodo verify failed", err instanceof Error ? err.message : err);
    return new Response("Couldn't reach Dodo Payments", { status: 502 });
  }
}
