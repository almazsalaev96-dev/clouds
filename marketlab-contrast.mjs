/**
 * Every text/background pair in MarketLab, measured against WCAG.
 *
 * The palette is not judged by eye. Each role is paired with the surfaces it
 * is actually drawn on, the contrast ratio is computed, and anything under the
 * threshold for its size fails this script. Both themes are checked, because a
 * dark theme derived by inverting a light one is how a design system quietly
 * loses a point of contrast per role.
 *
 *   node marketlab-contrast.mjs
 */
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./app/(lab)/marketlab.css", import.meta.url), "utf8");

function block(selector) {
  // Reads one `:root`-style rule out of the stylesheet, so the numbers checked
  // here are the ones that ship rather than a copy that can drift.
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`no ${selector} block`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open, close);
  const out = {};
  for (const m of body.matchAll(/(--ml-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const THEMES = {
  light: block(":root,\n[data-ml-theme=\"light\"]"),
  dark: block("[data-ml-theme=\"dark\"]"),
};

function rgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/* [foreground, background, minimum, what it is]
   4.5 for body text, 3.0 for large text and for the edge of a control. */
const PAIRS = [
  ["--ml-text", "--ml-canvas", 4.5, "body text on the page"],
  ["--ml-text", "--ml-surface", 4.5, "body text on a card"],
  ["--ml-text", "--ml-subtle", 4.5, "body text on a quiet panel"],
  ["--ml-text", "--ml-inset", 4.5, "body text on an inset"],
  ["--ml-text-2", "--ml-surface", 4.5, "secondary text on a card"],
  ["--ml-text-2", "--ml-canvas", 4.5, "secondary text on the page"],
  ["--ml-text-2", "--ml-inset", 4.5, "secondary text on an inset"],
  ["--ml-text-3", "--ml-surface", 4.5, "tertiary text on a card"],
  ["--ml-text-3", "--ml-canvas", 4.5, "tertiary text on the page"],
  ["--ml-text-4", "--ml-surface", 4.5, "faint text on a card"],
  ["--ml-text-4", "--ml-canvas", 4.5, "faint text on the page"],
  ["--ml-text-4", "--ml-inset", 4.5, "faint text on an inset"],
  ["--ml-accent", "--ml-surface", 4.5, "a link on a card"],
  ["--ml-accent", "--ml-canvas", 4.5, "a link on the page"],
  ["--ml-accent", "--ml-accent-subtle", 4.5, "the active sidebar row"],
  ["--ml-accent-fg", "--ml-accent", 4.5, "the primary button's label"],
  ["--ml-positive", "--ml-surface", 4.5, "a gain on a card"],
  ["--ml-positive", "--ml-positive-subtle", 4.5, "a gain in its own badge"],
  ["--ml-negative", "--ml-surface", 4.5, "a loss on a card"],
  ["--ml-negative", "--ml-negative-subtle", 4.5, "a loss in its own badge"],
  ["--ml-warning", "--ml-surface", 4.5, "a caution on a card"],
  ["--ml-warning", "--ml-warning-subtle", 4.5, "a caution in its own callout"],
  ["--ml-navy-fg", "--ml-navy", 4.5, "text on the deep field"],
  ["--ml-navy-fg-2", "--ml-navy", 4.5, "secondary text on the deep field"],
  ["--ml-border-strong", "--ml-surface", 3.0, "a control's edge on a card"],
  ["--ml-border-strong", "--ml-canvas", 3.0, "a control's edge on the page"],
  ["--ml-border-strong", "--ml-inset", 3.0, "a control's edge on an inset"],
  ["--ml-accent", "--ml-surface", 3.0, "the focus ring"],
  ["--ml-s1", "--ml-surface", 3.0, "chart series 1"],
  ["--ml-s2", "--ml-surface", 3.0, "chart series 2"],
  ["--ml-s3", "--ml-surface", 3.0, "chart series 3"],
  ["--ml-s4", "--ml-surface", 3.0, "chart series 4"],
  ["--ml-s5", "--ml-surface", 3.0, "chart series 5"],
];

let failed = 0;
for (const [theme, tokens] of Object.entries(THEMES)) {
  console.log(`\n${theme}`);
  for (const [fg, bg, min, label] of PAIRS) {
    const a = tokens[fg], c = tokens[bg];
    if (!a || !c) { failed++; console.log(`  ✗ ${label} — ${!a ? fg : bg} is not defined in this theme`); continue; }
    const r = ratio(a, c);
    const pass = r >= min;
    if (!pass) failed++;
    console.log(`  ${pass ? "✓" : "✗"} ${label.padEnd(36)} ${r.toFixed(2)}:1  (needs ${min})  ${a} on ${c}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
