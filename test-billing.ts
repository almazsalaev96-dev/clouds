export {};
/* The allowance: counted only on the server's keys, checked before sending,
   raised by a subscription, and started again each month. */
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { setConfigured } = await import("./lib/configured");
const b = await import("./lib/billing");

let failed = 0;
function check(ok: boolean, what: string, got?: unknown) {
  console.log(`  ${ok ? "✓" : "✗"} ${what}${ok || got === undefined ? "" : ` — got ${JSON.stringify(got)}`}`);
  if (!ok) failed++;
}

console.log("\nOff unless the server holds a Dodo key");
setConfigured({ anthropic: true });
b.recordSpend("anthropic", 5);
check(b.limitFor("anthropic") === null, "nothing is metered or blocked while billing is off");
check(b.billingState().spentUsd === 0, "and nothing was counted", b.billingState().spentUsd);

console.log("\nOn: the server's keys are metered, a person's own are not");
b.setBillingConfig({ enabled: true, checkoutUrl: "https://test.checkout.dodopayments.com/buy/pdt_x?quantity=1", price: "$1 / month", freeCapUsd: 0.05, proCapUsd: 0.5 });
b.recordSpend("openai", 1);
check(b.billingState().spentUsd === 0, "a provider the server has no key for is the person's own", b.billingState().spentUsd);
check(b.limitFor("openai") === null, "and is never blocked");
b.recordSpend("anthropic", 0.03);
check(b.limitFor("anthropic") === null, "under the free cap, answers go");
b.recordSpend("anthropic", 0.03);
const e = b.limitFor("anthropic");
check(e?.kind === "limit" && e.action === "subscribe", "past it, the next request is stopped with a way to subscribe", e);
check(Boolean(e?.message.includes("$1 / month")), "and the price is in the sentence", e?.message);

console.log("\nA subscription raises the cap");
store.set("armi.billing", JSON.stringify({ ...JSON.parse(store.get("armi.billing")!), active: true, subscriptionId: "sub_1" }));
check(b.limitFor("anthropic") === null, "the same spend is well inside the paid allowance");
check(b.billingState().capUsd === 0.5, "measured against the paid cap", b.billingState().capUsd);
b.forgetSubscription();
check(b.limitFor("anthropic")?.kind === "limit", "forgetting it on this browser puts the free cap back");

console.log("\nA new month starts from nothing");
store.set("armi.billing", JSON.stringify({ month: "1999-01", spentUsd: 99 }));
check(b.billingState().spentUsd === 0 && b.limitFor("anthropic") === null, "last month's spend is not this month's");

console.log("\nThe checkout sends people back here");
(globalThis as any).window = { location: { origin: "https://armi.example" } };
const href = new URL(b.checkoutHref());
check(href.searchParams.get("redirect_url") === "https://armi.example/", "redirect_url points at this app", href.toString());
check(href.searchParams.get("quantity") === "1", "and the link's own parameters survive");

console.log(`\nFAIL (${failed})`);
if (failed) process.exit(1);
