/**
 * A long source is read whole, in parts, by the cheapest model that can.
 *
 *   npx jiti test-digest.ts
 */
import { partsOf, spread, PART, WHOLE, MAX_PARTS } from "./lib/digest";
import { reader } from "./lib/route";
import { MODELS } from "./lib/models";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nSplitting a book");
{
  const para = "The moon pulls the near water toward it and the far water away. It is the cause of the tides.\n\n";
  const book = para.repeat(3_200); // ~300k characters
  const parts = partsOf(book);
  check(parts.length >= 5 && parts.length <= 7, "about three hundred thousand characters becomes five or six parts", `${parts.length} parts`);
  check(parts.every((p) => p.length <= PART), "none of them bigger than a part", `${Math.max(...parts.map((p) => p.length))}`);
  check(parts.join("") === book, "and nothing is lost or repeated at the seams");
  check(parts.slice(0, -1).every((p) => p.endsWith("\n") || p.endsWith(". ") || p.endsWith(".")), "each cut falls at a paragraph or a sentence, not mid-word");
  check(partsOf("short").length === 1, "a short text is one part");
  check(WHOLE > PART, "material under the whole-send line is never read in parts");
}

console.log("\nMore parts than can be read");
{
  const many = Array.from({ length: 200 }, (_, i) => i);
  const got = spread(many, MAX_PARTS);
  check(got.length === MAX_PARTS, `an even spread of ${MAX_PARTS}`, `${got.length}`);
  check(got[0] === 0 && got[got.length - 1] > 190, "from the first part to near the last, not the first forty-eight", `${got[0]}…${got[got.length - 1]}`);
}

console.log("\nWho reads");
{
  const ctx = { configured: { anthropic: true, openai: true } as Record<string, boolean>, keys: {} };
  const id = reader(ctx, PART);
  const m = MODELS.find((x) => x.id === id);
  check(Boolean(m), "a model is chosen when keys are held", id ?? "none");
  const need = Math.ceil(PART / 3.2) + 8_000;
  check(Boolean(m) && m!.contextWindow >= need, "its window holds a part with room to spare", `${m?.contextWindow}`);
  const cheaper = MODELS.filter((x) => (x.provider === "anthropic" || x.provider === "openai") && !x.legacy && x.contextWindow >= need && x.priceIn + x.priceOut < m!.priceIn + m!.priceOut);
  check(cheaper.length === 0, "and nothing cheaper could have done it", cheaper.map((c) => c.id).join(", "));
  check(reader({ configured: {}, keys: {} }, PART) === null, "with no key, nothing is chosen and the caller keeps the old slice");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
