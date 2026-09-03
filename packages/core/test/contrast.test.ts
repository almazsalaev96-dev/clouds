import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AA_NORMAL, PALETTES, SPEC_TOKENS, SURFACE_TOKENS, TEXT_TOKENS, contrast,
} from "../../../tools/contrast.js";

test("every text colour clears WCAG AA on every surface it can sit on", () => {
  const failures: string[] = [];
  for (const [mode, palette] of Object.entries(PALETTES)) {
    for (const text of TEXT_TOKENS) {
      for (const surface of SURFACE_TOKENS) {
        const ratio = contrast(palette[text], palette[surface]);
        if (ratio < AA_NORMAL) {
          failures.push(`${mode}: ${text} on ${surface} = ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
  assert.deepEqual(failures, [], `contrast failures:\n${failures.join("\n")}`);
});

test("the corrected tokens are genuinely a fix, not a preference", () => {
  // The values §28 supplied fail; the shipped ones pass. Recording both makes
  // the departure checkable rather than a claim in a document.
  assert.ok(contrast(SPEC_TOKENS.light.text3, PALETTES.light.surface) < AA_NORMAL);
  assert.ok(contrast(SPEC_TOKENS.light.accent, PALETTES.light.surface) < AA_NORMAL);
  assert.ok(contrast(SPEC_TOKENS.light.ai, PALETTES.light.surface) < AA_NORMAL);
  assert.ok(contrast(SPEC_TOKENS.dark.text3, PALETTES.dark.surface) < AA_NORMAL);

  assert.ok(contrast(PALETTES.light.text3, PALETTES.light.surface) >= AA_NORMAL);
  assert.ok(contrast(PALETTES.dark.text3, PALETTES.dark.surface) >= AA_NORMAL);
});

test("the stylesheet actually uses the verified values", async () => {
  const css = await (await import("node:fs/promises")).readFile("apps/web/styles.css", "utf8");
  for (const [mode, palette] of Object.entries(PALETTES)) {
    for (const [token, value] of Object.entries(palette)) {
      assert.ok(
        css.includes(value),
        `${mode} ${token} (${value}) is verified here but missing from styles.css`,
      );
    }
  }
});
