/**
 * The build, such as it is.
 *
 * There is no bundler and no transform: `src/app.html` is the app, and this
 * writes it out twice — once wrapped in a document for a browser or a static
 * host, once bare for publishing as an Artifact. The compatibility gate runs
 * first and fails the build, because the alternative is finding out on an iPad.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, report } from "./compat.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/app.html"), "utf8");

if (!report(audit(source, "src/app.html"))) {
  console.error("\nBuild stopped: the app uses something older iPads cannot run.");
  process.exit(1);
}

const dist = resolve(root, "dist");
mkdirSync(dist, { recursive: true });

// The fragment is head material (title, styles) then body material. Splitting on
// the style close is exact for this file, and asserted rather than assumed.
const split = source.indexOf("</style>");
if (split === -1) {
  console.error("Build stopped: src/app.html has no </style> to split on.");
  process.exit(1);
}
const head = source.slice(0, split + "</style>".length).trim();
const body = source.slice(split + "</style>".length).trim();

writeFileSync(resolve(dist, "index.html"), [
  "<!doctype html>",
  '<html lang="en">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="description" content="Recall: paste your notes, get questions, and be asked again at the moment you are about to forget.">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="theme-color" content="#f7f5ef" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#131314" media="(prefers-color-scheme: dark)">',
  head,
  "</head>",
  "<body>",
  body,
  "</body>",
  "</html>",
  ""
].join("\n"));

writeFileSync(resolve(dist, "artifact.html"), source);

const size = (name) => (readFileSync(resolve(dist, name)).length / 1024).toFixed(1);
console.log(`  ok    dist/index.html    ${size("index.html")} kB`);
console.log(`  ok    dist/artifact.html ${size("artifact.html")} kB`);
