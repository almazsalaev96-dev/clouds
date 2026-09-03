/** DOM helpers and the icon set. No framework: the app is a handful of screens. */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  add(node, children);
  return node;
}

/**
 * `ParentNode.append` stringifies anything that is not a Node, so a conditional
 * child that evaluates to null lands on the page as the word "null". Everything
 * appends through here instead.
 */
export function add(parent, ...children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return parent;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const pct = (x) => `${Math.round(x * 100)}%`;

export function relativeTime(from, to = Date.now()) {
  const seconds = Math.round((from - to) / 1000);
  const abs = Math.abs(seconds);
  for (const [unit, size] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (abs >= size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export function greeting(at = new Date()) {
  const h = at.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Mathematical notation for the reader, not for the parser. Deliberately small:
 * enough that `x^2` and `sqrt(2)/2` look like mathematics, and nothing that could
 * change what an expression means.
 */
export function pretty(text) {
  if (!text) return "";
  return String(text)
    .replace(/\bsqrt\(([^()]*)\)/g, "√($1)")
    .replace(/\bsqrt\s+(\d+)/g, "√$1")
    .replace(/\bpi\b/g, "π").replace(/\btheta\b/g, "θ")
    .replace(/\*/g, "×")
    .replace(/\^2\b/g, "²").replace(/\^3\b/g, "³")
    .replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠")
    .replace(/(?<![\d.])-(?=\d)/g, "−");
}

export function announce(message) {
  let live = document.getElementById("live");
  if (!live) {
    live = el("div", { id: "live", class: "sr-only", "aria-live": "polite", role: "status" });
    document.body.appendChild(live);
  }
  live.textContent = "";
  setTimeout(() => { live.textContent = message; }, 30);
}

export function modal(title, body, actions = []) {
  const previous = document.activeElement;
  const close = () => { overlay.remove(); if (previous && previous.focus) previous.focus(); };
  const panel = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title }, [
    el("h2", { class: "t-section", text: title }),
    body,
    el("div", { class: "row", style: { justifyContent: "flex-end" } }, actions.map((a) =>
      el("button", {
        class: `btn ${a.variant || ""}`.trim(),
        onclick: () => { if (!(a.onclick && a.onclick())) close(); },
      }, a.label))),
  ]);
  const overlay = el("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(); } }, [panel]);
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.body.appendChild(overlay);
  const focusable = panel.querySelector("button, input, textarea, select");
  if (focusable) focusable.focus();
  return close;
}

/**
 * Icons, drawn rather than typed. Emoji and dingbats render at a different weight
 * and baseline on every platform; these sit on the optical line of the label.
 */
const ICON = {
  home: '<path d="M3.5 9.4 10 4l6.5 5.4V16a1 1 0 0 1-1 1h-3v-4.4h-5V17h-3a1 1 0 0 1-1-1z"/>',
  documents: '<path d="M4.5 3.5h6l5 5v8a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z"/><path d="M10.5 3.6V8.5h4.9"/>',
  subjects: '<circle cx="10" cy="4.6" r="2.1"/><circle cx="4.8" cy="14.6" r="2.1"/><circle cx="15.2" cy="14.6" r="2.1"/><path d="M8.6 6.3 6 12.6M11.4 6.3 14 12.6"/>',
  tasks: '<rect x="3.5" y="3.5" width="13" height="13" rx="2.5"/><path d="m6.8 10.2 2.1 2.1 4.3-4.4"/>',
  ai: '<path d="M10 3.2 11.5 7l3.8 1.5-3.8 1.5L10 13.8 8.5 10 4.7 8.5 8.5 7z"/><circle cx="15.2" cy="14.4" r="1.5"/>',
  progress: '<path d="M3.5 16.5h13"/><rect x="4.6" y="9.5" width="3" height="4.6" rx="1"/><rect x="8.9" y="5.8" width="3" height="8.3" rx="1"/><rect x="13.2" y="11.4" width="3" height="2.7" rx="1"/>',
  settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.8v1.9M10 15.3v1.9M17.2 10h-1.9M4.7 10H2.8M15.1 4.9l-1.3 1.3M6.2 13.8l-1.3 1.3M15.1 15.1l-1.3-1.3M6.2 6.2 4.9 4.9"/>',
  pen: '<path d="M4 16.4 5 12 14 3a1.8 1.8 0 0 1 2.6 2.6L7.6 14.6z"/><path d="M4 16.4 7.6 14.6"/>',
  pencil: '<path d="M4.4 15.6 6 11l7.5-7.5 2.5 2.5L8.5 13.5z"/><path d="M13.5 3.5 16 6"/>',
  highlighter: '<path d="M6 12.4 12.4 6l3.1 3.1L9 15.5H6z"/><path d="M3.5 17.6h13"/>',
  eraser: '<path d="M8.2 15.6h7.4"/><path d="m3.6 12.2 6-6a1.6 1.6 0 0 1 2.3 0l3 3a1.6 1.6 0 0 1 0 2.3l-4 4H6.6l-3-3a1.6 1.6 0 0 1 0-2.3z"/>',
  shape: '<rect x="3.4" y="3.4" width="8.6" height="8.6" rx="1.6"/><circle cx="13.2" cy="13.2" r="3.6"/>',
  text: '<path d="M4.6 5.4V3.8h10.8v1.6"/><path d="M10 3.8v12.4"/><path d="M7.4 16.2h5.2"/>',
  lasso: '<path d="M10 3.6c3.6 0 6.5 2 6.5 4.6S13.6 12.8 10 12.8 3.5 10.8 3.5 8.2 6.4 3.6 10 3.6z"/><path d="M7.2 12.4c-.4 1.5.1 2.6 1 3.1"/><circle cx="7.7" cy="16.4" r="1.3"/>',
  finger: '<path d="M8 11V5.2a1.4 1.4 0 0 1 2.8 0V10"/><path d="M10.8 9.6a1.3 1.3 0 0 1 2.6 0v1.2"/><path d="M13.4 10.6a1.3 1.3 0 0 1 2.6 0v3.2a3.7 3.7 0 0 1-3.7 3.7h-2a3.6 3.6 0 0 1-2.7-1.2L4.4 13a1.3 1.3 0 0 1 1.8-1.9L8 12.6"/>',
  undo: '<path d="M4 9.4h7.6a4 4 0 0 1 0 8H8"/><path d="M7 5.9 3.5 9.4 7 12.9"/>',
  print: '<path d="M6 8V3.6h8V8"/><rect x="3.5" y="8" width="13" height="6" rx="1.5"/><rect x="6" y="12" width="8" height="4.4" rx="1"/>',
  mic: '<rect x="7.8" y="2.6" width="4.4" height="9" rx="2.2"/><path d="M4.8 9.2a5.2 5.2 0 0 0 10.4 0"/><path d="M10 14.4v3"/>',
  send: '<path d="M4 10h11"/><path d="m10.4 5.4 4.6 4.6-4.6 4.6"/>',
  close: '<path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  check: '<path d="m4.6 10.4 3.4 3.4 7.4-7.6"/>',
  chevron: '<path d="m7.8 4.8 5 5.2-5 5.2"/>',
  back: '<path d="m12.2 4.8-5 5.2 5 5.2"/>',
  scan: '<path d="M3.6 7V4.6a1 1 0 0 1 1-1H7M13 3.6h2.4a1 1 0 0 1 1 1V7M16.4 13v2.4a1 1 0 0 1-1 1H13M7 16.4H4.6a1 1 0 0 1-1-1V13"/><path d="M3.6 10h12.8"/>',
  file: '<path d="M5 3.6h6l4 4v9a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V4.4A.8.8 0 0 1 5 3.6z"/><path d="M11 3.7V7.7h4"/>',
  clock: '<circle cx="10" cy="10" r="6.6"/><path d="M10 6.2V10l2.6 1.6"/>',
  book: '<path d="M3.6 4.4A1 1 0 0 1 4.7 3.4H9a1.5 1.5 0 0 1 1 1.4v11a1.2 1.2 0 0 0-1-.9H4.6a1 1 0 0 1-1-1z"/><path d="M16.4 4.4a1 1 0 0 0-1.1-1H11a1.5 1.5 0 0 0-1 1.4v11a1.2 1.2 0 0 1 1-.9h4.4a1 1 0 0 0 1-1z"/>',
};

export function icon(name, size = 20) {
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;
}

/** The AI's visual signature: a dot, not a robot. */
export function aiMark(state = "idle") {
  return el("span", { class: `ai-mark ${state}`, "aria-hidden": "true" });
}
