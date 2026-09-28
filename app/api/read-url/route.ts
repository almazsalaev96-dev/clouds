import type { NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { htmlToText, isPrivateAddress } from "@/lib/sourcebook";

export const runtime = "nodejs";

/**
 * A web page, read as a notebook source.
 *
 * The browser cannot read another site for itself, so this server does it
 * on the student's behalf — which makes it a thing that fetches any address
 * it is given, and that is the whole of the danger. So: only http and https
 * on their ordinary ports; the name is looked up first and refused if any
 * address behind it is this machine, a private network or link-local (where
 * a cloud's metadata lives); every redirect is checked the same way before
 * it is followed; and the page is cut off at a size and a time.
 */
const MAX_BYTES = 3_000_000;
const MAX_HOPS = 3;

async function safe(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only web addresses (http or https) can be read.";
  if (url.port && url.port !== "80" && url.port !== "443") return "That address uses a port that is not read.";
  if (url.username || url.password) return "Addresses with a login in them are not read.";
  const host = url.hostname;
  if (!host || /^localhost$/i.test(host) || host.endsWith(".localhost") || host.endsWith(".internal")) return "That address is not on the public web.";
  try {
    const all = await lookup(host, { all: true, verbatim: true });
    if (!all.length || all.some((a) => isPrivateAddress(a.address))) return "That address is not on the public web.";
  } catch {
    return "That site could not be found.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  let raw = "";
  try {
    raw = String(((await req.json()) as { url?: unknown }).url ?? "").trim();
  } catch {
    return Response.json({ ok: false, message: "No address was sent." }, { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ ok: false, message: "That is not a web address." }, { status: 400 });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
      const why = await safe(url);
      if (why) return Response.json({ ok: false, message: why }, { status: 400 });
      res = await fetch(url, {
        redirect: "manual",
        signal: ctl.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; ArmiNotebook/1.0; reads a page a student added as a source)", accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      });
      const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!to) break;
      url = new URL(to, url);
      res = null;
    }
    if (!res) return Response.json({ ok: false, message: "That page redirects too many times." }, { status: 400 });
    if (!res.ok) return Response.json({ ok: false, message: `The site answered ${res.status}.` }, { status: 400 });
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return Response.json({ ok: false, message: "That is not a web page — download the file and add it instead." }, { status: 400 });
    }
    /* Read up to the limit and no further: a page that never ends must not
       hold the function open until it is killed. */
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        got += value.byteLength;
        if (got >= MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
      }
    }
    const body = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    const read = /text\/plain/i.test(type) ? { title: "", text: body.trim() } : htmlToText(body);
    if (read.text.length < 200) {
      return Response.json({ ok: false, message: "There was almost no text on that page — it may need a login or be built by scripts." }, { status: 400 });
    }
    return Response.json({ ok: true, title: read.title || url.hostname, text: read.text.slice(0, 400_000), url: url.toString() });
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    return Response.json({ ok: false, message: aborted ? "The site took too long to answer." : "That page could not be read." }, { status: 400 });
  } finally {
    clearTimeout(timer);
  }
}
