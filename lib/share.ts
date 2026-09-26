/**
 * A link that is the conversation.
 *
 * The other assistants share a thread by putting a copy on their server and
 * handing out its address. This app has no server that knows who you are,
 * and a share link that outlives the browser is a row all five of them
 * have. So the link *carries* the conversation: the text of every turn,
 * compressed and written into the fragment after `#`, which no server ever
 * receives — a fragment is not sent with the request. Whoever opens it gets
 * the page rendered from the link itself, and can continue it in their
 * own Armi, where it becomes a conversation of theirs.
 *
 * Kept small: only what a reader needs. Text, who said it (the Armi model's
 * name, never the engine's), the sources an answer rested on. Pictures and
 * files are named, not carried; a link is not a place for a megabyte.
 */

import type { Conversation, Message, WebSource } from "./types";
import { getPreset } from "./presets";

export interface SharedMessage {
  r: "user" | "assistant";
  c: string;
  /** Who answered, by the Armi name. */
  n?: string;
  s?: { t: string; u: string }[];
}

export interface Shared {
  v: 1;
  t: string;
  d: number;
  m: SharedMessage[];
}

/** The longest link that is still a link: past this, messaging apps and some browsers cut it. */
export const SHARE_LIMIT = 100_000;

/* In pieces: spread whole into fromCharCode, a long thread overflows the call stack. */
const B64 = {
  to: (bytes: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  from: (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=")), (c) => c.charCodeAt(0)),
};

async function deflate(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

function nameOf(m: Message): string | undefined {
  const preset = m.presetId ? getPreset(m.presetId) : null;
  return preset?.name ?? (m.role === "assistant" ? "Armi" : undefined);
}

function textOf(m: Message): string {
  const parts = m.content.map((b) => {
    if (b.type === "text") return b.text;
    if (b.type === "image") return `> [image: ${b.name ?? "pasted"}]`;
    if (b.type === "file") return `> [file: ${b.name}]`;
    return "";
  });
  return parts.filter(Boolean).join("\n\n").trim();
}

export function toShared(c: Conversation, messages: Message[]): Shared {
  return {
    v: 1,
    t: c.title || "A conversation with Armi",
    d: c.createdAt,
    m: messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        const out: SharedMessage = { r: m.role as "user" | "assistant", c: textOf(m) };
        const n = nameOf(m);
        if (n) out.n = n;
        const s = (m.sources ?? []).filter((x): x is WebSource => Boolean(x?.url)).slice(0, 12).map((x) => ({ t: x.title || x.url, u: x.url }));
        if (s.length) out.s = s;
        return out;
      })
      .filter((m) => m.c),
  };
}

/** The token after `#`: `z.` and deflated, or `j.` and plain where the browser cannot deflate. */
export async function encodeShare(c: Conversation, messages: Message[]): Promise<string> {
  const json = JSON.stringify(toShared(c, messages));
  const packed = await deflate(json);
  return packed ? `z.${B64.to(packed)}` : `j.${B64.to(new TextEncoder().encode(json))}`;
}

export async function decodeShare(token: string): Promise<Shared | null> {
  try {
    const t = token.replace(/^#?(share=)?/, "");
    const body = t.slice(2);
    const json = t.startsWith("z.") ? await inflate(B64.from(body)) : t.startsWith("j.") ? new TextDecoder().decode(B64.from(body)) : "";
    const got = JSON.parse(json) as Shared;
    if (got?.v !== 1 || !Array.isArray(got.m)) return null;
    /* Read back as data, field by field: nothing in the link decides what
       the page does, only what it says. */
    return {
      v: 1,
      t: String(got.t ?? "").slice(0, 200) || "A conversation with Armi",
      d: Number(got.d) || Date.now(),
      m: got.m.slice(0, 400).map((x) => ({
        r: x.r === "user" ? "user" : "assistant",
        c: String(x.c ?? "").slice(0, 200_000),
        ...(x.n ? { n: String(x.n).slice(0, 40) } : {}),
        ...(Array.isArray(x.s) ? { s: x.s.slice(0, 12).map((y) => ({ t: String(y?.t ?? "").slice(0, 200), u: String(y?.u ?? "") })).filter((y) => /^https?:\/\//.test(y.u)) } : {}),
      })),
    };
  } catch {
    return null;
  }
}

export function shareUrl(token: string): string {
  return `${location.origin}/share#${token}`;
}
