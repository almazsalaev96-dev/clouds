/**
 * The floor under everything this app builds.
 *
 * A model asked for a flashcard deck writes the deck and, on a bad day,
 * forgets the design: default Times, blue links, a button with a 1996
 * bevel, no dark theme, no focus ring. The person did not ask for a design
 * either — they asked for flashcards and assumed they would look like
 * something. So every made page gets this first, before its own styles,
 * and its own styles win wherever they say anything. What the model does not
 * mention is not left to the browser's 1996; it is left to this.
 *
 * Tokens, then defaults. The tokens are named in the build instructions, so
 * a model can use `var(--accent)` and get the same accent every other made
 * thing has, in both themes, without inventing a palette. The defaults are
 * for elements only — no classes, because a class the model does not know
 * about is a class it will never use.
 */
export const BASE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #fafafa; --surface: #ffffff; --surface-2: #f2f2f3; --fg: #1a1a1c; --muted: #6b6b70;
  --line: #e2e2e6; --line-strong: #c9c9cf; --accent: #4f6bff; --accent-fg: #ffffff; --accent-soft: #e9edff;
  --ok: #1f8f4e; --bad: #d23f3f; --warn: #b7791f;
  --radius: 12px; --radius-sm: 8px; --shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px -12px rgba(0,0,0,.18);
  --font: system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121214; --surface: #1b1b1f; --surface-2: #242429; --fg: #ececf0; --muted: #9a9aa3;
    --line: #2c2c33; --line-strong: #3d3d46; --accent: #8fa2ff; --accent-fg: #0f1330; --accent-soft: #23284a;
    --ok: #4cc27a; --bad: #ff6b6b; --warn: #e0a84a;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] {
  --bg: #121214; --surface: #1b1b1f; --surface-2: #242429; --fg: #ececf0; --muted: #9a9aa3;
  --line: #2c2c33; --line-strong: #3d3d46; --accent: #8fa2ff; --accent-fg: #0f1330; --accent-soft: #23284a;
  --ok: #4cc27a; --bad: #ff6b6b; --warn: #e0a84a;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; min-height: 100vh; background: var(--bg); color: var(--fg);
  font: 16px/1.5 var(--font); -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4 { line-height: 1.2; margin: 0 0 .5em; font-weight: 600; letter-spacing: -.01em; }
h1 { font-size: 1.75rem; } h2 { font-size: 1.25rem; } h3 { font-size: 1.05rem; }
p { margin: 0 0 1em; }
a { color: var(--accent); }
img, svg, video, canvas { max-width: 100%; height: auto; }
code, pre, kbd { font-family: var(--mono); font-size: .9em; }
pre { overflow: auto; padding: .75rem 1rem; border-radius: var(--radius-sm); background: var(--surface-2); }
hr { border: 0; border-top: 1px solid var(--line); margin: 1.5rem 0; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid var(--line); }
button, input, select, textarea { font: inherit; color: inherit; }
button {
  min-height: 2.5rem; padding: 0 1rem; border-radius: 999px; border: 1px solid var(--line-strong);
  background: var(--surface); cursor: pointer; transition: background-color .15s, border-color .15s, transform .08s;
}
button:hover { background: var(--surface-2); }
button:active { transform: translateY(1px); }
button:disabled { opacity: .5; cursor: default; transform: none; }
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea {
  min-height: 2.5rem; padding: .5rem .75rem; border-radius: var(--radius-sm); border: 1px solid var(--line-strong);
  background: var(--surface);
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
::selection { background: var(--accent-soft); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
`.trim();

/** The tag that carries it, first in <head> so everything after it wins. */
export function baseTag(): string {
  return `<style data-armi-base>\n${BASE_CSS}\n</style>`;
}

/**
 * The same tokens, said to the model. Short, because the instruction block
 * is read on every build and a stylesheet in it would be paid for a thousand
 * times; specific, because "use nice colours" is not an instruction.
 */
export const BASE_BRIEF =
  "A base stylesheet is already applied to everything you build, before your own styles: system font at 16px/1.5, " +
  "light and dark themes, sensible buttons, inputs, tables and focus rings. Build on it rather than fighting it. " +
  "Use its custom properties for colour so the thing matches both themes without any work: " +
  "var(--bg) page, var(--surface) cards, var(--surface-2) wells, var(--fg) text, var(--muted) secondary text, " +
  "var(--line) borders, var(--accent) and var(--accent-fg) for the one primary action, var(--accent-soft) for a tint, " +
  "var(--ok) / var(--bad) / var(--warn) for states, var(--radius) for corners, var(--shadow) for a lifted card. " +
  "Never hard-code a palette of your own unless the person asked for particular colours.";
