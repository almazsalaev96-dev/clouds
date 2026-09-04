#!/usr/bin/env node
/* Wrap index.html (authored as an Artifact fragment) into a complete
   standalone document for static hosting, and pull in the locally
   bundled Anthropic SDK so the page can run the read with the
   reader's own API key. Run: node build-site.js */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="An Ivy League admissions evaluator built on the 1-6 reader rubric disclosed in SFFA v. Harvard. Fill in your file, get the five reader ratings, an honest probability band, and a real read of your essay.">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%F0%9F%8E%93</text></svg>">
<style>
  html{color-scheme:light dark}
  body{margin:0;font:14px system-ui,-apple-system,sans-serif}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
<script src="vendor/anthropic.js"></script>
</head>
<body>
`;

fs.mkdirSync(path.join(__dirname, "site"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "site", "index.html"), head + src + "\n</body>\n</html>\n");

const bytes = fs.statSync(path.join(__dirname, "site", "index.html")).size;
console.log("site/index.html  " + (bytes / 1024).toFixed(0) + " KB");
console.log("site/vendor/anthropic.js  " + (fs.statSync(path.join(__dirname,"site","vendor","anthropic.js")).size/1024).toFixed(0) + " KB");
