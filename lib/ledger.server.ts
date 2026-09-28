/**
 * What each Armi Plus member has spent, kept on the server.
 *
 * A pass is held by the browser, so it cannot carry what is left — an old
 * copy would be as good as a new one. What is spent lives here instead,
 * one small record a customer, and what is paid is read from Dodo. The
 * two together are the balance.
 *
 * Where it lives: a private Vercel Blob store in production (the
 * `BLOB_READ_WRITE_TOKEN` Vercel sets when the store is connected), or,
 * for the tests, any server that answers GET and PUT of JSON at
 * `ARMI_LEDGER_URL/<id>`. With neither, there is no ledger and the
 * callers say so rather than guessing.
 */

export interface Spent {
  /** Dollars of model cost taken so far. */
  usd: number;
  at: number;
}

const env = (k: string): string | undefined => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

/** Which store is behind the ledger, if any. */
export function ledgerKind(): "blob" | "http" | null {
  if (env("ARMI_LEDGER_URL")) return "http";
  if (env("BLOB_READ_WRITE_TOKEN")) return "blob";
  return null;
}

const safeId = (customerId: string) => customerId.replace(/[^\w-]/g, "_").slice(0, 80);
const path = (customerId: string) => `armi-plus/spent/${safeId(customerId)}.json`;

function parse(text: string | null): Spent {
  if (!text) return { usd: 0, at: 0 };
  try {
    const o = JSON.parse(text) as Partial<Spent>;
    const usd = Number(o.usd);
    return { usd: Number.isFinite(usd) && usd > 0 ? usd : 0, at: Number(o.at) || 0 };
  } catch {
    return { usd: 0, at: 0 };
  }
}

async function read(customerId: string): Promise<{ spent: Spent; etag?: string } | null> {
  const kind = ledgerKind();
  if (kind === "http") {
    const res = await fetch(`${env("ARMI_LEDGER_URL")}/${encodeURIComponent(safeId(customerId))}`, { cache: "no-store" }).catch(() => null);
    if (!res) return null;
    if (res.status === 404) return { spent: { usd: 0, at: 0 } };
    return res.ok ? { spent: parse(await res.text()) } : null;
  }
  if (kind === "blob") {
    const { get } = await import("@vercel/blob");
    let failed = false;
    const got = await get(path(customerId), { access: "private", useCache: false }).catch((e: unknown) => {
      /* Not there yet is a first purchase, not a failure. */
      if (!/not.?found|404/i.test(String((e as Error)?.message ?? e))) failed = true;
      return null;
    });
    if (failed) return null;
    if (!got || got.statusCode !== 200) return { spent: { usd: 0, at: 0 } };
    return { spent: parse(await new Response(got.stream).text()), etag: got.blob.etag };
  }
  return null;
}

async function write(customerId: string, spent: Spent, etag?: string): Promise<boolean> {
  const kind = ledgerKind();
  const body = JSON.stringify(spent);
  if (kind === "http") {
    const res = await fetch(`${env("ARMI_LEDGER_URL")}/${encodeURIComponent(safeId(customerId))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => null);
    return Boolean(res?.ok);
  }
  if (kind === "blob") {
    const { put } = await import("@vercel/blob");
    try {
      await put(path(customerId), body, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Dollars spent so far, or null when there is no ledger to ask. */
export async function spentUsd(customerId: string): Promise<number | null> {
  const got = await read(customerId);
  return got ? got.spent.usd : null;
}

/**
 * Add a request's cost. Written against the version read, and read again
 * when someone else wrote in between — two answers finishing together must
 * both be counted. Never throws: a ledger that is down does not stop an
 * answer that has already been given.
 */
export async function addSpent(customerId: string, usd: number): Promise<void> {
  if (!(usd > 0) || !ledgerKind()) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const got = await read(customerId);
    if (!got) return;
    const next: Spent = { usd: Math.round((got.spent.usd + usd) * 1e6) / 1e6, at: Date.now() };
    if (await write(customerId, next, got.etag)) return;
  }
}
