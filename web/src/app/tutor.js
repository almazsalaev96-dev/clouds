/**
 * Finding the tutor, and talking to it.
 *
 * The rule this file exists to keep: **no provider credential ever reaches this
 * page.** There is no field anywhere in Slate that takes an Anthropic or
 * ElevenLabs key, and `looksLikeSecret` below actively refuses one if it is pasted
 * somewhere by mistake. A key in a web page is a key published — it is readable in
 * the page source, in browser storage and in the network tab, and rotating it is
 * the only remedy once it has been.
 *
 * What the page holds instead is at most an *access code*: a value the operator
 * chooses, sets as `SLATE_APP_TOKEN` on their own gateway, and can change at any
 * time. It is worthless anywhere else, and it exists so that a deployment paid for
 * by one person is not a free tutor for the whole internet.
 *
 * Where the app is served from the same origin as the gateway — the Vercel
 * deployment in this repository — there is nothing to configure at all: the page
 * asks `/health`, finds the tutor, and uses it.
 */
import * as store from "./store.js";

export const state = {
  /** "unknown" | "checking" | "ready" | "needsCode" | "notConfigured" | "absent" */
  mode: "unknown",
  origin: "",          // "" means the page's own origin
  sameOrigin: true,
  detail: "",
  voice: false,
};

let listeners = [];
export const onChange = (fn) => { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; };
const announce = () => { for (const fn of listeners) fn(state); };

/** A provider credential, recognised so it can be refused rather than stored. */
export function looksLikeSecret(value) {
  const v = String(value || "").trim();
  return /^sk-ant-/i.test(v) || /^sk-[A-Za-z0-9_-]{16,}/.test(v) || /^xi-[A-Za-z0-9]{16,}/i.test(v);
}

export const gatewayUrl = () => (store.getPref("gatewayUrl", "") || "").replace(/\/+$/, "");
export const accessCode = () => store.getPref("accessCode", "") || "";
export const available = () => state.mode === "ready" || state.mode === "needsCode";

function headers(extra = {}) {
  const code = accessCode();
  return {
    "content-type": "application/json",
    ...(code ? { authorization: `Bearer ${code}` } : {}),
    ...extra,
  };
}

/**
 * Ask the deployment whether it has a tutor. Same origin first, because that is
 * the configuration that needs no setup; a URL in Settings overrides it for anyone
 * running their gateway elsewhere.
 */
export async function probe() {
  const base = gatewayUrl();
  state.origin = base;
  state.sameOrigin = base === "";

  // A page opened from a file has no origin to serve a gateway, so asking would
  // only produce a cross-origin error in the console for something that could
  // never have worked.
  if (!base && !/^https?:$/.test(location.protocol)) {
    state.mode = "absent";
    state.detail = "This copy is open as a file, so there is no server alongside it.";
    announce();
    return state;
  }

  state.mode = "checking";
  announce();

  try {
    const response = await fetch(`${base}/health`, { headers: headers(), cache: "no-store" });
    if (response.status === 503) {
      const body = await response.json().catch(() => null);
      state.mode = "notConfigured";
      state.detail = (body && body.error && body.error.message)
        || "The tutor server is deployed but has no provider credentials yet.";
      announce();
      return state;
    }
    if (!response.ok) {
      state.mode = "absent";
      state.detail = `The tutor server answered ${response.status}.`;
      announce();
      return state;
    }
    const health = await response.json();
    state.voice = health.voice && health.voice !== "unavailable";
    state.detail = `${health.ai} · ${health.environment}`;
    state.mode = health.requiresToken && !accessCode() ? "needsCode" : "ready";
    announce();
    return state;
  } catch {
    // No gateway on this origin is the ordinary case for a file:// or static build,
    // not an error worth showing anyone.
    state.mode = "absent";
    state.detail = "";
    announce();
    return state;
  }
}

export async function ask(payload, signal) {
  const response = await fetch(`${gatewayUrl()}/v1/tutor`, {
    method: "POST", headers: headers(), body: JSON.stringify(payload), signal,
  });

  if (response.status === 401) {
    state.mode = "needsCode";
    announce();
    throw new Error("this tutor server needs an access code — add it in Settings");
  }
  if (response.status === 429) {
    const wait = response.headers.get("retry-after");
    throw new Error(`the tutor server is rate limiting${wait ? `; try again in ${wait}s` : ""}`);
  }
  if (response.status === 503) {
    const body = await response.json().catch(() => null);
    throw new Error((body && body.error && body.error.message) || "the tutor server is not configured");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`the tutor server answered ${response.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }

  const data = await response.json();
  if (!data || !data.reply || typeof data.reply.message !== "string") {
    throw new Error("the tutor server's reply did not match the expected shape");
  }
  if (state.mode !== "ready") { state.mode = "ready"; announce(); }
  return data.reply;
}

/** The reply, in the editorial shape the panel renders. */
export function toAnswer(reply) {
  const blocks = [{ title: "", kind: "text", text: reply.message }];
  if (reply.steps && reply.steps.length) {
    blocks.push({
      title: "Working", kind: "steps",
      items: reply.steps.filter((s) => !s.isHidden).map((s) => s.text),
    });
  }
  if (reply.uncertainty) {
    blocks.push({ title: "What I am unsure about", kind: "note", text: reply.uncertainty });
  }
  return { blocks, followUps: [], source: `Tutor · confidence ${reply.confidence.toFixed(2)}` };
}
