/**
 * Builds the browser app into one self-contained HTML file.
 *
 * Two outputs from one source: a complete document for opening off disk or
 * hosting, and a body-only fragment for publishing as an Artifact. Both carry
 * the identical style and script, so what gets tested is what gets published.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");

const css = readFileSync(resolve(root, "src/app/app.css"), "utf8");
const js = bundle([resolve(root, "src/app/main.js")]);

const TITLE = "Slate — Study Workspace";
const DESCRIPTION =
  "A study workspace with a real marker, a real memory model and a real diagnostic. " +
  "Write with a Pencil, get told what specifically went wrong, and watch mastery decay honestly.";

const head = `<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<style>
${css}</style>`;

const shell = `<div id="app"></div>
<noscript><p style="padding:24px">Slate needs JavaScript: the grader and the learning model run in your browser, not on a server.</p></noscript>
<script>
${js}</script>`;

mkdirSync(dist, { recursive: true });

writeFileSync(resolve(dist, "slate.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
${head}
</head>
<body>
${shell}
</body>
</html>
`);

writeFileSync(resolve(dist, "artifact.html"), `${head}\n${shell}\n`);

// A static host serves `/` from index.html, so the same document is written under
// both names: `slate.html` for opening off disk, `index.html` for deploying.
writeFileSync(resolve(dist, "index.html"), readFileSync(resolve(dist, "slate.html")));

const size = (name) => (readFileSync(resolve(dist, name)).length / 1024).toFixed(1);
console.log(`slate.html / index.html  ${size("slate.html")} kB`);
console.log(`artifact.html            ${size("artifact.html")} kB`);
