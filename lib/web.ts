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
    /* And one line of it cannot be the page either. The count was capped and
       the length was not, so console.log(bigString) handed the host a
       structured clone of several megabytes, five hundred times over. A
       console shows you the first screenful of anything; the rest was only
       ever going to be dropped by the drawer after it had been copied. */
    var text = parts.map(fmt).join(" ");
    if (text.length > 4000) text = text.slice(0, 4000) + " … (" + text.length + " characters)";
    try { parent.postMessage({ __armiConsole: 1, run: RUN, level: level, text: text }, "*"); } catch (e) {}
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

  /* Pointing at something.
     ---------------------------------------------------------------------
     The whole feature is: if you can see it, you can select it and say what
     to do with it. Everything else about this app already lets you describe a
     change; nothing let you *indicate* one, and describing "the blue button
     roughly in the middle of the dashboard" is a translation step that loses
     more than it carries.

     Turned on and off by a message rather than by rebuilding the page, and
     that is not a detail: a new srcDoc is a fresh load, so a picker you
     toggled by re-assembling would reset the counter, reshuffle the deck and
     scroll you back to the top every time you reached for it. Nothing about
     the running page changes here except one outline.

     Clicks are taken in the capture phase and stopped. While you are pointing,
     a button is a thing you are choosing, not a thing you are pressing — a
     picker that also fired the page's own handlers would submit the form you
     were trying to describe. */
  var picking = false;
  var lit = null;
  var mark = null;
  var markOffset = null;

  function outline(el){
    if (lit === el) return;
    clear();
    lit = el;
    if (!el || !el.style) return;
    /* Its own outline, remembered and put back. Outline rather than border or
       box-shadow because it is the one visual that takes up no space: a
       highlight that reflows the page moves the thing you were aiming at.

       Both properties are remembered. The offset used not to be, so pointing
       at an element that had an inline outline-offset of its own and moving
       away deleted it — a change to the page made by the act of looking at
       it. */
    mark = el.style.outline;
    markOffset = el.style.outlineOffset;
    el.style.outline = "2px solid #3450b5";
    el.style.outlineOffset = "1px";
  }
  function clear(){
    if (lit && lit.style) {
      lit.style.outline = mark || "";
      lit.style.outlineOffset = markOffset || "";
    }
    lit = null; mark = null; markOffset = null;
  }

  function markup(el){
    var was = lit === el;
    if (was) clear();
    var out = "";
    try { out = el.outerHTML || ""; } catch (e) {}
    if (was) outline(el);
    return out.slice(0, 800);
  }

  function describe(el){
    var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    var path = [];
    for (var n = el; n && n.nodeType === 1 && path.length < 6; n = n.parentElement) {
      var step = n.tagName.toLowerCase();
      if (n.id) { step += "#" + n.id; path.unshift(step); break; }
      if (n.className && typeof n.className === "string") {
        var first = n.className.trim().split(/\s+/)[0];
        if (first) step += "." + first;
      }
      path.unshift(step);
    }
    return {
      __armiPicked: 1,
      run: RUN,
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      cls: (typeof el.className === "string" ? el.className : "").trim(),
      text: text.slice(0, 120),
      /* The anchor. A tag and a class are not enough to find one element in a
         file that has nine of them; the actual markup is, and it is what the
         model is shown so it changes the one you meant.

         Read with the highlight off. outerHTML serialises the inline style,
         and by the time a click arrives the element is wearing this picker's
         own blue outline — so the markup handed to the model
         as "what you wrote" contained a rule nobody wrote, and a model asked
         to edit that element kept it. */
      html: markup(el),
      path: path.join(" > ")
    };
  }

  window.addEventListener("message", function(e){
    // From the page that framed this one, and nowhere else.
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.__armiPick !== 1) return;
    picking = Boolean(d.on);
    document.documentElement.style.cursor = picking ? "crosshair" : "";
    if (!picking) clear();
  });

  document.addEventListener("mousemove", function(e){
    if (!picking) return;
    var el = e.target;
    if (el && el.nodeType === 1 && el !== document.documentElement && el !== document.body) outline(el);
  }, true);

  document.addEventListener("click", function(e){
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    try { parent.postMessage(describe(el), "*"); } catch (err) {}
  }, true);

  document.addEventListener("mouseleave", function(){ if (picking) clear(); }, true);
})();</script>`;

/**
 * Text that cannot climb out of the tag it is being put inside.
 *
 * An HTML parser ends a script at `</script` followed by whitespace, a slash or
 * a `>` — not at the literal string `</script>`, which is all the old version
 * looked for. So a file containing `</script >`, or `</script\n>`, or
 * `</scripT>` in a string closed the tag it was inlined into and put the rest
 * of somebody's JavaScript on the page as text. The same is true of `</style`
 * inside a stylesheet, where nothing was escaped at all.
 *
 * `<\/` is the escape in both places: a valid string escape in JavaScript and a
 * valid character escape in CSS, and inert inside a comment.
 */
const escIn = (tag: string) => (s: string) =>
  s.replace(new RegExp(`</(${tag})(?=[\\s/>])`, "gi"), "<\\/$1");

const esc = escIn("script");
const escStyle = escIn("style");

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
  /** 1-based, inclusive, in the assembled document. */
  from: number;
  to: number;
  /**
   * The line of `name` that `from` corresponds to.
   *
   * Almost always 1, because a whole file is inlined at once. Not for
   * index.html, which arrives in several runs with other files spliced between
   * them — and index.html is the file most of the markup is in.
   */
  at: number;
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
  return hit ? { name: hit.name, line: line - hit.from + hit.at } : null;
}

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;
const lines = (text: string) => text.split("\n").length;

/**
 * One attribute's value, however it was written.
 *
 * `href="style.css"`, `href='style.css'` and `href=style.css` are the same
 * attribute, and HTML has always allowed the third. Only the quoted forms used
 * to be recognised, so a page written without quotes — which a model does
 * sometimes, and a person writing quickly does often — had its stylesheet left
 * as a link to a file that does not exist on an opaque origin. Nothing loaded
 * and nothing said why.
 */
function attrValue(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? m[1] ?? m[2] ?? m[3] ?? null : null;
}

/** The same attribute string without one attribute, valued or bare. */
function withoutAttr(attrs: string, name: string): string {
  return attrs.replace(
    new RegExp(`\\s*\\b${name}\\b(\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, "gi"),
    "",
  );
}

/**
 * A run of the finished document, and where it came from.
 *
 * The document is built out of these rather than rewritten and then searched.
 * Searching was wrong twice over. index.html was never found at all — by the
 * time the search ran, the string had been rewritten by every replacement, so
 * `html.indexOf(entry.content)` failed and the file holding most of the markup
 * had no entry in the map, which is to say a runtime error in it reported no
 * location. And a file whose text happened to occur inside another file
 * matched wherever it occurred first.
 *
 * An empty `name` means the run belongs to no file of yours — the console
 * bridge, the theme tag — and `locate` says so by finding nothing, which is
 * the honest answer for a line you did not write.
 */
interface Piece {
  name: string;
  /** The line of `name` this run starts on. */
  at: number;
  text: string;
}

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

  const src = entry.content;
  const resolve = (v: string | null) =>
    v ? byName.get(String(v).replace(/^\.?\//, "")) : undefined;

  /** A stretch of the entry replaced by something else. */
  interface Edit {
    at: number;
    len: number;
    pieces: Piece[];
    /** Runs after the document is parsed, so it is moved rather than left. */
    defer?: boolean;
  }
  const edits: Edit[] = [];

  // <link rel="stylesheet" href="style.css"> -> <style>…</style>
  const linkRe = /<link\b[^>]*>/gi;
  for (let m = linkRe.exec(src); m; m = linkRe.exec(src)) {
    const f = resolve(attrValue(m[0], "href"));
    if (!f || f.lang !== "css") continue;
    const line = lineOf(src, m.index);
    edits.push({
      at: m.index,
      len: m[0].length,
      pieces: [
        { name: entry.name, at: line, text: "<style>\n" },
        { name: f.name, at: 1, text: escStyle(f.content) },
        { name: entry.name, at: line, text: "\n</style>" },
      ],
    });
  }

  // <script src="app.js"></script> -> <script>…</script>, keeping type and the like
  const scriptRe = /<script\b([^>]*)>\s*<\/script>/gi;
  for (let m = scriptRe.exec(src); m; m = scriptRe.exec(src)) {
    const f = resolve(attrValue(m[0], "src"));
    if (!f) continue;
    const line = lineOf(src, m.index);
    const kept = withoutAttr(withoutAttr(withoutAttr(m[1], "src"), "defer"), "async").trim();
    edits.push({
      at: m.index,
      len: m[0].length,
      defer: /\bdefer\b/i.test(m[1]),
      pieces: [
        { name: entry.name, at: line, text: `<script${kept ? " " + kept : ""}>\n` },
        { name: f.name, at: 1, text: esc(f.content) },
        { name: entry.name, at: line, text: "\n</script>" },
      ],
    });
  }

  /* The bridge goes first inside <head>, so it is listening before any of your
     own code can throw. */
  const head = BRIDGE + themeTag(theme);
  const headTag = /<head[^>]*>/i.exec(src);
  if (headTag) {
    edits.push({
      at: headTag.index,
      len: headTag[0].length,
      pieces: [
        { name: entry.name, at: lineOf(src, headTag.index), text: headTag[0] },
        { name: "", at: 0, text: head },
      ],
    });
  }

  edits.sort((a, b) => a.at - b.at);

  const pieces: Piece[] = [];
  const deferred: Piece[] = [];
  if (!headTag) pieces.push({ name: "", at: 0, text: head });
  let cursor = 0;
  for (const e of edits) {
    if (e.at < cursor) continue;   // overlapping matches: the first one wins
    const before = src.slice(cursor, e.at);
    if (before) pieces.push({ name: entry.name, at: lineOf(src, cursor), text: before });
    for (const piece of e.pieces) (e.defer ? deferred : pieces).push(piece);
    cursor = e.at + e.len;
  }
  const tail = src.slice(cursor);
  if (tail) pieces.push({ name: entry.name, at: lineOf(src, cursor), text: tail });

  /* `defer` means "after the document is parsed", and an inline script has no
     such thing — the attribute is not merely ignored on one, it is invalid.
     The old code stripped it and left the tag where it was, which for the
     usual case of a deferred script in <head> meant running it against a
     document that did not exist yet: every getElementById at the top level came
     back null, in a preview whose own source said the script would wait. Moved
     to the end of the body instead, in document order, which is as close as a
     single document gets — and it keeps the script at top level, which
     wrapping it in a DOMContentLoaded handler would not. */
  if (deferred.length) {
    let idx = -1;
    let at = -1;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const k = pieces[i].text.toLowerCase().lastIndexOf("</body>");
      if (k !== -1) { idx = i; at = k; break; }
    }
    const spaced = [{ name: "", at: 0, text: "\n" }, ...deferred, { name: "", at: 0, text: "\n" }];
    if (idx === -1) pieces.push(...spaced);
    else {
      const p = pieces[idx];
      const before = p.text.slice(0, at);
      const after = p.text.slice(at);
      pieces.splice(
        idx,
        1,
        { name: p.name, at: p.at, text: before },
        ...spaced,
        { name: p.name, at: p.at + lines(before) - 1, text: after },
      );
    }
  }

  /* Pieces meet in the middle of a line as often as not — an entry piece ends
     with an indent, the next file's text begins after the newline that follows
     it — so a span claims only the lines a piece has to itself. Without that,
     two files both claim the line they share, the first one listed wins, and
     the first line of every inlined file is reported as a line of index.html. */
  let html = "";
  let line = 1;
  const map: SourceSpan[] = [];
  for (const p of pieces) {
    if (!p.text) continue;
    const n = lines(p.text);
    if (p.name) {
      const lead = p.text.startsWith("\n") ? 1 : 0;
      const from = line + lead;
      const to = line + n - 1 - (p.text.endsWith("\n") ? 1 : 0);
      if (to >= from) map.push({ name: p.name, from, to, at: p.at + lead });
    }
    html += p.text;
    line += n - 1;
  }

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
