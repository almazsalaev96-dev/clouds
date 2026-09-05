/**
 * Bundles the app into one self-contained HTML file.
 *
 * Resolution plugin does two jobs: point "@/..." at the Next app's source so the
 * real pages are reused verbatim, and swap the two Next modules those pages import
 * for the local shims.
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '../web');
const outHtml = resolve(here, 'dist/index.html');

const resolvePlugin = {
  name: 'atlas-resolve',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^next\/link$/ }, () => ({
      path: resolve(here, 'shims/next-link.tsx'),
    }));
    pluginBuild.onResolve({ filter: /^next\/navigation$/ }, () => ({
      path: resolve(here, 'shims/next-navigation.ts'),
    }));
    // esbuild does not apply resolveExtensions to plugin-returned paths, so the
    // "@/lib/study" -> file mapping has to find the extension itself.
    pluginBuild.onResolve({ filter: /^@\// }, (args) => {
      const base = resolve(webRoot, args.path.slice(2));
      for (const candidate of [
        base,
        `${base}.tsx`,
        `${base}.ts`,
        `${base}/index.tsx`,
        `${base}/index.ts`,
      ]) {
        if (existsSync(candidate) && !candidate.endsWith('/')) {
          return { path: candidate, namespace: 'file' };
        }
      }
      return { errors: [{ text: `Could not resolve ${args.path} under ${webRoot}` }] };
    });
  },
};

const result = await build({
  entryPoints: [resolve(here, 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2022'],
  jsx: 'automatic',
  platform: 'browser',
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  plugins: [resolvePlugin],
  logLevel: 'info',
});

const js = result.outputFiles[0].text;
const css = await readFile(resolve(webRoot, 'app/globals.css'), 'utf8');

const html = `<title>Atlas</title>
<meta name="description" content="Spaced retrieval, exam-weighted practice, and honest feedback for every subject." />
<style>
${css}
</style>
<div id="root"><div class="empty">Loading Atlas…</div></div>
<script>
${js}
</script>
`;

await mkdir(dirname(outHtml), { recursive: true });
await writeFile(outHtml, html, 'utf8');
console.log(`\nwrote ${outHtml} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
