/**
 * Fold the preview build into one file.
 *
 * `npm run build:preview` emits a page, a script, a stylesheet and the fonts. An
 * artifact is a single document, so the script and the stylesheet are inlined and
 * every font becomes a data URI — the page then has no second request to make, which
 * is also why it works offline.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const build = join(here, '..', 'dist-preview')
const out = process.argv[2] || join(build, 'margin-preview.html')

const assets = await readdir(join(build, 'assets'))
const js = assets.find(f => f.endsWith('.js'))
const css = assets.find(f => f.endsWith('.css'))
if (!js || !css) throw new Error('build the preview first: npm run build:preview')

let style = await readFile(join(build, 'assets', css), 'utf8')
let fonts = 0
for (const file of await readdir(join(build, 'fonts'))) {
  const data = await readFile(join(build, 'fonts', file))
  const uri = `data:font/woff2;base64,${data.toString('base64')}`
  const before = style
  style = style.split(`/fonts/${file}`).join(uri)
  if (style !== before) fonts++
}

/**
 * Inline JavaScript is read with whatever encoding the page is served as. A single
 * "Ø" decoded as Latin-1 is a syntax error, and the whole program fails to parse —
 * so the script is escaped to ASCII and cannot be misread. `\uXXXX` is valid in a
 * string and in an identifier alike, so the meaning is unchanged.
 *
 * "</script" is escaped for the same reason: left alone it closes the tag early.
 */
const toAscii = (source) => source.replace(/[^\x00-\x7F]/g, (ch) =>
  `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)

const script = toAscii(await readFile(join(build, 'assets', js), 'utf8'))
  .split('</script').join('<\\/script')

const page = `<title>Margin</title>
<style>
${style}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`
await writeFile(out, page)
const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`
console.log(`${out}\n  script ${kb(script)} · style ${kb(style)} (${fonts} fonts inlined) · page ${kb(page)}`)
