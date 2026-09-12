import type { Highlighter } from "shiki";

/**
 * Highlighting happens in a worker, so tokenising a thousand-line file cannot
 * drop a frame of the stream that produced it. Grammars load lazily and only
 * for the languages actually seen — Shiki's full set is megabytes, and a chat
 * that shows one Python block should not pay for Haskell.
 *
 * If a worker cannot be constructed — an older browser, a strict CSP — the
 * same work runs on this thread instead. Falling back to plain monospace
 * because of a policy header would be a worse trade than a few milliseconds.
 */
let highlighterPromise: Promise<Highlighter> | null = null;
const loaded = new Set<string>();

let worker: Worker | null | undefined;
let nextJob = 0;
const pending = new Map<number, (html: string | null) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./highlight.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<{ id: number; html: string | null }>) => {
      pending.get(e.data.id)?.(e.data.html);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      // Fail the whole queue over to the main thread rather than hanging.
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function highlightInWorker(code: string, lang: string): Promise<string | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++nextJob;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ id, code, lang });
    // A grammar that never loads must not leave a block waiting forever.
    setTimeout(() => {
      if (pending.delete(id)) resolve(null);
    }, 4000);
  });
}

const ALIASES: Record<string, string> = {
  js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", py: "python",
  rb: "ruby", rs: "rust", go: "go", sh: "bash", shell: "bash", zsh: "bash",
  yml: "yaml", md: "markdown", "c++": "cpp", cs: "csharp", kt: "kotlin",
  objc: "objective-c", ps1: "powershell", psql: "sql", tf: "hcl",
  dockerfile: "docker", vue: "vue", svelte: "svelte", html: "html", css: "css",
  scss: "scss", json: "json", java: "java", php: "php", swift: "swift",
  toml: "toml", xml: "xml", graphql: "graphql", diff: "diff", ini: "ini",
  lua: "lua", r: "r", scala: "scala", perl: "perl", dart: "dart", zig: "zig",
};

const SUPPORTED = new Set(Object.values(ALIASES));

export function normalizeLang(lang?: string): string | null {
  if (!lang) return null;
  const l = lang.toLowerCase().trim();
  if (SUPPORTED.has(l)) return l;
  /* Named but not highlightable. A fence that says what it is deserves to keep
     saying it — this used to return null for `mermaid`, which dropped the
     label along with the colours and left a reader looking at unexplained
     monospace. Shiki has no grammar for it; the caption does not need one. */
  if (LABEL_ONLY.has(l)) return l;
  return ALIASES[l] ?? null;
}

/** Languages we can name but not colour. */
const LABEL_ONLY = new Set(["mermaid"]);

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((shiki) =>
      shiki.createHighlighter({
        // One theme, mapped onto our CSS variables at render time, so switching
        // light/dark is instant and never re-highlights a single block.
        themes: ["github-light"],
        langs: [],
      }),
    );
  }
  return highlighterPromise;
}

export async function highlight(code: string, lang: string): Promise<string | null> {
  const fromWorker = await highlightInWorker(code, lang);
  if (fromWorker) return recolor(fromWorker);
  return highlightOnMainThread(code, lang);
}

async function highlightOnMainThread(code: string, lang: string): Promise<string | null> {
  try {
    const hl = await getHighlighter();
    if (!loaded.has(lang)) {
      await hl.loadLanguage(lang as never);
      loaded.add(lang);
    }
    return recolor(hl.codeToHtml(code, { lang, theme: "github-light" }));
  } catch {
    return null;
  }
}

/**
 * Shiki writes literal colours. Rewriting them to token variables is what lets
 * a block follow the app's theme instantly — switching light to dark costs
 * nothing, because no block is highlighted a second time.
 */
function recolor(html: string): string {
  return html.replace(/color:(#[0-9a-fA-F]{3,8})/g, (_, hex: string) => `color:${mapColor(hex.toLowerCase())}`);
}

/** github-light's palette → our six syntax tokens. */
const COLOR_MAP: Record<string, string> = {
  "#6a737d": "var(--syn-comment)",
  "#6e7781": "var(--syn-comment)",
  "#d73a49": "var(--syn-keyword)",
  "#cf222e": "var(--syn-keyword)",
  "#032f62": "var(--syn-string)",
  "#0a3069": "var(--syn-string)",
  "#6f42c1": "var(--syn-function)",
  "#8250df": "var(--syn-function)",
  "#005cc5": "var(--syn-number)",
  "#0550ae": "var(--syn-number)",
  "#e36209": "var(--syn-type)",
  "#953800": "var(--syn-type)",
  "#22863a": "var(--syn-string)",
  "#116329": "var(--syn-string)",
  "#24292e": "var(--text-primary)",
  "#24292f": "var(--text-primary)",
  "#1f2328": "var(--text-primary)",
};

function mapColor(hex: string): string {
  return COLOR_MAP[hex] ?? "var(--text-primary)";
}
