/** Small DOM helpers. No framework: the app is a handful of screens, and a
 *  framework would be more code than the screens. */

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
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/**
 * `ParentNode.append` stringifies anything that is not a Node, so a conditional
 * child that evaluates to null lands on the page as the word "null". Everything
 * appends through here instead.
 */
export function add(parent, ...children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return parent;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export const pct = (x) => `${Math.round(x * 100)}%`;

export function relativeTime(from, to = Date.now()) {
  const seconds = Math.round((from - to) / 1000);
  const abs = Math.abs(seconds);
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (abs >= size) {
      const value = Math.round(seconds / size);
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(value, unit);
    }
  }
  return "just now";
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Mathematical notation for the reader, not for a parser. Kept deliberately small:
 * enough to make `x^2` and `sqrt(2)/2` look like mathematics, and nothing that
 * could change what an expression means.
 */
export function pretty(text) {
  if (!text) return "";
  return String(text)
    .replace(/\bsqrt\(([^()]*)\)/g, "√($1)")
    .replace(/\bsqrt\s+(\d+)/g, "√$1")
    .replace(/\bpi\b/g, "π")
    .replace(/\btheta\b/g, "θ")
    .replace(/\*/g, "×")
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2");
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

/** A modal that traps focus and closes on Escape, because it is used for real decisions. */
export function sheet(title, body, actions = []) {
  const previous = document.activeElement;
  const close = () => { overlay.remove(); if (previous && previous.focus) previous.focus(); };
  const panel = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title }, [
    el("h2", { class: "sheet-title", text: title }),
    body,
    el("div", { class: "sheet-actions" }, actions.map((a) =>
      el("button", {
        class: `btn ${a.variant || ""}`.trim(),
        onclick: () => { const keep = a.onclick && a.onclick(); if (!keep) close(); },
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
 * Icons, drawn rather than typed. Emoji and dingbats render differently on every
 * platform and at the wrong weight next to text; these sit on the same optical
 * line as the label everywhere.
 */
const ICON = {
  desk: '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M8 3.5v13"/>',
  page: '<path d="M4 16.5 5 12 14 3a1.8 1.8 0 0 1 2.6 2.6L7.6 14.6z"/><path d="M12.2 5.2 14.8 7.8"/>',
  diagnose: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.4"/>',
  progress: '<path d="M3.5 15.5h13"/><rect x="4.5" y="9" width="3" height="5" rx="1"/><rect x="9" y="5.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="11" width="3" height="3" rx="1"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.6v2.2M10 15.2v2.2M17.4 10h-2.2M4.8 10H2.6M15.2 4.8l-1.6 1.6M6.4 13.6l-1.6 1.6M15.2 15.2l-1.6-1.6M6.4 6.4 4.8 4.8"/>',
  pen: '<path d="M4 16.5 5 12 14 3a1.8 1.8 0 0 1 2.6 2.6L7.6 14.6z"/><path d="M4 16.5 7.6 14.6"/>',
  pencil: '<path d="M4.5 15.5 6 11l7.5-7.5 2.5 2.5L8.5 13.5z"/><path d="M4.5 15.5 8.5 13.5"/><path d="M13.5 3.5 16 6"/>',
  highlighter: '<path d="M6 12.5 12.5 6l3 3L9 15.5H6z"/><path d="M3.5 17.5h13"/>',
  eraser: '<path d="M8 15.5h7.5"/><path d="m3.6 12.2 6-6a1.6 1.6 0 0 1 2.3 0l3 3a1.6 1.6 0 0 1 0 2.3l-4 4H6.6l-3-3a1.6 1.6 0 0 1 0-2.3z"/>',
  finger: '<path d="M8 11V5.2a1.4 1.4 0 0 1 2.8 0V10"/><path d="M10.8 9.6a1.3 1.3 0 0 1 2.6 0v1.2"/><path d="M13.4 10.6a1.3 1.3 0 0 1 2.6 0v3.2a3.7 3.7 0 0 1-3.7 3.7h-2a3.6 3.6 0 0 1-2.7-1.2L4.4 13a1.3 1.3 0 0 1 1.8-1.9L8 12.6"/>',
  undo: '<path d="M4 9.5h7.5a4 4 0 0 1 0 8H8"/><path d="M7 6 3.5 9.5 7 13"/>',
  print: '<path d="M6 8V3.5h8V8"/><rect x="3.5" y="8" width="13" height="6" rx="1.5"/><rect x="6" y="12" width="8" height="4.5" rx="1"/>',
};

export function icon(name, size = 18) {
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;
}
