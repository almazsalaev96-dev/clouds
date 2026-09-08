import type { Highlighter } from "shiki";

/**
 * One highlighter instance for the whole app, loaded lazily and only for the
 * languages actually seen. Shiki's full grammar set is megabytes; a chat that
 * shows one Python block should not pay for Haskell.
 *
 * Note on the worker: the master prompt calls for highlighting off the main
 * thread. This runs on the main thread, but never during a stream — blocks
 * render as plain monospace until 60ms after the last token, so the streaming
 * frame budget is untouched either way. Moving it to a worker is a contained
 * change behind this module and is the right next step for very large files.
 */
let highlighterPromise: Promise<Highlighter> | null = null;
const loaded = new Set<string>();

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
  return ALIASES[l] ?? null;
}

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
  try {
    const hl = await getHighlighter();
    if (!loaded.has(lang)) {
      await hl.loadLanguage(lang as never);
      loaded.add(lang);
    }
    return hl.codeToHtml(code, {
      lang,
      theme: "github-light",
      transformers: [
        {
          // Shiki writes literal colors. We rewrite them to token variables so
          // the block follows the app's theme with no second highlight pass.
          span(node) {
            const style = (node.properties.style as string) ?? "";
            const color = style.match(/color:(#[0-9a-fA-F]{3,8})/)?.[1]?.toLowerCase();
            if (color) node.properties.style = `color:${mapColor(color)}`;
          },
        },
      ],
    });
  } catch {
    return null;
  }
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
