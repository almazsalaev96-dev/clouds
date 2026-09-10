import type { CanvasFile } from "./types";

/**
 * A folder of files, assembled into one runnable document.
 *
 * The preview resolves `<link rel="stylesheet" href="style.css">` and
 * `<script src="app.js">` against the other files and inlines them. That
 * indirection is the point: what you write is a real page, the kind that would
 * work if you saved the folder to disk, rather than three panes whose
 * relationship only exists inside this app. Move to a real editor later and
 * nothing has to be untangled.
 *
 * Anything the folder does not contain is left exactly as written, so a CDN
 * script tag still reaches the CDN.
 */

export const ENTRY = "index.html";

/**
 * A cheap, stable name for one run of one folder.
 *
 * Every message the sandbox posts carries it, and the preview drops any that
 * do not carry the run it is currently showing. Without that, a reload racing
 * an in-flight message shows you an error from a version of the file you have
 * already changed — which is precisely the ten minutes the console drawer
 * exists to save. djb2 over the assembled inputs: same folder, same name;
 * one character different, different name.
 */
export function runToken(files: CanvasFile[], nonce: number): string {
  let h = 5381;
  const text = files.map((f) => f.name + "\u0000" + f.content).join("\u0001");
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${nonce}:${(h >>> 0).toString(36)}`;
}

/** The console bridge, injected first so it catches errors in your own code. */
const bridgeFor = (run: string) => `<script>(function(){
  var RUN = ${JSON.stringify(run)};
  var seen = 0;
  function fmt(v){
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.stack || (v.name + ": " + v.message);
    try { return JSON.stringify(v, null, 0); } catch (e) { return String(v); }
  }
  function post(level, parts){
    if (seen++ > 500) return;   // a runaway loop should not take the page with it
    try { parent.postMessage({ __armiConsole: 1, run: RUN, level: level, text: parts.map(fmt).join(" ") }, "*"); } catch (e) {}
  }
  ["log","info","warn","error"].forEach(function(k){
    var original = console[k];
    console[k] = function(){ post(k, [].slice.call(arguments)); original.apply(console, arguments); };
  });
  window.addEventListener("error", function(e){
    post("error", [e.message + (e.lineno ? " (line " + e.lineno + ")" : "")]);
  });
  window.addEventListener("unhandledrejection", function(e){
    post("error", ["Unhandled promise rejection: " + fmt(e.reason)]);
  });
  /* One key, forwarded.
     A sandboxed frame keeps its own keyboard: press Escape inside a running
     page and the app around it never hears about it. That is fine everywhere
     except the one screen where the page has the whole window and Escape is
     how you leave. Exactly Escape and nothing else — a page in here is not
     given a way to drive the app, it is given a way to hand the window back. */
  window.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    try { parent.postMessage({ __armiKey: "Escape" }, "*"); } catch (err) {}
  });
})();</script>`;

const esc = (s: string) => s.replace(/<\/script>/gi, "<\\/script>");

/**
 * The host's theme, stamped on the root before anything paints.
 *
 * A page in here follows `prefers-color-scheme`, which is the reader's system
 * setting — the right answer once the folder is saved and opened somewhere
 * else, and the wrong one while it sits inside an app the reader has
 * explicitly put into dark. So the host says which it is and a page that cares
 * can answer to it. It is inert on a page that does not: an attribute nothing
 * styles changes nothing, which is why this is safe to put on markup someone
 * else wrote.
 */
const themeTag = (theme?: string) =>
  theme
    ? `<script>document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});</script>`
    : "";

/** Where one file's text ended up in the assembled document, in lines. */
export interface SourceSpan {
  name: string;
  /** 1-based, inclusive. */
  from: number;
  to: number;
}

export interface Assembled {
  html: string;
  /** So a runtime error can be reported against the file you wrote. */
  map: SourceSpan[];
}

/**
 * Which file and line a document line belongs to.
 *
 * Without this the console says "line 76" and means line 76 of a document
 * nobody wrote — the browser only ever sees the assembled page. Reporting a
 * number that looks like a line number and is not is worse than reporting no
 * number: people go to line 76 of the file they are in and find something
 * innocent there.
 */
export function locate(map: SourceSpan[], line: number): { name: string; line: number } | null {
  const hit = map.find((m) => line >= m.from && line <= m.to);
  return hit ? { name: hit.name, line: line - hit.from + 1 } : null;
}

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

export function assembleWeb(files: CanvasFile[], theme?: string, run = ""): Assembled {
  const BRIDGE = bridgeFor(run);
  const byName = new Map(files.map((f) => [f.name.replace(/^\.?\//, ""), f]));
  const entry = byName.get(ENTRY) ?? files.find((f) => f.lang === "html");
  if (!entry) {
    return {
      html: `${BRIDGE}<p style="font:14px system-ui;padding:2rem;color:#666">
      No <code>index.html</code> in this folder, so there is nothing to open.</p>`,
      map: [],
    };
  }

  let html = entry.content;

  // <link rel="stylesheet" href="style.css"> -> <style>…</style>
  html = html.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    (whole, href: string) => {
      const f = byName.get(String(href).replace(/^\.?\//, ""));
      return f && f.lang === "css" ? `<style>\n${f.content}\n</style>` : whole;
    },
  );

  // <script src="app.js"></script> -> <script>…</script>, keeping any type/defer
  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (whole, before: string, src: string, after: string) => {
      const f = byName.get(String(src).replace(/^\.?\//, ""));
      if (!f) return whole;
      const attrs = `${before} ${after}`.replace(/\s+(defer|async)\b/gi, "").trim();
      return `<script${attrs ? " " + attrs : ""}>\n${esc(f.content)}\n</script>`;
    },
  );

  // The bridge goes first inside <head>, or at the top when there is no head.
  const head = BRIDGE + themeTag(theme);
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, `<head$1>${head}`)
    : head + html;

  /* Each file's text was inserted verbatim, so finding it again gives its line
     range. Done after the fact rather than tracked during, because the two
     replacements above run in whatever order the markup put them in. */
  const map: SourceSpan[] = [];
  for (const f of [entry, ...files.filter((x) => x !== entry)]) {
    const needle = f.lang === "js" ? esc(f.content) : f.content;
    const at = html.indexOf(needle);
    if (at === -1) continue;                       // not inlined; nothing to map
    const from = lineOf(html, at);
    map.push({ name: f.name, from, to: from + needle.split("\n").length - 1 });
  }
  // Narrowest first: the entry contains the others, and the inner file is the
  // truthful answer for a line that falls in both.
  map.sort((a, b) => b.from - a.from);

  return { html, map };
}

/** The starter folder. A working page, not a lorem-ipsum one. */
export function webTemplate(): { name: string; lang: string; content: string }[] {
  return [
    {
      name: ENTRY,
      lang: "html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Counter</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Counter</h1>
      <output id="value">0</output>
      <div class="row">
        <button id="down" aria-label="Subtract one">−</button>
        <button id="up" aria-label="Add one">+</button>
      </div>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
    },
    {
      name: "style.css",
      lang: "css",
      content: `:root { color-scheme: light dark; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font: 16px/1.5 system-ui, sans-serif;
}

main { text-align: center; }
h1 { font-size: 1.25rem; font-weight: 500; letter-spacing: 0.02em; }

output {
  display: block;
  font-size: 4rem;
  font-variant-numeric: tabular-nums;
  margin: 0.5rem 0 1.25rem;
}

.row { display: flex; gap: 0.5rem; justify-content: center; }

button {
  width: 3rem;
  height: 3rem;
  font-size: 1.25rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: none;
  color: inherit;
  cursor: pointer;
}
button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
`,
    },
    {
      name: "app.js",
      lang: "js",
      content: `const value = document.getElementById("value");
let count = 0;

function render() {
  value.textContent = String(count);
}

document.getElementById("up").addEventListener("click", () => {
  count += 1;
  render();
});

document.getElementById("down").addEventListener("click", () => {
  count -= 1;
  render();
});

render();
`,
    },
  ];
}
