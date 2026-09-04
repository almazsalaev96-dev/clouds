/**
 * Builds the Vercel deployment using the Build Output API (v3).
 *
 * Emitting `.vercel/output` directly, rather than relying on framework
 * detection, means the platform does not have to reproduce anything about the
 * local workflow — in particular Node 22's TypeScript type stripping and the
 * explicit `.ts` import specifiers it allows. The server is bundled to one
 * file here; the platform just runs it.
 */

import { build } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const OUT = ".vercel/output";
const FN = `${OUT}/functions/api/index.func`;

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/static`, { recursive: true });
await mkdir(FN, { recursive: true });

// ── the API, as one bundled function ────────────────────────────────────────
const serverBuild = await build({
  entryPoints: ["packages/server/src/vercel.ts"],
  outfile: `${FN}/index.mjs`,
  metafile: true,
  bundle: true,
  platform: "node",
  // ESM rather than CJS: the codebase uses `import.meta`, which a CJS bundle
  // leaves empty — and an empty one turns a module-scope `new URL(...)` into a
  // throw that kills the function on cold start.
  format: "esm",
  target: "node22",
  minify: true,
  lineLimit: 500,
  legalComments: "none",
  logLevel: "warning",
  // Everything is bundled, including the SDK. A Build Output `.func` directory
  // is self-contained — there is no node_modules beside it — so a bare import
  // left unbundled resolves fine locally against the repo root and then fails
  // at runtime with ERR_MODULE_NOT_FOUND on the first request.
});

// Guard for exactly that. esbuild's metafile reports what it left unresolved,
// which is exact — scanning the minified output for `from "..."` matches string
// literals and regexes too, and reports imports that do not exist.
const unresolved = Object.entries(serverBuild.metafile.outputs)
  .flatMap(([, out]) => out.imports ?? [])
  .filter((imp) => imp.external && !imp.path.startsWith("node:"))
  .map((imp) => imp.path);

if (unresolved.length > 0) {
  throw new Error(
    "The function bundle still imports packages that will not exist at runtime: " +
    `${[...new Set(unresolved)].join(", ")}. A Build Output .func directory has no ` +
    "node_modules beside it, so these must be bundled.",
  );
}

// ── the client, served statically ───────────────────────────────────────────
await build({
  entryPoints: ["apps/web/app.js"],
  outfile: `${OUT}/static/app.js`,
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  lineLimit: 500,
  logLevel: "warning",
});

await build({
  entryPoints: ["apps/web/styles.css"],
  outfile: `${OUT}/static/styles.css`,
  minify: true,
  lineLimit: 500,
  logLevel: "warning",
});

await cp("apps/web/index.html", `${OUT}/static/index.html`);

// ── routing ─────────────────────────────────────────────────────────────────
await writeFile(`${OUT}/config.json`, `${JSON.stringify({
  version: 3,
  routes: [
    // Static assets win; everything under /api reaches the function with its
    // original path intact, which is what the router matches on.
    { handle: "filesystem" },
    { src: "/api/(.*)", dest: "/api/index" },
    // Anything else is the client shell.
    { src: "/(.*)", dest: "/index.html" },
  ],
}, null, 2)}\n`);

console.log(`built ${OUT}`);
