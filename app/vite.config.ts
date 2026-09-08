import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Two builds from one source.
 *
 * The default build talks to the API over HTTP. `--mode preview` builds the same
 * interface with the marking and pedagogy engines compiled into the page, so it runs
 * with no server at all — the aliases below are what let server code, which is plain
 * ES modules, load in a browser.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: mode === 'preview'
      ? {
          'node:crypto': here('./src/preview/node-crypto.ts'),
          'node:sqlite': here('./src/preview/sqlite.ts'),
          'node:fs': here('./src/preview/node-fs.ts'),
          'node:path': here('./src/preview/node-path.ts'),
          'node:url': here('./src/preview/node-url.ts'),
        }
      : {},
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
    sourcemap: mode !== 'preview',
    // One page, one script: the preview is published as a single file.
    assetsInlineLimit: mode === 'preview' ? 0 : 4096,
    rollupOptions: mode === 'preview'
      ? { input: here('./preview.html'), output: { inlineDynamicImports: true } }
      : {},
  },
}))
