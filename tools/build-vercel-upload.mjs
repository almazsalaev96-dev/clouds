/**
 * Same artifact as tools/build-vercel.mjs, arranged as a plain `api/` +
 * `public/` project rather than a Build Output tree.
 *
 * Only needed for a manual `vercel deploy` from a machine that is not linked
 * to the repository — a direct upload cannot carry a `.vercel/output`
 * directory. The git-linked path uses build-vercel.mjs and needs none of this.
 * Both layouts come from the same bundles, so the deployed code is identical.
 *
 *   node tools/build-vercel-upload.mjs && cd dist/upload && vercel deploy
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const OUT = "dist/upload";
execFileSync("node", ["tools/build-vercel.mjs"], { stdio: "inherit" });

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/api`, { recursive: true });
await mkdir(`${OUT}/public`, { recursive: true });

// A catch-all so the function sees the real request path, which is what the
// router matches on.
await cp(".vercel/output/functions/api/index.func/index.mjs", `${OUT}/api/[[...path]].mjs`);
for (const file of ["app.js", "styles.css", "index.html"]) {
  await cp(`.vercel/output/static/${file}`, `${OUT}/public/${file}`);
}

const sdk = JSON.parse(await readFile("node_modules/@anthropic-ai/sdk/package.json", "utf8")).version;

await writeFile(`${OUT}/package.json`, `${JSON.stringify({
  name: "understory",
  private: true,
  type: "module",
  engines: { node: ">=22" },
  dependencies: { "@anthropic-ai/sdk": `^${sdk}` },
}, null, 2)}\n`);

await writeFile(`${OUT}/vercel.json`, `${JSON.stringify({
  $schema: "https://openapi.vercel.sh/vercel.json",
  functions: { "api/[[...path]].mjs": { maxDuration: 60 } },
}, null, 2)}\n`);

console.log(`built ${OUT}`);
