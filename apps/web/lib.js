/**
 * Small DOM and API helpers.
 *
 * No framework: the client is a handful of views over one state object, and a
 * framework would add a build step to a project that deliberately has none.
 * What replaces it is the `h` helper below and one render pass per view.
 */

/**
 * Element builder. Attributes that start with "on" bind listeners.
 *
 * Note: null, undefined and `false` attribute values are skipped entirely, and
 * `true` renders as an empty string. That is convenient for conditional
 * attributes but means a boolean cannot drive a `[data-x="true"]` CSS rule —
 * pass the string "true"/"false" when the value is matched in a selector.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      el.className = value;
    } else if (key === "html") {
      el.innerHTML = value;
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (selector, root = document) => root.querySelector(selector);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el).append(...children.flat(Infinity).filter(Boolean));
  return el;
}

// ── API ────────────────────────────────────────────────────────────────────

/**
 * Every call returns { ok, value } or { ok: false, failure }, matching the
 * server's shape, so views render failure the same way regardless of whether
 * it came from the network or from the model (§33).
 */
export async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        failure: body?.failure ?? {
          code: "model_error",
          message: `The server returned ${res.status}.`,
          retryable: res.status >= 500,
        },
      };
    }
    return { ok: true, value: body };
  } catch (error) {
    return {
      ok: false,
      failure: {
        code: "model_unavailable",
        message: "Could not reach the server. Check your connection.",
        retryable: true,
        detail: String(error),
      },
    };
  }
}

/**
 * Streams a turn. Parses SSE from a fetch body rather than using EventSource,
 * which cannot POST — and the turn needs a request body.
 */
export async function streamTurn(conversationId, payload, onEvent, signal) {
  let res;
  try {
    res = await fetch(`/api/conversations/${conversationId}/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) return;
    onEvent({
      type: "failure",
      failure: {
        code: "model_unavailable",
        message: "Could not reach the server. Your message was not sent.",
        retryable: true,
      },
    });
    return;
  }

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    onEvent({
      type: "failure",
      failure: body?.failure ?? {
        code: "model_error",
        message: `The server returned ${res.status}.`,
        retryable: res.status >= 500,
      },
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      if (signal?.aborted) return;
      onEvent({
        type: "failure",
        failure: { code: "model_error", message: "The answer was cut off.", retryable: true },
      });
      return;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    // SSE frames are separated by a blank line; a partial frame stays buffered.
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = /^data: (.*)$/m.exec(frame);
      if (!data) continue;
      try {
        onEvent(JSON.parse(data[1]));
      } catch {
        /* A malformed frame is skipped rather than killing the stream. */
      }
    }
  }
}

// ── formatting ─────────────────────────────────────────────────────────────

export function relativeTime(timestamp) {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const percent = (n) => `${Math.round(n * 100)}%`;

/** Renders paragraphs and inline emphasis. Deliberately not a full Markdown
 *  parser: model output here is prose, and innerHTML on model output would be
 *  an injection vector, so text nodes are built rather than HTML strings. */
export function prose(text) {
  const fragment = document.createDocumentFragment();
  for (const paragraph of String(text).split(/\n{2,}/)) {
    if (!paragraph.trim()) continue;
    const p = h("p");
    // Split on **bold** and `code`, keeping the delimiters.
    for (const part of paragraph.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
      if (!part) continue;
      if (part.startsWith("**") && part.endsWith("**")) {
        p.append(h("strong", {}, part.slice(2, -2)));
      } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        p.append(h("code", {}, part.slice(1, -1)));
      } else {
        p.append(document.createTextNode(part));
      }
    }
    fragment.append(p);
  }
  return fragment;
}

/** Reads a dropped or picked file as text, refusing what cannot be read. */
export async function readFileAsText(file) {
  const readable = /^(text\/|application\/(json|xml|x-yaml))/.test(file.type) ||
    /\.(txt|md|markdown|csv|tsv|json|html|xml|yaml|yml|log)$/i.test(file.name);
  if (!readable) {
    return {
      ok: false,
      failure: {
        code: "unsupported_file",
        message: `${file.name} is a ${file.type || "binary"} file. Text, Markdown and CSV work today; PDF extraction is not built yet.`,
        retryable: false,
      },
    };
  }
  try {
    return { ok: true, value: await file.text() };
  } catch {
    return {
      ok: false,
      failure: { code: "unsupported_file", message: `${file.name} could not be read.`, retryable: false },
    };
  }
}

// ── icons (inline, so there is no icon-font dependency) ────────────────────

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  doc: "M6 2h8l6 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm8 1v5h5",
  learn: "M12 3 2 8l10 5 10-5zM4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5.5 12.5L21 21",
  memory: "M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0 0 6v2a3 3 0 0 0 6 0V7a4 4 0 0 0-2-4zm4 4a4 4 0 0 1 0 8",
  ai: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  send: "M4 12 20 4l-4 16-4-6-8-2z",
  close: "M6 6l12 12M18 6 6 18",
  theme: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z",
  back: "M15 5l-7 7 7 7",
};

export function icon(name, size = 20) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[name] ?? ICONS.doc);
  svg.append(path);
  return svg;
}
