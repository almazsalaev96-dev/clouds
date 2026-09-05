/**
 * Build the single-file version.
 *
 * Compiles the same components and engines the Next app uses into one
 * self-contained HTML page: content bundle inlined as JSON, stylesheet inlined,
 * JavaScript bundled by esbuild. The output can be opened with no server, no
 * install and no network.
 *
 *   node artifact/build.mjs   →   artifact/dist/lodestar.html
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- 1. load and validate the content packs -------------------------------
// Imported from the real loader rather than reimplemented, so the published
// page and the served app can never disagree about what loaded. Run this
// script under tsx (see the npm script) so the TypeScript import resolves.
const { loadAllPacks, summariseDiagnostics } = await import(join(root, "src/content/loader.ts"));

const packs = loadAllPacks();
const diagnostics = packs.flatMap((p) => p.diagnostics);
const counts = summariseDiagnostics(diagnostics);

if (counts.errors > 0) {
  console.error(`Refusing to build: ${counts.errors} content error(s). Run npm run content:check.`);
  process.exit(1);
}

const bundle = {
  packs: packs.map((p) => ({ manifest: p.manifest, stats: p.stats })),
  syllabuses: packs.flatMap((p) => p.syllabuses.map((s) => ({ ...s, packId: p.manifest.id }))),
  questions: packs.flatMap((p) => p.questions),
  lessons: packs.flatMap((p) => p.lessons),
  cards: packs.flatMap((p) => p.cards),
  glossary: packs.flatMap((p) => p.glossary),
  diagnostics: counts,
};

const buildInfo = {
  builtAt: new Date().toISOString().slice(0, 10),
  errors: counts.errors,
  warnings: counts.warnings,
};

// --- 2. bundle the application --------------------------------------------
const result = await build({
  entryPoints: [join(root, "artifact/entry.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  jsx: "automatic",
  write: false,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    __CONTENT__: JSON.stringify(bundle),
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  alias: {
    // Route the framework imports at the shims; everything else resolves as usual.
    "next/link": join(root, "artifact/shims/next-link.tsx"),
    "next/navigation": join(root, "artifact/shims/next-navigation.ts"),
    "server-only": join(root, "artifact/shims/server-only.ts"),
  },
  loader: { ".css": "text" },
  logLevel: "warning",
});

const js = result.outputFiles[0].text;
const css = readFileSync(join(root, "app/globals.css"), "utf8");

// --- 3. compose one file ---------------------------------------------------
const stats = bundle.packs.reduce(
  (acc, p) => ({
    questions: acc.questions + p.stats.questions,
    marks: acc.marks + p.stats.questionMarks,
    topics: acc.topics + p.stats.topics,
  }),
  { questions: 0, marks: 0, topics: 0 },
);

const html = `<title>Lodestar</title>
<meta name="description" content="An adaptive exam-learning system for Cambridge IGCSE, AS and A Level.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
${css}

/* The single-file build has no server-rendered shell, so the mount point
   carries the layout that <body> would otherwise receive. */
#root { min-height: 100vh; }
#boot { padding: 48px 32px; font-family: var(--sans); color: var(--muted); }
</style>

<div id="root"><div id="boot">Loading Lodestar…</div></div>

<script>
${js}
</script>
`;

mkdirSync(join(root, "artifact/dist"), { recursive: true });
const out = join(root, "artifact/dist/lodestar.html");
writeFileSync(out, html);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Built ${out}`);
console.log(`  ${stats.topics} topics · ${stats.questions} questions · ${stats.marks} marks`);
console.log(`  js ${kb(js.length)} · css ${kb(css.length)} · total ${kb(html.length)}`);
if (counts.warnings) console.log(`  ${counts.warnings} content warning(s)`);
