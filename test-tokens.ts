/* Every custom property a component points at is one the stylesheet defines.
 *
 * `var(--subtle)` renders as nothing. Not an error, not a warning, not a
 * fallback — the declaration is simply dropped, and the element keeps
 * whatever it would have had. So a typo in a token name is invisible in
 * review, invisible in the type checker, and invisible on screen unless the
 * thing it was painting happened to be the thing you were looking at.
 *
 * Two have been found by eye so far: `--gold`, left behind by a palette
 * change, and `--subtle` for `--bg-subtle`, which meant the twelve-week
 * calendar never drew its own grid. This is the check that finds the third.
 *
 *   npx jiti test-tokens.ts */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
};

const css = readFileSync("app/globals.css", "utf8");
/* `components` and `app` only. `lib` holds prompt text — the canvas brief
   describes a stylesheet for the *model* to write, with its own `--bg` and
   `--fg` that this app never defines and never should. Scanning it finds
   six tokens that are not bugs. */
const files = [...walk("components"), ...walk("app")];

/* Defined: anything declared in the stylesheet, plus anything a component
   sets on itself — Tailwind's arbitrary-property syntax `[--ctl:2rem]`, an
   inline `style={{ "--x": … }}`, and `@property` registrations. */
const defined = new Set<string>();
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) defined.add(m[1]);
for (const m of css.matchAll(/@property\s+(--[a-z0-9-]+)/gi)) defined.add(m[1]);
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\[(--[a-z0-9-]+):/gi)) defined.add(m[1]);
  for (const m of src.matchAll(/["']?(--[a-z0-9-]+)["']?\s*:\s*[`"'{]/gi)) defined.add(m[1]);
}

/* Tailwind writes its own, and a `var(--tw-…)` is never ours to define. */
const ours = (name: string) => !name.startsWith("--tw-");

console.log("\nThe stylesheet defines what the app asks for");
{
  const missing: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,|\))/gi)) {
        const name = m[1];
        /* A `var(--x, fallback)` says out loud that it may not exist. */
        if (m[2] === ",") continue;
        if (!ours(name) || defined.has(name)) continue;
        missing.push(`${f}:${i + 1} ${name}`);
      }
    });
  }
  check(missing.length === 0,
    "every token a component paints with is one the stylesheet declares",
    missing.slice(0, 6).join(" · ") || `${defined.size} tokens defined`);
}

console.log("\nAnd the stylesheet is not carrying tokens nothing asks for");
{
  /* The other direction, as a warning rather than a failure: a token defined
     in one theme and not the other is a real bug, and one defined in both and
     used nowhere is only clutter. Only the first is worth failing on. */
  /* The two blocks themselves, found by matching braces from each selector.
     Splitting the file at the dark selector's index was the first attempt and
     was wrong: everything after it counted as dark, including the `@theme`
     block further down, so Tailwind's whole type scale read as dark-only. */
  const block = (selector: string): Set<string> => {
    const at = css.indexOf(selector);
    if (at < 0) return new Set();
    const open = css.indexOf("{", at);
    let depth = 0, end = open;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) { end = i; break; }
    }
    const body = css.slice(open, end);
    return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  };
  const light = block(":root {");
  const dark = block(':root[data-theme="dark"]');
  /* Derived values live in one block or the other legitimately; what must
     match is the colour vocabulary both themes are read against. */
  const colourish = (n: string) => /^--(bg|text|border|accent|syn|chart|danger|success|warning|highlight|mark|rim|glass|mesh|composer)/.test(n);
  const onlyLight = [...light].filter((n) => colourish(n) && !dark.has(n));
  const onlyDark = [...dark].filter((n) => colourish(n) && !light.has(n));
  check(onlyLight.length === 0 && onlyDark.length === 0,
    "and both themes define the same colour vocabulary, so neither falls back to the other's",
    [...onlyLight.map((n) => `light only: ${n}`), ...onlyDark.map((n) => `dark only: ${n}`)].slice(0, 8).join(" · ") || "matched");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
